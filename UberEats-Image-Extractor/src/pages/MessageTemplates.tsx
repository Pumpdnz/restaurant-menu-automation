import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Mail,
  MessageSquare,
  Plus,
  Edit,
  Trash2,
  Eye,
  Filter,
  X,
  FileText,
  Copy
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { cn } from '../lib/utils';
import { CreateMessageTemplateModal } from '../components/message-templates/CreateMessageTemplateModal';
import { useToast } from '../hooks/use-toast';

export default function MessageTemplates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    type: 'all',
    is_active: 'all'
  });

  const [modals, setModals] = useState({
    create: false,
    edit: null,
    duplicate: null
  });

  useEffect(() => {
    fetchTemplates();
  }, [filters]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const params: any = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== 'all') params[key] = value;
      });

      const response = await api.get('/message-templates', { params });
      setTemplates(response.data.templates || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch message templates:', err);
      setError('Failed to load message templates');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this message template?')) {
      return;
    }

    try {
      await api.delete(`/message-templates/${templateId}`);
      toast({
        title: "Success",
        description: "Message template deleted successfully"
      });
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || 'Failed to delete template',
        variant: "destructive"
      });
    }
  };

  const updateFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      type: 'all',
      is_active: 'all'
    });
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(value => value !== 'all');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'social_message':
        return <MessageSquare className="h-4 w-4" />;
      case 'text':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors = {
      email: 'bg-blue-100 text-blue-800 border-blue-200',
      social_message: 'bg-purple-100 text-purple-800 border-purple-200',
      text: 'bg-green-100 text-green-800 border-green-200'
    };
    return (
      <Badge variant="outline" className={cn('capitalize', colors[type as keyof typeof colors])}>
        {type.replace(/_/g, ' ')}
      </Badge>
    );
  };

  if (loading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading message templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Message Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {templates.length} {hasActiveFilters() ? 'filtered ' : ''}templates
          </p>
        </div>
        <Button
          onClick={() => setModals({ ...modals, create: true })}
          className="bg-gradient-to-r from-brand-blue to-brand-green"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Filters</h3>
          </div>
          {hasActiveFilters() && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Type Filter */}
          <div>
            <label className="text-sm font-medium mb-1 block">Type</label>
            <Select
              value={filters.type}
              onValueChange={(v) => updateFilter('type', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="social_message">Social Message</SelectItem>
                <SelectItem value="text">Text</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active Status Filter */}
          <div>
            <label className="text-sm font-medium mb-1 block">Status</label>
            <Select
              value={filters.is_active}
              onValueChange={(v) => updateFilter('is_active', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          {error}
        </div>
      )}

      {/* Templates Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Usage Count</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No message templates found. Create your first template to get started.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template: any) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div className="font-medium">{template.name}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(template.type)}
                      {getTypeBadge(template.type)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground max-w-xs truncate">
                      {template.description || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {template.available_variables && template.available_variables.length > 0 ? (
                        template.available_variables.slice(0, 3).map((variable: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {'{' + variable + '}'}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                      {template.available_variables && template.available_variables.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{template.available_variables.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {template.usage_count || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={template.is_active ? "default" : "secondary"}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setModals({ ...modals, edit: template.id })}
                        title="Edit template"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setModals({ ...modals, duplicate: template.id })}
                        title="Duplicate template"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(template.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete template"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modals */}
      {modals.create && (
        <CreateMessageTemplateModal
          open={modals.create}
          onClose={() => setModals({ ...modals, create: false })}
          onSuccess={fetchTemplates}
        />
      )}

      {modals.edit && (
        <CreateMessageTemplateModal
          open={!!modals.edit}
          templateId={modals.edit}
          onClose={() => setModals({ ...modals, edit: null })}
          onSuccess={fetchTemplates}
        />
      )}

      {modals.duplicate && (
        <CreateMessageTemplateModal
          open={!!modals.duplicate}
          duplicateFromId={modals.duplicate}
          onClose={() => setModals({ ...modals, duplicate: null })}
          onSuccess={fetchTemplates}
        />
      )}
    </div>
  );
}
