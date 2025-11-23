import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, Loader2, Workflow, Tag, ChevronDown } from 'lucide-react';
import {
  useSequenceInstances,
  usePauseSequence,
  useResumeSequence,
  useCancelSequence,
  useFinishSequence,
  useSequences,
  SequenceTemplate,
} from '../hooks/useSequences';
import { useRestaurants } from '../hooks/useRestaurants';
import { SequenceProgressCard } from '../components/sequences/SequenceProgressCard';
import { SelectRestaurantForSequenceModal } from '../components/sequences/SelectRestaurantForSequenceModal';
import { StartSequenceModal } from '../components/sequences/StartSequenceModal';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { CreateSequenceTemplateModal } from '../components/sequences/CreateSequenceTemplateModal';
import { EditSequenceTemplateModal } from '../components/sequences/EditSequenceTemplateModal';
import { SequenceTemplateCard } from '../components/sequences/SequenceTemplateCard';
import { Button } from '../components/ui/button';
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
import { cn } from '../lib/utils';

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

  // Modal state for creating sequences
  const [selectRestaurantOpen, setSelectRestaurantOpen] = useState(false);
  const [startSequenceOpen, setStartSequenceOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  // Modal state for task creation (Finish & Set Follow-up)
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const [followUpTaskId, setFollowUpTaskId] = useState<string | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);

  // Data fetching - Instances
  const { data: instances, isLoading: instancesLoading } = useSequenceInstances();
  const pauseMutation = usePauseSequence();
  const resumeMutation = useResumeSequence();
  const cancelMutation = useCancelSequence();
  const finishMutation = useFinishSequence();

  // Data fetching - Templates
  const { templates, loading: templatesLoading, fetchTemplates, deleteTemplate, duplicateTemplate, updateTemplate } = useSequences();

  // Data fetching - Restaurants
  const { data: restaurants } = useRestaurants();

  // Fetch templates when on templates tab
  useEffect(() => {
    if (activeTab === 'templates') {
      fetchTemplates({
        is_active: filterActive === 'all' ? undefined : filterActive === 'true',
        search: templateSearchTerm || undefined,
      });
    }
  }, [activeTab, fetchTemplates, filterActive, templateSearchTerm]);

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
        const templateName = instance.sequence_template?.name?.toLowerCase() || '';
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

  const handleStartSequenceClose = () => {
    setStartSequenceOpen(false);
    setSelectedRestaurant(null);
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
    await updateTemplate(id, { is_active: !isActive });
  };

  const handleEditTemplate = (template: SequenceTemplate) => {
    setSelectedTemplate(template);
    setEditTemplateModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Sequences</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage sequence instances and templates
          </p>
        </div>
        <Button
          onClick={handleCreateSequence}
          className="bg-gradient-to-r from-brand-blue to-brand-green"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Sequence
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="instances">Instances</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* INSTANCES TAB */}
        <TabsContent value="instances" className="space-y-6">
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
        <TabsContent value="templates" className="space-y-6">
          {/* Header with Create Button */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">
                Create and manage reusable task sequence workflows
              </p>
            </div>
            <Button onClick={() => setCreateTemplateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>

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
                  onDelete={deleteTemplate}
                  onDuplicate={duplicateTemplate}
                  onToggleActive={handleToggleActive}
                  onEdit={handleEditTemplate}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <SelectRestaurantForSequenceModal
        open={selectRestaurantOpen}
        onClose={() => setSelectRestaurantOpen(false)}
        onSelectRestaurant={handleRestaurantSelected}
      />

      {selectedRestaurant && (
        <StartSequenceModal
          open={startSequenceOpen}
          onClose={handleStartSequenceClose}
          restaurant={selectedRestaurant}
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
    </div>
  );
}
