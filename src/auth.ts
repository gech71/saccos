
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "./lib/prisma";
import bcrypt from "bcryptjs";
import type { AuthUser, MemberAuthUser } from "./types";
import { permissionsList } from "./app/(app)/settings/permissions";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
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

        // 1. ADMIN USER LOGIN
        const adminUser = await prisma.user.findFirst({
          where: { OR: [{ phoneNumber: phoneLocal }, { phoneNumber: phoneIntl }] },
        });

        if (adminUser) {
          const match = adminUser.password && (await bcrypt.compare(password, adminUser.password));
          if (match) {
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
          }
        }

        // 2. MEMBER LOGIN
        const member = await prisma.member.findFirst({
          where: { OR: [{ phoneNumber: phoneLocal }, { phoneNumber: phoneIntl }] },
        });

        if (member) {
          const match = member.password && (await bcrypt.compare(password, member.password));
          if (match) {
            return {
              id: member.id,
              name: member.fullName,
              email: member.email,
              phoneNumber: member.phoneNumber,
              isMember: true,
              mustChangePassword: member.mustChangePassword,
            } as MemberAuthUser;
          }
        }

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
    error: "/login",
  },
});

export const { GET, POST } = handlers;
