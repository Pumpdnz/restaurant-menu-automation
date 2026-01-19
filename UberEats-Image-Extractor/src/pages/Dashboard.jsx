import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Store,
  Download,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
  ClipboardList,
  User,
  Mail,
  Phone,
  Star,
  ExternalLink,
  Circle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ChevronDown,
  Edit,
  Copy,
  Workflow,
  Eye,
  ArrowRightCircle,
  Loader2,
  MapPin,
  Globe
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';
import api from '../services/api';
import { DateTimePicker } from '../components/ui/date-time-picker';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
} from '../components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Progress } from '../components/ui/progress';
import { CreateLeadScrapeJob } from '../components/leads/CreateLeadScrapeJob';
import { ReportsTabContent } from '../components/reports/ReportsTabContent';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { TaskDetailModal } from '../components/tasks/TaskDetailModal';
import { TaskTypeQuickView } from '../components/tasks/TaskTypeQuickView';
import { StartSequenceModal } from '../components/sequences/StartSequenceModal';
import { LeadContactQuickView } from '../components/restaurants/LeadContactQuickView';
import { TaskCell } from '../components/restaurants/TaskCell';
import { LeadDetailModal } from '../components/leads/LeadDetailModal';
import { useAuth } from '../context/AuthContext';
import { usePendingLeadsPreview, useRecentRegistrationBatches, useTasksDueToday, useOverdueTasksCount, useRecentRestaurants } from '../hooks/useDashboard';
import { useConvertLeadsToRestaurants } from '../hooks/useLeadScrape';
import { useQueryClient } from '@tanstack/react-query';

