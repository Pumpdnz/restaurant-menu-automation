import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Plus, Search, Edit, Archive, Trash2, Database, RefreshCw, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { OrganizationCreateModal } from './organizations/OrganizationCreateModal';
import { OrganizationEditModal } from './organizations/OrganizationEditModal';
import { OrganizationArchiveModal } from './organizations/OrganizationArchiveModal';
import { OrganizationDeleteModal } from './organizations/OrganizationDeleteModal';
import { OrganizationDataModal } from './organizations/OrganizationDataModal';

interface Organization {
  id: string;
  name: string;
  status: 'active' | 'archived';
  created_at: string;
  archived_at?: string;
  member_count?: number;
  extraction_count?: number;
}

export function SuperAdminOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');
  
  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      
      // Query organizations with counts
      const { data, error } = await supabase
        .from('organisations')
        .select(`
          *,
          profiles(count),
          extraction_jobs(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const orgs = data?.map(org => ({
        ...org,
        member_count: org.profiles?.[0]?.count || 0,
        extraction_count: org.extraction_jobs?.[0]?.count || 0
      })) || [];

      setOrganizations(orgs);
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || org.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAction = (action: string, org: Organization) => {
    setSelectedOrg(org);
    switch (action) {
      case 'edit':
        setEditModalOpen(true);
        break;
      case 'archive':
        setArchiveModalOpen(true);
        break;
      case 'restore':
        handleRestore(org);
        break;
      case 'delete':
        setDeleteModalOpen(true);
        break;
      case 'data':
        setDataModalOpen(true);
        break;
    }
  };

  const handleRestore = async (org: Organization) => {
    try {
      const { error } = await supabase
        .from('organisations')
        .update({
          status: 'active',
          archived_at: null,
          archived_by: null
        })
        .eq('id', org.id);

      if (error) throw error;
      
      await loadOrganizations();
    } catch (error) {
      console.error('Error restoring organization:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Organizations</h2>
          <p className="text-gray-500">Manage all organizations in the system</p>
        </div>
        <Button 
          onClick={() => setCreateModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button 
          variant="outline" 
          size="icon"
          onClick={loadOrganizations}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Organizations List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredOrgs.map((org) => (
            <Card key={org.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{org.name}</CardTitle>
                    <CardDescription>
                      Created {new Date(org.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleAction('edit', org)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      
                      {org.status === 'active' ? (
                        <DropdownMenuItem onClick={() => handleAction('archive', org)}>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuItem onClick={() => handleAction('restore', org)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Restore
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleAction('delete', org)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Permanently
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleAction('data', org)}>
                        <Database className="h-4 w-4 mr-2" />
                        Manage Data
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {org.member_count} members
                    </span>
                    <Badge variant={org.status === 'active' ? 'default' : 'secondary'}>
                      {org.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500">
                    {org.extraction_count} extractions
                  </div>
                  {org.archived_at && (
                    <div className="text-xs text-gray-400">
                      Archived {new Date(org.archived_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredOrgs.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No organizations found
        </div>
      )}

      {/* Modals */}
      <OrganizationCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={loadOrganizations}
      />

      {selectedOrg && (
        <>
          <OrganizationEditModal
            open={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            onSuccess={loadOrganizations}
            organizationId={selectedOrg.id}
          />

          <OrganizationArchiveModal
            open={archiveModalOpen}
            onClose={() => setArchiveModalOpen(false)}
            onSuccess={loadOrganizations}
            organization={selectedOrg}
          />

          <OrganizationDeleteModal
            open={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            onSuccess={loadOrganizations}
            organization={selectedOrg}
          />

          <OrganizationDataModal
            open={dataModalOpen}
            onClose={() => setDataModalOpen(false)}
            onSuccess={loadOrganizations}
            sourceOrgId={selectedOrg.id}
            sourceOrgName={selectedOrg.name}
          />
        </>
      )}
    </div>
  );
}