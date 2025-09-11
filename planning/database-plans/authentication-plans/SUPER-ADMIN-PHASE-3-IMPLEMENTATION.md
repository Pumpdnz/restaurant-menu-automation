# Super Admin Dashboard - Phase 3: User Management Implementation

## Overview
Phase 3 implements comprehensive user management functionality for super admins, including CRUD operations, organization assignment, role management, and invitation system integration.

## Prerequisites
- Phase 1 completed (Foundation & Route Protection)
- Phase 2 completed (Organization Management)
- Existing invitation system from main authentication implementation
- Email sending via Edge Functions

## Timeline
**Duration**: 1 Day (8-10 hours)
**Deliverable**: Complete user management system with all CRUD operations

## Tasks Breakdown

### Task 1: Database Schema Updates (1 hour)

#### 1.1 Extend Profiles Table for Future Fields
```sql
-- Migration: extend_profiles_for_super_admin
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_organisation ON profiles(organisation_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
```

#### 1.2 Create User Activity Tracking
```sql
-- Migration: create_user_activity_log
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  performed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_date ON user_activity_log(created_at);
```

#### 1.3 Create Functions for User Management
```sql
-- Function to safely delete user
CREATE OR REPLACE FUNCTION delete_user_safely(
  p_user_id UUID,
  p_deleted_by UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_org UUID;
  v_admin_count INT;
BEGIN
  -- Get user's organization
  SELECT organisation_id INTO v_user_org
  FROM profiles WHERE id = p_user_id;
  
  -- Check if user is last admin of organization
  SELECT COUNT(*) INTO v_admin_count
  FROM profiles 
  WHERE organisation_id = v_user_org 
  AND role IN ('admin', 'super_admin')
  AND id != p_user_id;
  
  IF v_admin_count = 0 THEN
    RAISE EXCEPTION 'Cannot delete last admin of organization';
  END IF;
  
  -- Log the deletion
  INSERT INTO user_activity_log (user_id, action, details, performed_by)
  VALUES (p_user_id, 'deleted', jsonb_build_object('deleted_at', NOW()), p_deleted_by);
  
  -- Delete the user (will cascade due to foreign keys)
  DELETE FROM auth.users WHERE id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reassign user to new organization
CREATE OR REPLACE FUNCTION reassign_user_to_org(
  p_user_id UUID,
  p_new_org_id UUID,
  p_performed_by UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- Update user's organization
  UPDATE profiles
  SET organisation_id = p_new_org_id,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Log the reassignment
  INSERT INTO user_activity_log (user_id, action, details, performed_by)
  VALUES (p_user_id, 'org_reassigned', 
    jsonb_build_object('new_org_id', p_new_org_id), 
    p_performed_by);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Task 2: User List Component (2 hours)

#### 2.1 User Table Component
**File**: `/src/components/super-admin/UserTable.tsx`
```typescript
import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { 
  MoreHorizontal, 
  Edit, 
  UserX, 
  ArrowUpDown,
  Mail,
  Building2,
  Shield,
  User as UserIcon 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

interface UserTableProps {
  users: User[];
  organizations: Array<{ id: string; name: string }>;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onReassign: (user: User) => void;
  onResendInvite: (user: User) => void;
}

export function UserTable({
  users,
  organizations,
  onEdit,
  onDelete,
  onReassign,
  onResendInvite
}: UserTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof User>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesOrg = orgFilter === 'all' || user.organisation_id === orgFilter;
    
    return matchesSearch && matchesRole && matchesOrg;
  });

  // Sort users
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;
    
    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: keyof User) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, any> = {
      super_admin: { color: 'bg-purple-100 text-purple-700', icon: Shield },
      admin: { color: 'bg-blue-100 text-blue-700', icon: Shield },
      user: { color: 'bg-gray-100 text-gray-700', icon: UserIcon }
    };
    
    const variant = variants[role] || variants.user;
    const Icon = variant.icon;
    
    return (
      <Badge className={variant.color}>
        <Icon className="h-3 w-3 mr-1" />
        {role.replace('_', ' ')}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      suspended: 'bg-red-100 text-red-700'
    };
    
    return (
      <Badge className={colors[status] || colors.inactive}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={orgFilter} onValueChange={setOrgFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All organizations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All organizations</SelectItem>
            {organizations.map(org => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('name')}
                  className="h-8 p-0 font-medium"
                >
                  Name
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('email')}
                  className="h-8 p-0 font-medium"
                >
                  Email
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('created_at')}
                  className="h-8 p-0 font-medium"
                >
                  Created
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                    {user.organisation?.name || 'No Organization'}
                  </div>
                </TableCell>
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                <TableCell>{getStatusBadge(user.status)}</TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  {user.last_login_at ? 
                    formatDistanceToNow(new Date(user.last_login_at), { addSuffix: true }) :
                    'Never'
                  }
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(user)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onReassign(user)}>
                        <Building2 className="mr-2 h-4 w-4" />
                        Reassign Organization
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onResendInvite(user)}>
                        <Mail className="mr-2 h-4 w-4" />
                        Resend Invite
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => onDelete(user)}
                        className="text-red-600"
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {sortedUsers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No users found matching your filters
        </div>
      )}
    </div>
  );
}
```

### Task 3: User Management Modals (2.5 hours)

#### 3.1 Create User Modal
**File**: `/src/components/super-admin/CreateUserModal.tsx`
```typescript
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { useToast } from '../ui/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizations: Array<{ id: string; name: string }>;
  onUserCreated: () => void;
}

