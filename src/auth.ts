
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "./lib/prisma";
import bcrypt from "bcryptjs";
import type { AuthUser, MemberAuthUser } from "./types";
import type { Role } from '@prisma/client';
import { permissionsList } from "./app/(app)/settings/permissions";
import { differenceInMinutes } from 'date-fns';

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

const MAX_FAILED_ATTEMPTS_PER_ACCOUNT = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const MAX_ATTEMPTS_PER_IP = 50;

// This helper function sets a cookie on the response to show specific errors on the client.
// This is necessary because NextAuth's default error handling is too generic.
function setAuthErrorCookie(req: any, message: string, durationMinutes: number) {
    try {
        const res = req?.res || req?.req?.res;
        if (res && typeof res.setHeader === 'function') {
            const cookie = `auth_error=${encodeURIComponent(message)}; Path=/; Max-Age=${60 * durationMinutes}; SameSite=Lax`;
            const prev = res.getHeader && res.getHeader('Set-Cookie');
            const existing = Array.isArray(prev) ? prev : (prev ? [String(prev)] : []);
            res.setHeader('Set-Cookie', [...existing, cookie]);
        }
    } catch (e) {
        console.error('Failed to set auth error cookie:', e);
    }
}

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

        const now = new Date();
        
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
          }
        } catch (e) {
          ip = 'unknown';
        }

        // --- RATE LIMITING: IP Address ---
        const ipWindowStart = new Date(now.getTime() - LOCKOUT_DURATION_MINUTES * 60 * 1000);
        const ipLoginAttempts = await prisma.auditLog.count({
            where: {
                action: 'AUTH_LOGIN_FAIL',
                details: { path: 'ip', equals: ip },
                timestamp: { gte: ipWindowStart }
            }
        });
        
        if (ipLoginAttempts >= MAX_ATTEMPTS_PER_IP) {
            const msg = `Too many requests from your network. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`;
            setAuthErrorCookie(req, msg, LOCKOUT_DURATION_MINUTES);
            throw new Error(msg);
        }
        
        const phoneLocal = toLocalPhone(String(phoneNumber ?? ''));
        const phoneIntl = toIntlPhone(String(phoneNumber ?? ''));

        // --- ACCOUNT LOCKOUT: Check both User and Member tables ---
        const user = await prisma.user.findFirst({ where: { OR: [{ phoneNumber: phoneLocal }, { phoneNumber: phoneIntl }] } });
        if (user && user.lockoutUntil && user.lockoutUntil > now) {
            const minutesLeft = Math.ceil(differenceInMinutes(user.lockoutUntil, now));
            const msg = `Account is temporarily locked. Please try again in ${minutesLeft} minutes.`;
            setAuthErrorCookie(req, msg, minutesLeft);
            throw new Error(msg);
        }

        const member = await prisma.member.findFirst({ where: { OR: [{ phoneNumber: phoneLocal }, { phoneNumber: phoneIntl }] } });
        if (member && member.lockoutUntil && member.lockoutUntil > now) {
             const minutesLeft = Math.ceil(differenceInMinutes(member.lockoutUntil, now));
            const msg = `Account is temporarily locked. Please try again in ${minutesLeft} minutes.`;
            setAuthErrorCookie(req, msg, minutesLeft);
            throw new Error(msg);
        }
        
        // --- AUTHENTICATION ATTEMPT ---
        const handleFailedAttempt = async (entity: 'user' | 'member', id: string, currentAttempts: number) => {
             const newAttemptCount = currentAttempts + 1;
             await prisma.auditLog.create({
                data: { actorName: String(phoneNumber), action: 'AUTH_LOGIN_FAIL', details: { ip } }
             });

             if (newAttemptCount >= MAX_FAILED_ATTEMPTS_PER_ACCOUNT) {
                const lockoutUntil = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
                await prisma[entity].update({
                    where: { id },
                    data: { failedLoginAttempts: newAttemptCount, lockoutUntil },
                });
                const msg = `Account locked due to too many failed attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`;
                setAuthErrorCookie(req, msg, LOCKOUT_DURATION_MINUTES);
                throw new Error(msg);
             } else {
                 await prisma[entity].update({
                    where: { id },
                    data: { failedLoginAttempts: newAttemptCount },
                });
             }
        };

        if (user) {
          const match = user.password && (await bcrypt.compare(String(password ?? ''), String(user.password ?? '')));
          if (match) {
            await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockoutUntil: null }});
            const userRoles: Role[] = await prisma.role.findMany({ where: { users: { some: { id: user.id } } } });
            const permissions = new Set<string>();
            if (userRoles.some(r => r.name === "Admin")) {
              permissionsList.forEach(p => permissions.add(p.id));
            } else {
              userRoles.forEach(role => role.permissions.split(",").forEach(p => p && permissions.add(p)));
            }
            return { id: user.id, name: user.name, email: user.email, phoneNumber: user.phoneNumber, isMember: false, roles: userRoles.map(r => r.name), permissions: Array.from(permissions) } as AuthUser;
          } else {
            await handleFailedAttempt('user', user.id, user.failedLoginAttempts || 0);
            return null;
          }
        }
        
        if (member) {
          const match = member.password && (await bcrypt.compare(String(password ?? ''), String(member.password ?? '')));
          if (match) {
            await prisma.member.update({ where: { id: member.id }, data: { failedLoginAttempts: 0, lockoutUntil: null }});
            return { id: member.id, name: member.fullName, email: member.email, phoneNumber: member.phoneNumber, isMember: true, mustChangePassword: member.mustChangePassword ?? false } as MemberAuthUser;
          } else {
             await handleFailedAttempt('member', member.id, member.failedLoginAttempts || 0);
             return null;
          }
        }

        // If no user or member found, still log the failed attempt against the IP.
        await prisma.auditLog.create({
            data: { actorName: String(phoneNumber), action: 'AUTH_LOGIN_FAIL', details: { ip, reason: 'user_not_found' } }
        });
        
        return null; // Invalid credentials
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
