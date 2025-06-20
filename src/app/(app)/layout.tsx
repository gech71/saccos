
'use client';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarInset,
  SidebarRail,
} from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/sidebar-nav';
import { Header } from '@/components/header';
import { Logo } from '@/components/logo';
import type { NavItem } from '@/types';
import { LayoutDashboard, PiggyBank, PieChart, Landmark, FileText, School, Users, Shapes, WalletCards, Library, ListChecks } from 'lucide-react'; // Added ListChecks
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Schools', href: '/schools', icon: School },
  { title: 'Members', href: '/members', icon: Users },
  { title: 'Saving Acct. Types', href: '/saving-account-types', icon: WalletCards },
  { title: 'Savings', href: '/savings', icon: PiggyBank },
  { title: 'Group Collections', href: '/group-collections', icon: Library },
  { title: 'Share Types', href: '/share-types', icon: Shapes },
  { title: 'Shares', href: '/shares', icon: PieChart },
  { title: 'Dividends', href: '/dividends', icon: Landmark },
  { title: 'Overdue Payments', href: '/overdue-payments', icon: ListChecks },
  { title: 'Reports', href: '/reports', icon: FileText },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  useEffect(() => {
    // Ensure localStorage is accessed only on the client side
    if (typeof window !== 'undefined') {
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      if (isAuthenticated !== 'true') {
        router.replace('/login');
      } else {
        setIsAuthenticating(false);
      }
    }
  }, [pathname, router]); 

  if (isAuthenticating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center">
          <Logo className="mb-4" />
          <p className="text-lg text-muted-foreground">Loading your AcademInvest experience...</p>
           {/* You can add a spinner here */}
        </div>
      </div>
    );
  }
  
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1">
          <Sidebar collapsible="icon" side="left" variant="sidebar" className="border-r">
            <SidebarHeader className="p-4 hidden md:flex items-center justify-center">
              <Logo />
            </SidebarHeader>
            <SidebarNav navItems={navItems} />
          </Sidebar>
          <SidebarRail />
          <SidebarInset className="flex-1 overflow-y-auto">
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
