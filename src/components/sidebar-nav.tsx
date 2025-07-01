
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
import { useAuth } from '@/contexts/auth-context';

interface SidebarNavProps {
  navItems: NavItem[];
  className?: string;
}

export function SidebarNav({ navItems, className }: SidebarNavProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    if (setOpenMobile) setOpenMobile(false);
  };

  if (!navItems?.length) {
    return null;
  }

  return (
    <SidebarContent className={cn("flex flex-col justify-between", className)}>
      <SidebarMenu>
        {navItems.map((item, index) => {
          if (item.isGroupLabel) {
            return (
              <li key={index} className="px-2 pt-5 pb-1 text-xs font-semibold uppercase text-sidebar-foreground/70 tracking-wider group-data-[state=collapsed]/sidebar-wrapper:hidden">
                {item.title}
              </li>
            );
          }

          const Icon = item.icon;
          if (!Icon || !item.href) {
              return null;
          }
          
          const isActive = item.href === '/' ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <SidebarMenuItem key={index}>
              <SidebarMenuButton
                asChild
                variant={isActive ? 'default' : 'ghost'}
                className={cn(
                  isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  item.disabled && 'cursor-not-allowed opacity-80'
                )}
                onClick={() => {
                  if (item.disabled) return; 
                  if (setOpenMobile) setOpenMobile(false);
                }}
                disabled={item.disabled}
                tooltip={item.title}
              >
                <Link href={item.disabled ? '#' : item.href}>
                  <Icon className="mr-2 h-5 w-5" />
                  <span className="truncate">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
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
                    <>
                      <LogOut className="mr-2 h-5 w-5" />
                      <span className="truncate">Logout</span>
                    </>
                  </SidebarMenuButton>
            </SidebarMenuItem>
         </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
  );
}
