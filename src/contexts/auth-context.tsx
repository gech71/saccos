
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import type { AuthResponse, AuthUser, MemberAuthUser, WebsiteContent } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { syncUserOnLogin, getUserPermissions } from '@/app/(app)/settings/actions';
import { findUserOrMember, verifyMemberCredentials } from '@/app/login/actions';
import type { Member } from '@prisma/client';
import { getWebsiteContent } from '@/lib/website-actions';


interface AuthContextType {
  user: AuthUser | null;
  member: MemberAuthUser | null;
  content: WebsiteContent | null;
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
  nameid?: string; // Corresponds to User ID (sub) in some .NET configs
  sub?: string; // Standard JWT subject claim, often the User ID
  email: string;
  unique_name: string; // Corresponds to User Name
  role: string | string[]; // Can be single or multiple roles
  nbf: number;
  exp: number;
  iat: number;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [member, setMember] = useState<MemberAuthUser | null>(null);
  const [content, setContent] = useState<WebsiteContent | null>(null);
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
        const userId = decoded.sub || decoded.nameid; // Prioritize 'sub', fallback to 'nameid'

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
      
      const [websiteContent, storedAccessToken, storedRefreshToken, memberId] = await Promise.all([
          getWebsiteContent(),
          localStorage.getItem('accessToken'),
          localStorage.getItem('refreshToken'),
          localStorage.getItem('memberId'),
      ]);
      
      setContent(websiteContent as WebsiteContent);
      
      if (memberId) {
        // This is a member session
        // For simplicity, we just set the memberId. The profile page will fetch full details.
        setMember({ id: memberId, fullName: 'Member', mustChangePassword: false });
      } else if (storedAccessToken && storedRefreshToken) {
        try {
          const decoded = jwtDecode<DecodedToken>(storedAccessToken);
          if (decoded.exp * 1000 > Date.now()) {
            await handleAuthSuccess({ accessToken: storedAccessToken, refreshToken: storedRefreshToken });
          } else {
            console.log("Access token expired. Implement refresh logic.");
            handleLogout();
          }
        } catch (error) {
            console.error("Invalid token found:", error);
            handleLogout();
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, [handleAuthSuccess, handleLogout]);

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
      // Don't toast here, let the unified login handle it
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
      
      // Login success
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
      // Check if this phone number exists in the admin user table first.
      const userTypeResult = await findUserOrMember(data.phoneNumber);

      if (userTypeResult.userType === 'admin') {
        // If it's an admin, use the existing admin login flow.
        await login(data);
      } else if (userTypeResult.userType === 'member') {
        // If it's a member, use the member login flow.
        await memberLogin(data);
      } else {
        // If the user doesn't exist in either table.
        toast({ variant: 'destructive', title: 'Login Failed', description: 'Phone number not found.' });
        throw new Error('Phone number not found.');
      }
    } catch (error: any) {
      // The specific login functions (admin or member) will throw errors on failure (e.g., wrong password).
      // We'll display those specific errors here.
      // If the error doesn't come from our specific checks, show a generic one.
      const errorMessage = error.message || 'An unknown login error occurred.';
      if (!errorMessage.includes('not found')) { // Avoid double "not found" messages
        toast({ variant: 'destructive', title: 'Login Failed', description: errorMessage });
      }
      // Re-throw to ensure isLoading is set to false in the calling component.
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