export default function Dashboard() {
  // Feature flags
  const { isFeatureEnabled } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Dialog state for CreateLeadScrapeJob
  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [prefillScrapeData, setPrefillScrapeData] = useState({
    city: undefined,
    cuisine: undefined,
    pageOffset: undefined,
  });

  // Dialog state for CreateTaskModal
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);

  // Dialog state for LeadDetailModal
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isLeadDetailModalOpen, setIsLeadDetailModalOpen] = useState(false);

  // Dialog state for TaskDetailModal
  const [detailModalTaskId, setDetailModalTaskId] = useState(null);

  // Dialog state for StartSequenceModal (from action dropdown)
  const [sequenceRestaurant, setSequenceRestaurant] = useState(null);
  const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false);

  // Dialog state for follow-up task (reuses CreateTaskModal with prefill)
  const [followUpTaskId, setFollowUpTaskId] = useState(null);

  // Dialog state for duplicate task (reuses CreateTaskModal with prefill)
  const [duplicateTaskId, setDuplicateTaskId] = useState(null);

  // Dialog state for StartSequenceModal (from Recent Restaurants TaskCell dropdown)
  const [startSequenceFor, setStartSequenceFor] = useState(null);

  // Pending Leads multi-select and expansion state
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
  const [expandedLeadIds, setExpandedLeadIds] = useState(new Set());
  const [isConversionDialogOpen, setIsConversionDialogOpen] = useState(false);
  const [conversionResults, setConversionResults] = useState([]);
  const [isConverting, setIsConverting] = useState(false);
  const [createRegistrationBatch, setCreateRegistrationBatch] = useState(true);

  // Lead conversion mutation
  const convertMutation = useConvertLeadsToRestaurants();

  // Callback for ReportsTabContent to trigger dialog with prefill data
  // ReportsTabContent passes an object with { city, cuisine, pageOffset }
  const handleStartScrape = (params) => {
    setPrefillScrapeData({
      city: params.city,
      cuisine: params.cuisine,
      pageOffset: params.pageOffset,
    });
    setCreateJobOpen(true);
  };

  // Helper function for platform labels
  const getPlatformLabel = (platform) => {
    const labels = {
      ubereats: 'UberEats',
      doordash: 'DoorDash',
      google_maps: 'Google Maps',
      delivereasy: 'DeliverEasy',
    };
    return labels[platform] || platform;
  };

  // Task status configuration
  const statusOptions = [
    {
      value: 'pending',
      label: 'Pending',
      icon: <Circle className="h-4 w-4 stroke-gray-700" />,
      description: 'Waiting on dependencies'
    },
    {
      value: 'active',
      label: 'Active',
      icon: <Circle className="h-4 w-4 stroke-brand-blue" />,
      description: 'Currently working on'
    },
    {
      value: 'completed',
      label: 'Completed',
      icon: <CheckCircle2 className="h-4 w-4 stroke-brand-green" />,
      description: 'Task finished'
    },
    {
      value: 'cancelled',
      label: 'Cancelled',
      icon: <XCircle className="h-4 w-4 stroke-brand-red" />,
      description: 'Task cancelled'
    }
  ];

  // Handle task status change
  const handleTaskStatusChange = async (taskId, newStatus) => {
    try {
      if (newStatus === 'completed') {
        await api.patch(`/tasks/${taskId}/complete`);
      } else if (newStatus === 'cancelled') {
        await api.patch(`/tasks/${taskId}/cancel`);
      } else {
        await api.patch(`/tasks/${taskId}`, { status: newStatus });
      }
      // Refetch tasks due today and overdue tasks
      queryClient.invalidateQueries({ queryKey: ['tasks-due-today'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  // Handle task due date change
  const handleTaskDueDateChange = async (taskId, newDueDate) => {
    try {
      await api.patch(`/tasks/${taskId}`, { due_date: newDueDate });
      queryClient.invalidateQueries({ queryKey: ['tasks-due-today'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
    } catch (error) {
      console.error('Failed to update task due date:', error);
    }
  };

  // Handle task priority change
  const handleTaskPriorityChange = async (taskId, newPriority) => {
    try {
      await api.patch(`/tasks/${taskId}`, { priority: newPriority });
      queryClient.invalidateQueries({ queryKey: ['tasks-due-today'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
    } catch (error) {
      console.error('Failed to update task priority:', error);
    }
  };

  // Handle mark task as complete
  const handleCompleteTask = async (taskId) => {
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      queryClient.invalidateQueries({ queryKey: ['tasks-due-today'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  // Handle complete with follow-up
  const handleCompleteWithFollowUp = async (taskId) => {
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      // Open CreateTaskModal for follow-up
      setFollowUpTaskId(taskId);
      setCreateTaskModalOpen(true);
      queryClient.invalidateQueries({ queryKey: ['tasks-due-today'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  // Handle complete with start sequence
  const handleCompleteWithStartSequence = async (task) => {
    try {
      if (!task?.restaurants) {
        console.error('No restaurant data available');
        return;
      }
      await api.patch(`/tasks/${task.id}/complete`);
      // Open StartSequenceModal
      setSequenceRestaurant({
        id: task.restaurants.id,
        name: task.restaurants.name
      });
      setIsSequenceModalOpen(true);
      queryClient.invalidateQueries({ queryKey: ['tasks-due-today'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  // Priority config for dropdown styling
  const priorityConfig = {
    low: { label: 'Low', color: 'bg-gray-100 text-gray-800 border-gray-200' },
    medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    high: { label: 'High', color: 'bg-red-100 text-red-800 border-red-200' },
  };

  // Get icon for task type
  const getTypeIcon = (type) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'social_message':
        return <MessageSquare className="h-4 w-4" />;
      case 'text':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <ClipboardList className="h-4 w-4" />;
    }
  };

  // Helper to get due date input based on task status
  const getDueDateInput = (task) => {
    // Show completed date for completed tasks
    if (task.status === 'completed') {
      return (
        <div className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {task.completed_at
            ? new Date(task.completed_at).toLocaleDateString('en-NZ', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })
            : 'Completed'}
        </div>
      );
    }

    // Show cancelled indicator
    if (task.status === 'cancelled') {
      return <span className="text-xs text-gray-500">Cancelled</span>;
    }

    // Original due date picker for active/pending tasks
    const isOverdue = task.due_date &&
      new Date(task.due_date) < new Date();

    return (
      <DateTimePicker
        value={task.due_date ? new Date(task.due_date) : null}
        onChange={(date) => handleTaskDueDateChange(task.id, date ? date.toISOString() : null)}
        placeholder="Set due date"
        className={cn("h-8 text-xs", isOverdue && "text-red-600")}
      />
    );
  };

  // Pending Leads Preview (moved up for use in multi-select functions)
  const { data: pendingLeadsData, isLoading: pendingLeadsLoading, refetch: refetchPendingLeads } = usePendingLeadsPreview(5);
  const pendingLeads = pendingLeadsData?.leads || [];
  const totalPendingLeads = pendingLeadsData?.total || 0;

  // Lead detail handlers
  const handleViewLead = (leadId) => {
    setSelectedLeadId(leadId);
    setIsLeadDetailModalOpen(true);
  };

  // Pending Leads multi-select functions
  const allLeadsSelected =
    pendingLeads.length > 0 &&
    pendingLeads.every((l) => selectedLeadIds.has(l.id));

  const toggleLeadSelection = (leadId) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const toggleSelectAllLeads = () => {
    if (allLeadsSelected) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(pendingLeads.map((l) => l.id)));
    }
  };

  const clearLeadSelection = () => {
    setSelectedLeadIds(new Set());
  };

  // Pending Leads expand/collapse functions
  const allLeadsExpanded =
    pendingLeads.length > 0 &&
    pendingLeads.every((lead) => expandedLeadIds.has(lead.id));

  const toggleLeadExpanded = (leadId) => {
    setExpandedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const toggleExpandAllLeads = () => {
    if (allLeadsExpanded) {
      setExpandedLeadIds(new Set());
    } else {
      setExpandedLeadIds(new Set(pendingLeads.map((l) => l.id)));
    }
  };

  // Lead conversion handlers
  const handleConvertSingleLead = async (leadId) => {
    const lead = pendingLeads.find((l) => l.id === leadId);
    if (!lead) return;

    setIsConverting(true);
    setConversionResults([]);
    setIsConversionDialogOpen(true);

    const batchName = `${lead.restaurant_name} - ${new Date().toISOString().split('T')[0]}`;

    try {
      const response = await convertMutation.mutateAsync({
        leadIds: [leadId],
        createRegistrationBatch,
        batchName,
      });

      const convertedItem = response.converted?.[0];
      setConversionResults([
        {
          leadId: lead.id,
          restaurantName: convertedItem?.restaurant_name || lead.restaurant_name,
          success: !!convertedItem,
          error: response.failed?.[0]?.error,
          restaurantId: convertedItem?.restaurant_id,
        },
      ]);

      queryClient.invalidateQueries({ queryKey: ['pending-leads-preview'] });
    } catch (error) {
      setConversionResults([
        {
          leadId: lead.id,
          restaurantName: lead.restaurant_name,
          success: false,
          error: error.message || 'Conversion failed',
        },
      ]);
    } finally {
      setIsConverting(false);
    }
  };

  const handleConvertSelectedLeads = async () => {
    if (selectedLeadIds.size === 0) return;

    setIsConverting(true);
    setConversionResults([]);
    setIsConversionDialogOpen(true);

    const leadIds = Array.from(selectedLeadIds);
    const leadsToConvert = pendingLeads.filter((l) => leadIds.includes(l.id));
    const batchName = `Batch ${new Date().toISOString().split('T')[0]} (${leadIds.length} restaurants)`;

    try {
      const response = await convertMutation.mutateAsync({
        leadIds,
        createRegistrationBatch,
        batchName,
      });

      const results = [];
      if (response.converted) {
        response.converted.forEach((item) => {
          results.push({
            leadId: item.lead_id,
            restaurantName: item.restaurant_name,
            success: true,
            restaurantId: item.restaurant_id,
          });
        });
      }
      if (response.failed) {
        response.failed.forEach((item) => {
          const lead = leadsToConvert.find((l) => l.id === item.lead_id);
          results.push({
            leadId: item.lead_id,
            restaurantName: lead?.restaurant_name || 'Unknown',
            success: false,
            error: item.error,
          });
        });
      }

      setConversionResults(results);
      clearLeadSelection();
      queryClient.invalidateQueries({ queryKey: ['pending-leads-preview'] });
    } catch (error) {
      const results = leadsToConvert.map((lead) => ({
        leadId: lead.id,
        restaurantName: lead.restaurant_name,
        success: false,
        error: error.message || 'Conversion failed',
      }));
      setConversionResults(results);
    } finally {
      setIsConverting(false);
    }
  };

  // Recent Registration Batches Preview
  const { data: registrationBatches = [], isLoading: batchesLoading } = useRecentRegistrationBatches(5);

  // Tasks Due Today with pagination
  const [tasksPage, setTasksPage] = useState(0);
  const tasksPageSize = 5;
  const { data: tasksDueTodayData, isLoading: tasksLoading } = useTasksDueToday(10);
  const allTasksDueToday = tasksDueTodayData?.tasks || [];
  const totalTasksDueToday = tasksDueTodayData?.total || 0;

  // Overdue tasks with fallback logic
  const { data: overdueData } = useOverdueTasksCount();
  const overdueCount = overdueData?.count || 0;
  const overdueTasks = overdueData?.tasks || [];

  // Merge overdue tasks when due today < 25
  const combinedTasks = React.useMemo(() => {
    if (allTasksDueToday.length < 25 && overdueTasks.length > 0) {
      const tasksNeeded = 25 - allTasksDueToday.length;
      const overdueToAdd = overdueTasks.slice(0, tasksNeeded);
      return [...overdueToAdd, ...allTasksDueToday];
    }
    return allTasksDueToday;
  }, [allTasksDueToday, overdueTasks]);

  const showingOverdue = combinedTasks.length > allTasksDueToday.length;
  const paginatedTasks = combinedTasks.slice(tasksPage * tasksPageSize, (tasksPage + 1) * tasksPageSize);
  const totalTasksPages = Math.ceil(combinedTasks.length / tasksPageSize);

  // Recently Created Restaurants with city filter and pagination
  const { data: recentRestaurantsData = [], isLoading: recentRestaurantsLoading } = useRecentRestaurants(25);
  const [selectedRestaurantCity, setSelectedRestaurantCity] = useState(null);
  const [restaurantsPage, setRestaurantsPage] = useState(0);
  const restaurantsPageSize = 5;

  // Get unique cities from recent restaurants
  const restaurantCities = useMemo(() => {
    const citySet = new Set(recentRestaurantsData.map(r => r.city).filter(Boolean));
    return Array.from(citySet).sort();
  }, [recentRestaurantsData]);

  // Filter recent restaurants by selected city
  const filteredRecentRestaurants = useMemo(() => {
    if (!selectedRestaurantCity) return recentRestaurantsData;
    return recentRestaurantsData.filter(r => r.city === selectedRestaurantCity);
  }, [recentRestaurantsData, selectedRestaurantCity]);

  // Paginate filtered restaurants
  const paginatedRestaurants = filteredRecentRestaurants.slice(
    restaurantsPage * restaurantsPageSize,
    (restaurantsPage + 1) * restaurantsPageSize
  );
  const totalRestaurantsPages = Math.ceil(filteredRecentRestaurants.length / restaurantsPageSize);

  // Reset page when city filter changes
  useEffect(() => {
    setRestaurantsPage(0);
  }, [selectedRestaurantCity]);

  // Task handlers for Recently Created Restaurants
  const handleCreateTask = (restaurant) => {
    // Open create task modal - implement if needed
    setCreateTaskModalOpen(true);
  };

  const handleStartSequence = (restaurant) => {
    // Open StartSequenceModal for TaskCell dropdown "Start New Sequence"
    setStartSequenceFor(restaurant);
  };

  const handleTaskCompleted = () => {
    // Refresh recent restaurants data after task completion
    // The hook should automatically refetch
  };

  const handleFollowUpRequested = (taskId) => {
    // Handle follow-up request - implement if needed
  };

  const handleStartSequenceRequested = (restaurant) => {
    // Open StartSequenceModal from TaskTypeQuickView "Complete & Start Sequence"
    setSequenceRestaurant(restaurant);
    setIsSequenceModalOpen(true);
  };

  // Handle restaurant field updates
  const handleUpdateRestaurantField = async (restaurantId, field, value) => {
    try {
      await api.patch(`/restaurants/${restaurantId}`, { [field]: value });
      // Trigger data refresh
      queryClient.invalidateQueries({ queryKey: ['recent-restaurants'] });
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
    }
  };

  // Badge helper functions for Recent Restaurants
  const getLeadTypeBadge = (type, restaurantId) => {
    if (!type) {
      return (
        <Select value="none" onValueChange={(v) => handleUpdateRestaurantField(restaurantId, 'lead_type', v)}>
          <SelectTrigger className="h-7 w-full border-dashed">
            <SelectValue placeholder="Set type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    const colors = {
      inbound: 'bg-blue-100 text-blue-800 border-blue-200',
      outbound: 'bg-purple-100 text-purple-800 border-purple-200'
    };

    return (
      <Select value={type} onValueChange={(v) => handleUpdateRestaurantField(restaurantId, 'lead_type', v)}>
        <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0" hideChevron>
          <Badge variant="outline" className={cn('capitalize cursor-pointer hover:opacity-80', colors[type])}>
            {type}
          </Badge>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="inbound">Inbound</SelectItem>
          <SelectItem value="outbound">Outbound</SelectItem>
        </SelectContent>
      </Select>
    );
  };

  const getLeadCategoryBadge = (category, restaurantId) => {
    if (!category) {
      return (
        <Select value="none" onValueChange={(v) => handleUpdateRestaurantField(restaurantId, 'lead_category', v)}>
          <SelectTrigger className="h-7 w-full border-dashed">
            <SelectValue placeholder="Set category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paid_ads">Paid Ads</SelectItem>
            <SelectItem value="organic_content">Organic Content</SelectItem>
            <SelectItem value="warm_outreach">Warm Outreach</SelectItem>
            <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    const colors = {
      paid_ads: 'bg-green-100 text-green-800 border-green-200',
      organic_content: 'bg-blue-100 text-blue-800 border-blue-200',
      warm_outreach: 'bg-orange-100 text-orange-800 border-orange-200',
      cold_outreach: 'bg-gray-100 text-gray-800 border-gray-200'
    };

    return (
      <Select value={category} onValueChange={(v) => handleUpdateRestaurantField(restaurantId, 'lead_category', v)}>
        <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0" hideChevron>
          <Badge variant="outline" className={cn('capitalize cursor-pointer hover:opacity-80 text-xs', colors[category])}>
            {category.replace(/_/g, ' ')}
          </Badge>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="paid_ads">Paid Ads</SelectItem>
          <SelectItem value="organic_content">Organic Content</SelectItem>
          <SelectItem value="warm_outreach">Warm Outreach</SelectItem>
          <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
        </SelectContent>
      </Select>
    );
  };

  const getLeadStatusBadge = (status, restaurantId) => {
    if (!status) {
      return (
        <Select value="none" onValueChange={(v) => handleUpdateRestaurantField(restaurantId, 'lead_status', v)}>
          <SelectTrigger className="h-7 w-full border-dashed">
            <SelectValue placeholder="Set status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="ghosted">Ghosted</SelectItem>
            <SelectItem value="reengaging">Reengaging</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    const colors = {
      active: 'bg-green-100 text-green-800 border-green-200',
      inactive: 'bg-gray-100 text-gray-800 border-gray-200',
      ghosted: 'bg-red-100 text-red-800 border-red-200',
      reengaging: 'bg-orange-100 text-orange-800 border-orange-200',
      closed: 'bg-purple-100 text-purple-800 border-purple-200'
    };

    return (
      <Select value={status} onValueChange={(v) => handleUpdateRestaurantField(restaurantId, 'lead_status', v)}>
        <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0" hideChevron>
          <Badge variant="outline" className={cn('capitalize cursor-pointer hover:opacity-80', colors[status])}>
            {status}
          </Badge>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          <SelectItem value="ghosted">Ghosted</SelectItem>
          <SelectItem value="reengaging">Reengaging</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>
    );
  };

  const getOnboardingStatusBadge = (status, restaurantId) => {
    const colors = {
      completed: 'text-green-600 border-green-600',
      in_progress: 'text-blue-600 border-blue-600',
      pending: 'text-yellow-600 border-yellow-600',
      unknown: 'text-gray-600 border-gray-600'
    };

    const displayStatus = status || 'unknown';

    return (
      <Select value={displayStatus} onValueChange={(v) => handleUpdateRestaurantField(restaurantId, 'onboarding_status', v)}>
        <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0" hideChevron>
          <Badge variant="outline" className={cn('cursor-pointer hover:opacity-80', colors[displayStatus])}>
            {displayStatus}
          </Badge>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
    );
  };

  if (recentRestaurantsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of your restaurant menu extraction system
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your restaurant menu extraction system
        </p>
      </div>

      {/* Quick Actions */}
      <Card className="backdrop-blur-sm bg-background/95 border-border">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/extractions/new"
              className="flex-1 min-w-[200px] flex items-center justify-center px-4 py-3 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90 transition-all duration-200 shadow-lg"
            >
              <Download className="mr-2 h-4 w-4" />
              New Extraction
            </Link>
            <Link
              to="/restaurants/new"
              className="flex-1 min-w-[200px] flex items-center justify-center px-4 py-3 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-brand-purple to-brand-blue hover:opacity-90 transition-all duration-200 shadow-lg"
            >
              <Store className="mr-2 h-4 w-4" />
              New Restaurant
            </Link>
            {isFeatureEnabled('tasksAndSequences') && (
              <button
                onClick={() => setCreateTaskModalOpen(true)}
                className="flex-1 min-w-[200px] flex items-center justify-center px-4 py-3 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-brand-orange to-brand-coral hover:opacity-90 transition-all duration-200 shadow-lg"
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                New Task
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tasks Due Today - Feature flagged, moved to top */}
      {isFeatureEnabled('tasksAndSequences') && (
        <Card className="backdrop-blur-sm bg-background/95 border-border">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base flex items-center gap-2">
              {showingOverdue ? 'Overdue & Due Today' : 'Tasks Due Today'}
              <Badge variant="secondary" className="text-xs">
                {combinedTasks.length}
              </Badge>
              {showingOverdue && (
                <Badge variant="destructive" className="text-xs">
                  {combinedTasks.length - allTasksDueToday.length} overdue
                </Badge>
              )}
            </CardTitle>
            <Link to="/tasks">
              <div className="text-sm text-brand-blue hover:text-brand-blue/80 font-medium flex items-center transition-colors">
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {tasksLoading ? (
              <div className="divide-y divide-border">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4">
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : combinedTasks.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No tasks due today
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Task Name</TableHead>
                      <TableHead className="w-24">Type</TableHead>
                      <TableHead className="w-24">Priority</TableHead>
                      <TableHead className="w-48">Restaurant</TableHead>
                      <TableHead className="w-40">Due Date</TableHead>
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTasks.map((task) => {
                      const currentStatus = statusOptions.find(s => s.value === task.status);
                      return (
                        <TableRow key={task.id} className="hover:bg-muted/50">
                          <TableCell className="w-12 p-2">
                            <Select
                              value={task.status}
                              onValueChange={(v) => handleTaskStatusChange(task.id, v)}
                            >
                              <SelectTrigger className="h-8 w-8 border-0 bg-transparent p-0 hover:bg-muted/50 rounded-full">
                                {currentStatus?.icon || <Circle className="h-4 w-4 text-gray-400" />}
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    <div className="flex items-center gap-2">
                                      {status.icon}
                                      <div>
                                        <div className="font-medium">{status.label}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {status.description}
                                        </div>
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div
                              className="font-medium cursor-pointer hover:text-brand-blue transition-colors"
                              onClick={() => setDetailModalTaskId(task.id)}
                            >
                              {task.name}
                            </div>
                            {task.description && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {task.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <TaskTypeQuickView
                              task={task}
                              onTaskCompleted={() => {
                                queryClient.invalidateQueries({ queryKey: ['tasks-due-today'] });
                                queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
                              }}
                              onFollowUpRequested={(taskId) => {
                                // Handle follow-up - can be enhanced later
                              }}
                              onStartSequenceRequested={(restaurant) => {
                                // Handle start sequence - can be enhanced later
                              }}
                            >
                              <div className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors">
                                {getTypeIcon(task.type)}
                                <span className="text-sm capitalize">
                                  {task.type?.replace(/_/g, ' ') || 'task'}
                                </span>
                              </div>
                            </TaskTypeQuickView>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-muted/50 rounded-md">
                                  <Badge variant="outline" className={cn('capitalize cursor-pointer', priorityConfig[task.priority]?.color)}>
                                    {priorityConfig[task.priority]?.label || task.priority}
                                  </Badge>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={() => handleTaskPriorityChange(task.id, 'low')}>
                                  <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200 mr-2">
                                    Low
                                  </Badge>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleTaskPriorityChange(task.id, 'medium')}>
                                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 mr-2">
                                    Medium
                                  </Badge>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleTaskPriorityChange(task.id, 'high')}>
                                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 mr-2">
                                    High
                                  </Badge>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {task.restaurants?.name || '-'}
                          </TableCell>
                          <TableCell>
                            {getDueDateInput(task)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {task.status === 'active' && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-green-600 hover:text-green-700 flex items-center gap-0.5 px-2"
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleCompleteTask(task.id)}>
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Mark as Complete
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleCompleteWithFollowUp(task.id)}>
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Complete & Set Follow-up
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleCompleteWithStartSequence(task)}
                                      disabled={!task?.restaurants}
                                    >
                                      <Workflow className="h-4 w-4 mr-2" />
                                      Complete & Start Sequence
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDetailModalTaskId(task.id)}
                                title="Edit task"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDuplicateTaskId(task.id);
                                  setCreateTaskModalOpen(true);
                                }}
                                title="Duplicate task"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {totalTasksPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
                    <div className="text-sm text-muted-foreground">
                      Showing {tasksPage * tasksPageSize + 1}-{Math.min((tasksPage + 1) * tasksPageSize, combinedTasks.length)} of {combinedTasks.length} tasks
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-md border border-border bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={() => setTasksPage(tasksPage - 1)}
                        disabled={tasksPage === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-sm text-muted-foreground min-w-[100px] text-center">
                        Page {tasksPage + 1} of {totalTasksPages}
                      </span>
                      <button
                        className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-md border border-border bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={() => setTasksPage(tasksPage + 1)}
                        disabled={tasksPage + 1 >= totalTasksPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lead Scraping Reports - Feature flagged */}
      {isFeatureEnabled('leadScraping') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Lead Scraping</h2>
            <Link
              to="/leads?tab=reports"
              className="text-sm text-brand-blue hover:text-brand-blue/80 font-medium flex items-center transition-colors"
            >
              View Full Reports
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <ReportsTabContent onStartScrape={handleStartScrape} />
        </div>
      )}

      {/* Two-column grid for Recent Restaurants, Pending Leads, and Batch Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recently Created Restaurants - Position 1 (left) */}
        <Card className="backdrop-blur-sm bg-background/95 border-border">
          <CardHeader className="py-3 space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Recently Created Restaurants
                <Badge variant="secondary" className="text-xs">
                  {recentRestaurantsData.length}
                </Badge>
              </CardTitle>
              <Link to="/restaurants">
                <div className="text-sm text-brand-blue hover:text-brand-blue/80 font-medium flex items-center transition-colors">
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </Link>
            </div>
            {/* City filter buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedRestaurantCity(null)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedRestaurantCity === null
                    ? 'bg-brand-blue text-white'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                All
              </button>
              {restaurantCities.map((city) => (
                <button
                  key={city}
                  onClick={() => setSelectedRestaurantCity(city)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedRestaurantCity === city
                      ? 'bg-brand-blue text-white'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentRestaurantsLoading ? (
              <div className="divide-y divide-border">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4">
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : filteredRecentRestaurants.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No restaurants to display
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Restaurant Name</TableHead>
                      <TableHead className="w-32">City</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-24">Lead Type</TableHead>
                      <TableHead className="w-32">Lead Category</TableHead>
                      <TableHead className="w-32">Lead Status</TableHead>
                      <TableHead className="w-32">Lead Contact</TableHead>
                      <TableHead className="w-48">Tasks</TableHead>
                      <TableHead className="w-28">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRestaurants.map((restaurant) => (
                      <TableRow
                        key={restaurant.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/restaurants/${restaurant.id}`)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">{restaurant.name}</div>
                            {restaurant.organisation_name && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {restaurant.organisation_name}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{restaurant.city || '-'}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {getOnboardingStatusBadge(restaurant.onboarding_status, restaurant.id)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {getLeadTypeBadge(restaurant.lead_type, restaurant.id)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {getLeadCategoryBadge(restaurant.lead_category, restaurant.id)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {getLeadStatusBadge(restaurant.lead_status, restaurant.id)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {restaurant.lead_contact || 'No contact'}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <TaskCell
                            task={restaurant.oldest_task}
                            restaurantName={restaurant.name}
                            restaurantId={restaurant.id}
                            onStartSequence={() => handleStartSequence(restaurant)}
                            onTaskCompleted={handleTaskCompleted}
                            onFollowUpRequested={handleFollowUpRequested}
                            onStartSequenceRequested={handleStartSequenceRequested}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(restaurant.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {totalRestaurantsPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
                    <div className="text-sm text-muted-foreground">
                      Showing {restaurantsPage * restaurantsPageSize + 1}-{Math.min((restaurantsPage + 1) * restaurantsPageSize, filteredRecentRestaurants.length)} of {filteredRecentRestaurants.length} restaurants
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-md border border-border bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={() => setRestaurantsPage(restaurantsPage - 1)}
                        disabled={restaurantsPage === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-sm text-muted-foreground min-w-[100px] text-center">
                        Page {restaurantsPage + 1} of {totalRestaurantsPages}
                      </span>
                      <button
                        className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-md border border-border bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={() => setRestaurantsPage(restaurantsPage + 1)}
                        disabled={restaurantsPage + 1 >= totalRestaurantsPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Pending Leads Preview - Position 2 (right) - Feature flagged */}
        {isFeatureEnabled('leadScraping') && (
          <div className="space-y-2">
            {/* Bulk Actions Bar */}
            {selectedLeadIds.size > 0 && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                <span className="text-sm font-medium">{selectedLeadIds.size} leads selected</span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={createRegistrationBatch}
                      onCheckedChange={(checked) => setCreateRegistrationBatch(!!checked)}
                    />
                    <span className="text-xs text-muted-foreground">Create Batch</span>
                  </label>
                  <Button size="sm" onClick={handleConvertSelectedLeads} disabled={convertMutation.isPending}>
                    {convertMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRightCircle className="h-4 w-4 mr-2" />
                    )}
                    Convert Selected
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearLeadSelection}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <Card className="backdrop-blur-sm bg-background/95 border-border">
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  Pending Leads
                  <Badge variant="secondary" className="text-xs">
                    {totalPendingLeads}
                  </Badge>
                </CardTitle>
                <Link to="/leads?tab=pending">
                  <div className="text-sm text-brand-blue hover:text-brand-blue/80 font-medium flex items-center transition-colors">
                    View All
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {pendingLeadsLoading ? (
                  <div className="divide-y divide-border">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4">
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ))}
                  </div>
                ) : pendingLeads.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No pending leads to display
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={toggleExpandAllLeads}
                            title={allLeadsExpanded ? 'Collapse All' : 'Expand All'}
                          >
                            {allLeadsExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allLeadsSelected}
                            onCheckedChange={toggleSelectAllLeads}
                          />
                        </TableHead>
                        <TableHead>Restaurant Name</TableHead>
                        <TableHead className="w-28">City</TableHead>
                        <TableHead className="w-24">Rating</TableHead>
                        <TableHead className="w-28">Created</TableHead>
                        <TableHead className="w-20 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingLeads.map((lead) => (
                        <React.Fragment key={lead.id}>
                          <TableRow className="hover:bg-muted/50">
                            <TableCell className="w-8 p-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleLeadExpanded(lead.id)}
                              >
                                {expandedLeadIds.has(lead.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedLeadIds.has(lead.id)}
                                onCheckedChange={() => toggleLeadSelection(lead.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <div
                                  className="font-medium cursor-pointer hover:text-brand-blue transition-colors"
                                  onClick={() => handleViewLead(lead.id)}
                                >
                                  {lead.restaurant_name}
                                </div>
                                {lead.store_link && (
                                  <a
                                    href={lead.store_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 py-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View on {getPlatformLabel(lead.platform)}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{lead.city || '-'}</TableCell>
                            <TableCell>
                              {lead.ubereats_average_review_rating ? (
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                  <span className="text-sm font-medium">
                                    {lead.ubereats_average_review_rating.toFixed(1)}
                                  </span>
                                  {lead.ubereats_number_of_reviews && (
                                    <span className="text-xs text-muted-foreground">
                                      ({lead.ubereats_number_of_reviews})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDistanceToNow(new Date(lead.created_at), {
                                addSuffix: true,
                              })}
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleViewLead(lead.id)}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleConvertSingleLead(lead.id)}
                                  disabled={convertMutation.isPending}
                                  title="Convert to Restaurant"
                                >
                                  <ArrowRightCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {/* Collapsible details row */}
                          <Collapsible open={expandedLeadIds.has(lead.id)} asChild>
                            <TableRow className="hover:bg-transparent border-0">
                              <TableCell colSpan={7} className="p-0">
                                <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
                                  <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 border-t">
                                    {/* Column 1: Location */}
                                    <div className="space-y-1">
                                      <div className="text-xs font-medium text-muted-foreground mb-2">Location</div>
                                      {lead.ubereats_address && (
                                        <div className="flex items-start gap-2 py-0.5">
                                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                          <span className="text-xs">{lead.ubereats_address}</span>
                                        </div>
                                      )}
                                      {lead.city && (
                                        <div className="text-xs text-muted-foreground pl-5">{lead.city}</div>
                                      )}
                                      {lead.ubereats_cuisine && lead.ubereats_cuisine.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1">
                                          {lead.ubereats_cuisine.map((c, i) => (
                                            <Badge key={i} variant="secondary" className="text-[10px]">
                                              {c}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {/* Column 2: Contact */}
                                    <div className="space-y-1">
                                      <div className="text-xs font-medium text-muted-foreground mb-2">Contact</div>
                                      {lead.phone && (
                                        <div className="flex items-start gap-2 py-0.5">
                                          <Phone className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                          <span className="text-xs">{lead.phone}</span>
                                        </div>
                                      )}
                                      {lead.email && (
                                        <div className="flex items-start gap-2 py-0.5">
                                          <Mail className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                          <span className="text-xs">{lead.email}</span>
                                        </div>
                                      )}
                                    </div>
                                    {/* Column 3: Online */}
                                    <div className="space-y-1">
                                      <div className="text-xs font-medium text-muted-foreground mb-2">Online</div>
                                      {lead.website_url && (
                                        <div className="flex items-start gap-2 py-0.5">
                                          <Globe className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                          <a
                                            href={lead.website_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline truncate"
                                          >
                                            Website
                                          </a>
                                        </div>
                                      )}
                                      {lead.instagram_url && (
                                        <div className="flex items-start gap-2 py-0.5">
                                          <Globe className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                          <a
                                            href={lead.instagram_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline truncate"
                                          >
                                            Instagram
                                          </a>
                                        </div>
                                      )}
                                      {lead.facebook_url && (
                                        <div className="flex items-start gap-2 py-0.5">
                                          <Globe className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                          <a
                                            href={lead.facebook_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline truncate"
                                          >
                                            Facebook
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </TableCell>
                            </TableRow>
                          </Collapsible>
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Batch Registration Jobs - Position 3 - Feature flagged */}
        {isFeatureEnabled('registrationBatches') && (
          <Card className="backdrop-blur-sm bg-background/95 border-border">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base flex items-center gap-2">
                Recent Batch Jobs
                <Badge variant="secondary" className="text-xs">
                  {registrationBatches.length}
                </Badge>
              </CardTitle>
              <Link to="/registration-batches">
                <div className="text-sm text-brand-blue hover:text-brand-blue/80 font-medium flex items-center transition-colors">
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {batchesLoading ? (
                <div className="divide-y divide-border">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4">
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              ) : registrationBatches.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No batch jobs to display
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Name</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-32">Current Step</TableHead>
                      <TableHead className="w-40">Restaurants</TableHead>
                      <TableHead className="w-32">Progress</TableHead>
                      <TableHead className="w-28">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrationBatches.map((batch) => {
                      const stepNames = [
                        'Menu & Branding',
                        'Contact Search',
                        'Company Selection',
                        'Company Details',
                        'Yolo Config',
                        'Account Setup'
                      ];
                      const currentStepName = stepNames[batch.current_step - 1] || `Step ${batch.current_step}`;
                      const progressPercent = batch.total_restaurants > 0
                        ? Math.round((batch.completed_restaurants / batch.total_restaurants) * 100)
                        : 0;

                      return (
                        <TableRow
                          key={batch.id}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => navigate(`/registration-batches/${batch.id}`)}
                        >
                          <TableCell className="font-medium">{batch.name}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                batch.status === 'completed' ? 'text-green-600 border-green-600' :
                                batch.status === 'processing' || batch.status === 'in_progress' ? 'text-blue-600 border-blue-600' :
                                batch.status === 'failed' ? 'text-red-600 border-red-600' :
                                'text-gray-600 border-gray-600'
                              }
                            >
                              {batch.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {batch.current_step}: {currentStepName}
                          </TableCell>
                          <TableCell>
                            {batch.jobs && batch.jobs.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {batch.jobs.slice(0, 2).map((job) => (
                                  <div
                                    key={job.id}
                                    className="flex items-center gap-1 text-[10px] bg-muted/50 px-1.5 py-0.5 rounded"
                                    title={job.restaurant?.name}
                                  >
                                    <Store className="h-2.5 w-2.5 text-muted-foreground" />
                                    <span className="truncate max-w-[60px]">
                                      {job.restaurant?.name || 'Unknown'}
                                    </span>
                                  </div>
                                ))}
                                {batch.jobs.length > 2 && (
                                  <span className="text-[10px] text-muted-foreground px-1.5 py-0.5">
                                    +{batch.jobs.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={progressPercent} className="h-2 w-20" />
                              <span className="text-xs text-muted-foreground">{progressPercent}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(batch.created_at), {
                              addSuffix: true,
                            })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Lead Scrape Job Dialog */}
      <CreateLeadScrapeJob
        open={createJobOpen}
        onClose={() => {
          setCreateJobOpen(false);
          setPrefillScrapeData({ city: undefined, cuisine: undefined, pageOffset: undefined });
        }}
        prefillCity={prefillScrapeData.city}
        prefillCuisine={prefillScrapeData.cuisine}
        prefillPageOffset={prefillScrapeData.pageOffset}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        open={createTaskModalOpen}
        onClose={() => {
          setCreateTaskModalOpen(false);
          setDuplicateTaskId(null);
          setFollowUpTaskId(null);
        }}
        onSuccess={() => {
          setCreateTaskModalOpen(false);
          setDuplicateTaskId(null);
          setFollowUpTaskId(null);
          queryClient.invalidateQueries({ queryKey: ['tasks-due-today'] });
          queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
        }}
        duplicateFromTaskId={duplicateTaskId}
        followUpFromTaskId={followUpTaskId}
      />

      {/* Lead Detail Modal */}
      <LeadDetailModal
        open={isLeadDetailModalOpen}
        leadId={selectedLeadId}
        onClose={() => {
          setIsLeadDetailModalOpen(false);
          setSelectedLeadId(null);
        }}
      />

      {/* Task Detail Modal */}
      {detailModalTaskId && (
        <TaskDetailModal
          open={!!detailModalTaskId}
          taskId={detailModalTaskId}
          onClose={() => setDetailModalTaskId(null)}
          onSuccess={() => {
            setDetailModalTaskId(null);
            queryClient.invalidateQueries({ queryKey: ['tasks-due-today'] });
            queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
          }}
        />
      )}

      {/* Start Sequence Modal (from Tasks Due Today action dropdown) */}
      {isSequenceModalOpen && sequenceRestaurant && (
        <StartSequenceModal
          open={isSequenceModalOpen}
          onClose={() => {
            setIsSequenceModalOpen(false);
            setSequenceRestaurant(null);
            queryClient.invalidateQueries({ queryKey: ['tasks-due-today'] });
            queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
          }}
          restaurant={sequenceRestaurant}
        />
      )}

      {/* Start Sequence Modal (from Recent Restaurants TaskCell dropdown) */}
      {startSequenceFor && (
        <StartSequenceModal
          open={!!startSequenceFor}
          onClose={() => {
            setStartSequenceFor(null);
            queryClient.invalidateQueries({ queryKey: ['recent-restaurants'] });
          }}
          restaurant={{
            id: startSequenceFor.id,
            name: startSequenceFor.name
          }}
        />
      )}

      {/* Lead Conversion Dialog */}
      <Dialog open={isConversionDialogOpen} onOpenChange={setIsConversionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isConverting ? 'Converting Leads...' : 'Conversion Complete'}
            </DialogTitle>
            <DialogDescription>
              {isConverting
                ? 'Please wait while leads are being converted to restaurants.'
                : `${conversionResults.filter(r => r.success).length} of ${conversionResults.length} leads converted successfully.`}
            </DialogDescription>
          </DialogHeader>
          {isConverting ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {conversionResults.map((result) => (
                <div
                  key={result.leadId}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded text-sm',
                    result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  )}
                >
                  {result.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">{result.restaurantName}</span>
                  {result.error && (
                    <span className="text-xs text-red-500 truncate">: {result.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsConversionDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}