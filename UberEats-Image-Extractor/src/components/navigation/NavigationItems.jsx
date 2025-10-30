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
  Shield,
  Video,
} from 'lucide-react';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const NavigationItems = ({ collapsed }) => {
  const location = useLocation();
  const { isSuperAdmin } = useAuth();
  
  const navigationItems = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/restaurants', label: 'Restaurants', icon: Store },
    { href: '/extractions', label: 'Extractions', icon: Download },
    { href: '/menus', label: 'Menus', icon: Menu },
    { href: '/social-media', label: 'Social Media', icon: Video },
    { href: '/analytics', label: 'Analytics', icon: BarChart },
    { href: '/history', label: 'History', icon: History },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];
  
  // Add Super Admin link if user is super admin
  if (isSuperAdmin && isSuperAdmin()) {
    navigationItems.push({ 
      href: '/super-admin', 
      label: 'Super Admin', 
      icon: Shield,
      className: 'text-purple-600 hover:text-purple-700'
    });
  }
  
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
                  className={item.className}
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