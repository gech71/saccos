
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "./lib/prisma";
import bcrypt from "bcryptjs";
import type { AuthUser, MemberAuthUser } from "./types";
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

        const phoneLocal = toLocalPhone(phoneNumber);
        const phoneIntl = toIntlPhone(phoneNumber);
        
        const now = new Date();

        // 1. ADMIN USER LOGIN
        let adminUser = await prisma.user.findFirst({
          where: { OR: [{ phoneNumber: phoneLocal }, { phoneNumber: phoneIntl }] },
        });

        if (adminUser) {
           if (adminUser.lockoutUntil && adminUser.lockoutUntil > now) {
            const minutesLeft = differenceInMinutes(adminUser.lockoutUntil, now);
            throw new Error(`Account is temporarily locked. Please try again in ${minutesLeft} minutes.`);
          }
          
          const match = adminUser.password && (await bcrypt.compare(password, adminUser.password));
          if (match) {
             await prisma.user.update({
              where: { id: adminUser.id },
              data: { failedLoginAttempts: 0, lockoutUntil: null },
            });
            
            const userRoles = await prisma.role.findMany({
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
              throw new Error(`Account is temporarily locked due to too many failed login attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`);
            } else {
              await prisma.user.update({
                where: { id: adminUser.id },
                data: { failedLoginAttempts: newAttemptCount },
              });
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
          
          const match = member.password && (await bcrypt.compare(password, member.password));
          if (match) {
             await prisma.member.update({
              where: { id: member.id },
              data: { failedLoginAttempts: 0, lockoutUntil: null },
            });
            
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
              throw new Error(`Account is temporarily locked due to too many failed login attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`);
            } else {
              await prisma.member.update({
                where: { id: member.id },
                data: { failedLoginAttempts: newAttemptCount },
              });
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
