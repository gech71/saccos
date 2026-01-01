
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
    // Cast to any because types in this environment may not expose .set() on the Cookies object
    (cookies() as any).set({
      name: "auth_error",
      value: message,
      path: "/",
      maxAge: 60, // Cookie lasts for 1 minute
      sameSite: "lax",
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
                    await resetRateLimit('PHONE', phoneLocal);
                    const userRoles: Role[] = await prisma.role.findMany({ where: { users: { some: { id: user.id } } } });
                    const permissions = new Set<string>();
                    if (userRoles.some(r => r.name === "Admin")) {
                        permissionsList.forEach(p => permissions.add(p.id));
                    } else {
                        userRoles.forEach(role => role.permissions.split(",").forEach(p => p && permissions.add(p)));
                    }

                    // Concurrency control: find an existing active session from the same device and reuse it; if none, create one.
                    try {
                      const allowConcurrent = process.env.ALLOW_CONCURRENT_SESSIONS === 'true';
                      const userAgent = getHeaderValue(req.headers, 'user-agent') ?? undefined;

                      // Prefer reusing an existing active session from the same IP + user-agent (same browser/device)
                      let existingSameDevice = null as any | null;
                      try {
                        existingSameDevice = await (prisma as any).userSession.findFirst({
                          where: {
                            userId: user.id,
                            revoked: false,
                            ip,
                            ...(userAgent ? { userAgent } : {}),
                          },
                          orderBy: { createdAt: 'desc' },
                        });
                      } catch (e) {
                        // If Prisma client missing or table isn't present yet, ignore and continue
                        existingSameDevice = null;
                      }

                      if (existingSameDevice) {
                        // Update the existing session's expiry/last active time instead of creating a duplicate
                        await (prisma as any).userSession.update({
                          where: { id: existingSameDevice.id },
                          data: { lastActiveAt: new Date(), expiresAt: new Date(Date.now() + 15 * 60 * 1000), userAgent },
                        });

                        // Clean up any other duplicate sessions for this same device (keep the updated record)
                        try {
                          await (prisma as any).userSession.deleteMany({ where: { userId: user.id, ip, userAgent, NOT: { id: existingSameDevice.id } } });
                        } catch (e) {
                          // Non-fatal
                        }

                        return { id: user.id, name: user.name, email: user.email, phoneNumber: user.phoneNumber, isMember: false, roles: userRoles.map(r => r.name), permissions: Array.from(permissions), mustChangePassword: user.mustChangePassword ?? false, sessionId: existingSameDevice.id } as any;
                      }

                      // No existing same-device session found
                      if (!allowConcurrent) {
                        // Revoke other active sessions for this user (single-session policy)
                        await (prisma as any).userSession.updateMany({ where: { userId: user.id, revoked: false }, data: { revoked: true } });
                      }

                      const createdSession = await (prisma as any).userSession.create({
                        data: {
                          userId: user.id,
                          ip,
                          userAgent: userAgent ?? undefined,
                          expiresAt: new Date(Date.now() + (15 * 60 * 1000)), // 15 minutes, align with access token
                        }
                      });

                      // Return the user payload including the session id so it can be embedded in tokens
                      return { id: user.id, name: user.name, email: user.email, phoneNumber: user.phoneNumber, isMember: false, roles: userRoles.map(r => r.name), permissions: Array.from(permissions), mustChangePassword: user.mustChangePassword ?? false, sessionId: createdSession.id } as any;
                    } catch (err) {
                      console.error('Session creation error:', err);
                      // Fallback: still return user without sessionId
                      return { id: user.id, name: user.name, email: user.email, phoneNumber: user.phoneNumber, isMember: false, roles: userRoles.map(r => r.name), permissions: Array.from(permissions), mustChangePassword: user.mustChangePassword ?? false } as AuthUser;
                    }
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
    async jwt({ token, user }) {
      if (user) {
        token.user = user;
        // If the authorize flow created a server-tracked session, capture its id as 'sid'
        if ((user as any).sessionId) {
          token.sid = (user as any).sessionId;
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.user = token.user as any;
      // Surface the session id to the client session object for use in refresh/create-refresh flows
      if ((token as any).sid) {
        (session.user as any).sessionId = (token as any).sid;
      }
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
