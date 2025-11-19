
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
import {
  LayoutDashboard,
  PiggyBank,
  PieChart,
  Landmark,
  FileText,
  School,
  Users,
  Shapes,
  WalletCards,
  Library,
  ListChecks,
  ReceiptText,
  ClipboardList,
  CheckSquare,
  Percent,
  ClipboardPaste,
  Banknote,
  AlertCircle,
  Calculator,
  CalendarCheck,
  UserX,
  Archive,
  Settings,
  UserPlus,
  Combine,
  UploadCloud,
  Newspaper,
  Settings2,
  History,
  UserRoundPlus,
} from 'lucide-react';
import React, { useEffect, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard:view',
  },

  { title: 'Basic Information', isGroupLabel: true },
  {
    title: 'Schools',
    href: '/schools',
    icon: School,
    permission: 'school:view',
  },
  {
    title: 'Members',
    href: '/members',
    icon: Users,
    permission: 'member:view',
  },
  {
    title: 'Add Saving Account',
    href: '/add-saving-account',
    icon: UserPlus,
    permission: 'savingAccount:create',
  },

  { title: 'Savings', isGroupLabel: true },
  {
    title: 'Savings Transactions',
    href: '/savings',
    icon: PiggyBank,
    permission: 'saving:view',
  },
  {
    title: 'Savings Accounts',
    href: '/savings-accounts',
    icon: WalletCards,
    permission: 'savingAccount:view',
  },
  {
    title: 'Calculate Savings Interest',
    href: '/calculate-interest',
    icon: Percent,
    permission: 'savingsInterestCalculation:view',
  },
  {
    title: 'Account Statement',
    href: '/account-statement',
    icon: ClipboardPaste,
    permission: 'accountStatement:view',
  },
  {
    title: 'Close Account',
    href: '/close-account',
    icon: UserX,
    permission: 'accountClosure:view',
  },
  {
    title: 'Closed Accounts',
    href: '/closed-accounts',
    icon: Archive,
    permission: 'closedAccount:view',
  },

  { title: 'Loans', isGroupLabel: true },
  { title: 'Loans', href: '/loans', icon: Banknote, permission: 'loan:view' },
  {
    title: 'Loan Repayments',
    href: '/loan-repayments',
    icon: ClipboardPaste,
    permission: 'loanRepayment:view',
  },
  {
    title: 'Calculate Loan Interest',
    href: '/calculate-loan-interest',
    icon: Calculator,
    permission: 'loanInterestCalculation:view',
  },
  {
    title: 'Overdue Loans',
    href: '/overdue-loans',
    icon: AlertCircle,
    permission: 'overdueLoan:view',
  },

  { title: 'Shares & Dividends', isGroupLabel: true },
  {
    title: 'Share Payments',
    href: '/shares',
    icon: PieChart,
    permission: 'share:view',
  },
  {
    title: 'Dividend Payouts',
    href: '/dividends',
    icon: Landmark,
    permission: 'dividend:view',
  },

  { title: 'Administration', isGroupLabel: true },
  {
    title: 'Approve Transactions',
    href: '/approve-transactions',
    icon: CheckSquare,
    permission: 'transactionApproval:view',
  },
  {
    title: 'Aggregate Collections',
    href: '/aggregate-collections',
    icon: Combine,
    permission: 'groupCollection:view',
  },
  {
    title: 'System Import',
    href: '/system-import',
    icon: UploadCloud,
    permission: 'systemImport:view',
  },
  {
    title: 'Applied Service Charges',
    href: '/applied-service-charges',
    icon: ClipboardList,
    permission: 'serviceCharge:view',
  },
  {
    title: 'Overdue Payments',
    href: '/overdue-payments',
    icon: ListChecks,
    permission: 'overduePayment:view',
  },
  {
    title: 'Collection Forecast',
    href: '/collection-forecast',
    icon: CalendarCheck,
    permission: 'collectionForecast:view',
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: FileText,
    permission: 'report:view',
  },
  {
    title: 'Audit Log',
    href: '/audit-log',
    icon: History,
    permission: 'auditLog:view',
  },

  { title: 'Website Management', isGroupLabel: true },
  {
    title: 'Website Settings',
    href: '/settings/website',
    icon: Settings2,
    permission: 'website:view',
  },
  {
    title: 'Manage News',
    href: '/settings/news',
    icon: Newspaper,
    permission: 'news:view',
  },

  { title: 'Configuration', isGroupLabel: true },
  {
    title: 'Application Settings',
    href: '/settings',
    icon: Settings,
    permission: 'setting:view',
  },
  {
    title: 'Register New User',
    href: '/settings/register',
    icon: UserRoundPlus,
    permission: 'setting:create',
  },
  {
    title: 'Saving Acct. Types',
    href: '/saving-account-types',
    icon: WalletCards,
    permission: 'configuration:view',
  },
  {
    title: 'Share Types',
    href: '/share-types',
    icon: Shapes,
    permission: 'configuration:view',
  },
  {
    title: 'Loan Types',
    href: '/loan-types',
    icon: Banknote,
    permission: 'configuration:view',
  },
  {
    title: 'Service Charge Types',
    href: '/service-charge-types',
    icon: ReceiptText,
    permission: 'configuration:view',
  },
  {
    title: 'SMS Notifications',
    href: '/settings/sms',
    icon: ReceiptText, // Using existing icon, can be changed
    permission: 'setting:view',
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user, member, content, logout } = useAuth();
  const { toast } = useToast();

  const filteredNavItems = useMemo(() => {
    if (!user?.permissions) return [];

    return navItems.reduce((acc, item) => {
      if (item.isGroupLabel) {
        const groupIndex = navItems.indexOf(item);
        let nextGroupIndex = navItems.findIndex(
          (it, idx) => idx > groupIndex && it.isGroupLabel
        );
        if (nextGroupIndex === -1) nextGroupIndex = navItems.length;

        const itemsInGroup = navItems.slice(groupIndex + 1, nextGroupIndex);
        const isGroupVisible = itemsInGroup.some((groupItem) =>
          user.permissions.includes(groupItem.permission!)
        );

        if (isGroupVisible) {
          acc.push(item);
        }
      } else if (!item.permission || user.permissions.includes(item.permission)) {
        acc.push(item);
      }
      return acc;
    }, [] as NavItem[]);
  }, [user]);
  
  // Session Timeout Logic
  const handleInactiveLogout = useCallback(() => {
    toast({
      title: 'Session Expired',
      description: 'You have been logged out due to inactivity.',
      variant: 'destructive'
    });
    logout();
  }, [logout, toast]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const sessionTimeout = 1000 * 60 * 15; // 15 minutes
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleInactiveLogout, sessionTimeout);
    };

    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];

    const resetTimerOnActivity = () => resetTimer();

    events.forEach(event => window.addEventListener(event, resetTimerOnActivity));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimerOnActivity));
    };
  }, [isAuthenticated, handleInactiveLogout]);


  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    
    if (member?.mustChangePassword) {
      if (!pathname.startsWith('/member-change-password')) {
        router.replace(`/member-change-password`);
      }
      return;
    }
    
    // If a member is authenticated but is not on their own profile page, redirect them.
    if (member && !pathname.startsWith(`/member-profile/${member.id}`)) {
        router.replace(`/member-profile/${member.id}`);
        return;
    }

    // Admin user is logged in
    if (user) { 
      const navItem = [...navItems]
        .filter((item) => item.href && item.href !== '/')
        .sort((a, b) => b.href!.length - a.href!.length)
        .find((item) => pathname.startsWith(item.href!));

      // If the route doesn't correspond to a nav item (like a member profile page for an admin),
      // we don't need to do a permission check on it here. The page's own data fetching will handle auth.
      if (navItem && navItem.permission) {
        if (!user.permissions.includes(navItem.permission)) {
          router.replace('/dashboard');
        }
      }
    }
  }, [pathname, user, member, isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Logo logo={content?.logo} saccoName={content?.saccoName} />
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">
            Verifying your session...
          </p>
        </div>
      </div>
    );
  }

  // Unified layout with conditional sidebar
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full flex-col">
        <div className="no-print">
          <Header content={content} />
        </div>
        <div className="flex flex-1">
          {user && ( // Only render sidebar for admin users
            <div className="no-print flex-shrink-0">
              <Sidebar
                collapsible="icon"
                side="left"
                variant="sidebar"
                className="border-r"
              >
                <SidebarHeader className="p-4 hidden md:flex items-center justify-center">
                  <Logo logo={content?.logo} saccoName={content?.saccoName} />
                </SidebarHeader>
                <SidebarNav navItems={filteredNavItems} />
              </Sidebar>
              <SidebarRail />
            </div>
          )}
          <SidebarInset className="flex-1 overflow-y-auto">
            <main className="p-4 sm:p-6 lg:p-8">{children}</main>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
