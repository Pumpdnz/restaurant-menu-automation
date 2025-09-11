import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { UserTable } from './users/UserTable';
import { CreateUserModal } from './users/CreateUserModal';
import { EditUserModal } from './users/EditUserModal';
import { DeleteUserModal } from './users/DeleteUserModal';
import { useToast } from '../ui/use-toast';
import { supabase } from '../../lib/supabase';
import { Loader2, UserPlus, Download } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'user';
  organisation_id: string;
  organisation?: {
    id: string;
    name: string;
  };
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  last_login_at?: string;
}

export function SuperAdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load users with organization details
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select(`
          *,
          organisation:organisations(id, name)
        `)
        .order('created_at', { ascending: false });

      if (userError) throw userError;

      // Load organizations for dropdowns
      const { data: orgData, error: orgError } = await supabase
        .from('organisations')
        .select('id, name')
        .eq('status', 'active')
        .order('name');

      if (orgError) throw orgError;

      setUsers(userData || []);
      setOrganizations(orgData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditModalOpen(true);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  const handleReassign = async (user: User) => {
    // This could open a specific modal for reassignment
    // For now, we'll use the edit modal
    handleEdit(user);
  };

  const handleResendInvite = async (user: User) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`/api/super-admin/users/${user.id}/resend-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to resend invitation');
      }

      toast({
        title: 'Invitation Sent',
        description: `Invitation email sent to ${user.email}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resend invitation',
        variant: 'destructive'
      });
    }
  };

  const handleExport = async () => {
    try {
      const csv = [
        ['Name', 'Email', 'Role', 'Organization', 'Status', 'Created', 'Last Login'],
        ...users.map(user => [
          user.name || '',
          user.email,
          user.role,
          user.organisation?.name || '',
          user.status || 'active',
          new Date(user.created_at).toLocaleDateString(),
          user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Complete',
        description: 'User data exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export user data',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-gray-500">Manage all users across organizations</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Total Users</p>
          <p className="text-2xl font-bold">{users.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Super Admins</p>
          <p className="text-2xl font-bold">
            {users.filter(u => u.role === 'super_admin').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Admins</p>
          <p className="text-2xl font-bold">
            {users.filter(u => u.role === 'admin').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Active Users</p>
          <p className="text-2xl font-bold">
            {users.filter(u => (!u.status || u.status === 'active')).length}
          </p>
        </Card>
      </div>

      {/* User Table */}
      <Card className="p-6">
        <UserTable
          users={users}
          organizations={organizations}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onReassign={handleReassign}
          onResendInvite={handleResendInvite}
        />
      </Card>

      {/* Modals */}
      <CreateUserModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        organizations={organizations}
        onUserCreated={loadData}
      />
      
      <EditUserModal
        user={selectedUser}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        organizations={organizations}
        onUserUpdated={loadData}
      />
      
      <DeleteUserModal
        user={selectedUser}
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onUserDeleted={loadData}
      />
    </div>
  );
}