
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
        // Generate a unique session ID (jti) for tracking concurrent sessions
        if (!token.jti) {
          token.jti = crypto.randomUUID();
        }
      }

      // Concurrent Session Enforcement
      // Only check existing tokens (not new logins) - skip when user is present (new login)
      // When MAX_CONCURRENT_SESSIONS = 1, only one session can be active at a time
      // If the jti doesn't match the active session, it was invalidated by a new login
      if (token.jti && token.user && !user) {
        // This is an existing token being validated (not a new login)
        // Check if this session is still active in the database
        try {
          // Allow a short grace period for very new tokens (30 seconds) to handle race conditions
          // where create-refresh hasn't been called yet. This is a minimal window to prevent
          // blocking legitimate new sessions while still catching revoked sessions quickly.
          const isVeryNewToken = token.iat && (Date.now() / 1000 - token.iat < 30);
          
          if (!isVeryNewToken) {
            const userData = token.user as any;
            const userType = userData.isMember ? 'member' : 'user';
            
            // Import here to avoid circular dependencies
            const { isActiveSession } = await import('./lib/session-management');
            const isActive = await isActiveSession(token.jti, userData.id, userType);
            
            if (!isActive) {
              // This session was invalidated (e.g., by a new login on another device)
              console.warn(`[AUTH] Session invalidated - jti ${token.jti} is not the active session for user ${userData.id}`);
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
        // Expose the session ID (jti) to the client and other server-side calls
        (session as any).jti = token.jti;
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
