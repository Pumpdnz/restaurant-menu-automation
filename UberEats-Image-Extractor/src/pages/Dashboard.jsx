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
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Progress } from '../components/ui/progress';
import { CreateLeadScrapeJob } from '../components/leads/CreateLeadScrapeJob';
import { ReportsTabContent } from '../components/reports/ReportsTabContent';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import { LeadContactQuickView } from '../components/restaurants/LeadContactQuickView';
import { TaskCell } from '../components/restaurants/TaskCell';
import { LeadDetailModal } from '../components/leads/LeadDetailModal';
import { useAuth } from '../context/AuthContext';
import { usePendingLeadsPreview, useRecentRegistrationBatches, useTasksDueToday, useOverdueTasksCount, useRecentRestaurants } from '../hooks/useDashboard';

export default function Dashboard() {
  // Feature flags
  const { isFeatureEnabled } = useAuth();
  const navigate = useNavigate();

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

  // Lead detail handlers
  const handleViewLead = (leadId) => {
    setSelectedLeadId(leadId);
    setIsLeadDetailModalOpen(true);
  };

  // Pending Leads Preview
  const { data: pendingLeadsData, isLoading: pendingLeadsLoading } = usePendingLeadsPreview(5);
  const pendingLeads = pendingLeadsData?.leads || [];
  const totalPendingLeads = pendingLeadsData?.total || 0;

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
    // Start sequence - implement if needed
  };

  const handleTaskCompleted = () => {
    // Refresh recent restaurants data after task completion
    // The hook should automatically refetch
  };

  const handleFollowUpRequested = (taskId) => {
    // Handle follow-up request - implement if needed
  };

  const handleStartSequenceRequested = (restaurant) => {
    // Handle start sequence request - implement if needed
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/extractions/new"
              className="flex items-center justify-center px-4 py-3 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90 transition-all duration-200 shadow-lg"
            >
              <Download className="mr-2 h-4 w-4" />
              New Extraction
            </Link>
            <Link
              to="/restaurants"
              className="flex items-center justify-center px-4 py-3 border border-border text-sm font-medium rounded-lg text-foreground bg-background hover:bg-accent transition-all duration-200"
            >
              <Store className="mr-2 h-4 w-4" />
              Manage Restaurants
            </Link>
            <button
              onClick={() => setCreateTaskModalOpen(true)}
              className="flex items-center justify-center px-4 py-3 border border-border text-sm font-medium rounded-lg text-foreground bg-background hover:bg-accent transition-all duration-200"
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              New Task
            </button>
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
                      <TableHead>Task Name</TableHead>
                      <TableHead className="w-24">Type</TableHead>
                      <TableHead className="w-24">Priority</TableHead>
                      <TableHead className="w-48">Restaurant</TableHead>
                      <TableHead className="w-32">Due Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTasks.map((task) => (
                      <TableRow key={task.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{task.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {task.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              task.priority === 'high' ? 'text-red-600 border-red-600' :
                              task.priority === 'medium' ? 'text-yellow-600 border-yellow-600' :
                              'text-gray-600 border-gray-600'
                            }
                          >
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {task.restaurants?.name || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(task.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                      </TableRow>
                    ))}
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

      {/* Pending Leads Preview - Feature flagged */}
      {isFeatureEnabled('leadScraping') && (
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
                    <TableHead>Restaurant Name</TableHead>
                    <TableHead className="w-32">City</TableHead>
                    <TableHead className="w-36">Cuisine</TableHead>
                    <TableHead className="w-24">Rating</TableHead>
                    <TableHead className="w-28">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingLeads.map((lead) => (
                    <TableRow key={lead.id} className="hover:bg-muted/50">
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
                        <div className="flex flex-wrap gap-1">
                          {lead.ubereats_cuisine?.slice(0, 2).map((c, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {c}
                            </Badge>
                          ))}
                          {lead.ubereats_cuisine && lead.ubereats_cuisine.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{lead.ubereats_cuisine.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Batch Registration Jobs - Feature flagged */}
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


      {/* Recently Created Restaurants - No feature flag */}
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

          {/* City filter pills */}
          {restaurantCities.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge
                variant={selectedRestaurantCity === null ? "default" : "outline"}
                className={cn(
                  "text-xs cursor-pointer hover:bg-muted",
                  selectedRestaurantCity === null && "cursor-pointer"
                )}
                onClick={() => setSelectedRestaurantCity(null)}
              >
                All
              </Badge>
              {restaurantCities.slice(0, 5).map((city) => (
                <Badge
                  key={city}
                  variant={selectedRestaurantCity === city ? "default" : "outline"}
                  className={cn(
                    "text-xs cursor-pointer hover:bg-muted",
                    selectedRestaurantCity === city && "cursor-pointer"
                  )}
                  onClick={() => setSelectedRestaurantCity(selectedRestaurantCity === city ? null : city)}
                >
                  {city}
                </Badge>
              ))}
              {selectedRestaurantCity && (
                <button
                  className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                  onClick={() => setSelectedRestaurantCity(null)}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
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
              {selectedRestaurantCity ? 'No restaurants in this city' : 'No restaurants created yet'}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant Name</TableHead>
                    <TableHead className="w-32">City</TableHead>
                    <TableHead className="w-40">Status</TableHead>
                    <TableHead className="w-48">Lead Contact</TableHead>
                    <TableHead className="w-40">Tasks</TableHead>
                    <TableHead className="w-32">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRestaurants.map((restaurant) => (
                    <TableRow key={restaurant.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link
                          to={`/restaurants/${restaurant.id}`}
                          className="hover:text-brand-blue transition-colors"
                        >
                          {restaurant.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{restaurant.city || '-'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            restaurant.onboarding_status === 'completed' ? 'text-green-600 border-green-600' :
                            restaurant.onboarding_status === 'in_progress' ? 'text-blue-600 border-blue-600' :
                            restaurant.onboarding_status === 'pending' ? 'text-yellow-600 border-yellow-600' :
                            'text-gray-600 border-gray-600'
                          }
                        >
                          {restaurant.onboarding_status || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <LeadContactQuickView restaurant={restaurant}>
                          <div className="space-y-1 cursor-pointer hover:bg-muted/30 p-1 -m-1 rounded transition-colors">
                            {restaurant.contact_name && (
                              <div className="flex items-center gap-1 text-xs">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span>{restaurant.contact_name}</span>
                              </div>
                            )}
                            {restaurant.contact_email && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {restaurant.contact_email}
                              </div>
                            )}
                            {restaurant.contact_phone && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {restaurant.contact_phone}
                              </div>
                            )}
                            {!restaurant.contact_name && !restaurant.contact_phone && !restaurant.contact_email && (
                              <span className="text-xs text-muted-foreground">No contact</span>
                            )}
                          </div>
                        </LeadContactQuickView>
                      </TableCell>
                      <TableCell>
                        <TaskCell
                          task={restaurant.oldest_task}
                          restaurantName={restaurant.name}
                          restaurantId={restaurant.id}
                          onCreateTask={() => handleCreateTask(restaurant)}
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
        onClose={() => setCreateTaskModalOpen(false)}
        onSuccess={() => setCreateTaskModalOpen(false)}
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
    </div>
  );
}