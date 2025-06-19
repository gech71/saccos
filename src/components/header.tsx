'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, UserCircle, Settings, Sun, Moon } from 'lucide-react';
import { Logo } from './logo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import React, { useState, useEffect } from 'react';

export function Header() {
  const router = useRouter();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    setMounted(true);
    const currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setIsDarkMode(currentTheme === 'dark');
    document.documentElement.classList.toggle('dark', currentTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };
  
  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    router.push('/login');
  };

  if (!mounted) {
    return ( // Return a placeholder or null to avoid mismatched content during SSR
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
           <div className="flex items-center gap-2">
             <div className="h-8 w-8 rounded-full bg-muted animate-pulse md:hidden" /> {/* Placeholder for SidebarTrigger */}
             <div className="h-8 w-24 rounded bg-muted animate-pulse" /> {/* Placeholder for Logo */}
           </div>
           <div className="flex items-center gap-4">
             <div className="h-8 w-8 rounded-full bg-muted animate-pulse" /> {/* Placeholder for Theme Toggle */}
             <div className="h-10 w-10 rounded-full bg-muted animate-pulse" /> {/* Placeholder for Avatar */}
           </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <Logo className="hidden md:flex" />
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="https://placehold.co/100x100.png" alt="User avatar" data-ai-hint="user avatar" />
                  <AvatarFallback>
                    <UserCircle className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Academ User</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    user@example.com
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/profile">
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
