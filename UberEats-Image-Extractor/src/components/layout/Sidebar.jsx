import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Store,
  FileText, 
  BarChart3, 
  Settings,
  Download,
  Upload,
  History,
  Search
} from 'lucide-react';
import { cn } from '../../lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Restaurants', href: '/restaurants', icon: Store },
  { name: 'Extractions', href: '/extractions', icon: Download },
  { name: 'Menus', href: '/menus', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'History', href: '/history', icon: History },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar({ sidebarOpen }) {
  const location = useLocation();

  return (
    <>
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" />
      )}

      {/* Sidebar with glass panel effect */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 bg-background/95 backdrop-blur-lg border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 lg:block",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo area - mobile only */}
          <div className="flex items-center h-16 px-6 border-b border-border lg:hidden">
            <span className="text-2xl font-bold bg-gradient-to-r from-brand-blue to-brand-green bg-clip-text text-transparent">
              Pumpd
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                             (item.href !== '/' && location.pathname.startsWith(item.href));
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-brand-blue/10 text-brand-blue border border-brand-blue/20 shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon 
                    className={cn(
                      "mr-3 h-5 w-5 transition-colors",
                      isActive ? "text-brand-blue" : "text-muted-foreground"
                    )} 
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Quick actions */}
          <div className="px-4 py-4 border-t border-border">
            <Link
              to="/extractions/new"
              className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-brand-blue to-brand-green rounded-lg hover:opacity-90 transition-opacity shadow-lg"
            >
              <Upload className="mr-2 h-4 w-4" />
              New Extraction
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}