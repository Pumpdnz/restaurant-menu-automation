import React, { useMemo } from 'react';
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
  CheckSquare,
  FileText,
  ClipboardList,
  Workflow,
  Users,
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
  const { isSuperAdmin, user } = useAuth();

  // Get feature flags from the user's organisation
  const featureFlags = useMemo(() => {
    return user?.organisation?.feature_flags || {};
  }, [user?.organisation?.feature_flags]);

  // Helper to check if a feature is enabled
  const isFeatureEnabled = (flagPath) => {
    const parts = flagPath.split('.');
    let current = featureFlags;
    for (const part of parts) {
      if (current === undefined || current === null) return false;
      current = current[part];
    }
    // Handle both { enabled: true } format and direct boolean
    if (typeof current === 'object' && current !== null) {
      return current.enabled !== false;
    }
    return current !== false;
  };

  const navigationItems = useMemo(() => {
    const items = [
      { href: '/', label: 'Dashboard', icon: Home },
      { href: '/restaurants', label: 'Restaurants', icon: Store },
    ];

    // Tasks & Sequences - conditionally show based on feature flag
    if (isFeatureEnabled('tasksAndSequences')) {
      items.push({ href: '/tasks', label: 'Tasks', icon: CheckSquare });
      items.push({ href: '/sequences', label: 'Sequences', icon: Workflow });
    }

    // Lead Scraping - conditionally show based on feature flag
    if (isFeatureEnabled('leadScraping')) {
      items.push({ href: '/leads', label: 'Lead Scraping', icon: Users });
    }

    items.push({ href: '/extractions', label: 'Extractions', icon: Download });
    items.push({ href: '/menus', label: 'Menus', icon: Menu });

    // Social Media - conditionally show based on feature flag
    if (isFeatureEnabled('socialMedia')) {
      items.push({ href: '/social-media', label: 'Social Media', icon: Video });
    }

    items.push({ href: '/analytics', label: 'Analytics', icon: BarChart });
    items.push({ href: '/history', label: 'History', icon: History });
    items.push({ href: '/settings', label: 'Settings', icon: Settings });

    // Add Super Admin link if user is super admin
    if (isSuperAdmin && isSuperAdmin()) {
      items.push({
        href: '/super-admin',
        label: 'Super Admin',
        icon: Shield,
        className: 'text-purple-600 hover:text-purple-700'
      });
    }

    return items;
  }, [featureFlags, isSuperAdmin]);
  
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