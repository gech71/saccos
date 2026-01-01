'use client';

import React, { createContext, useContext } from 'react';
import { SessionProvider, useSession, signOut } from 'next-auth/react';
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

const AuthProviderContent = ({
  children,
  initialContent,
}: {
  children: React.ReactNode;
  initialContent: (WebsiteContent & { socialLinks: SocialMediaLink[] }) | null;
}) => {
  const { data: session, status } = useSession();

  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  // Determine user or member from session
  const user = session?.user?.isMember ? null : (session?.user as AuthUser | null);
  const member = session?.user?.isMember ? (session?.user as MemberAuthUser | null) : null;

  const logout = async () => {
    try {
      // Invalidate refresh token server-side and clear refresh cookie
      await fetch('/api/auth/clear-refresh', { method: 'POST' });
    } catch (err) {
      console.error('Failed to clear refresh token on logout', err);
    } finally {
      await signOut({ callbackUrl: '/login' });
    }
  };

  const value: AuthContextType = {
    user,
    member,
    content: initialContent,
    isAuthenticated,
    isLoading,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      <DynamicTheme />
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider = ({
  children,
  initialContent,
}: {
  children: React.ReactNode;
  initialContent: (WebsiteContent & { socialLinks: SocialMediaLink[] }) | null;
}) => {
  return (
    <SessionProvider>
      <AuthProviderContent initialContent={initialContent}>
        {children}
      </AuthProviderContent>
    </SessionProvider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
