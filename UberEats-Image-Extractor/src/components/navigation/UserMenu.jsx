import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { LogOut, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const UserMenu = ({ collapsed }) => {
  // Placeholder user data - will be replaced with auth context later
  const user = {
    name: 'User',
    email: 'user@example.com',
    role: 'admin'
  };
  
  const displayName = user?.name || user?.email || 'User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
  
  const handleLogout = () => {
    // Placeholder logout function - will be replaced with actual auth
    console.log('Logout clicked');
  };
  
  return (
    <div className="flex flex-col gap-2">
      <div 
        className={cn(
          "flex items-center gap-3 p-2 rounded-md w-full",
          collapsed ? "justify-center" : "justify-start"
        )}
      >
        <Avatar className={cn("", collapsed ? "h-8 w-8" : "h-10 w-10")}>
          <AvatarFallback className={cn("bg-brand-yellow text-brand-dark-text", collapsed ? "text-sm" : "text-base")}>
            {initials}
          </AvatarFallback>
        </Avatar>
        
        {!collapsed && (
          <div className="flex flex-col justify-center">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[180px] mt-1">{user?.email}</p>
            {user?.role && (
              <Badge variant="secondary" className="mt-1 text-xs px-1.5 py-0">
                {user.role}
              </Badge>
            )}
          </div>
        )}
      </div>
      
      <div className={cn("", collapsed ? "flex justify-center" : "")}>
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
            "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
            collapsed ? "w-auto" : "w-full justify-start"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default UserMenu;