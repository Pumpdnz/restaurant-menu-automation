import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, Loader2, Workflow, Tag, ChevronDown, Mail, MessageSquare, Edit, Copy, Trash2, FileText } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../hooks/use-toast';
import api from '../services/api';
import {
  useSequenceInstances,
  usePauseSequence,
  useResumeSequence,
  useCancelSequence,
  useFinishSequence,
  useDeleteSequenceInstance,
  useSequenceTemplates,
  useUpdateSequenceTemplate,
  useDeleteSequenceTemplate,
  useDuplicateSequenceTemplate,
  SequenceTemplate,
} from '../hooks/useSequences';
import { useRestaurants } from '../hooks/useRestaurants';
import { SequenceProgressCard } from '../components/sequences/SequenceProgressCard';
import { SelectRestaurantForSequenceModal } from '../components/sequences/SelectRestaurantForSequenceModal';
import { StartSequenceModal } from '../components/sequences/StartSequenceModal';
import { BulkStartSequenceModal } from '../components/sequences/BulkStartSequenceModal';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { CreateSequenceTemplateModal } from '../components/sequences/CreateSequenceTemplateModal';
import { EditSequenceTemplateModal } from '../components/sequences/EditSequenceTemplateModal';
import { SequenceTemplateCard } from '../components/sequences/SequenceTemplateCard';
import { CreateMessageTemplateModal } from '../components/message-templates/CreateMessageTemplateModal';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { MultiSelect } from '../components/ui/multi-select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

