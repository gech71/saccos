
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import type { AuthResponse, AuthUser } from '@/types';
import { useToast } from '@/hooks/use-toast';

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

const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL || 'http://localhost:5160';

interface DecodedToken {
  nameid: string; // Corresponds to User ID (sub)
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
  
  const handleAuthSuccess = useCallback((data: { accessToken: string; refreshToken: string; }) => {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);

    try {
        const decoded = jwtDecode<DecodedToken>(data.accessToken);
        const authUser: AuthUser = {
            id: decoded.nameid,
            email: decoded.email,
            name: decoded.unique_name,
            // Assuming phone number is not in token, might need another API call if needed
            phoneNumber: '', 
        };
        setUser(authUser);
    } catch (error) {
        console.error("Failed to decode token:", error);
        handleLogout();
    }
  }, [handleLogout]);

  useEffect(() => {
    const initAuth = () => {
      setIsLoading(true);
      const storedAccessToken = localStorage.getItem('accessToken');
      const storedRefreshToken = localStorage.getItem('refreshToken');

      if (storedAccessToken && storedRefreshToken) {
        try {
          const decoded = jwtDecode<DecodedToken>(storedAccessToken);
          if (decoded.exp * 1000 > Date.now()) {
            handleAuthSuccess({ accessToken: storedAccessToken, refreshToken: storedRefreshToken });
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
      const response = await axios.post<AuthResponse>(`${AUTH_API_URL}/api/Auth/login`, data);
      if (response.data.isSuccess && response.data.accessToken && response.data.refreshToken) {
        handleAuthSuccess(response.data as { accessToken: string; refreshToken: string; });
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
      const response = await axios.post<AuthResponse>(`${AUTH_API_URL}/api/Auth/register`, data);
       if (response.data.isSuccess && response.data.accessToken && response.data.refreshToken) {
        handleAuthSuccess(response.data as { accessToken: string; refreshToken: string; });
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
