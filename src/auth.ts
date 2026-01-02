
import NextAuth, { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "./lib/prisma";
import bcrypt from "bcryptjs";
import type { AuthUser, MemberAuthUser } from "./types";
import type { Role } from '@prisma/client';
import { permissionsList } from "./app/(app)/settings/permissions";
import { differenceInMinutes } from 'date-fns';
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import crypto from "crypto";
import jwt from 'jsonwebtoken';
import { createActiveSession } from './lib/session-management';

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

function getHeaderValue(headers: any, name: string): string | null {
  if (!headers) return null;
  const normalizedName = name.toLowerCase();

  try {
    if (typeof headers.get === "function") {
      const value = headers.get(name);
      return value ?? null;
    }
  } catch (err) {
    // ignore - we'll try the object path below
  }

  if (typeof headers === "object") {
    const key = Object.keys(headers).find(
      (headerKey) => headerKey.toLowerCase() === normalizedName
    );
    if (key) {
      return headers[key as keyof typeof headers] as string;
    }
  }

  return null;
}

function getClientIp(req: any): string {
  const headerSources = [req?.headers, req?.request?.headers];
  for (const headerSource of headerSources) {
    const forwarded = getHeaderValue(headerSource, "x-forwarded-for");
    if (forwarded) {
      const ip = forwarded.split(",")[0]?.trim();
      if (ip) return ip;
    }

    const real = getHeaderValue(headerSource, "x-real-ip");
    if (real) {
      const ip = real.split(",")[0]?.trim();
      if (ip) return ip;
    }

    const cf = getHeaderValue(headerSource, "cf-connecting-ip");
    if (cf) {
      const ip = cf.split(",")[0]?.trim();
      if (ip) return ip;
    }
  }

  if (typeof req?.ip === "string" && req.ip.trim()) {
    return req.ip.trim();
  }

  const socketIp = req?.socket?.remoteAddress;
  if (typeof socketIp === "string" && socketIp.trim()) {
    return socketIp.trim();
  }

  return "unknown";
}

const MAX_FAILED_ATTEMPTS_PHONE = 5;
const MAX_FAILED_ATTEMPTS_IP = 50;
const LOCKOUT_DURATION_MINUTES = 15;

function setAuthErrorCookie(message: string) {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    cookies().set({
      name: "auth_error",
      value: message,
      path: "/",
      maxAge: 60, // Cookie lasts for 1 minute
      sameSite: "strict",
      secure: isProd,
      httpOnly: false,
    });
  } catch (e) {
    console.error('Failed to set auth error cookie:', e);
  }
}

async function checkRateLimit(type: 'PHONE' | 'IP', identifier: string) {
  if (!identifier || identifier === 'unknown') {
    // Don't rate limit if we can't identify the source
    return;
  }
  const now = new Date();
  const limitRecord = await prisma.rateLimit.findUnique({
      where: { identifier_type: { identifier, type } },
  });

  if (limitRecord && limitRecord.lockedUntil && limitRecord.lockedUntil > now) {
      const minutesLeft = Math.ceil(differenceInMinutes(limitRecord.lockedUntil, now));
      const msg = `Too many failed attempts. Please try again in ${minutesLeft} minutes.`;
      setAuthErrorCookie(msg);
      throw new Error(msg);
  }
}

