
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
import { LayoutDashboard, PiggyBank, PieChart, Landmark, FileText, School, Users, Shapes, WalletCards, Library, ListChecks, ReceiptText, ClipboardList, CheckSquare, Percent, ClipboardPaste, Banknote, AlertCircle, Calculator, CalendarCheck, UserX, Archive, Settings, UserPlus } from 'lucide-react';
import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Loader2 } from 'lucide-react';

const allNavItems: NavItem[] = [
  // Always visible
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard:view' },

  // BASIC INFORMATION
  { title: 'Basic Information', isGroupLabel: true },
  { title: 'Schools', href: '/schools', icon: School, permission: 'school:view' },
  { title: 'Members', href: '/members', icon: Users, permission: 'member:view' },
  
  // SAVING RELATED
  { title: 'Savings', isGroupLabel: true },
  { title: 'Savings Transactions', href: '/savings', icon: PiggyBank, permission: 'saving:view' },
  { title: 'Savings Accounts', href: '/savings-accounts', icon: WalletCards, permission: 'savingAccount:view' },
  { title: 'Group Collections', href: '/group-collections', icon: Library, permission: 'groupCollection:view' },
  { title: 'Calculate Savings Interest', href: '/calculate-interest', icon: Percent, permission: 'interestCalculation:view' },
  { title: 'Account Statement', href: '/account-statement', icon: ClipboardPaste, permission: 'accountStatement:view' },
  { title: 'Close Account', href: '/close-account', icon: UserX, permission: 'accountClosure:view' },
  { title: 'Closed Accounts', href: '/closed-accounts', icon: Archive, permission: 'closedAccount:view' },

  // LOAN RELATED
  { title: 'Loans', isGroupLabel: true },
  { title: 'Loans', href: '/loans', icon: Banknote, permission: 'loan:view' },
  { title: 'Loan Repayments', href: '/loan-repayments', icon: ClipboardPaste, permission: 'loanRepayment:view' },
  { title: 'Group Loan Repayments', href: '/group-loan-repayments', icon: Library, permission: 'groupLoanRepayment:view' },
  { title: 'Calculate Loan Interest', href: '/calculate-loan-interest', icon: Calculator, permission: 'interestCalculation:view' },
  { title: 'Overdue Loans', href: '/overdue-loans', icon: AlertCircle, permission: 'overdueLoan:view' },
  
  // DIVIDEND/SHARE RELATED
  { title: 'Shares & Dividends', isGroupLabel: true },
  { title: 'Share Allocations', href: '/shares', icon: PieChart, permission: 'share:view' },
  { title: 'Dividend Payouts', href: '/dividends', icon: Landmark, permission: 'dividend:view' },
  
  // ADMINISTRATION (Covers Settings, Operations, Monitoring)
  { title: 'Administration', isGroupLabel: true },
  { title: 'Approve Transactions', href: '/approve-transactions', icon: CheckSquare, permission: 'transactionApproval:view' },
  { title: 'Applied Service Charges', href: '/applied-service-charges', icon: ClipboardList, permission: 'serviceCharge:view' },
  { title: 'Overdue Payments', href: '/overdue-payments', icon: ListChecks, permission: 'overduePayment:view' },
  { title: 'Collection Forecast', href: '/collection-forecast', icon: CalendarCheck, permission: 'report:view' },
  { title: 'AI Reports', href: '/reports', icon: FileText, permission: 'report:view' },
  { title: 'Settings', href: '/settings', icon: Settings, permission: 'setting:view' },

  // CONFIGURATION
  { title: 'Configuration', isGroupLabel: true },
  { title: 'Saving Acct. Types', href: '/saving-account-types', icon: WalletCards, permission: 'configuration:view' },
  { title: 'Share Types', href: '/share-types', icon: Shapes, permission: 'configuration:view' },
  { title: 'Loan Types', href: '/loan-types', icon: Banknote, permission: 'configuration:view' },
  { title: 'Service Charge Types', href: '/service-charge-types', icon: ReceiptText, permission: 'configuration:view' },
];


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  
  const navItems = useMemo(() => {
    if (!user?.permissions) return [];
    
    const userPermissions = new Set(user.permissions);
    
    return allNavItems.filter(item => {
        if (!item.permission) return true; // Group labels and items without specific permissions
        return userPermissions.has(item.permission);
    });

  }, [user]);


  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">Verifying your session...</p>
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
