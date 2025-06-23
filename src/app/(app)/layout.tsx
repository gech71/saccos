
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
import { LayoutDashboard, PiggyBank, PieChart, Landmark, FileText, School, Users, Shapes, WalletCards, Library, ListChecks, ReceiptText, ClipboardList, CheckSquare, Percent, ClipboardPaste } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const allNavItems: NavItem[] = [
  // Overview
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'member'] },
  
  // Core Entities
  { title: 'Schools', href: '/schools', icon: School, roles: ['admin'] },
  { title: 'Members', href: '/members', icon: Users, roles: ['admin'] },

  // Configuration
  { title: 'Saving Acct. Types', href: '/saving-account-types', icon: WalletCards, roles: ['admin'] },
  { title: 'Share Types', href: '/share-types', icon: Shapes, roles: ['admin'] },
  { title: 'Service Charge Types', href: '/service-charge-types', icon: ReceiptText, roles: ['admin'] },

  // Savings Management
  { title: 'Savings Accounts', href: '/savings-accounts', icon: WalletCards, roles: ['admin'] },
  { title: 'Savings Transactions', href: '/savings', icon: PiggyBank, roles: ['admin', 'member'], memberTitle: 'My Savings' },
  { title: 'Group Collections', href: '/group-collections', icon: Library, roles: ['admin'] },
  { title: 'Calculate Interest', href: '/calculate-interest', icon: Percent, roles: ['admin'] },

  // Shares & Dividends
  { title: 'Share Allocations', href: '/shares', icon: PieChart, roles: ['admin', 'member'], memberTitle: 'My Shares' },
  { title: 'Dividend Payouts', href: '/dividends', icon: Landmark, roles: ['admin', 'member'], memberTitle: 'My Dividends' },
  
  // Charges & Payments
  { title: 'Applied Service Charges', href: '/applied-service-charges', icon: ClipboardList, roles: ['admin'] },
  { title: 'Overdue Payments', href: '/overdue-payments', icon: ListChecks, roles: ['admin'] },

  // Controls & Approvals
  { title: 'Approve Transactions', href: '/approve-transactions', icon: CheckSquare, roles: ['admin'] },

  // Reporting
  { title: 'AI Reports', href: '/reports', icon: FileText, roles: ['admin'] },
  { title: 'Account Statement', href: '/account-statement', icon: ClipboardPaste, roles: ['admin', 'member'], memberTitle: 'My Statement' },
];


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    // Ensure localStorage is accessed only on the client side
    if (typeof window !== 'undefined') {
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const role = localStorage.getItem('userRole');

      if (isAuthenticated !== 'true') {
        router.replace('/login');
      } else {
        setUserRole(role);
        setIsAuthenticating(false);
      }
    }
  }, [pathname, router]);

  const navItems = allNavItems
    .filter(item => item.roles?.includes(userRole || ''))
    .map(item => ({
      ...item,
      title: userRole === 'member' && item.memberTitle ? item.memberTitle : item.title,
    }));


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
        <div className="no-print">
            <Header />
        </div>
        <div className="flex flex-1">
          <div className="no-print">
            <Sidebar collapsible="icon" side="left" variant="sidebar" className="border-r">
                <SidebarHeader className="p-4 hidden md:flex items-center justify-center">
                <Logo />
                </SidebarHeader>
                <SidebarNav navItems={navItems} />
            </Sidebar>
            <SidebarRail />
          </div>
          <SidebarInset className="flex-1 overflow-y-auto">
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
