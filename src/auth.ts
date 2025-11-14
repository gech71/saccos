
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from './lib/prisma';
import bcrypt from 'bcryptjs';
import type { User, Member } from '@prisma/client';
import type { AuthUser, MemberAuthUser } from './types';

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
        if (!credentials?.phoneNumber || !credentials.password) {
          return null;
        }

        const phoneNumber = credentials.phoneNumber as string;
        const password = credentials.password as string;

        // Try to find an admin user first
        const adminUser = await prisma.user.findFirst({
          where: { phoneNumber: phoneNumber },
        });

        if (adminUser) {
          if (adminUser.password && (await bcrypt.compare(password, adminUser.password))) {
            const userRoles = await prisma.role.findMany({
                where: { users: { some: { id: adminUser.id } } },
            });
            const permissions = new Set<string>();
            userRoles.forEach(role => {
                role.permissions.split(',').forEach(p => permissions.add(p));
            });

            // Return a standardized AuthUser object
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

        // If not an admin, try to find a member
        const member = await prisma.member.findFirst({
          where: { phoneNumber: phoneNumber },
        });
        
        if (member) {
          if (member.password && (await bcrypt.compare(password, member.password))) {
            // Return a standardized MemberAuthUser object
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
        
        // If no user or member found, or password doesn't match
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
    // error: '/login', // Redirect to login page on error
  },
});
export const { GET, POST } = handlers;
