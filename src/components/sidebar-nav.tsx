
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarContent,
  useSidebar,
} from '@/components/ui/sidebar';
import type { NavItem } from '@/types';
import { cn } from '@/lib/utils';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface SidebarNavProps {
  navItems: NavItem[];
  className?: string;
}

export function SidebarNav({ navItems, className }: SidebarNavProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    router.push('/login');
    if (setOpenMobile) setOpenMobile(false);
  };

  if (!navItems?.length) {
    return null;
  }

  return (
    <SidebarContent className={cn("flex flex-col justify-between", className)}>
      <SidebarMenu>
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.href === '/' ? pathname === item.href : pathname.startsWith(item.href);
          return (
            item.href && (
              <SidebarMenuItem key={index}>
                <Link href={item.disabled ? '#' : item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    asChild // SidebarMenuButton uses its own asChild
                    variant={isActive ? 'default' : 'ghost'}
                    className={cn(
                      isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      item.disabled && 'cursor-not-allowed opacity-80'
                    )}
                    onClick={() => {
                      // For Link with legacyBehavior, onClick on the <a> tag handles navigation.
                      // This onClick is for other actions like closing mobile sidebar.
                      if (setOpenMobile) setOpenMobile(false);
                    }}
                    tooltip={item.title}
                  >
                    <a> {/* This anchor tag receives the href */}
                      <Icon className="mr-2 h-5 w-5" />
                      <span className="truncate">{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )
          );
        })}
      </SidebarMenu>
      
      <SidebarGroup className="mt-auto p-2">
         <SidebarMenu>
            <SidebarMenuItem>
                 <SidebarMenuButton
                    variant="ghost"
                    className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    onClick={handleLogout}
                    tooltip="Logout"
                  >
                    <LogOut className="mr-2 h-5 w-5" />
                    <span className="truncate">Logout</span>
                  </SidebarMenuButton>
            </SidebarMenuItem>
         </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
  );
}
