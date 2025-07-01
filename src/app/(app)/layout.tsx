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
import { LayoutDashboard, PiggyBank, PieChart, Landmark, FileText, School, Users, Shapes, WalletCards, Library, ListChecks, ReceiptText, ClipboardList, CheckSquare, Percent, ClipboardPaste, Banknote, AlertCircle, Calculator, CalendarCheck, UserX, Archive } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const navItems: NavItem[] = [
  // Always visible
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },

  // BASIC INFORMATION
  { title: 'Basic Information', isGroupLabel: true },
  { title: 'Schools', href: '/schools', icon: School },
  { title: 'Members', href: '/members', icon: Users },
  
  // SAVING RELATED
  { title: 'Savings', isGroupLabel: true },
  { title: 'Savings Transactions', href: '/savings', icon: PiggyBank },
  { title: 'Savings Accounts', href: '/savings-accounts', icon: WalletCards },
  { title: 'Group Collections', href: '/group-collections', icon: Library },
  { title: 'Calculate Savings Interest', href: '/calculate-interest', icon: Percent },
  { title: 'Account Statement', href: '/account-statement', icon: ClipboardPaste },
  { title: 'Close Account', href: '/close-account', icon: UserX },
  { title: 'Closed Accounts', href: '/closed-accounts', icon: Archive },

  // LOAN RELATED
  { title: 'Loans', isGroupLabel: true },
  { title: 'Loans', href: '/loans', icon: Banknote },
  { title: 'Loan Repayments', href: '/loan-repayments', icon: ClipboardPaste },
  { title: 'Group Loan Repayments', href: '/group-loan-repayments', icon: Library },
  { title: 'Calculate Loan Interest', href: '/calculate-loan-interest', icon: Calculator },
  { title: 'Overdue Loans', href: '/overdue-loans', icon: AlertCircle },
  
  // DIVIDEND/SHARE RELATED
  { title: 'Shares & Dividends', isGroupLabel: true },
  { title: 'Share Allocations', href: '/shares', icon: PieChart },
  { title: 'Dividend Payouts', href: '/dividends', icon: Landmark },
  
  // ADMINISTRATION (Covers Settings, Operations, Monitoring)
  { title: 'Administration', isGroupLabel: true },
  { title: 'Approve Transactions', href: '/approve-transactions', icon: CheckSquare },
  { title: 'Applied Service Charges', href: '/applied-service-charges', icon: ClipboardList },
  { title: 'Overdue Payments', href: '/overdue-payments', icon: ListChecks },
  { title: 'Collection Forecast', href: '/collection-forecast', icon: CalendarCheck },
  { title: 'AI Reports', href: '/reports', icon: FileText },

  // CONFIGURATION
  { title: 'Configuration', isGroupLabel: true },
  { title: 'Saving Acct. Types', href: '/saving-account-types', icon: WalletCards },
  { title: 'Share Types', href: '/share-types', icon: Shapes },
  { title: 'Loan Types', href: '/loan-types', icon: Banknote },
  { title: 'Service Charge Types', href: '/service-charge-types', icon: ReceiptText },
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