async function incrementRateLimit(type: 'PHONE' | 'IP', identifier: string) {
    if (!identifier || identifier === 'unknown') return;

    const record = await prisma.rateLimit.upsert({
        where: { identifier_type: { identifier, type } },
        create: { type, identifier, attempts: 1 },
        update: { attempts: { increment: 1 } },
    });
    
    const maxAttempts = type === 'PHONE' ? MAX_FAILED_ATTEMPTS_PHONE : MAX_FAILED_ATTEMPTS_IP;
    
    if (record.attempts >= maxAttempts) {
       const lockoutUntil = new Date(new Date().getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
       await prisma.rateLimit.update({
           where: { id: record.id },
           data: { lockedUntil: lockoutUntil, attempts: 0 } // Reset attempts after locking
       });
       const msg = `Too many failed attempts. Account temporarily locked for ${LOCKOUT_DURATION_MINUTES} minutes.`;
       setAuthErrorCookie(msg);
       throw new Error(msg);
    }
}

async function resetRateLimit(type: 'PHONE' | 'IP', identifier: string) {
     if (!identifier || identifier === 'unknown') return;
     await prisma.rateLimit.updateMany({
        where: { identifier, type },
        data: { attempts: 0, lockedUntil: null }
    });
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 15 * 60, // 15 minutes
  },
  useSecureCookies: process.env.NODE_ENV === 'production',
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: { httpOnly: true, sameSite: 'strict', path: '/', secure: process.env.NODE_ENV === 'production' }
    }
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        phoneNumber: { label: "Phone Number", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials, req) {
        const phoneNumber = credentials?.phoneNumber as string;
        const password = credentials?.password as string;

        if (!phoneNumber || !password) return null;

        const ip = getClientIp(req);
        const phoneLocal = toLocalPhone(String(phoneNumber ?? ''));

        try {
            await checkRateLimit('IP', ip);
            await checkRateLimit('PHONE', phoneLocal);

            const user = await prisma.user.findFirst({ where: { OR: [{ phoneNumber: phoneLocal }, { phoneNumber: toIntlPhone(phoneLocal) }] } });
            if (user) {
                const match = user.password && (await bcrypt.compare(password, user.password));
                if (match) {
                    // If this account requires a password change, validate the temporary password expiry and enforce single-use.
                    if (user.mustChangePassword) {
                      const now = new Date();
                      if (!user.temporaryPasswordExpires || user.temporaryPasswordExpires < now) {
                        setAuthErrorCookie('Temporary password has expired. Please request a password reset.');
                        return null;
                      }

                      // Temp password is valid; invalidate it immediately to enforce single-use
                      try {
                        await prisma.user.update({ where: { id: user.id }, data: { temporaryPassword: null, temporaryPasswordExpires: null } });
                      } catch (e) {
                        console.error('Failed to clear temporary password after login:', e);
                      }

                      await resetRateLimit('PHONE', phoneLocal);
                      const userRoles: Role[] = await prisma.role.findMany({ where: { users: { some: { id: user.id } } } });
                      const permissions = new Set<string>();
                      if (userRoles.some(r => r.name === "Admin")) {
                          permissionsList.forEach(p => permissions.add(p.id));
                      } else {
                          userRoles.forEach(role => role.permissions.split(",").forEach(p => p && permissions.add(p)));
                      }
                      return { id: user.id, name: user.name, email: user.email, phoneNumber: user.phoneNumber, isMember: false, roles: userRoles.map(r => r.name), permissions: Array.from(permissions), mustChangePassword: user.mustChangePassword ?? false } as AuthUser;
                    }

                    await resetRateLimit('PHONE', phoneLocal);
                    const userRoles: Role[] = await prisma.role.findMany({ where: { users: { some: { id: user.id } } } });
                    const permissions = new Set<string>();
                    if (userRoles.some(r => r.name === "Admin")) {
                        permissionsList.forEach(p => permissions.add(p.id));
                    } else {
                        userRoles.forEach(role => role.permissions.split(",").forEach(p => p && permissions.add(p)));
                    }
                    // Create a server-side session (sid) and a refresh token bound to it
                    try {
                      const signingKey = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
                      const sessionId = crypto.randomUUID();
                      const refreshToken = jwt.sign({ sub: user.id, type: 'refresh', sessionId }, signingKey as string, { algorithm: 'HS256', expiresIn: '7d' });
                      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                      await createActiveSession({ sessionId, userId: user.id, userType: 'user', refreshToken, ipAddress: getClientIp(req), userAgent: getHeaderValue(req?.headers, 'user-agent') || undefined, expiresAt, forceReplace: true });
                      // Set refresh cookie so client can call refresh endpoint
                      try { cookies().set({ name: 'authjs.refresh-token', value: refreshToken, path: '/', httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60, secure: process.env.NODE_ENV === 'production' }); } catch (e) { console.error('Failed to set refresh cookie during login', e); }
                      // Include sid on returned user so JWT callback can persist it
                      return { id: user.id, name: user.name, email: user.email, phoneNumber: user.phoneNumber, isMember: false, roles: userRoles.map(r => r.name), permissions: Array.from(permissions), mustChangePassword: user.mustChangePassword ?? false, sid: sessionId } as any as AuthUser;
                    } catch (e) {
                      console.error('Failed to create active session during login', e);
                    }

                    return { id: user.id, name: user.name, email: user.email, phoneNumber: user.phoneNumber, isMember: false, roles: userRoles.map(r => r.name), permissions: Array.from(permissions), mustChangePassword: user.mustChangePassword ?? false } as AuthUser;
                }
            }
            
            const member = await prisma.member.findFirst({ where: { OR: [{ phoneNumber: phoneLocal }, { phoneNumber: toIntlPhone(phoneLocal) }] } });
            if (member) {
                const match = member.password && (await bcrypt.compare(password, member.password));
                if (match) {
                    // Enforce temporary password expiry and single-use if member must change password
                    if (member.mustChangePassword) {
                      const now = new Date();
                      if (!member.temporaryPasswordExpires || member.temporaryPasswordExpires < now) {
                        setAuthErrorCookie('Temporary password has expired. Please request a password reset.');
                        return null;
                      }

                      try {
                        await prisma.member.update({ where: { id: member.id }, data: { temporaryPassword: null, temporaryPasswordExpires: null } });
                      } catch (e) {
                        console.error('Failed to clear temporary password after member login:', e);
                      }

                      await resetRateLimit('PHONE', phoneLocal);
                      return { id: member.id, name: member.fullName, email: member.email, phoneNumber: member.phoneNumber, isMember: true, mustChangePassword: member.mustChangePassword ?? false } as MemberAuthUser;
                    }

                    // Create server-side session for member login
                    try {
                      const signingKey = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
                      const sessionId = crypto.randomUUID();
                      const refreshToken = jwt.sign({ sub: member.id, type: 'refresh', sessionId }, signingKey as string, { algorithm: 'HS256', expiresIn: '7d' });
                      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                      await createActiveSession({ sessionId, userId: member.id, userType: 'member', refreshToken, ipAddress: getClientIp(req), userAgent: getHeaderValue(req?.headers, 'user-agent') || undefined, expiresAt, forceReplace: true });
                      try { cookies().set({ name: 'authjs.refresh-token', value: refreshToken, path: '/', httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60, secure: process.env.NODE_ENV === 'production' }); } catch (e) { console.error('Failed to set refresh cookie during member login', e); }
                      return { id: member.id, name: member.fullName, email: member.email, phoneNumber: member.phoneNumber, isMember: true, mustChangePassword: member.mustChangePassword ?? false, sid: sessionId } as any as MemberAuthUser;
                    } catch (e) {
                      console.error('Failed to create active session during member login', e);
                    }

                    await resetRateLimit('PHONE', phoneLocal);
                    return { id: member.id, name: member.fullName, email: member.email, phoneNumber: member.phoneNumber, isMember: true, mustChangePassword: member.mustChangePassword ?? false } as MemberAuthUser;
                }
            }

            // If we reach here, login failed.
            await incrementRateLimit('IP', ip);
            await incrementRateLimit('PHONE', phoneLocal);

            await prisma.auditLog.create({
                data: { actorName: String(phoneNumber), action: 'AUTH_LOGIN_FAIL', actorType: 'ANONYMOUS', details: { ip } }
            });
            
            setAuthErrorCookie('Invalid phone number or password.');
            return null;

        } catch (error: any) {
            if (error.message.includes('Too many failed attempts')) {
              // The error message is already set in the cookie by checkRateLimit or incrementRateLimit
              return null;
            }
            console.error('Authorization error:', error);
            setAuthErrorCookie('An unexpected server error occurred.');
            return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.user = user;
        // Persist server-provided sid (session id) if returned by authorize
        if ((user as any).sid) token.sid = (user as any).sid;
        // Generate a unique jti for token uniqueness (not used for session identification)
        if (!token.jti) token.jti = crypto.randomUUID();
      }

      // Concurrent Session Enforcement
      // Only check existing tokens (not new logins) - skip when user is present (new login)
      // When MAX_CONCURRENT_SESSIONS = 1, only one session can be active at a time
      // If the jti doesn't match the active session, it was invalidated by a new login
      if ((token.sid || token.jti) && token.user && !user) {
        // This is an existing token being validated (not a new login)
        // Check if this session is still active in the database
        try {
          // Allow a short grace period for very new tokens to handle race conditions
          // where create-refresh hasn't been called yet. Increase this window to account for
          // slower client/server timings (e.g., slow networks or heavy page loads). This avoids
          // falsely invalidating the newly-created session while the refresh token is still being stored.
          const tokenIat = Number(token.iat || 0);
          const isVeryNewToken = tokenIat > 0 && (Date.now() / 1000 - tokenIat < 120); // 2 minutes
          
          if (!isVeryNewToken) {
            const userData = token.user as any;
            const userType = userData.isMember ? 'member' : 'user';
            // Import here to avoid circular dependencies
            const { isActiveSession } = await import('./lib/session-management');
            const sessionToCheck = token.sid as string || token.jti as string;
            const isActive = await isActiveSession(sessionToCheck, userData.id, userType);
            if (!isActive) {
              console.warn(`[AUTH] Session invalidated - sid/jti ${sessionToCheck} is not active for user ${userData.id}`);
              return { ...token, error: "SessionInvalidated" };
            }
          }
        } catch (error) {
          // If there's an error checking, log it but don't block the request
          // This prevents database issues from breaking authentication
          // Note: requireAuth() will perform additional validation on every API call
          console.error('[AUTH] Error checking active session:', error);
        }
      }
      
      return token;
      },
  
      async session({ session, token }) {
        // Handle invalidated sessions
        if (token.error === "SessionInvalidated" || !token.user) {
          // Returning null forces the client to sign out
          return null as any;
        }

        session.user = token.user as any;
        // Expose the stable session id (sid) to the client and other server-side calls
        (session as any).sid = token.sid || token.jti;
        return session;
      },

    async redirect({ url, baseUrl }) {
      // Security: Validate callback URL to prevent open redirect attacks
      // Only allow relative URLs (same origin)
      
      // If URL is relative (starts with /), construct full URL
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      
      // If URL is absolute, validate it's from the same origin
      try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(baseUrl);
        
        // Allow only same origin redirects
        if (
          urlObj.protocol === baseUrlObj.protocol &&
          urlObj.hostname === baseUrlObj.hostname &&
          urlObj.port === baseUrlObj.port
        ) {
          return url;
        }
      } catch {
        // Invalid URL format, fall back to base URL
      }
      
      // Default to base URL for any invalid or external URLs
      return baseUrl;
    },
  },

  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions);

// Route handlers for /api/auth/[...nextauth]
export { handler as GET, handler as POST };

// Helper to fetch the server session (keeps existing `auth()` call sites working)
export async function auth() {
  return getServerSession(authOptions);
}
