
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from './lib/prisma';
import bcrypt from 'bcryptjs';
import type { User, Member, Role } from '@prisma/client';
import type { AuthUser, MemberAuthUser } from './types';
import { permissionsList } from './app/(app)/settings/permissions';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        phoneNumber: { label: 'Phone Number', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const phoneNumber = credentials?.phoneNumber as string;
        const password = credentials?.password as string;

        if (!phoneNumber || !password) {
          return null;
        }

        // 1. Attempt to find and authenticate an admin User
        const adminUser = await prisma.user.findFirst({
          where: { phoneNumber: phoneNumber },
        });

        if (adminUser) {
          const passwordMatch = adminUser.password && (await bcrypt.compare(password, adminUser.password));
          if (passwordMatch) {
            const userRoles = await prisma.role.findMany({
              where: { users: { some: { id: adminUser.id } } },
            });
            const permissions = new Set<string>();
            
            const isAdmin = userRoles.some(role => role.name === 'Admin');

            if (isAdmin) {
                // If user is an Admin, grant all permissions
                permissionsList.forEach(p => permissions.add(p.id));
            } else {
                // Otherwise, aggregate permissions from assigned roles
                userRoles.forEach(role => {
                    role.permissions.split(',').forEach(p => {
                        if(p) permissions.add(p);
                    });
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

        // 2. If no authenticated admin, attempt to find and authenticate a Member
        const member = await prisma.member.findFirst({
          where: { phoneNumber: phoneNumber },
        });

        if (member) {
          const passwordMatch = member.password && (await bcrypt.compare(password, member.password));
          if (passwordMatch) {
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
        
        // 3. If neither authentication succeeded, return null
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
        if (user) {
            // This is the first sign-in
            token.user = user;
        }
        return token;
    },
    async session({ session, token }) {
        // The user object in the token has the data from authorize
        session.user = token.user as any; 
        return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login', // Redirect to login page on error
  },
});
export const { GET, POST } = handlers;
