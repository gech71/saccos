
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "./lib/prisma";
import bcrypt from "bcryptjs";
import type { AuthUser, MemberAuthUser } from "./types";
import type { Role } from '@prisma/client';
import { permissionsList } from "./app/(app)/settings/permissions";
import { differenceInMinutes } from 'date-fns';
import { Prisma } from "@prisma/client";

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

const MAX_FAILED_ATTEMPTS_PHONE = 5;
const MAX_FAILED_ATTEMPTS_IP = 50;
const LOCKOUT_DURATION_MINUTES = 15;

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

async function checkRateLimit(type: 'PHONE' | 'IP', identifier: string, maxAttempts: number, req: any) {
    const now = new Date();
    const limitRecord = await prisma.rateLimit.findUnique({
        where: { identifier_type: { identifier, type } },
    });

    if (limitRecord && limitRecord.lockedUntil && limitRecord.lockedUntil > now) {
        const minutesLeft = Math.ceil(differenceInMinutes(limitRecord.lockedUntil, now));
        const msg = `Too many failed attempts. Please try again in ${minutesLeft} minutes.`;
        setAuthErrorCookie(req, msg, minutesLeft);
        throw new Error(msg);
    }
    
    if (limitRecord && limitRecord.attempts >= maxAttempts) {
       const lockoutUntil = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
       await prisma.rateLimit.update({
           where: { id: limitRecord.id },
           data: { lockedUntil: lockoutUntil, attempts: 0 } // Reset attempts after locking
       });
       const msg = `Too many failed attempts. Account temporarily locked for ${LOCKOUT_DURATION_MINUTES} minutes.`;
       setAuthErrorCookie(req, msg, LOCKOUT_DURATION_MINUTES);
       throw new Error(msg);
    }

    return limitRecord;
}

async function incrementRateLimit(type: 'PHONE' | 'IP', identifier: string) {
    await prisma.rateLimit.upsert({
        where: { identifier_type: { identifier, type } },
        create: { type, identifier, attempts: 1 },
        update: { attempts: { increment: 1 } },
    });
}

async function resetRateLimit(type: 'PHONE' | 'IP', identifier: string) {
     await prisma.rateLimit.updateMany({
        where: { identifier, type },
        data: { attempts: 0, lockedUntil: null }
    });
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
        const phoneNumber = credentials?.phoneNumber as string;
        const password = credentials?.password as string;

        if (!phoneNumber || !password) return null;

        const req: any = arguments[1];
        let ip = 'unknown';
        try {
          const headers = req?.headers || req?.req?.headers || {};
          ip = headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        } catch (e) {
          ip = 'unknown';
        }
        
        const phoneLocal = toLocalPhone(String(phoneNumber ?? ''));

        // --- RATE LIMITING CHECKS ---
        await checkRateLimit('IP', ip, MAX_FAILED_ATTEMPTS_IP, req);
        await checkRateLimit('PHONE', phoneLocal, MAX_FAILED_ATTEMPTS_PHONE, req);

        // --- AUTHENTICATION ---
        const user = await prisma.user.findFirst({ where: { OR: [{ phoneNumber: phoneLocal }, { phoneNumber: toIntlPhone(phoneLocal) }] } });
        if (user) {
            const match = user.password && (await bcrypt.compare(password, user.password));
            if (match) {
                await resetRateLimit('PHONE', phoneLocal);
                // IP is not reset to allow catching distributed attacks from one IP
                const userRoles: Role[] = await prisma.role.findMany({ where: { users: { some: { id: user.id } } } });
                const permissions = new Set<string>();
                if (userRoles.some(r => r.name === "Admin")) {
                    permissionsList.forEach(p => permissions.add(p.id));
                } else {
                    userRoles.forEach(role => role.permissions.split(",").forEach(p => p && permissions.add(p)));
                }
                return { id: user.id, name: user.name, email: user.email, phoneNumber: user.phoneNumber, isMember: false, roles: userRoles.map(r => r.name), permissions: Array.from(permissions) } as AuthUser;
            }
        }
        
        const member = await prisma.member.findFirst({ where: { OR: [{ phoneNumber: phoneLocal }, { phoneNumber: toIntlPhone(phoneLocal) }] } });
        if (member) {
            const match = member.password && (await bcrypt.compare(password, member.password));
            if (match) {
                await resetRateLimit('PHONE', phoneLocal);
                return { id: member.id, name: member.fullName, email: member.email, phoneNumber: member.phoneNumber, isMember: true, mustChangePassword: member.mustChangePassword ?? false } as MemberAuthUser;
            }
        }

        // --- FAILED ATTEMPT LOGIC ---
        await incrementRateLimit('IP', ip);
        await incrementRateLimit('PHONE', phoneLocal);
        
        await prisma.auditLog.create({
            data: { actorName: String(phoneNumber), actorType: 'ANONYMOUS', action: 'AUTH_LOGIN_FAIL', details: { ip } }
        });
        
        // Re-check phone limit to lock immediately if threshold is met
        await checkRateLimit('PHONE', phoneLocal, MAX_FAILED_ATTEMPTS_PHONE, req);

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

    