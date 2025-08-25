import React from 'react';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import NavigationHeader from './navigation/NavigationHeader';
import NavigationItems from './navigation/NavigationItems';
import UserMenu from './navigation/UserMenu';

const NavigationWrapper = ({ children }) => {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex w-full min-h-screen">
        <NavigationSidebar />
        <SidebarInset className="px-6 py-6 w-full overflow-x-hidden">
          {/* Mobile navigation trigger */}
          <div className="md:hidden absolute top-4 left-4 z-50">
            <SidebarTrigger />
          </div>
          <div className="w-full overflow-x-auto scrollbar-hide">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

const NavigationSidebar = () => {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  
  return (
    <Sidebar 
      variant="sidebar" 
      collapsible="icon" 
      className="overflow-visible"
    >
      <SidebarHeader className="p-0 relative">
        <NavigationHeader 
          collapsed={collapsed} 
          toggleSidebar={toggleSidebar} 
        />
      </SidebarHeader>
      
      <SidebarContent>
        <NavigationItems collapsed={collapsed} />
      </SidebarContent>

      <SidebarFooter>
        <div className={cn("py-2", collapsed ? "px-0" : "px-3")}>
          <UserMenu collapsed={collapsed} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default NavigationWrapper;