export default function Sequences() {
  // Tab state
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'instances';

  // Instances tab state
  const [instanceFilters, setInstanceFilters] = useState({
    search: '',
    status: ['active'] as string[],
    restaurant_id: [] as string[]
  });

  // Templates tab state (from SequenceTemplates.tsx)
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<string>('true');
  const [createTemplateModalOpen, setCreateTemplateModalOpen] = useState(false);
  const [editTemplateModalOpen, setEditTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SequenceTemplate | null>(null);

  // Message Templates tab state
  const [messageTemplateFilterType, setMessageTemplateFilterType] = useState<string>('all');
  const [messageTemplateFilterActive, setMessageTemplateFilterActive] = useState<string>('all');
  const [createMessageTemplateModalOpen, setCreateMessageTemplateModalOpen] = useState(false);
  const [editMessageTemplateModalOpen, setEditMessageTemplateModalOpen] = useState(false);
  const [duplicateMessageTemplateModalOpen, setDuplicateMessageTemplateModalOpen] = useState(false);
  const [selectedMessageTemplate, setSelectedMessageTemplate] = useState<any | null>(null);

  // Modal state for creating sequences
  const [selectRestaurantOpen, setSelectRestaurantOpen] = useState(false);
  const [startSequenceOpen, setStartSequenceOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  // Bulk flow state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkStartOpen, setBulkStartOpen] = useState(false);
  const [selectedRestaurants, setSelectedRestaurants] = useState<any[]>([]);

  // Modal state for task creation (Finish & Set Follow-up)
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const [followUpTaskId, setFollowUpTaskId] = useState<string | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  // Data fetching - Instances
  const { data: instances, isLoading: instancesLoading, refetch: refetchInstances } = useSequenceInstances();
  const pauseMutation = usePauseSequence();
  const resumeMutation = useResumeSequence();
  const cancelMutation = useCancelSequence();
  const finishMutation = useFinishSequence();
  const deleteMutation = useDeleteSequenceInstance();

  // Data fetching - Templates
  const templateFilters = useMemo(() => ({
    is_active: filterActive === 'all' ? undefined : filterActive === 'true',
    search: templateSearchTerm || undefined,
  }), [filterActive, templateSearchTerm]);

  const { data: templatesData, isLoading: templatesLoading } = useSequenceTemplates(templateFilters);
  const templates = templatesData?.data || [];

  const updateTemplateMutation = useUpdateSequenceTemplate();
  const deleteTemplateMutation = useDeleteSequenceTemplate();
  const duplicateTemplateMutation = useDuplicateSequenceTemplate();

  // Data fetching - Restaurants
  const { data: restaurants } = useRestaurants();

  // Hooks for message templates
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Data fetching - Message Templates
  const messageTemplateFilters = useMemo(() => ({
    type: messageTemplateFilterType === 'all' ? undefined : messageTemplateFilterType,
    is_active: messageTemplateFilterActive === 'all' ? undefined : messageTemplateFilterActive === 'true',
  }), [messageTemplateFilterType, messageTemplateFilterActive]);

  const { data: messageTemplatesData, isLoading: messageTemplatesLoading } = useQuery({
    queryKey: ['message-templates', messageTemplateFilters],
    queryFn: async () => {
      const params: any = {};
      if (messageTemplateFilters.type) params.type = messageTemplateFilters.type;
      if (messageTemplateFilters.is_active !== undefined) params.is_active = messageTemplateFilters.is_active;

      const response = await api.get('/message-templates', { params });
      return response.data;
    }
  });

  const messageTemplates = messageTemplatesData?.templates || [];

  // Filter instances logic
  const filteredInstances = useMemo(() => {
    if (!instances?.data) return [];

    return instances.data.filter((instance) => {
      // Status filter
      if (instanceFilters.status.length > 0 && !instanceFilters.status.includes(instance.status)) {
        return false;
      }

      // Restaurant filter
      if (instanceFilters.restaurant_id.length > 0 && !instanceFilters.restaurant_id.includes(instance.restaurant_id)) {
        return false;
      }

      // Search filter
      if (instanceFilters.search) {
        const searchLower = instanceFilters.search.toLowerCase();
        const restaurantName = instance.restaurants?.name?.toLowerCase() || '';
        const templateName = instance.sequence_templates?.name?.toLowerCase() || '';
        return restaurantName.includes(searchLower) || templateName.includes(searchLower);
      }

      return true;
    });
  }, [instances, instanceFilters]);

  // Tab change handler
  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  // Create sequence flow
  const handleCreateSequence = () => {
    setSelectRestaurantOpen(true);
  };

  const handleRestaurantSelected = (restaurant) => {
    setSelectedRestaurant(restaurant);
    setSelectRestaurantOpen(false);
    setStartSequenceOpen(true);
  };

  const handleRestaurantsSelected = (restaurants: any[]) => {
    setSelectedRestaurants(restaurants);
    setSelectRestaurantOpen(false);
    setBulkStartOpen(true);
  };

  const handleStartSequenceClose = () => {
    setStartSequenceOpen(false);
    setSelectedRestaurant(null);
  };

  const handleBulkStartClose = () => {
    setBulkStartOpen(false);
    setSelectedRestaurants([]);
    setBulkMode(false);
  };

  const handleNewSequenceClick = (mode: 'single' | 'bulk') => {
    setBulkMode(mode === 'bulk');
    setSelectRestaurantOpen(true);
  };

  // Sequence action handlers
  const handlePause = async (instanceId: string) => {
    await pauseMutation.mutateAsync(instanceId);
  };

  const handleResume = async (instanceId: string) => {
    await resumeMutation.mutateAsync(instanceId);
  };

  const handleCancel = async (instanceId: string) => {
    if (window.confirm('Are you sure you want to cancel this sequence? This will delete all pending tasks.')) {
      await cancelMutation.mutateAsync(instanceId);
    }
  };

  // Finish sequence handler (for Phase 2.3 integration)
  const handleFinish = async (instanceId: string, option: 'finish-only' | 'finish-followup' | 'finish-start-new') => {
    if (!window.confirm('Are you sure you want to finish this sequence? Active tasks will be marked complete and pending tasks will be cancelled.')) {
      return;
    }

    await finishMutation.mutateAsync(instanceId);

    const sequence = instances?.data?.find(s => s.id === instanceId);

    if (option === 'finish-followup') {
      // Find last active task and open CreateTaskModal
      const lastActiveTask = sequence?.tasks?.find(t => t.status === 'active');
      if (lastActiveTask && sequence?.restaurant_id) {
        setFollowUpTaskId(lastActiveTask.id);
        setSelectedRestaurantId(sequence.restaurant_id);
        setCreateTaskModalOpen(true);
      }
    } else if (option === 'finish-start-new') {
      // Open StartSequenceModal with restaurant
      if (sequence?.restaurants) {
        setSelectedRestaurant(sequence.restaurants);
        setStartSequenceOpen(true);
      }
    }
  };

  // Delete sequence handler
  const handleDelete = async (instanceId: string) => {
    if (window.confirm('Are you sure you want to delete this sequence? This action cannot be undone.')) {
      await deleteMutation.mutateAsync(instanceId);
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setInstanceFilters({
      search: '',
      status: ['active'],
      restaurant_id: []
    });
  };

  const handleClearFilters = () => {
    setInstanceFilters({
      search: '',
      status: [],
      restaurant_id: []
    });
  };

  // Check if filters are at default
  const isDefaultFilters =
    instanceFilters.search === '' &&
    instanceFilters.status.length === 1 &&
    instanceFilters.status[0] === 'active' &&
    instanceFilters.restaurant_id.length === 0;

  const hasAnyFilters =
    instanceFilters.search !== '' ||
    instanceFilters.status.length > 0 ||
    instanceFilters.restaurant_id.length > 0;

  // Template handlers
  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateTemplateMutation.mutateAsync({ id, updates: { is_active: !isActive } });
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleDeleteTemplate = async (id: string): Promise<boolean> => {
    try {
      await deleteTemplateMutation.mutateAsync(id);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleDuplicateTemplate = async (id: string, newName?: string) => {
    try {
      const result = await duplicateTemplateMutation.mutateAsync({ id, newName });
      return result;
    } catch (error) {
      return null;
    }
  };

  const handleEditTemplate = (template: SequenceTemplate) => {
    setSelectedTemplate(template);
    setEditTemplateModalOpen(true);
  };

  // Message Template handlers
  const handleDeleteMessageTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this message template?')) {
      return;
    }

    try {
      await api.delete(`/message-templates/${templateId}`);
      toast({
        title: "Success",
        description: "Message template deleted successfully"
      });
      // Refetch message templates
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || 'Failed to delete template',
        variant: "destructive"
      });
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col -mt-6 -mb-6">
      {/* Sticky Header + Tabs */}
      <div className="sticky -top-6 z-40 bg-white/80 backdrop-blur-sm -mx-6 px-6 pt-6 pb-4 border border-white/20 shadow-lg space-y-4 rounded-b-[16px]">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Sequences</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage sequence instances and templates
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-gradient-to-r from-brand-blue to-brand-green">
                <Plus className="h-4 w-4 mr-2" />
                New Sequence
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleNewSequenceClick('single')}>
                <div className="flex flex-col">
                  <span className="font-medium">Single Restaurant</span>
                  <span className="text-xs text-muted-foreground">
                    Start a sequence for one restaurant
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNewSequenceClick('bulk')}>
                <div className="flex flex-col">
                  <span className="font-medium">Multiple Restaurants (Bulk)</span>
                  <span className="text-xs text-muted-foreground">
                    Start the same sequence for multiple restaurants
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreateTemplateModalOpen(true)}>
                <div className="flex flex-col">
                  <span className="font-medium">New Sequence Template</span>
                  <span className="text-xs text-muted-foreground">
                    Create a reusable sequence workflow
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* TabsList */}
        <TabsList size="full">
          <TabsTrigger size="full" variant="blue" value="instances">Instances</TabsTrigger>
          <TabsTrigger size="full" variant="blue" value="templates">Sequence Templates</TabsTrigger>
          <TabsTrigger size="full" variant="blue" value="message-templates">Message Templates</TabsTrigger>
        </TabsList>
      </div>

      {/* Scrollable Content */}
      <div className="pt-6 space-y-6">
        {/* INSTANCES TAB */}
        <TabsContent value="instances" className="space-y-6 mt-0">
          {/* Filters Card */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <h3 className="font-medium">Filters</h3>
              </div>
              <div className="flex gap-2">
                {!isDefaultFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                  >
                    Reset to Default
                  </Button>
                )}
                {hasAnyFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search Input */}
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sequences..."
                  value={instanceFilters.search}
                  onChange={(e) => setInstanceFilters({ ...instanceFilters, search: e.target.value })}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <MultiSelect
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'Paused', value: 'paused' },
                  { label: 'Completed', value: 'completed' },
                  { label: 'Cancelled', value: 'cancelled' }
                ]}
                selected={instanceFilters.status}
                onChange={(selected) => setInstanceFilters({ ...instanceFilters, status: selected })}
                placeholder="Status"
              />

              {/* Restaurant Filter */}
              <MultiSelect
                options={
                  restaurants?.map((r) => ({
                    label: r.name,
                    value: r.id
                  })) || []
                }
                selected={instanceFilters.restaurant_id}
                onChange={(selected) => setInstanceFilters({ ...instanceFilters, restaurant_id: selected })}
                placeholder="Restaurant"
              />
            </div>
          </div>

          {/* Instances List */}
          {instancesLoading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!instancesLoading && filteredInstances.length === 0 && (
            <div className="text-center py-12">
              <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No sequences found</h3>
              <p className="text-muted-foreground mb-4">
                {hasAnyFilters
                  ? 'Try adjusting your filters'
                  : 'Get started by creating a new sequence'}
              </p>
              {!hasAnyFilters && (
                <Button onClick={handleCreateSequence}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Sequence
                </Button>
              )}
            </div>
          )}

          {!instancesLoading && filteredInstances.length > 0 && (
            <div className="space-y-4">
              {filteredInstances.map((instance) => (
                <SequenceProgressCard
                  key={instance.id}
                  instance={instance}
                  onPause={handlePause}
                  onResume={handleResume}
                  onCancel={handleCancel}
                  onFinish={handleFinish}
                  onDelete={handleDelete}
                  onRefresh={refetchInstances}
                  onStartSequence={(restaurant) => {
                    setSelectedRestaurant(restaurant);
                    setStartSequenceOpen(true);
                  }}
                  onFollowUpTask={(taskId) => {
                    setFollowUpTaskId(taskId);
                    setSelectedRestaurantId(instance.restaurant_id);
                    setCreateTaskModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}

          {/* Results Count */}
          {!instancesLoading && filteredInstances.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground text-center">
              Showing {filteredInstances.length} sequence{filteredInstances.length !== 1 ? 's' : ''}
            </div>
          )}
        </TabsContent>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates" className="space-y-6 mt-0">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={templateSearchTerm}
                onChange={(e) => setTemplateSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterActive} onValueChange={setFilterActive}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Templates</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Templates List */}
          {templatesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Loading templates...</p>
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div className="border rounded-lg p-12 text-center">
              <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No sequence templates yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first sequence template to automate task workflows
              </p>
              <Button onClick={() => setCreateTemplateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <SequenceTemplateCard
                  key={template.id}
                  template={template}
                  onDelete={handleDeleteTemplate}
                  onDuplicate={handleDuplicateTemplate}
                  onToggleActive={handleToggleActive}
                  onEdit={handleEditTemplate}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* MESSAGE TEMPLATES TAB */}
        <TabsContent value="message-templates" className="space-y-6 mt-0">
          {/* Filters */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Filters</h3>
              </div>
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                {(messageTemplateFilterType !== 'all' || messageTemplateFilterActive !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMessageTemplateFilterType('all');
                      setMessageTemplateFilterActive('all');
                    }}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                )}
                {/* Create Button */}
                <div className="flex justify-end">
                  <Button onClick={() => setCreateMessageTemplateModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Message Template
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Type Filter */}
              <div>
                <label className="text-sm font-medium mb-1 block">Type</label>
                <Select
                  value={messageTemplateFilterType}
                  onValueChange={setMessageTemplateFilterType}
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
                  value={messageTemplateFilterActive}
                  onValueChange={setMessageTemplateFilterActive}
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
                {messageTemplatesLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">Loading templates...</p>
                    </TableCell>
                  </TableRow>
                ) : messageTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No message templates found. Create your first template to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  messageTemplates.map((template: any) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div
                          className="font-medium cursor-pointer hover:text-brand-blue"
                          onClick={() => {
                            setSelectedMessageTemplate(template);
                            setEditMessageTemplateModalOpen(true);
                          }}
                        >
                          {template.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {template.type === 'email' && <Mail className="h-4 w-4" />}
                          {template.type === 'social_message' && <MessageSquare className="h-4 w-4" />}
                          {template.type === 'text' && <MessageSquare className="h-4 w-4" />}
                          <Badge variant="outline" className={
                            template.type === 'email' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              template.type === 'social_message' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                template.type === 'text' ? 'bg-green-100 text-green-800 border-green-200' : ''
                          }>
                            {template.type.replace(/_/g, ' ')}
                          </Badge>
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
                            <>
                              {template.available_variables.slice(0, 3).map((variable: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {'{' + variable + '}'}
                                </Badge>
                              ))}
                              {template.available_variables.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{template.available_variables.length - 3} more
                                </Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
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
                            onClick={() => {
                              setSelectedMessageTemplate(template);
                              setEditMessageTemplateModalOpen(true);
                            }}
                            title="Edit template"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedMessageTemplate(template);
                              setDuplicateMessageTemplateModalOpen(true);
                            }}
                            title="Duplicate template"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteMessageTemplate(template.id)}
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
        </TabsContent>
      </div>

      {/* Modals */}
      <SelectRestaurantForSequenceModal
        open={selectRestaurantOpen}
        onClose={() => {
          setSelectRestaurantOpen(false);
          setBulkMode(false);
        }}
        onSelectRestaurant={handleRestaurantSelected}
        onSelectRestaurants={handleRestaurantsSelected}
        allowMultiple={bulkMode}
      />

      {selectedRestaurant && (
        <StartSequenceModal
          open={startSequenceOpen}
          onClose={handleStartSequenceClose}
          restaurant={selectedRestaurant}
        />
      )}

      {selectedRestaurants.length > 0 && (
        <BulkStartSequenceModal
          open={bulkStartOpen}
          onClose={handleBulkStartClose}
          restaurants={selectedRestaurants}
        />
      )}

      {/* Create Task Modal for Follow-up (Phase 2.3 integration) */}
      {followUpTaskId && selectedRestaurantId && (
        <CreateTaskModal
          open={createTaskModalOpen}
          onClose={() => {
            setCreateTaskModalOpen(false);
            setFollowUpTaskId(null);
            setSelectedRestaurantId(null);
          }}
          onSuccess={() => {
            setCreateTaskModalOpen(false);
            setFollowUpTaskId(null);
            setSelectedRestaurantId(null);
          }}
          restaurantId={selectedRestaurantId}
          followUpFromTaskId={followUpTaskId}
        />
      )}

      {/* Template Modals */}
      <CreateSequenceTemplateModal
        open={createTemplateModalOpen}
        onClose={() => setCreateTemplateModalOpen(false)}
      />

      <EditSequenceTemplateModal
        open={editTemplateModalOpen}
        onClose={() => {
          setEditTemplateModalOpen(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
      />

      {/* Message Template Modals */}
      <CreateMessageTemplateModal
        open={createMessageTemplateModalOpen}
        onClose={() => setCreateMessageTemplateModalOpen(false)}
        onSuccess={() => {
          setCreateMessageTemplateModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ['message-templates'] });
        }}
      />

      {selectedMessageTemplate && (
        <CreateMessageTemplateModal
          open={editMessageTemplateModalOpen}
          templateId={selectedMessageTemplate.id}
          onClose={() => {
            setEditMessageTemplateModalOpen(false);
            setSelectedMessageTemplate(null);
          }}
          onSuccess={() => {
            setEditMessageTemplateModalOpen(false);
            setSelectedMessageTemplate(null);
            queryClient.invalidateQueries({ queryKey: ['message-templates'] });
          }}
        />
      )}

      {selectedMessageTemplate && (
        <CreateMessageTemplateModal
          open={duplicateMessageTemplateModalOpen}
          duplicateFromId={selectedMessageTemplate.id}
          onClose={() => {
            setDuplicateMessageTemplateModalOpen(false);
            setSelectedMessageTemplate(null);
          }}
          onSuccess={() => {
            setDuplicateMessageTemplateModalOpen(false);
            setSelectedMessageTemplate(null);
            queryClient.invalidateQueries({ queryKey: ['message-templates'] });
          }}
        />
      )}
    </Tabs>
  );
}