export function CreateUserModal({
  open,
  onOpenChange,
  organizations,
  onUserCreated
}: CreateUserModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'user' as 'super_admin' | 'admin' | 'user',
    organisation_id: '',
    sendInvite: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.name || !formData.organisation_id) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      // Create user via super admin API
      const response = await fetch('/api/super-admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }

      const { user, inviteUrl } = await response.json();

      toast({
        title: 'User Created',
        description: formData.sendInvite 
          ? `User created and invitation sent to ${formData.email}`
          : `User created successfully`,
      });

      // Reset form
      setFormData({
        email: '',
        name: '',
        role: 'user',
        organisation_id: '',
        sendInvite: true
      });

      onUserCreated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new user and optionally send them an invitation email
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="role">Role *</Label>
              <Select 
                value={formData.role} 
                onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Admins can manage their organization, Super Admins can access this dashboard
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="organization">Organization *</Label>
              <Select 
                value={formData.organisation_id} 
                onValueChange={(value) => setFormData({ ...formData, organisation_id: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendInvite"
                checked={formData.sendInvite}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, sendInvite: checked as boolean })
                }
                disabled={loading}
              />
              <Label 
                htmlFor="sendInvite" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Send invitation email
              </Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

#### 3.2 Edit User Modal
**File**: `/src/components/super-admin/EditUserModal.tsx`
```typescript
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useToast } from '../ui/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EditUserModalProps {
  user: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizations: Array<{ id: string; name: string }>;
  onUserUpdated: () => void;
}

export function EditUserModal({
  user,
  open,
  onOpenChange,
  organizations,
  onUserUpdated
}: EditUserModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'user' as 'super_admin' | 'admin' | 'user',
    organisation_id: '',
    status: 'active' as 'active' | 'inactive' | 'suspended',
    phone: '',
    timezone: 'UTC'
  });

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        name: user.name || '',
        role: user.role || 'user',
        organisation_id: user.organisation_id || '',
        status: user.status || 'active',
        phone: user.phone || '',
        timezone: user.timezone || 'UTC'
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/super-admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }

      toast({
        title: 'User Updated',
        description: `Successfully updated ${formData.name}`,
      });

      onUserUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={loading}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={loading}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select 
                value={formData.role} 
                onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="organization">Organization</Label>
              <Select 
                value={formData.organisation_id} 
                onValueChange={(value) => setFormData({ ...formData, organisation_id: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Extensible fields for future */}
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1234567890"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={loading}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select 
                value={formData.timezone} 
                onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  <SelectItem value="Europe/London">London</SelectItem>
                  <SelectItem value="Europe/Paris">Paris</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  <SelectItem value="Australia/Sydney">Sydney</SelectItem>
                  <SelectItem value="Pacific/Auckland">Auckland</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

#### 3.3 Delete User Confirmation
**File**: `/src/components/super-admin/DeleteUserModal.tsx`
```typescript
import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { useToast } from '../ui/use-toast';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';

interface DeleteUserModalProps {
  user: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserDeleted: () => void;
}

export function DeleteUserModal({
  user,
  open,
  onOpenChange,
  onUserDeleted
}: DeleteUserModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/super-admin/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }

      toast({
        title: 'User Deleted',
        description: `Successfully deleted ${user.name}`,
      });

      onUserDeleted();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete User</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{user?.name}</strong> ({user?.email})?
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete User
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### Task 4: Main Users Component Integration (1.5 hours)

#### 4.1 Super Admin Users Component
**File**: `/src/components/super-admin/SuperAdminUsers.tsx`
```typescript
import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { UserTable } from './UserTable';
import { CreateUserModal } from './CreateUserModal';
import { EditUserModal } from './EditUserModal';
import { DeleteUserModal } from './DeleteUserModal';
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
      // Load users
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
      const response = await fetch(`/api/super-admin/users/${user.id}/resend-invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
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
          user.name,
          user.email,
          user.role,
          user.organisation?.name || '',
          user.status,
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
            {users.filter(u => u.status === 'active').length}
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
```

### Task 5: API Endpoints (1.5 hours)

#### 5.1 User Management API Routes
**File**: `/server.js` (additions)
```javascript
// Create user
app.post('/api/super-admin/users', superAdminMiddleware, async (req, res) => {
  try {
    const { email, name, role, organisation_id, sendInvite } = req.body;

    // Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authError) throw authError;

    // Create profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authUser.user.id,
        email,
        name,
        role,
        organisation_id
      })
      .select()
      .single();

    if (profileError) {
      // Rollback auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw profileError;
    }

    // Send invitation if requested
    let inviteUrl = null;
    if (sendInvite) {
      // Create invitation token
      const token = crypto.randomBytes(32).toString('hex');
      
      const { error: inviteError } = await supabase
        .from('organisation_invites')
        .insert({
          organisation_id,
          email,
          role,
          invited_by: req.user.id,
          token,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

      if (!inviteError) {
        inviteUrl = `${process.env.FRONTEND_URL}/invite/${token}`;
        
        // Send email via Edge Function
        await supabase.functions.invoke('send-invitation', {
          body: {
            email,
            inviterName: 'Super Admin',
            organizationName: 'Your Organization',
            role,
            inviteUrl
          }
        });
      }
    }

    res.json({ user: profile, inviteUrl });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user
app.put('/api/super-admin/users/:id', superAdminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Update profile
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log the action
    await supabase
      .from('user_activity_log')
      .insert({
        user_id: id,
        action: 'updated',
        details: updates,
        performed_by: req.user.id
      });

    res.json(data);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete user
app.delete('/api/super-admin/users/:id', superAdminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is last admin
    const { data: user } = await supabase
      .from('profiles')
      .select('organisation_id, role')
      .eq('id', id)
      .single();

    if (user?.role === 'admin') {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', user.organisation_id)
        .in('role', ['admin', 'super_admin'])
        .neq('id', id);

      if (count === 0) {
        return res.status(400).json({ 
          error: 'Cannot delete the last admin of an organization' 
        });
      }
    }

    // Delete from auth
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resend invitation
app.post('/api/super-admin/users/:id/resend-invite', superAdminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Get user details
    const { data: user } = await supabase
      .from('profiles')
      .select('email, name, organisation_id, role')
      .eq('id', id)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate reset password link
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: user.email
    });

    if (error) throw error;

    // Send email (implement your email logic here)
    // For now, return the link
    res.json({ link: data.properties.action_link });
  } catch (error) {
    console.error('Error resending invite:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Task 6: Testing Checklist (0.5 hours)

#### 6.1 User Creation Tests
- [ ] Create user with all roles (user, admin, super_admin)
- [ ] Create user with invitation email
- [ ] Create user without invitation email
- [ ] Validate required fields
- [ ] Check duplicate email prevention

#### 6.2 User Editing Tests
- [ ] Edit user name
- [ ] Change user role
- [ ] Reassign to different organization
- [ ] Change user status
- [ ] Update optional fields (phone, timezone)

#### 6.3 User Deletion Tests
- [ ] Delete regular user
- [ ] Prevent deletion of last admin
- [ ] Confirm deletion dialog works
- [ ] Verify cascade deletion

#### 6.4 User Table Tests
- [ ] Search by name works
- [ ] Search by email works
- [ ] Filter by role works
- [ ] Filter by organization works
- [ ] Sort columns work
- [ ] Pagination works (if > 20 users)

#### 6.5 Export Tests
- [ ] CSV export includes all fields
- [ ] Export handles special characters
- [ ] Export includes filtered results

## Deliverables Checklist

### Database
- [ ] Profiles table extended with new fields
- [ ] User activity log table created
- [ ] User management functions created
- [ ] Indexes added for performance

### Frontend Components
- [ ] UserTable component with search/filter/sort
- [ ] CreateUserModal with validation
- [ ] EditUserModal with all fields
- [ ] DeleteUserModal with confirmation
- [ ] SuperAdminUsers main component

### Backend
- [ ] Create user endpoint
- [ ] Update user endpoint
- [ ] Delete user endpoint
- [ ] Resend invitation endpoint
- [ ] Proper error handling

### Integration
- [ ] Users tab connected in dashboard
- [ ] All modals functional
- [ ] Export functionality working
- [ ] Email invitations sending

## Success Criteria
Phase 3 is complete when:
1. ✅ Super admin can create users with any role
2. ✅ Users can be assigned to any organization
3. ✅ User details can be edited
4. ✅ Users can be deleted (with validation)
5. ✅ User table has search/filter/sort
6. ✅ Export to CSV works
7. ✅ Invitation emails can be sent
8. ✅ All CRUD operations are functional

## Next Steps (Phase 4)
After Phase 3 is complete:
1. Implement usage tracking hooks
2. Create statistics dashboard
3. Add date range filtering
4. Build metrics display cards
5. Implement export functionality

---

**Ready to Execute**: This plan provides all code and SQL needed for Phase 3 implementation