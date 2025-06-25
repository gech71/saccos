
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
import { LayoutDashboard, PiggyBank, PieChart, Landmark, FileText, School, Users, Shapes, WalletCards, Library, ListChecks, ReceiptText, ClipboardList, CheckSquare, Percent, ClipboardPaste, Banknote, AlertCircle, Calculator, CalendarCheck, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const allNavItems: NavItem[] = [
  // Always visible
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'member'] },

  // BASIC INFORMATION
  { title: 'Basic Information', isGroupLabel: true, roles: ['admin'] },
  { title: 'Schools', href: '/schools', icon: School, roles: ['admin'] },
  { title: 'Members', href: '/members', icon: Users, roles: ['admin'] },
  
  // SAVING RELATED
  { title: 'Savings', isGroupLabel: true, roles: ['admin'] },
  { title: 'Savings Transactions', href: '/savings', icon: PiggyBank, roles: ['admin', 'member'], memberTitle: 'My Savings' },
  { title: 'Savings Accounts', href: '/savings-accounts', icon: WalletCards, roles: ['admin'] },
  { title: 'Group Collections', href: '/group-collections', icon: Library, roles: ['admin'] },
  { title: 'Calculate Savings Interest', href: '/calculate-interest', icon: Percent, roles: ['admin'] },
  { title: 'Account Statement', href: '/account-statement', icon: ClipboardPaste, roles: ['admin', 'member'], memberTitle: 'My Statement' },
  { title: 'Close Account', href: '/close-account', icon: UserX, roles: ['admin'] },

  // LOAN RELATED
  { title: 'Loans', isGroupLabel: true, roles: ['admin'] },
  { title: 'Loans', href: '/loans', icon: Banknote, roles: ['admin', 'member'], memberTitle: 'My Loans' },
  { title: 'Loan Repayments', href: '/loan-repayments', icon: ClipboardPaste, roles: ['admin'] },
  { title: 'Group Loan Repayments', href: '/group-loan-repayments', icon: Library, roles: ['admin'] },
  { title: 'Calculate Loan Interest', href: '/calculate-loan-interest', icon: Calculator, roles: ['admin'] },
  { title: 'Overdue Loans', href: '/overdue-loans', icon: AlertCircle, roles: ['admin'] },
  
  // DIVIDEND/SHARE RELATED
  { title: 'Shares & Dividends', isGroupLabel: true, roles: ['admin', 'member'] },
  { title: 'Share Allocations', href: '/shares', icon: PieChart, roles: ['admin', 'member'], memberTitle: 'My Shares' },
  { title: 'Dividend Payouts', href: '/dividends', icon: Landmark, roles: ['admin', 'member'], memberTitle: 'My Dividends' },
  
  // ADMINISTRATION (Covers Settings, Operations, Monitoring)
  { title: 'Administration', isGroupLabel: true, roles: ['admin'] },
  { title: 'Approve Transactions', href: '/approve-transactions', icon: CheckSquare, roles: ['admin'] },
  { title: 'Applied Service Charges', href: '/applied-service-charges', icon: ClipboardList, roles: ['admin'] },
  { title: 'Overdue Payments', href: '/overdue-payments', icon: ListChecks, roles: ['admin'] },
  { title: 'Collection Forecast', href: '/collection-forecast', icon: CalendarCheck, roles: ['admin'] },
  { title: 'AI Reports', href: '/reports', icon: FileText, roles: ['admin'] },

  // CONFIGURATION
  { title: 'Configuration', isGroupLabel: true, roles: ['admin'] },
  { title: 'Saving Acct. Types', href: '/saving-account-types', icon: WalletCards, roles: ['admin'] },
  { title: 'Share Types', href: '/share-types', icon: Shapes, roles: ['admin'] },
  { title: 'Loan Types', href: '/loan-types', icon: Banknote, roles: ['admin'] },
  { title: 'Service Charge Types', href: '/service-charge-types', icon: ReceiptText, roles: ['admin'] },
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
