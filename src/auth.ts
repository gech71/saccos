
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "./lib/prisma";
import bcrypt from "bcryptjs";
import type { AuthUser, MemberAuthUser } from "./types";
import type { Role } from '@prisma/client';
import { permissionsList } from "./app/(app)/settings/permissions";
import { differenceInMinutes } from 'date-fns';
import { rateLimitCheck, rateLimitReset, rateLimitDelay } from './lib/rate-limit';

function toLocalPhone(phone?: string | null) {
  if (!phone) return "";
  const p = phone.trim();
  if (p.startsWith("+251")) {
    const rest = p.slice(4);
    return rest ? `0${rest}` : p;
  }
  return p;
}

function toIntlPhone(phone?: string | null) {
  if (!phone) return "";
  const p = phone.trim();
  if (p.startsWith("+251")) return p;
  if (/^0[79]\d{8}$/.test(p)) return `+251${p.slice(1)}`;
  return p;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 15 * 60, // 15 minutes
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        phoneNumber: { label: "Phone Number", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        const phoneNumber = credentials?.phoneNumber;
        const password = credentials?.password;

        if (!phoneNumber || !password) return null;

        const phoneLocal = toLocalPhone(String(phoneNumber ?? ''));
        const phoneIntl = toIntlPhone(String(phoneNumber ?? ''));
        
        const now = new Date();

        // Extract client IP from request (second arg passed to authorize)
        // Support multiple header names used by proxies/CDNs.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req: any = arguments[1];
        let ip = 'unknown';
        try {
          const headers = req?.headers || req?.req?.headers || {};
          const headerCandidates = ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'x-vercel-forwarded-for', 'x-forwarded'];
          let forwarded = '';
          for (const h of headerCandidates) {
            const val = headers[h] || headers[h.toLowerCase()];
            if (val) {
              forwarded = Array.isArray(val) ? String(val[0]) : String(val);
              break;
            }
          }
          if (forwarded) {
            ip = forwarded.split(',')[0].trim();
          } else if (req?.socket?.remoteAddress) {
            ip = req.socket.remoteAddress;
          } else if (req?.connection?.remoteAddress) {
            ip = req.connection.remoteAddress;
          }
          if (!ip) ip = 'unknown';
        } catch (e) {
          ip = 'unknown';
        }

        // Rate limiting: enforce per-IP and per-phone limits before credential checks
        try {
          const ipKey = `rl:ip:${ip}`;
          const phoneKey = `rl:phone:${phoneLocal || phoneIntl}`;
          const ipLimit = Number(process.env.RATE_LIMIT_IP_LIMIT || 50);
          const phoneLimit = Number(process.env.RATE_LIMIT_PHONE_LIMIT || 10);
          const windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 15 * 60);

          const ipCheck = await rateLimitCheck(ipKey, ipLimit, windowSeconds);
          if (!ipCheck.allowed) {
            throw new Error('Too many requests from your network. Try again later.');
          }

          const phoneCheck = await rateLimitCheck(phoneKey, phoneLimit, windowSeconds);
          if (!phoneCheck.allowed) {
            throw new Error('Too many failed attempts for this account. Try again later.');
          }
        } catch (rlErr: any) {
          // If the rate limiter fails, log and continue to avoid locking out legit users.
          // eslint-disable-next-line no-console
          console.warn('Rate limiter error:', rlErr);
        }

        // 1. ADMIN USER LOGIN
        let adminUser = await prisma.user.findFirst({
          where: { OR: [{ phoneNumber: phoneLocal }, { phoneNumber: phoneIntl }] },
        });

        if (adminUser) {
           if (adminUser.lockoutUntil && adminUser.lockoutUntil > now) {
            const minutesLeft = differenceInMinutes(adminUser.lockoutUntil, now);
            throw new Error(`Account is temporarily locked. Please try again in ${minutesLeft} minutes.`);
          }
          
          const match = adminUser.password && (await bcrypt.compare(String(password ?? ''), String(adminUser.password ?? '')));
          if (match) {
             await prisma.user.update({
              where: { id: adminUser.id },
              data: { failedLoginAttempts: 0, lockoutUntil: null },
            });
            // Reset rate limiter counters on successful login
            try {
              const ipKey = `rl:ip:${ip}`;
              const phoneKey = `rl:phone:${phoneLocal || phoneIntl}`;
              await Promise.all([rateLimitReset(ipKey), rateLimitReset(phoneKey)]);
            } catch (e) {
              // ignore rate limit reset errors
            }
            
            const userRoles: Role[] = await prisma.role.findMany({
              where: { users: { some: { id: adminUser.id } } },
            });

            const permissions = new Set<string>();
            const isAdmin = userRoles.some(r => r.name === "Admin");

            if (isAdmin) {
              permissionsList.forEach(p => permissions.add(p.id));
            } else {
              userRoles.forEach(role => {
                role.permissions.split(",").forEach(p => p && permissions.add(p));
              });
            }

            return {
              id: adminUser.id,
              name: adminUser.name,
              email: adminUser.email,
              phoneNumber: adminUser.phoneNumber,
              isMember: false,
              roles: userRoles.map(r => r.name),
              permissions: Array.from(permissions),
            } as AuthUser;
          } else {
            const newAttemptCount = (adminUser.failedLoginAttempts || 0) + 1;
            if (newAttemptCount >= MAX_FAILED_ATTEMPTS) {
              await prisma.user.update({
                where: { id: adminUser.id },
                data: {
                  failedLoginAttempts: newAttemptCount,
                  lockoutUntil: new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000),
                },
              });
              await rateLimitDelay(300);
              throw new Error(`Account is temporarily locked due to too many failed login attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`);
            } else {
              await prisma.user.update({
                where: { id: adminUser.id },
                data: { failedLoginAttempts: newAttemptCount },
              });
              await rateLimitDelay(200);
            }
          }
        }

        // 2. MEMBER LOGIN
        let member = await prisma.member.findFirst({
          where: { OR: [{ phoneNumber: phoneLocal }, { phoneNumber: phoneIntl }] },
        });

        if (member) {
           if (member.lockoutUntil && member.lockoutUntil > now) {
            const minutesLeft = differenceInMinutes(member.lockoutUntil, now);
            throw new Error(`Account is temporarily locked. Please try again in ${minutesLeft} minutes.`);
          }
          
          const match = member.password && (await bcrypt.compare(String(password ?? ''), String(member.password ?? '')));
          if (match) {
             await prisma.member.update({
              where: { id: member.id },
              data: { failedLoginAttempts: 0, lockoutUntil: null },
            });
            // Reset rate limiter counters on successful login
            try {
              const ipKey = `rl:ip:${ip}`;
              const phoneKey = `rl:phone:${phoneLocal || phoneIntl}`;
              await Promise.all([rateLimitReset(ipKey), rateLimitReset(phoneKey)]);
            } catch (e) {
              // ignore
            }
            
            return {
              id: member.id,
              name: member.fullName,
              email: member.email,
              phoneNumber: member.phoneNumber,
              isMember: true,
              mustChangePassword: member.mustChangePassword ?? false, // Ensure it's a boolean
            } as MemberAuthUser;
          } else {
            const newAttemptCount = (member.failedLoginAttempts || 0) + 1;
            if (newAttemptCount >= MAX_FAILED_ATTEMPTS) {
              await prisma.member.update({
                where: { id: member.id },
                data: {
                  failedLoginAttempts: newAttemptCount,
                  lockoutUntil: new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000),
                },
              });
              await rateLimitDelay(300);
              throw new Error(`Account is temporarily locked due to too many failed login attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`);
            } else {
              await prisma.member.update({
                where: { id: member.id },
                data: { failedLoginAttempts: newAttemptCount },
              });
              await rateLimitDelay(200);
            }
          }
        }

        // Artificial delay for failed attempts on non-existent users
        await new Promise(resolve => setTimeout(resolve, 300));
        return null;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) token.user = user;
      return token;
    },

    async session({ session, token }) {
      session.user = token.user as any;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});

export const { GET, POST } = handlers;
