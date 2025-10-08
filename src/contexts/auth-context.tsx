
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import type { AuthResponse, AuthUser, MemberAuthUser, WebsiteContent } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { syncUserOnLogin, getUserPermissions } from '@/app/(app)/settings/actions';
import { findUserOrMember, verifyMemberCredentials } from '@/app/login/actions';
import type { Member, SocialMediaLink } from '@prisma/client';
import { getWebsiteContent } from '@/lib/website-actions';
import { DynamicTheme } from '@/components/DynamicTheme';


interface AuthContextType {
  user: AuthUser | null;
  member: MemberAuthUser | null;
  content: (WebsiteContent & { socialLinks: SocialMediaLink[] }) | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  memberLogin: (data: any) => Promise<void>;
  unifiedLogin: (data: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface DecodedToken {
  nameid?: string;
  sub?: string; 
  email: string;
  unique_name: string;
  role: string | string[];
  nbf: number;
  exp: number;
  iat: number;
}

export const AuthProvider = ({ children, initialContent }: { children: React.ReactNode, initialContent: (WebsiteContent & { socialLinks: SocialMediaLink[] }) | null }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [member, setMember] = useState<MemberAuthUser | null>(null);
  const [content, setContent] = useState((initialContent));
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const authApiBaseUrl = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

  const handleLogout = useCallback(() => {
    setUser(null);
    setMember(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('memberId');
    router.push('/login');
  }, [router]);
  
  const handleAuthSuccess = useCallback(async (data: { accessToken: string; refreshToken: string; }) => {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);

    try {
        const decoded = jwtDecode<DecodedToken>(data.accessToken);
        const userId = decoded.sub || decoded.nameid;

        if (!userId) {
          console.error("Token is invalid: does not contain 'sub' or 'nameid' claim for user ID.");
          toast({ variant: 'destructive', title: 'Authentication Error', description: 'Invalid token received from server.' });
          handleLogout();
          return;
        }
        
        const localUser = await syncUserOnLogin(userId, decoded.unique_name, decoded.email);
        const permissions = await getUserPermissions(userId);
        
        const authUser: AuthUser = {
            id: localUser.id,
            userId: localUser.userId,
            email: localUser.email,
            name: localUser.name,
            phoneNumber: '',
            roles: localUser.roles.map(r => r.name),
            permissions,
        };
        setUser(authUser);
    } catch (error) {
        console.error("Failed to decode token or sync user:", error);
        handleLogout();
    }
  }, [handleLogout, toast]);

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);

      if (!content) {
        const fetchedContent = await getWebsiteContent();
        setContent(fetchedContent as (WebsiteContent & { socialLinks: SocialMediaLink[] }));
      }
      
      const storedAccessToken = localStorage.getItem('accessToken');
      const storedRefreshToken = localStorage.getItem('refreshToken');
      const memberId = localStorage.getItem('memberId');
      
      if (memberId) {
        setMember({ id: memberId, fullName: 'Member', mustChangePassword: false });
      } else if (storedAccessToken && storedRefreshToken) {
        try {
          const decoded = jwtDecode<DecodedToken>(storedAccessToken);
          if (decoded.exp * 1000 > Date.now()) {
            await handleAuthSuccess({ accessToken: storedAccessToken, refreshToken: storedRefreshToken });
          } else {
            handleLogout();
          }
        } catch (error) {
            handleLogout();
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, [handleAuthSuccess, handleLogout, content]);

  const login = async (data: any) => {
    try {
      const response = await axios.post<AuthResponse>(`${authApiBaseUrl}/api/Auth/login`, data);
      if (response.data.isSuccess && response.data.accessToken && response.data.refreshToken) {
        await handleAuthSuccess(response.data as { accessToken: string; refreshToken: string; });
        toast({ title: 'Login Successful', description: 'Welcome back!' });
        router.push('/dashboard');
      } else {
        throw new Error(response.data.errors?.[0] || 'Login failed.');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors?.[0] || error.message || 'An unknown error occurred.';
      throw new Error(errorMessage);
    }
  };
  
  const memberLogin = async (data: {phoneNumber: string, password?: string}) => {
      const result = await verifyMemberCredentials(data);
      
      if (!result.success || !result.member) {
          toast({ variant: 'destructive', title: 'Login Failed', description: result.error});
          throw new Error(result.error);
      }
      
      const memberResult = result.member as Member;
      
      setMember({
          id: memberResult.id,
          fullName: memberResult.fullName,
          mustChangePassword: memberResult.mustChangePassword ?? undefined,
      });
      localStorage.setItem('memberId', memberResult.id);
      
      toast({ title: 'Login Successful', description: `Welcome back, ${memberResult.fullName}!` });

      if (memberResult.mustChangePassword) {
          router.push(`/member-login/change-password?memberId=${memberResult.id}`);
      } else {
          router.push(`/member-profile/${memberResult.id}`);
      }
  }

  const unifiedLogin = async (data: {phoneNumber: string, password?: string}) => {
    try {
      const userTypeResult = await findUserOrMember(data.phoneNumber);

      if (userTypeResult.userType === 'admin') {
        await login(data);
      } else if (userTypeResult.userType === 'member') {
        await memberLogin(data);
      } else {
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Phone number not found.' });
        throw new Error('Phone number not found.');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'An unknown login error occurred.';
      if (!errorMessage.includes('not found')) {
        toast({ variant: 'destructive', title: 'Login Failed', description: errorMessage });
      }
      throw error;
    }
  };
  

  const register = async (data: any) => {
    try {
      const response = await axios.post<AuthResponse>(`${authApiBaseUrl}/api/Auth/register`, data);
       if (response.data.isSuccess && response.data.accessToken && response.data.refreshToken) {
        await handleAuthSuccess(response.data as { accessToken: string; refreshToken: string; });
        toast({ title: 'Registration Successful', description: 'Your account has been created.' });
        router.push('/dashboard');
      } else {
        throw new Error(response.data.errors?.[0] || 'Registration failed.');
      }
    } catch (error: any) {
       const errorMessage = error.response?.data?.errors?.[0] || error.message || 'An unknown error occurred.';
      toast({ variant: 'destructive', title: 'Registration Failed', description: errorMessage });
      throw new Error(errorMessage);
    }
  };


  const logout = () => {
    handleLogout();
    toast({ title: 'Logged Out', description: 'You have been successfully signed out.' });
  };
  
  const value = {
    user,
    member,
    content,
    accessToken,
    isAuthenticated: !!accessToken || !!member,
    isLoading,
    login,
    register,
    memberLogin,
    unifiedLogin,
    logout,
  };

  return <AuthContext.Provider value={value}><DynamicTheme />{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
