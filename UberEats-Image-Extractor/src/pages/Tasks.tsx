import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '../hooks/use-toast';
import {
  CheckCircle2,
  Circle,
  XCircle,
  Calendar,
  Flag,
  User,
  MessageSquare,
  Phone,
  Mail,
  Plus,
  Edit,
  Filter,
  X,
  ClipboardList,
  Copy,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Workflow,
  CheckCircle,
  Trash2
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
import { MultiSelect } from '../components/ui/multi-select';
import { Input } from '../components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Calendar as CalendarComponent } from '../components/ui/calendar';
import { DateTimePicker } from '../components/ui/date-time-picker';
import { cn } from '../lib/utils';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { TaskDetailModal } from '../components/tasks/TaskDetailModal';
import { TaskTypeQuickView } from '../components/tasks/TaskTypeQuickView';
import { StartSequenceModal } from '../components/sequences/StartSequenceModal';
import { CreateTaskTemplateModal } from '../components/task-templates/CreateTaskTemplateModal';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { DateRange } from 'react-day-picker';

export default function Tasks() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTaskFilters, setShowTaskFilters] = useState(true);
  const [showRestaurantFilters, setShowRestaurantFilters] = useState(true);

  // Task filters (multi-select)
  const [filters, setFilters] = useState({
    search: '',
    status: ['active'] as string[],
    type: [] as string[],
    priority: [] as string[]
  });

  // Restaurant filters (from Restaurants page)
  const [restaurantFilters, setRestaurantFilters] = useState({
    lead_type: [] as string[],
    lead_category: [] as string[],
    lead_warmth: [] as string[],
    lead_stage: ['uncontacted', 'reached_out', 'in_talks', 'demo_booked', 'rebook_demo', 'demo_completed', 'contract_sent', 'reengaging'] as string[],
    lead_status: [] as string[],
    demo_store_built: 'all',
    icp_rating_min: ''
  });

  const [dueDateFilter, setDueDateFilter] = useState<{
    types: string[];
    customDates?: DateRange;
  }>({
    types: ['overdue', 'today'],
    customDates: undefined
  });

  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [sortConfig, setSortConfig] = useState<{
    column: 'due_date' | 'type' | 'priority' | null;
    direction: 'asc' | 'desc';
  }>({
    column: null,
    direction: 'asc'
  });

  const [sequenceRestaurant, setSequenceRestaurant] = useState(null);

  const [modals, setModals] = useState({
    create: false,
    edit: null,
    detail: null,
    duplicate: null,
    followUp: null,
    startSequence: false
  });

  // Tab state
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'tasks';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  // Task Templates tab state
  const [taskTemplateFilterType, setTaskTemplateFilterType] = useState<string>('all');
  const [taskTemplateFilterActive, setTaskTemplateFilterActive] = useState<string>('all');
  const [taskTemplateModals, setTaskTemplateModals] = useState({
    create: false,
    edit: null as string | null,
    duplicate: null as string | null
  });

  // Hooks for task templates
  const { toast } = useToast();

  // NZ Timezone utility functions
  const getStartOfDayNZ = (date: Date): Date => {
    // Create date string in NZ timezone
    const nzDateString = date.toLocaleString('en-NZ', {
      timeZone: 'Pacific/Auckland',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const [day, month, year] = nzDateString.split('/');
    // Create a new Date object at start of day in NZ timezone
    const nzDate = new Date(`${year}-${month}-${day}T00:00:00+13:00`);
    return nzDate;
  };

  const getEndOfDayNZ = (date: Date): Date => {
    // Create date string in NZ timezone
    const nzDateString = date.toLocaleString('en-NZ', {
      timeZone: 'Pacific/Auckland',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const [day, month, year] = nzDateString.split('/');
    // Create a new Date object at end of day in NZ timezone
    const nzDate = new Date(`${year}-${month}-${day}T23:59:59.999+13:00`);
    return nzDate;
  };

  const getTodayStartNZ = (): Date => {
    const now = new Date();
    return getStartOfDayNZ(now);
  };

  const getTodayEndNZ = (): Date => {
    const now = new Date();
    return getEndOfDayNZ(now);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Handle navigation state from Restaurants page
  useEffect(() => {
    if (location.state) {
      const { clearFilters: shouldClear, searchQuery } = location.state as {
        clearFilters?: boolean;
        searchQuery?: string;
      };

      if (shouldClear) {
        // Clear all filters
        setFilters({
          search: searchQuery || '',
          status: [],
          type: [],
          priority: []
        });
        setDueDateFilter({
          types: [],
          customDates: undefined
        });
        setRestaurantFilters({
          lead_type: [],
          lead_category: [],
          lead_warmth: [],
          lead_stage: [],
          lead_status: [],
          demo_store_built: 'all',
          icp_rating_min: ''
        });

        // Auto-focus search input
        if (searchQuery && searchInputRef.current) {
          setTimeout(() => searchInputRef.current?.focus(), 100);
        }
      } else if (searchQuery) {
        // Just update search, keep other filters
        setFilters(prev => ({ ...prev, search: searchQuery }));
      }

      // Clear navigation state to prevent reapplication
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [tasks, filters, restaurantFilters, dueDateFilter, sortConfig]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      // Fetch all tasks - we'll filter client-side
      const response = await api.get('/tasks');
      setTasks(response.data.tasks || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  // Data fetching - Task Templates
  const taskTemplateFilters = useMemo(() => ({
    type: taskTemplateFilterType === 'all' ? undefined : taskTemplateFilterType,
    is_active: taskTemplateFilterActive === 'all' ? undefined : taskTemplateFilterActive === 'true',
  }), [taskTemplateFilterType, taskTemplateFilterActive]);

  const { data: taskTemplatesData, isLoading: taskTemplatesLoading, refetch: refetchTaskTemplates } = useQuery({
    queryKey: ['task-templates', taskTemplateFilters],
    queryFn: async () => {
      const params: any = {};
      if (taskTemplateFilters.type) params.type = taskTemplateFilters.type;
      if (taskTemplateFilters.is_active !== undefined) params.is_active = taskTemplateFilters.is_active;

      const response = await api.get('/task-templates', { params });
      return response.data;
    }
  });

  const taskTemplates = taskTemplatesData?.templates || [];

  const applyFiltersAndSort = () => {
    let filtered = [...tasks];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(task =>
        task.name?.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower) ||
        task.restaurants?.name?.toLowerCase().includes(searchLower) ||
        task.restaurants?.contact_name?.toLowerCase().includes(searchLower) ||
        task.restaurants?.contact_email?.toLowerCase().includes(searchLower)
      );
    }

    // Apply task filters (multi-select)
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(t => filters.status.includes(t.status));
    }

    if (filters.type && filters.type.length > 0) {
      filtered = filtered.filter(t => filters.type.includes(t.type));
    }

    if (filters.priority && filters.priority.length > 0) {
      filtered = filtered.filter(t => filters.priority.includes(t.priority));
    }

    // Apply due date filters (multi-select + custom)
    if (dueDateFilter.types.length > 0 || dueDateFilter.customDates?.from) {
      const now = new Date();
      const matchingTasks = new Set<any>();

      // Apply each selected filter type
      dueDateFilter.types.forEach(filterType => {
        let matches: any[] = [];

        switch (filterType) {
          case 'overdue':
            matches = filtered.filter(t =>
              t.due_date &&
              new Date(t.due_date) < now &&
              t.status !== 'completed' &&
              t.status !== 'cancelled'
            );
            break;

          case 'today':
            const todayStart = getTodayStartNZ();
            const todayEnd = getTodayEndNZ();
            matches = filtered.filter(t =>
              t.due_date &&
              new Date(t.due_date) >= todayStart &&
              new Date(t.due_date) <= todayEnd
            );
            break;

          case 'week':
            const weekEnd = new Date(now);
            weekEnd.setDate(weekEnd.getDate() + 7);
            matches = filtered.filter(t =>
              t.due_date &&
              new Date(t.due_date) >= now &&
              new Date(t.due_date) <= getEndOfDayNZ(weekEnd)
            );
            break;

          case 'month':
            const monthEnd = new Date(now);
            monthEnd.setDate(monthEnd.getDate() + 30);
            matches = filtered.filter(t =>
              t.due_date &&
              new Date(t.due_date) >= now &&
              new Date(t.due_date) <= getEndOfDayNZ(monthEnd)
            );
            break;

          case 'no_date':
            matches = filtered.filter(t => !t.due_date);
            break;
        }

        matches.forEach(task => matchingTasks.add(task));
      });

      // Apply custom date range filter
      if (dueDateFilter.customDates?.from) {
        const startDate = getStartOfDayNZ(dueDateFilter.customDates.from);
        const endDate = getEndOfDayNZ(dueDateFilter.customDates.to || dueDateFilter.customDates.from);
        const customMatches = filtered.filter(t =>
          t.due_date &&
          new Date(t.due_date) >= startDate &&
          new Date(t.due_date) <= endDate
        );
        customMatches.forEach(task => matchingTasks.add(task));
      }

      // Only keep tasks that matched at least one filter
      filtered = Array.from(matchingTasks);
    }

    // Apply restaurant filters (only filter tasks that have restaurants)
    if (restaurantFilters.lead_type && restaurantFilters.lead_type.length > 0) {
      filtered = filtered.filter(t =>
        !t.restaurants || (t.restaurants.lead_type && restaurantFilters.lead_type.includes(t.restaurants.lead_type))
      );
    }

    if (restaurantFilters.lead_category && restaurantFilters.lead_category.length > 0) {
      filtered = filtered.filter(t =>
        !t.restaurants || (t.restaurants.lead_category && restaurantFilters.lead_category.includes(t.restaurants.lead_category))
      );
    }

    if (restaurantFilters.lead_warmth && restaurantFilters.lead_warmth.length > 0) {
      filtered = filtered.filter(t =>
        !t.restaurants || (t.restaurants.lead_warmth && restaurantFilters.lead_warmth.includes(t.restaurants.lead_warmth))
      );
    }

    if (restaurantFilters.lead_stage && restaurantFilters.lead_stage.length > 0) {
      filtered = filtered.filter(t =>
        !t.restaurants || (t.restaurants.lead_stage && restaurantFilters.lead_stage.includes(t.restaurants.lead_stage))
      );
    }

    if (restaurantFilters.lead_status && restaurantFilters.lead_status.length > 0) {
      filtered = filtered.filter(t =>
        !t.restaurants || (t.restaurants.lead_status && restaurantFilters.lead_status.includes(t.restaurants.lead_status))
      );
    }

    if (restaurantFilters.demo_store_built !== 'all') {
      const demoBuilt = restaurantFilters.demo_store_built === 'true';
      filtered = filtered.filter(t => !t.restaurants || t.restaurants.demo_store_built === demoBuilt);
    }

    if (restaurantFilters.icp_rating_min) {
      const minRating = parseInt(restaurantFilters.icp_rating_min);
      filtered = filtered.filter(t => !t.restaurants || (t.restaurants.icp_rating && t.restaurants.icp_rating >= minRating));
    }

    // Apply sorting
    if (sortConfig.column) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.column) {
          case 'due_date':
            aValue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
            bValue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
            break;
          case 'type':
            aValue = a.type || '';
            bValue = b.type || '';
            break;
          case 'priority':
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            aValue = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
            bValue = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredTasks(filtered);
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      await fetchTasks();
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const handleCompleteWithFollowUp = async (taskId: string) => {
    try {
      // First, complete the current task
      await api.patch(`/tasks/${taskId}/complete`);

      // Then open the follow-up task modal
      setModals({ ...modals, followUp: taskId });
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const handleCompleteWithStartSequence = async (task: any) => {
    try {
      if (!task?.restaurants) {
        console.error('No restaurant data available');
        return;
      }

      // First, complete the current task
      await api.patch(`/tasks/${task.id}/complete`);

      // Then open the sequence modal
      setSequenceRestaurant({
        id: task.restaurants.id,
        name: task.restaurants.name
      });
      setModals({ ...modals, startSequence: true });
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}/cancel`);
      await fetchTasks();
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  };

  const handleUpdateDueDate = async (taskId: string, dueDate: string | null) => {
    try {
      await api.patch(`/tasks/${taskId}`, { due_date: dueDate });
      // Update local state optimistically
      setTasks(prev => prev.map((t: any) =>
        t.id === taskId ? { ...t, due_date: dueDate } : t
      ));
    } catch (error) {
      console.error('Failed to update due date:', error);
      // Refetch if update fails
      fetchTasks();
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      // Use the specific endpoint for complete/cancel, or general update for others
      if (newStatus === 'completed') {
        await api.patch(`/tasks/${taskId}/complete`);
      } else if (newStatus === 'cancelled') {
        await api.patch(`/tasks/${taskId}/cancel`);
      } else {
        await api.patch(`/tasks/${taskId}`, { status: newStatus });
      }
      await fetchTasks();
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const handlePriorityChange = async (taskId: string, newPriority: string) => {
    try {
      await api.patch(`/tasks/${taskId}`, { priority: newPriority });
      setTasks((prev: any) =>
        prev.map((t: any) => (t.id === taskId ? { ...t, priority: newPriority } : t))
      );
    } catch (error) {
      console.error('Failed to update task priority:', error);
      fetchTasks();
    }
  };

  const updateFilter = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const updateRestaurantFilter = (key: string, value: any) => {
    setRestaurantFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSort = (column: 'due_date' | 'type' | 'priority') => {
    setSortConfig(prev => {
      if (prev.column === column) {
        // Toggle direction if same column
        return {
          column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      } else {
        // New column, default to ascending
        return {
          column,
          direction: 'asc'
        };
      }
    });
  };

  const getSortIcon = (column: 'due_date' | 'type' | 'priority') => {
    if (sortConfig.column !== column) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="h-4 w-4 text-brand-blue" />
      : <ArrowDown className="h-4 w-4 text-brand-blue" />;
  };

  const clearTaskFilters = () => {
    setFilters({
      search: '',
      status: ['active'],
      type: [],
      priority: []
    });
    setDueDateFilter({
      types: ['overdue', 'today'],
      customDates: undefined
    });
    setTempDateRange(undefined);
  };

  const clearAllTaskFilters = () => {
    setFilters({
      search: '',
      status: [],
      type: [],
      priority: []
    });
    setDueDateFilter({
      types: [],
      customDates: undefined
    });
    setTempDateRange(undefined);
  };

  const clearRestaurantFilters = () => {
    setRestaurantFilters({
      lead_type: [],
      lead_category: [],
      lead_warmth: [],
      lead_stage: ['uncontacted', 'reached_out', 'in_talks', 'demo_booked', 'rebook_demo', 'demo_completed', 'contract_sent', 'reengaging'],
      lead_status: [],
      demo_store_built: 'all',
      icp_rating_min: ''
    });
  };

  const clearAllRestaurantFilters = () => {
    setRestaurantFilters({
      lead_type: [],
      lead_category: [],
      lead_warmth: [],
      lead_stage: [],
      lead_status: [],
      demo_store_built: 'all',
      icp_rating_min: ''
    });
  };

  const clearFilters = () => {
    clearTaskFilters();
    clearRestaurantFilters();
  };

  // Task Template handlers
  const handleDeleteTaskTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this task template?')) {
      return;
    }

    try {
      await api.delete(`/task-templates/${templateId}`);
      toast({
        title: "Success",
        description: "Task template deleted successfully"
      });
      refetchTaskTemplates();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || 'Failed to delete template',
        variant: "destructive"
      });
    }
  };

  const hasTaskFilters = () => {
    return filters.search !== '' ||
      filters.status.length > 0 ||
      filters.type.length > 0 ||
      filters.priority.length > 0 ||
      dueDateFilter.types.length > 0 ||
      dueDateFilter.customDates !== undefined;
  };

  const isTaskFiltersAtDefault = () => {
    return filters.search === '' &&
      JSON.stringify(filters.status) === JSON.stringify(['active']) &&
      filters.type.length === 0 &&
      filters.priority.length === 0 &&
      JSON.stringify(dueDateFilter.types) === JSON.stringify(['overdue', 'today']) &&
      dueDateFilter.customDates === undefined;
  };

  const hasRestaurantFilters = () => {
    return restaurantFilters.lead_type.length > 0 ||
      restaurantFilters.lead_category.length > 0 ||
      restaurantFilters.lead_warmth.length > 0 ||
      restaurantFilters.lead_stage.length > 0 ||
      restaurantFilters.lead_status.length > 0 ||
      restaurantFilters.demo_store_built !== 'all' ||
      restaurantFilters.icp_rating_min !== '';
  };

  const isRestaurantFiltersAtDefault = () => {
    return restaurantFilters.lead_type.length === 0 &&
      restaurantFilters.lead_category.length === 0 &&
      restaurantFilters.lead_warmth.length === 0 &&
      JSON.stringify(restaurantFilters.lead_stage) === JSON.stringify(['uncontacted', 'reached_out', 'in_talks', 'demo_booked', 'rebook_demo', 'contract_sent', 'reengaging']) &&
      restaurantFilters.lead_status.length === 0 &&
      restaurantFilters.demo_store_built === 'all' &&
      restaurantFilters.icp_rating_min === '';
  };

  const hasAnyFilters = () => {
    return hasTaskFilters() || hasRestaurantFilters();
  };

  const hasActiveFilters = () => {
    // Check if task filters differ from defaults
    const taskFiltersActive = filters.search !== '' ||
      JSON.stringify(filters.status) !== JSON.stringify(['active']) ||
      filters.type.length > 0 ||
      filters.priority.length > 0 ||
      JSON.stringify(dueDateFilter.types) !== JSON.stringify(['overdue', 'today']) ||
      dueDateFilter.customDates !== undefined;

    const restaurantFiltersActive = restaurantFilters.lead_type.length > 0 ||
      restaurantFilters.lead_category.length > 0 ||
      restaurantFilters.lead_warmth.length > 0 ||
      restaurantFilters.lead_stage.length < 7 || // Default is 7 stages
      restaurantFilters.lead_status.length > 0 ||
      restaurantFilters.demo_store_built !== 'all' ||
      restaurantFilters.icp_rating_min !== '';

    return taskFiltersActive || restaurantFiltersActive;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'active':
        return <Circle className="h-5 w-5 text-blue-600" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getTypeIcon = (type: string) => {
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

  const getPriorityDropdown = (task: any) => {
    const priorityConfig = {
      low: { label: 'Low', color: 'bg-gray-100 text-gray-800 border-gray-200' },
      medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      high: { label: 'High', color: 'bg-red-100 text-red-800 border-red-200' },
    };

    const currentPriority = priorityConfig[task.priority as keyof typeof priorityConfig];

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-muted/50 rounded-md">
            <Badge variant="outline" className={cn('capitalize cursor-pointer', currentPriority?.color)}>
              {currentPriority?.label || task.priority}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handlePriorityChange(task.id, 'low')}>
            <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200 mr-2">
              Low
            </Badge>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePriorityChange(task.id, 'medium')}>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 mr-2">
              Medium
            </Badge>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePriorityChange(task.id, 'high')}>
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 mr-2">
              High
            </Badge>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const getDueDateInput = (task: any) => {
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
        onChange={(date) => handleUpdateDueDate(task.id, date ? date.toISOString() : null)}
        placeholder="Set due date"
        className={cn("h-8 text-xs", isOverdue && "text-red-600")}
      />
    );
  };

  const getInteractiveStatusIcon = (task: any) => {
    const statusOptions = [
      {
        value: 'pending',
        label: 'Pending',
        icon: <Circle className="h-4 w-4 stroke-gray-700"/>,
        description: 'Waiting on dependencies'
      },
      {
        value: 'active',
        label: 'Active',
        icon: <Circle className="h-4 w-4 stroke-brand-blue"/>,
        description: 'Currently working on'
      },
      {
        value: 'completed',
        label: 'Completed',
        icon: <CheckCircle2 className="h-4 w-4 stroke-brand-green"/>,
        description: 'Task finished'
      },
      {
        value: 'cancelled',
        label: 'Cancelled',
        icon: <XCircle className="h-4 w-4 stroke-brand-red"/>,
        description: 'Task cancelled'
      }
    ];

    const currentStatus = statusOptions.find(s => s.value === task.status);

    return (
      <Select
        value={task.status}
        onValueChange={(v) => handleStatusChange(task.id, v)}
      >
        <SelectTrigger className="h-8 w-8 border-0 bg-transparent p-0 hover:bg-muted/50 rounded-full">
          {currentStatus?.icon || <Circle className="h-5 w-5 text-gray-400" />}
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
    );
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredTasks.length} {hasActiveFilters() ? 'filtered ' : ''}task{filteredTasks.length !== 1 ? 's' : ''}
            {tasks.length !== filteredTasks.length && ` of ${tasks.length} total`}
          </p>
        </div>
        <Button
          onClick={() => setModals({ ...modals, create: true })}
          className="bg-gradient-to-r from-brand-blue to-brand-green"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList size="full">
          <TabsTrigger size="full" variant="blue" value="tasks">Tasks</TabsTrigger>
          <TabsTrigger size="full" variant="blue" value="templates">Task Templates</TabsTrigger>
        </TabsList>

        {/* TASKS TAB */}
        <TabsContent value="tasks" className="space-y-6">
      {/* Task Filters */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowTaskFilters(!showTaskFilters)}
            className="flex items-center gap-2 hover:text-brand-blue transition-colors"
          >
            <Filter className="h-4 w-4" />
            <h3 className="font-medium">Task Filters</h3>
            <ChevronDown className={cn("h-4 w-4 transition-transform", !showTaskFilters && "-rotate-90")} />
          </button>
          {(hasTaskFilters() || !isTaskFiltersAtDefault()) && (
            <div className="flex gap-2">
              {hasTaskFilters() && (
                <Button variant="ghost" size="sm" onClick={clearAllTaskFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              )}
              {!isTaskFiltersAtDefault() && (
                <Button variant="ghost" size="sm" onClick={clearTaskFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Reset to Default
                </Button>
              )}
            </div>
          )}
        </div>

        {showTaskFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="text-sm font-medium mb-1 block">Search</label>
              <Input
                ref={searchInputRef}
                placeholder="Task, restaurant, contact..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <MultiSelect
                options={[
                  { label: 'Pending', value: 'pending' },
                  { label: 'Active', value: 'active' },
                  { label: 'Completed', value: 'completed' },
                  { label: 'Cancelled', value: 'cancelled' }
                ]}
                selected={filters.status}
                onChange={(v) => updateFilter('status', v)}
                placeholder="All Statuses"
              />
            </div>

            {/* Type Filter */}
            <div>
              <label className="text-sm font-medium mb-1 block">Type</label>
              <MultiSelect
                options={[
                  { label: 'Internal Activity', value: 'internal_activity' },
                  { label: 'Email', value: 'email' },
                  { label: 'Call', value: 'call' },
                  { label: 'Social Message', value: 'social_message' },
                  { label: 'Text', value: 'text' }
                ]}
                selected={filters.type}
                onChange={(v) => updateFilter('type', v)}
                placeholder="All Types"
              />
            </div>

            {/* Priority Filter */}
            <div>
              <label className="text-sm font-medium mb-1 block">Priority</label>
              <MultiSelect
                options={[
                  { label: 'Low', value: 'low' },
                  { label: 'Medium', value: 'medium' },
                  { label: 'High', value: 'high' }
                ]}
                selected={filters.priority}
                onChange={(v) => updateFilter('priority', v)}
                placeholder="All Priorities"
              />
            </div>

          {/* Due Date Filter */}
          <div className="md:col-span-2">
            <label className="text-sm font-medium mb-1 block">Due Date</label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <MultiSelect
                    options={[
                      { label: 'Overdue', value: 'overdue' },
                      { label: 'Today', value: 'today' },
                      { label: 'This Week', value: 'week' },
                      { label: 'This Month', value: 'month' },
                      { label: 'No Due Date', value: 'no_date' }
                    ]}
                    selected={dueDateFilter.types}
                    onChange={(v) => setDueDateFilter(prev => ({ ...prev, types: v }))}
                    placeholder="All Dates"
                  />
                </div>

                {/* Custom Date Range Button */}
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "whitespace-nowrap",
                        dueDateFilter.customDates?.from && "border-brand-blue text-brand-blue"
                      )}
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Custom
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" sideOffset={5}>
                    <div className="p-4">
                      <CalendarComponent
                        mode="range"
                        defaultMonth={tempDateRange?.from}
                        selected={tempDateRange}
                        onSelect={setTempDateRange}
                        numberOfMonths={2}
                      />
                      <div className="flex justify-end mt-4 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTempDateRange(dueDateFilter.customDates);
                            setIsDatePickerOpen(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (tempDateRange?.from && tempDateRange?.to) {
                              setDueDateFilter(prev => ({
                                ...prev,
                                customDates: tempDateRange
                              }));
                              setIsDatePickerOpen(false);
                            }
                          }}
                          disabled={!tempDateRange?.from || !tempDateRange?.to}
                        >
                          Select
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Display selected custom dates as badge */}
              {dueDateFilter.customDates?.from && dueDateFilter.customDates?.to && (
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <span className="font-medium">Range:</span>
                    {format(dueDateFilter.customDates.from, 'dd/MM/yyyy')} - {format(dueDateFilter.customDates.to, 'dd/MM/yyyy')}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setDueDateFilter(prev => ({
                          ...prev,
                          customDates: undefined
                        }));
                        setTempDateRange(undefined);
                      }}
                      className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Restaurant Filters */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowRestaurantFilters(!showRestaurantFilters)}
            className="flex items-center gap-2 hover:text-brand-blue transition-colors"
          >
            <Filter className="h-4 w-4" />
            <h3 className="font-medium">Restaurant Filters</h3>
            <ChevronDown className={cn("h-4 w-4 transition-transform", !showRestaurantFilters && "-rotate-90")} />
          </button>
          {(hasRestaurantFilters() || !isRestaurantFiltersAtDefault()) && (
            <div className="flex gap-2">
              {hasRestaurantFilters() && (
                <Button variant="ghost" size="sm" onClick={clearAllRestaurantFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              )}
              {!isRestaurantFiltersAtDefault() && (
                <Button variant="ghost" size="sm" onClick={clearRestaurantFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Reset to Default
                </Button>
              )}
            </div>
          )}
        </div>

        {showRestaurantFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Lead Type */}
            <div>
              <label className="text-sm font-medium mb-1 block">Lead Type</label>
              <MultiSelect
                options={[
                  { label: 'Inbound', value: 'inbound' },
                  { label: 'Outbound', value: 'outbound' }
                ]}
                selected={restaurantFilters.lead_type}
                onChange={(v) => updateRestaurantFilter('lead_type', v)}
                placeholder="All Types"
              />
            </div>

            {/* Lead Category */}
            <div>
              <label className="text-sm font-medium mb-1 block">Lead Category</label>
              <MultiSelect
                options={[
                  { label: 'Paid Ads', value: 'paid_ads' },
                  { label: 'Organic Content', value: 'organic_content' },
                  { label: 'Warm Outreach', value: 'warm_outreach' },
                  { label: 'Cold Outreach', value: 'cold_outreach' }
                ]}
                selected={restaurantFilters.lead_category}
                onChange={(v) => updateRestaurantFilter('lead_category', v)}
                placeholder="All Categories"
              />
            </div>

            {/* Lead Warmth */}
            <div>
              <label className="text-sm font-medium mb-1 block">Lead Warmth</label>
              <MultiSelect
                options={[
                  { label: 'Frozen', value: 'frozen' },
                  { label: 'Cold', value: 'cold' },
                  { label: 'Warm', value: 'warm' },
                  { label: 'Hot', value: 'hot' }
                ]}
                selected={restaurantFilters.lead_warmth}
                onChange={(v) => updateRestaurantFilter('lead_warmth', v)}
                placeholder="All Warmth"
              />
            </div>

            {/* Lead Stage */}
            <div>
              <label className="text-sm font-medium mb-1 block">Lead Stage</label>
              <MultiSelect
                options={[
                  { label: 'Uncontacted', value: 'uncontacted' },
                  { label: 'Reached Out', value: 'reached_out' },
                  { label: 'In Talks', value: 'in_talks' },
                  { label: 'Demo Booked', value: 'demo_booked' },
                  { label: 'Rebook Demo', value: 'rebook_demo' },
                  { label: 'Demo Completed', value: 'demo_completed' },
                  { label: 'Contract Sent', value: 'contract_sent' },
                  { label: 'Closed Won', value: 'closed_won' },
                  { label: 'Closed Lost', value: 'closed_lost' },
                  { label: 'Reengaging', value: 'reengaging' }
                ]}
                selected={restaurantFilters.lead_stage}
                onChange={(v) => updateRestaurantFilter('lead_stage', v)}
                placeholder="All Stages"
              />
            </div>

            {/* Lead Status */}
            <div>
              <label className="text-sm font-medium mb-1 block">Lead Status</label>
              <MultiSelect
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'Inactive', value: 'inactive' },
                  { label: 'Ghosted', value: 'ghosted' },
                  { label: 'Reengaging', value: 'reengaging' },
                  { label: 'Closed', value: 'closed' }
                ]}
                selected={restaurantFilters.lead_status}
                onChange={(v) => updateRestaurantFilter('lead_status', v)}
                placeholder="All Status"
              />
            </div>

            {/* Demo Store Built */}
            <div>
              <label className="text-sm font-medium mb-1 block">Demo Store</label>
              <Select value={restaurantFilters.demo_store_built} onValueChange={(v) => updateRestaurantFilter('demo_store_built', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Built</SelectItem>
                  <SelectItem value="false">Not Built</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ICP Rating */}
            <div>
              <label className="text-sm font-medium mb-1 block">Min ICP Rating</label>
              <Select value={restaurantFilters.icp_rating_min || 'all'} onValueChange={(v) => updateRestaurantFilter('icp_rating_min', v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Any rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any rating</SelectItem>
                  <SelectItem value="5">5+ Stars</SelectItem>
                  <SelectItem value="6">6+ Stars</SelectItem>
                  <SelectItem value="7">7+ Stars</SelectItem>
                  <SelectItem value="8">8+ Stars</SelectItem>
                  <SelectItem value="9">9+ Stars</SelectItem>
                  <SelectItem value="10">10 Stars</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
          {error}
        </div>
      )}

      {/* Tasks Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Restaurant</TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('type')}
                  className="flex items-center gap-1 hover:text-brand-blue transition-colors"
                >
                  Type
                  {getSortIcon('type')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('priority')}
                  className="flex items-center gap-1 hover:text-brand-blue transition-colors"
                >
                  Priority
                  {getSortIcon('priority')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('due_date')}
                  className="flex items-center gap-1 hover:text-brand-blue transition-colors"
                >
                  Due Date
                  {getSortIcon('due_date')}
                </button>
              </TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {hasActiveFilters()
                    ? "No tasks match your filters. Try adjusting your criteria."
                    : "No tasks found. Create your first task to get started."}
                </TableCell>
              </TableRow>
            ) : (
              filteredTasks.map((task: any) => (
                <TableRow key={task.id} className={['completed', 'cancelled', 'pending'].includes(task.status) ? 'opacity-60' : ''}>
                  <TableCell>
                    {getInteractiveStatusIcon(task)}
                  </TableCell>
                  <TableCell>
                    <div
                      className="font-medium cursor-pointer hover:text-brand-blue"
                      onClick={() => setModals({ ...modals, detail: task.id })}
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
                    {task.restaurants ? (
                      <Link
                        to={`/restaurants/${task.restaurant_id}`}
                        className="text-sm hover:text-brand-blue"
                      >
                        {task.restaurants.name}
                      </Link>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <TaskTypeQuickView
                      task={task}
                      onTaskCompleted={fetchTasks}
                      onFollowUpRequested={(taskId) => setModals({ ...modals, followUp: taskId })}
                      onStartSequenceRequested={(restaurant) => {
                        setSequenceRestaurant(restaurant);
                        setModals({ ...modals, startSequence: true });
                      }}
                    >
                      <div className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors">
                        {getTypeIcon(task.type)}
                        <span className="text-sm capitalize">
                          {task.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </TaskTypeQuickView>
                  </TableCell>
                  <TableCell>
                    {getPriorityDropdown(task)}
                  </TableCell>
                  <TableCell>
                    {getDueDateInput(task)}
                  </TableCell>
                  <TableCell>
                    {task.assigned_to ? (
                      <div className="text-sm">{task.assigned_to.full_name || task.assigned_to.email}</div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
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
                        onClick={() => setModals({ ...modals, edit: task.id })}
                        title="Edit task"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setModals({ ...modals, duplicate: task.id })}
                        title="Duplicate task"
                      >
                        <Copy className="h-4 w-4" />
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

        {/* TASK TEMPLATES TAB */}
        <TabsContent value="templates" className="space-y-6">
          {/* Header with Create Button */}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">
                Create and manage reusable task templates with default messages and priorities
              </p>
            </div>
            <Button onClick={() => setTaskTemplateModals({ ...taskTemplateModals, create: true })}>
              <Plus className="h-4 w-4 mr-2" />
              New Task Template
            </Button>
          </div>

          {/* Filters */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Filters</h3>
              </div>
              {(taskTemplateFilterType !== 'all' || taskTemplateFilterActive !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTaskTemplateFilterType('all');
                    setTaskTemplateFilterActive('all');
                  }}
                >
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
                  value={taskTemplateFilterType}
                  onValueChange={setTaskTemplateFilterType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="internal_activity">Internal Activity</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="social_message">Social Message</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Active Status Filter */}
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <Select
                  value={taskTemplateFilterActive}
                  onValueChange={setTaskTemplateFilterActive}
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
                  <TableHead>Priority</TableHead>
                  <TableHead>Message Template</TableHead>
                  <TableHead>Usage Count</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskTemplatesLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto"></div>
                      <p className="mt-4 text-muted-foreground">Loading templates...</p>
                    </TableCell>
                  </TableRow>
                ) : taskTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No task templates found. Create your first template to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  taskTemplates.map((template: any) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div
                          className="font-medium cursor-pointer hover:text-brand-blue"
                          onClick={() => setTaskTemplateModals({ ...taskTemplateModals, edit: template.id })}
                        >
                          {template.name}
                        </div>
                        {template.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {template.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {template.type === 'email' && <Mail className="h-4 w-4" />}
                          {template.type === 'call' && <Phone className="h-4 w-4" />}
                          {template.type === 'social_message' && <MessageSquare className="h-4 w-4" />}
                          {template.type === 'text' && <MessageSquare className="h-4 w-4" />}
                          {template.type === 'internal_activity' && <ClipboardList className="h-4 w-4" />}
                          <Badge variant="outline" className={cn('capitalize',
                            template.type === 'email' && 'bg-blue-100 text-blue-800 border-blue-200',
                            template.type === 'call' && 'bg-green-100 text-green-800 border-green-200',
                            template.type === 'social_message' && 'bg-purple-100 text-purple-800 border-purple-200',
                            template.type === 'text' && 'bg-yellow-100 text-yellow-800 border-yellow-200',
                            template.type === 'internal_activity' && 'bg-gray-100 text-gray-800 border-gray-200'
                          )}>
                            {template.type.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('capitalize',
                          template.priority === 'low' && 'bg-gray-100 text-gray-800 border-gray-200',
                          template.priority === 'medium' && 'bg-yellow-100 text-yellow-800 border-yellow-200',
                          template.priority === 'high' && 'bg-red-100 text-red-800 border-red-200'
                        )}>
                          {template.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {template.message_templates ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm">{template.message_templates.name}</span>
                          </div>
                        ) : template.default_message ? (
                          <span className="text-sm text-muted-foreground">Custom message</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
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
                            onClick={() => setTaskTemplateModals({ ...taskTemplateModals, edit: template.id })}
                            title="Edit template"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setTaskTemplateModals({ ...taskTemplateModals, duplicate: template.id })}
                            title="Duplicate template"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteTaskTemplate(template.id)}
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
      </Tabs>

      {/* Modals */}
      {modals.create && (
        <CreateTaskModal
          open={modals.create}
          onClose={() => setModals({ ...modals, create: false })}
          onSuccess={fetchTasks}
        />
      )}

      {modals.edit && (
        <TaskDetailModal
          open={!!modals.edit}
          taskId={modals.edit}
          onClose={() => setModals({ ...modals, edit: null })}
          onSuccess={fetchTasks}
          initialMode="edit"
        />
      )}

      {modals.detail && (
        <TaskDetailModal
          open={!!modals.detail}
          taskId={modals.detail}
          onClose={() => setModals({ ...modals, detail: null })}
          onSuccess={fetchTasks}
        />
      )}

      {modals.duplicate && (
        <CreateTaskModal
          open={!!modals.duplicate}
          duplicateFromTaskId={modals.duplicate}
          onClose={() => setModals({ ...modals, duplicate: null })}
          onSuccess={fetchTasks}
        />
      )}

      {modals.followUp && (
        <CreateTaskModal
          open={!!modals.followUp}
          followUpFromTaskId={modals.followUp}
          onClose={() => {
            setModals({ ...modals, followUp: null });
            fetchTasks(); // Refresh to show the completed task
          }}
          onSuccess={fetchTasks}
        />
      )}

      {modals.startSequence && sequenceRestaurant && (
        <StartSequenceModal
          open={modals.startSequence}
          onClose={() => {
            setModals({ ...modals, startSequence: false });
            setSequenceRestaurant(null);
            fetchTasks();
          }}
          restaurant={sequenceRestaurant}
        />
      )}

      {/* Task Template Modals */}
      {taskTemplateModals.create && (
        <CreateTaskTemplateModal
          open={taskTemplateModals.create}
          onClose={() => setTaskTemplateModals({ ...taskTemplateModals, create: false })}
          onSuccess={() => {
            setTaskTemplateModals({ ...taskTemplateModals, create: false });
            refetchTaskTemplates();
          }}
        />
      )}

      {taskTemplateModals.edit && (
        <CreateTaskTemplateModal
          open={!!taskTemplateModals.edit}
          templateId={taskTemplateModals.edit}
          onClose={() => setTaskTemplateModals({ ...taskTemplateModals, edit: null })}
          onSuccess={() => {
            setTaskTemplateModals({ ...taskTemplateModals, edit: null });
            refetchTaskTemplates();
          }}
        />
      )}

      {taskTemplateModals.duplicate && (
        <CreateTaskTemplateModal
          open={!!taskTemplateModals.duplicate}
          duplicateFromId={taskTemplateModals.duplicate}
          onClose={() => setTaskTemplateModals({ ...taskTemplateModals, duplicate: null })}
          onSuccess={() => {
            setTaskTemplateModals({ ...taskTemplateModals, duplicate: null });
            refetchTaskTemplates();
          }}
        />
      )}
    </div>
  );
}
