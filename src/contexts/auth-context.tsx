

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import type { AuthResponse, AuthUser, MemberAuthUser } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { syncUserOnLogin, getUserPermissions } from '@/app/(app)/settings/actions';
import { findMemberByPhoneNumber } from '@/app/login/actions';
import bcrypt from 'bcryptjs';

interface AuthContextType {
  user: AuthUser | null;
  member: MemberAuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  memberLogin: (data: any) => Promise<void>;
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
      const storedAccessToken = localStorage.getItem('accessToken');
      const storedRefreshToken = localStorage.getItem('refreshToken');
      const memberId = localStorage.getItem('memberId');
      
      if (memberId) {
        // This is a member session
        const memberRes = await prisma.member.findUnique({ where: {id: memberId }});
        if (memberRes) {
            setMember({ id: memberRes.id, fullName: memberRes.fullName, mustChangePassword: memberRes.mustChangePassword ?? undefined });
        }
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
      toast({ variant: 'destructive', title: 'Login Failed', description: errorMessage });
      throw new Error(errorMessage);
    }
  };
  
  const memberLogin = async (data: {phoneNumber: string, password?: string}) => {
      const memberResult = await prisma.member.findFirst({ where: {phoneNumber: data.phoneNumber}});
      
      if (!memberResult) {
          toast({ variant: 'destructive', title: 'Login Failed', description: 'Phone number not found.'});
          throw new Error('Phone number not found.');
      }
      
      if (!memberResult.password) {
          toast({ variant: 'destructive', title: 'Login Failed', description: 'This member account is not yet configured for password login.' });
          throw new Error('Account not configured.');
      }
      
      const passwordMatch = await bcrypt.compare(data.password || '', memberResult.password);

      if (!passwordMatch) {
           toast({ variant: 'destructive', title: 'Login Failed', description: 'Incorrect password.'});
           throw new Error('Incorrect password.');
      }
      
      // Login success
      setMember({
          id: memberResult.id,
          fullName: memberResult.fullName,
          mustChangePassword: memberResult.mustChangePassword ?? undefined,
      });
      localStorage.setItem('memberId', memberResult.id);

      if (memberResult.mustChangePassword) {
          router.push(`/member-login/change-password?memberId=${memberResult.id}`);
      } else {
          router.push(`/member-profile/${memberResult.id}`);
      }
  }

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
    accessToken,
    isAuthenticated: !!accessToken || !!member,
    isLoading,
    login,
    register,
    memberLogin,
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
