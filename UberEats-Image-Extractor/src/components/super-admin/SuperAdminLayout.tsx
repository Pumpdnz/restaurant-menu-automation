import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Building2, Users, BarChart3, Settings, Shield } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';

interface SuperAdminLayoutProps {
  children?: React.ReactNode;
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function SuperAdminLayout({ children, activeTab, onTabChange }: SuperAdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Shield className="h-6 w-6 text-purple-600 mr-2" />
              <h1 className="text-xl font-semibold">Super Admin Dashboard</h1>
              <Badge variant="secondary" className="ml-3 bg-purple-100 text-purple-700">
                SUPER ADMIN
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/">
                <Button variant="outline" size="sm">
                  Back to App
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="organizations" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organizations
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Usage
            </TabsTrigger>
          </TabsList>

          {children}
        </Tabs>
      </div>
    </div>
  );
}