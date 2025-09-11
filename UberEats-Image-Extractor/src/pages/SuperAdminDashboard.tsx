import React, { useState } from 'react';
import { SuperAdminRoute } from '../components/super-admin/SuperAdminRoute';
import { SuperAdminLayout } from '../components/super-admin/SuperAdminLayout';
import { SuperAdminOrganizations } from '../components/super-admin/SuperAdminOrganizations';
import { SuperAdminUsers } from '../components/super-admin/SuperAdminUsers';
import { SuperAdminUsage } from '../components/super-admin/SuperAdminUsage';
import { TabsContent } from '../components/ui/tabs';

export function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState('organizations');

  return (
    <SuperAdminRoute>
      <SuperAdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
        <TabsContent value="organizations" className="space-y-4">
          <SuperAdminOrganizations />
        </TabsContent>
        
        <TabsContent value="users" className="space-y-4">
          <SuperAdminUsers />
        </TabsContent>
        
        <TabsContent value="usage" className="space-y-4">
          <SuperAdminUsage />
        </TabsContent>
      </SuperAdminLayout>
    </SuperAdminRoute>
  );
}