import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const NavigationHeader = memo(({ collapsed, toggleSidebar }) => {
  const displayName = "Menu Manager";
  
  return (
    <div className="flex flex-col gap-2 px-3 py-4 relative">
      {!collapsed ? (
        <div className="flex items-center gap-2 justify-start">
          <Avatar className="h-8 w-8 rounded-md bg-gradient-to-br from-brand-blue to-brand-green">
            <AvatarFallback className="bg-transparent">
              <Package className="h-4 w-4 text-white" />
            </AvatarFallback>
          </Avatar>
          
          <span className="text-sm font-medium truncate max-w-[140px]">
            {displayName}
          </span>
        </div>
      ) : (
        <div className="h-8"></div>
      )}
      
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 rounded-full z-20",
          collapsed 
            ? "absolute top-4 left-1/2 transform -translate-x-1/2" 
            : "absolute right-3 top-4"
        )}
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
        <span className="sr-only">Toggle navigation</span>
      </Button>
    </div>
  );
});

NavigationHeader.displayName = 'NavigationHeader';

export default NavigationHeader;