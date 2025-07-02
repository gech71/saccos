
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import type { AuthResponse, AuthUser } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { syncUserOnLogin, getUserPermissions } from '@/app/(app)/settings/actions';

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = useCallback(() => {
    // Ideally, call the /api/Auth/logout endpoint
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
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
        
        // Sync user with local DB and get full user profile with roles
        const localUser = await syncUserOnLogin(userId, decoded.unique_name, decoded.email);
        
        // Fetch all permissions for the user's roles
        const permissions = await getUserPermissions(userId);
        
        const authUser: AuthUser = {
            id: localUser.id,
            userId: localUser.userId,
            email: localUser.email,
            name: localUser.name,
            phoneNumber: '', // Not in token, can be added to local DB if needed
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

      if (storedAccessToken && storedRefreshToken) {
        try {
          const decoded = jwtDecode<DecodedToken>(storedAccessToken);
          if (decoded.exp * 1000 > Date.now()) {
            await handleAuthSuccess({ accessToken: storedAccessToken, refreshToken: storedRefreshToken });
          } else {
            // Here you would implement token refresh logic
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
      const response = await axios.post<AuthResponse>('/api/auth/login', data);
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
  
  const register = async (data: any) => {
    try {
      const response = await axios.post<AuthResponse>('/api/auth/register', data);
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
    // Call API to invalidate tokens if necessary
    handleLogout();
    toast({ title: 'Logged Out', description: 'You have been successfully signed out.' });
  };
  
  const value = {
    user,
    accessToken,
    isAuthenticated: !!accessToken,
    isLoading,
    login,
    register,
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
