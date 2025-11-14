'use client';

import React, { createContext, useContext } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import type { AuthUser, MemberAuthUser, WebsiteContent } from '@/types';
import type { SocialMediaLink } from '@prisma/client';
import { DynamicTheme } from '@/components/DynamicTheme';

interface AuthContextType {
  user: AuthUser | null;
  member: MemberAuthUser | null;
  content: (WebsiteContent & { socialLinks: SocialMediaLink[] }) | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AuthProviderContent = ({ children, initialContent }: { children: React.ReactNode, initialContent: (WebsiteContent & { socialLinks: SocialMediaLink[] }) | null }) => {
    const { data: session, status } = useSession();
    const isLoading = status === 'loading';
    const isAuthenticated = status === 'authenticated';
    
    // The session object from NextAuth.js now holds our user data.
    // We need to determine if it's an Admin (User) or a Member based on its structure.
    const user = session?.user?.isMember ? null : (session?.user as AuthUser | null);
    const member = session?.user?.isMember ? (session?.user as MemberAuthUser | null) : null;
    
    // The logout function is now just a call to NextAuth's signOut.
    const logout = () => {
        const { signOut } = require('next-auth/react');
        signOut({ callbackUrl: '/login' });
    };

    const value = {
        user,
        member,
        content: initialContent,
        isAuthenticated,
        isLoading,
        logout,
        accessToken: null, // This is now managed by NextAuth
        login: async () => {}, // Handled by NextAuth's signIn
        register: async () => {}, // Handled outside or by custom NextAuth logic
        memberLogin: async () => {}, // Unified into NextAuth's signIn
        unifiedLogin: async () => {}, // Unified into NextAuth's signIn
    };

    return (
        <AuthContext.Provider value={value}>
            <DynamicTheme />
            {children}
        </AuthContext.Provider>
    );
};


export const AuthProvider = ({ children, initialContent }: { children: React.ReactNode, initialContent: (WebsiteContent & { socialLinks: SocialMediaLink[] }) | null }) => {
  return (
    <SessionProvider>
        <AuthProviderContent initialContent={initialContent}>
            {children}
        </AuthProviderContent>
    </SessionProvider>
  )
}


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
