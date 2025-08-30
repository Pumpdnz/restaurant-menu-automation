import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { LogOut, User, Building, Crown, Shield, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../../context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

const UserMenu = ({ collapsed }) => {
  const { user, logout, isAdmin, isSuperAdmin, organization } = useAuth();
  const navigate = useNavigate();
  
  // Use actual user data or fallback
  const displayName = user?.name || user?.email || 'User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
  
  const handleLogout = async () => {
    try {
      await logout();
      // Navigation is handled in the AuthContext logout function
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  
  // Get role badge variant and icon
  const getRoleBadgeInfo = () => {
    if (isSuperAdmin()) {
      return { 
        variant: 'default', 
        icon: <Crown className="h-3 w-3" />,
        label: 'Super Admin'
      };
    }
    if (isAdmin()) {
      return { 
        variant: 'secondary', 
        icon: <Shield className="h-3 w-3" />,
        label: 'Admin'
      };
    }
    return { 
      variant: 'outline', 
      icon: <User className="h-3 w-3" />,
      label: 'User'
    };
  };
  
  const roleInfo = getRoleBadgeInfo();
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-3 p-2 rounded-md w-full hover:bg-accent transition-colors",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          <Avatar className={cn("", collapsed ? "h-8 w-8" : "h-10 w-10")}>
            <AvatarFallback className={cn("bg-brand-yellow text-brand-dark-text", collapsed ? "text-sm" : "text-base")}>
              {initials}
            </AvatarFallback>
          </Avatar>
          
          {!collapsed && (
            <div className="flex flex-col justify-center text-left">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[180px] mt-1">{user?.email}</p>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {organization && (
          <>
            <DropdownMenuItem className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              <div className="flex flex-col">
                <span className="text-sm">{organization.name}</span>
                <Badge variant={roleInfo.variant} className="mt-1 text-xs h-5">
                  {roleInfo.icon}
                  {roleInfo.label}
                </Badge>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        {(isAdmin() || isSuperAdmin()) && (
          <>
            <DropdownMenuItem 
              onClick={() => navigate('/settings/organization')}
              className="cursor-pointer"
            >
              <Settings className="h-4 w-4 mr-2" />
              Organization Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        {isSuperAdmin() && (
          <>
            <DropdownMenuItem 
              onClick={() => navigate('/super-admin')}
              className="cursor-pointer"
            >
              <Crown className="h-4 w-4 mr-2" />
              Super Admin Dashboard
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuItem 
          onClick={handleLogout}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;