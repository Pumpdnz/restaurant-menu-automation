import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  Eye,
  FileText,
  Store,
  Globe,
  Phone,
  Mail,
  Calendar,
  ExternalLink,
  Trash2,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  Star
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
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { MultiSelect } from '../components/ui/multi-select';
import { DateTimePicker } from '../components/ui/date-time-picker';
import { cn } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

export default function Restaurants() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [restaurants, setRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, restaurantId: null, restaurantName: null });
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Initialize filters from URL params
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    lead_type: searchParams.get('lead_type')?.split(',').filter(Boolean) || [],
    lead_category: searchParams.get('lead_category')?.split(',').filter(Boolean) || [],
    lead_warmth: searchParams.get('lead_warmth')?.split(',').filter(Boolean) || [],
    lead_stage: searchParams.get('lead_stage')?.split(',').filter(Boolean) || [],
    lead_status: searchParams.get('lead_status')?.split(',').filter(Boolean) || [],
    demo_store_built: searchParams.get('demo_store_built') || 'all',
    icp_rating_min: searchParams.get('icp_rating_min') || ''
  });

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
    updateUrlParams();
  }, [restaurants, filters, sortField, sortDirection]);

  const fetchRestaurants = async () => {
    try {
      const response = await api.get('/restaurants/list');
      const data = response.data.restaurants || [];
      setRestaurants(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch restaurants:', err);
      setError('Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...restaurants];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(restaurant =>
        restaurant.name?.toLowerCase().includes(searchLower) ||
        restaurant.contact_name?.toLowerCase().includes(searchLower) ||
        restaurant.contact_email?.toLowerCase().includes(searchLower) ||
        restaurant.city?.toLowerCase().includes(searchLower) ||
        restaurant.address?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sales filters (multi-select)
    if (filters.lead_type && filters.lead_type.length > 0) {
      filtered = filtered.filter(r =>
        r.lead_type && filters.lead_type.includes(r.lead_type)
      );
    }

    if (filters.lead_category && filters.lead_category.length > 0) {
      filtered = filtered.filter(r =>
        r.lead_category && filters.lead_category.includes(r.lead_category)
      );
    }

    if (filters.lead_warmth && filters.lead_warmth.length > 0) {
      filtered = filtered.filter(r =>
        r.lead_warmth && filters.lead_warmth.includes(r.lead_warmth)
      );
    }

    if (filters.lead_stage && filters.lead_stage.length > 0) {
      filtered = filtered.filter(r =>
        r.lead_stage && filters.lead_stage.includes(r.lead_stage)
      );
    }

    if (filters.lead_status && filters.lead_status.length > 0) {
      filtered = filtered.filter(r =>
        r.lead_status && filters.lead_status.includes(r.lead_status)
      );
    }

    if (filters.demo_store_built !== 'all') {
      const demoBuilt = filters.demo_store_built === 'true';
      filtered = filtered.filter(r => r.demo_store_built === demoBuilt);
    }

    if (filters.icp_rating_min) {
      const minRating = parseInt(filters.icp_rating_min);
      filtered = filtered.filter(r => r.icp_rating && r.icp_rating >= minRating);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let valueA, valueB;

      switch (sortField) {
        case 'created_at':
        case 'last_contacted':
          valueA = a[sortField] ? new Date(a[sortField]) : new Date(0);
          valueB = b[sortField] ? new Date(b[sortField]) : new Date(0);
          break;
        case 'icp_rating':
          valueA = a[sortField] || 0;
          valueB = b[sortField] || 0;
          break;
        case 'name':
          valueA = a[sortField]?.toLowerCase() || '';
          valueB = b[sortField]?.toLowerCase() || '';
          break;
        case 'last_scraped':
          valueA = a.restaurant_platforms?.[0]?.last_scraped_at
            ? new Date(a.restaurant_platforms[0].last_scraped_at)
            : new Date(0);
          valueB = b.restaurant_platforms?.[0]?.last_scraped_at
            ? new Date(b.restaurant_platforms[0].last_scraped_at)
            : new Date(0);
          break;
        default:
          valueA = a[sortField] || '';
          valueB = b[sortField] || '';
      }

      if (sortDirection === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });

    setFilteredRestaurants(filtered);
  };

  const updateUrlParams = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        params.set(key, value.join(','));
      } else if (value && value !== 'all' && value !== '') {
        params.set(key, value);
      }
    });
    setSearchParams(params, { replace: true });
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      lead_type: [],
      lead_category: [],
      lead_warmth: [],
      lead_stage: [],
      lead_status: [],
      demo_store_built: 'all',
      icp_rating_min: ''
    });
  };

  const hasActiveFilters = () => {
    return Object.entries(filters).some(([key, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== 'all' && value !== '';
    });
  };

  const getActiveFiltersCount = () => {
    return Object.entries(filters).filter(([key, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== 'all' && value !== '';
    }).reduce((count, [key, value]) => {
      if (Array.isArray(value)) return count + value.length;
      return count + 1;
    }, 0);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1 inline" />
      : <ArrowDown className="h-4 w-4 ml-1 inline" />;
  };

  const getWarmthBadge = (warmth, restaurantId) => {
    if (!warmth) {
      return (
        <Select value="none" onValueChange={(v) => handleUpdateRestaurantField(restaurantId, 'lead_warmth', v)}>
          <SelectTrigger className="h-7 w-full border-dashed">
            <SelectValue placeholder="Set warmth" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="frozen">Frozen</SelectItem>
            <SelectItem value="cold">Cold</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="hot">Hot</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    const colors = {
      frozen: 'bg-blue-100 text-blue-800 border-blue-200',
      cold: 'bg-gray-100 text-gray-800 border-gray-200',
      warm: 'bg-orange-100 text-orange-800 border-orange-200',
      hot: 'bg-red-100 text-red-800 border-red-200'
    };

    return (
      <Select value={warmth} onValueChange={(v) => handleUpdateRestaurantField(restaurantId, 'lead_warmth', v)}>
        <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0">
          <Badge variant="outline" className={cn('capitalize cursor-pointer hover:opacity-80', colors[warmth] || colors.cold)}>
            {warmth}
          </Badge>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="frozen">Frozen</SelectItem>
          <SelectItem value="cold">Cold</SelectItem>
          <SelectItem value="warm">Warm</SelectItem>
          <SelectItem value="hot">Hot</SelectItem>
        </SelectContent>
      </Select>
    );
  };

  const getStageBadge = (stage, restaurantId) => {
    if (!stage) {
      return (
        <Select value="none" onValueChange={(v) => handleUpdateRestaurantField(restaurantId, 'lead_stage', v)}>
          <SelectTrigger className="h-7 w-full border-dashed">
            <SelectValue placeholder="Set stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uncontacted">Uncontacted</SelectItem>
            <SelectItem value="reached_out">Reached Out</SelectItem>
            <SelectItem value="in_talks">In Talks</SelectItem>
            <SelectItem value="demo_booked">Demo Booked</SelectItem>
            <SelectItem value="rebook_demo">Rebook Demo</SelectItem>
            <SelectItem value="contract_sent">Contract Sent</SelectItem>
            <SelectItem value="closed_won">Closed Won</SelectItem>
            <SelectItem value="closed_lost">Closed Lost</SelectItem>
            <SelectItem value="reengaging">Reengaging</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    const colors = {
      uncontacted: 'bg-gray-100 text-gray-800 border-gray-200',
      reached_out: 'bg-blue-100 text-blue-800 border-blue-200',
      in_talks: 'bg-purple-100 text-purple-800 border-purple-200',
      demo_booked: 'bg-green-100 text-green-800 border-green-200',
      rebook_demo: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      contract_sent: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      closed_won: 'bg-green-600 text-white border-green-700',
      closed_lost: 'bg-red-100 text-red-800 border-red-200',
      reengaging: 'bg-orange-100 text-orange-800 border-orange-200'
    };

    return (
      <Select value={stage} onValueChange={(v) => handleUpdateRestaurantField(restaurantId, 'lead_stage', v)}>
        <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0">
          <Badge variant="outline" className={cn('capitalize cursor-pointer hover:opacity-80 text-xs', colors[stage] || colors.uncontacted)}>
            {stage.replace(/_/g, ' ')}
          </Badge>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="uncontacted">Uncontacted</SelectItem>
          <SelectItem value="reached_out">Reached Out</SelectItem>
          <SelectItem value="in_talks">In Talks</SelectItem>
          <SelectItem value="demo_booked">Demo Booked</SelectItem>
          <SelectItem value="rebook_demo">Rebook Demo</SelectItem>
          <SelectItem value="contract_sent">Contract Sent</SelectItem>
          <SelectItem value="closed_won">Closed Won</SelectItem>
          <SelectItem value="closed_lost">Closed Lost</SelectItem>
          <SelectItem value="reengaging">Reengaging</SelectItem>
        </SelectContent>
      </Select>
    );
  };

  const getIcpRatingBadge = (rating, restaurantId) => {
    if (rating === null || rating === undefined) {
      return (
        <Select value="none" onValueChange={(v) => handleUpdateRestaurantField(restaurantId, 'icp_rating', parseInt(v))}>
          <SelectTrigger className="h-7 w-full border-dashed">
            <SelectValue placeholder="Set rating" />
          </SelectTrigger>
          <SelectContent>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
              <SelectItem key={num} value={num.toString()}>
                {num} {num === 1 ? 'Star' : 'Stars'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Select value={rating.toString()} onValueChange={(v) => handleUpdateRestaurantField(restaurantId, 'icp_rating', parseInt(v))}>
        <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0">
          <div className="flex items-center gap-1 cursor-pointer hover:opacity-80">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{rating}</span>
            <span className="text-xs text-muted-foreground">/10</span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
            <SelectItem key={num} value={num.toString()}>
              {num} {num === 1 ? 'Star' : 'Stars'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const getLastContactedInput = (lastContacted, restaurantId) => {
    return (
      <DateTimePicker
        value={lastContacted ? new Date(lastContacted) : null}
        onChange={(date) => handleUpdateRestaurantField(restaurantId, 'last_contacted', date ? date.toISOString() : null)}
        placeholder="Set last contacted"
        className="h-8 text-xs"
      />
    );
  };

  const getDemoStoreBadge = (demoStoreBuilt, restaurantId) => {
    const isBuilt = demoStoreBuilt === true;

    return (
      <Select
        value={isBuilt ? 'true' : 'false'}
        onValueChange={(v) => handleUpdateRestaurantField(restaurantId, 'demo_store_built', v === 'true')}
      >
        <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0">
          <Badge
            variant="outline"
            className={cn(
              'cursor-pointer hover:opacity-80',
              isBuilt
                ? 'bg-green-100 text-green-800 border-green-200'
                : 'bg-gray-100 text-gray-800 border-gray-200'
            )}
          >
            {isBuilt ? 'Built' : 'Not Built'}
          </Badge>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Built</SelectItem>
          <SelectItem value="false">Not Built</SelectItem>
        </SelectContent>
      </Select>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleViewRestaurant = (restaurantId) => {
    navigate(`/restaurants/${restaurantId}`);
  };

  const handleViewMenus = (restaurantId) => {
    navigate(`/menus?restaurant=${restaurantId}`);
  };

  const handleDeleteRestaurant = async () => {
    if (!deleteConfirm.restaurantId) return;

    try {
      const response = await api.delete(`/restaurants/${deleteConfirm.restaurantId}`);

      if (response.data.success) {
        await fetchRestaurants();
        console.log('Restaurant deleted successfully');
      }
    } catch (err) {
      console.error('Failed to delete restaurant:', err);
    } finally {
      setDeleteConfirm({ open: false, restaurantId: null, restaurantName: null });
    }
  };

  const handleUpdateRestaurantField = async (restaurantId, field, value) => {
    try {
      const response = await api.patch(`/restaurants/${restaurantId}`, {
        [field]: value
      });

      if (response.data.success) {
        // Update local state to reflect the change
        setRestaurants(prev => prev.map(r =>
          r.id === restaurantId ? { ...r, [field]: value } : r
        ));
      }
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
      // Optionally show error toast
    }
  };

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
        <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0">
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
        <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0">
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
        <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0">
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Store className="h-8 w-8 text-brand-blue animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-brand-red/5 border border-brand-red/20 p-4">
        <p className="text-sm text-brand-red">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="sm:flex sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Restaurants</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filteredRestaurants.length} {hasActiveFilters() ? 'filtered ' : ''}
            restaurant{filteredRestaurants.length !== 1 ? 's' : ''}
            {restaurants.length !== filteredRestaurants.length && ` of ${restaurants.length} total`}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "relative",
              hasActiveFilters() && "border-brand-blue text-brand-blue"
            )}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {getActiveFiltersCount() > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 bg-brand-blue text-white"
              >
                {getActiveFiltersCount()}
              </Badge>
            )}
          </Button>
          <Button
            onClick={() => navigate('/restaurants/new')}
            className="bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90"
          >
            Add Restaurant
          </Button>
        </div>
      </div>

      {/* Filters Section */}
      {showFilters && (
        <div className="bg-card border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Filter Restaurants</h3>
            </div>
            {hasActiveFilters() && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="text-sm font-medium mb-1 block">Search</label>
              <Input
                placeholder="Name, contact, city..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
              />
            </div>

            {/* Lead Type */}
            <div>
              <label className="text-sm font-medium mb-1 block">Lead Type</label>
              <MultiSelect
                options={[
                  { label: 'Inbound', value: 'inbound' },
                  { label: 'Outbound', value: 'outbound' }
                ]}
                selected={filters.lead_type}
                onChange={(v) => updateFilter('lead_type', v)}
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
                selected={filters.lead_category}
                onChange={(v) => updateFilter('lead_category', v)}
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
                selected={filters.lead_warmth}
                onChange={(v) => updateFilter('lead_warmth', v)}
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
                  { label: 'Contract Sent', value: 'contract_sent' },
                  { label: 'Closed Won', value: 'closed_won' },
                  { label: 'Closed Lost', value: 'closed_lost' },
                  { label: 'Reengaging', value: 'reengaging' }
                ]}
                selected={filters.lead_stage}
                onChange={(v) => updateFilter('lead_stage', v)}
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
                selected={filters.lead_status}
                onChange={(v) => updateFilter('lead_status', v)}
                placeholder="All Status"
              />
            </div>

            {/* Demo Store Built */}
            <div>
              <label className="text-sm font-medium mb-1 block">Demo Store</label>
              <Select value={filters.demo_store_built} onValueChange={(v) => updateFilter('demo_store_built', v)}>
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
              <Select value={filters.icp_rating_min || 'all'} onValueChange={(v) => updateFilter('icp_rating_min', v === 'all' ? '' : v)}>
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
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="min-w-[200px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('name')}
                >
                  Name
                  {getSortIcon('name')}
                </TableHead>
                <TableHead className="min-w-[180px]">Lead Contact</TableHead>
                <TableHead className="min-w-[110px]">Lead Type</TableHead>
                <TableHead className="min-w-[130px]">Lead Category</TableHead>
                <TableHead className="min-w-[110px]">Lead Status</TableHead>
                <TableHead className="min-w-[100px]">Warmth</TableHead>
                <TableHead className="min-w-[130px]">Stage</TableHead>
                <TableHead
                  className="min-w-[100px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('icp_rating')}
                >
                  ICP Rating
                  {getSortIcon('icp_rating')}
                </TableHead>
                <TableHead className="min-w-[100px]">Demo Store</TableHead>
                <TableHead
                  className="min-w-[120px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('last_contacted')}
                >
                  Last Contact
                  {getSortIcon('last_contacted')}
                </TableHead>
                <TableHead
                  className="min-w-[100px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('created_at')}
                >
                  Created
                  {getSortIcon('created_at')}
                </TableHead>
                <TableHead className="text-right min-w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRestaurants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    {hasActiveFilters()
                      ? "No restaurants match your filters. Try adjusting your criteria."
                      : "No restaurants found. Add a restaurant to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRestaurants.map((restaurant) => (
                  <TableRow key={restaurant.id}>
                    <TableCell>
                      <div>
                        <div
                          className="font-medium cursor-pointer hover:text-brand-blue transition-colors"
                          onClick={() => handleViewRestaurant(restaurant.id)}
                        >
                          {restaurant.name}
                        </div>
                        {restaurant.city && (
                          <div className="text-xs text-muted-foreground">{restaurant.city}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
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
                    </TableCell>
                    <TableCell>
                      {getLeadTypeBadge(restaurant.lead_type, restaurant.id)}
                    </TableCell>
                    <TableCell>
                      {getLeadCategoryBadge(restaurant.lead_category, restaurant.id)}
                    </TableCell>
                    <TableCell>
                      {getLeadStatusBadge(restaurant.lead_status, restaurant.id)}
                    </TableCell>
                    <TableCell>
                      {getWarmthBadge(restaurant.lead_warmth, restaurant.id)}
                    </TableCell>
                    <TableCell>
                      {getStageBadge(restaurant.lead_stage, restaurant.id)}
                    </TableCell>
                    <TableCell>
                      {getIcpRatingBadge(restaurant.icp_rating, restaurant.id)}
                    </TableCell>
                    <TableCell>
                      {getDemoStoreBadge(restaurant.demo_store_built, restaurant.id)}
                    </TableCell>
                    <TableCell>
                      {getLastContactedInput(restaurant.last_contacted, restaurant.id)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(restaurant.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewRestaurant(restaurant.id)}
                          className="text-brand-blue hover:text-brand-blue hover:bg-brand-blue/10"
                          title="View restaurant details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewMenus(restaurant.id)}
                          className="text-brand-green hover:text-brand-green hover:bg-brand-green/10"
                          title="View menus"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {restaurant.restaurant_platforms?.[0]?.url && (
                          <a
                            href={restaurant.restaurant_platforms[0].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex"
                          >
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-foreground hover:bg-accent"
                              title="View on platform"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteConfirm({
                            open: true,
                            restaurantId: restaurant.id,
                            restaurantName: restaurant.name
                          })}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete restaurant"
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
      </div>

      {/* Statistics Summary */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Store className="h-6 w-6 text-brand-blue" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground">Total Restaurants</p>
              <p className="text-2xl font-semibold text-foreground">{restaurants.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Globe className="h-6 w-6 text-brand-green" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground">Hot Leads</p>
              <p className="text-2xl font-semibold text-foreground">
                {restaurants.filter(r => r.lead_warmth === 'hot').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Mail className="h-6 w-6 text-brand-orange" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground">Demo Booked</p>
              <p className="text-2xl font-semibold text-foreground">
                {restaurants.filter(r => r.lead_stage === 'demo_booked').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-6 w-6 text-brand-red" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-muted-foreground">This Month</p>
              <p className="text-2xl font-semibold text-foreground">
                {restaurants.filter(r => {
                  const created = new Date(r.created_at);
                  const now = new Date();
                  return created.getMonth() === now.getMonth() &&
                         created.getFullYear() === now.getFullYear();
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, restaurantId: null, restaurantName: null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Restaurant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deleteConfirm.restaurantName}</span>?
              This will also delete all associated extractions, menus, and menu items. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm({ open: false, restaurantId: null, restaurantName: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRestaurant}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Restaurant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}