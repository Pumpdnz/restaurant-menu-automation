import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Store,
  Download,
  Menu,
  BarChart,
  History,
  Settings,
} from 'lucide-react';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const NavigationItems = ({ collapsed }) => {
  const location = useLocation();
  
  const navigationItems = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/restaurants', label: 'Restaurants', icon: Store },
    { href: '/extractions', label: 'Extractions', icon: Download },
    { href: '/menus', label: 'Menus', icon: Menu },
    { href: '/analytics', label: 'Analytics', icon: BarChart },
    { href: '/history', label: 'History', icon: History },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];
  
  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };
  
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={collapsed ? item.label : null}
                >
                  <Link to={item.href}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default NavigationItems;