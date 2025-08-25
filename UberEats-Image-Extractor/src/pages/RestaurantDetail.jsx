import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  Clock, 
  MapPin,
  Instagram,
  Facebook,
  DollarSign,
  Edit,
  Save,
  X,
  ChevronLeft,
  Palette,
  User,
  CreditCard,
  Settings,
  CheckCircle,
  AlertCircle,
  Calendar,
  Link2,
  Hash,
  Search,
  RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import api from '../services/api';

export default function RestaurantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [searchingGoogle, setSearchingGoogle] = useState(false);
  const isNewRestaurant = id === 'new';

  useEffect(() => {
    if (isNewRestaurant) {
      // Initialize empty restaurant for creation
      const emptyRestaurant = {
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        organisation_name: '',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        opening_hours: [],
        cuisine: [],
        onboarding_status: 'lead'
      };
      setRestaurant(emptyRestaurant);
      setEditedData(emptyRestaurant);
      setIsEditing(true);
      setLoading(false);
    } else {
      fetchRestaurantDetails();
    }
  }, [id]);

  const fetchRestaurantDetails = async () => {
    try {
      const response = await api.get(`/restaurants/${id}/details`);
      setRestaurant(response.data.restaurant);
      setEditedData(response.data.restaurant);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch restaurant details:', err);
      setError('Failed to load restaurant details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let response;
      if (isNewRestaurant) {
        // Create new restaurant
        response = await api.post('/restaurants', editedData);
        const newRestaurantId = response.data.restaurant.id;
        setSuccess('Restaurant created successfully');
        // Navigate to the new restaurant's detail page
        setTimeout(() => {
          navigate(`/restaurants/${newRestaurantId}`);
        }, 1500);
      } else {
        // Update existing restaurant
        response = await api.patch(`/restaurants/${id}/workflow`, editedData);
        setRestaurant(response.data.restaurant);
        setIsEditing(false);
        setSuccess('Restaurant details updated successfully');
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err) {
      console.error('Failed to save restaurant:', err);
      setError(err.response?.data?.error || `Failed to ${isNewRestaurant ? 'create' : 'update'} restaurant`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isNewRestaurant) {
      navigate('/restaurants');
    } else {
      setEditedData(restaurant);
      setIsEditing(false);
      setError(null);
    }
  };

  const handleFieldChange = (field, value) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGoogleSearch = async () => {
    if (!restaurant?.name) {
      setError('Restaurant name is required for search');
      return;
    }

    // Use city field if available, otherwise try to extract from address
    const city = restaurant?.city || (() => {
      if (restaurant?.address) {
        const cityMatch = restaurant.address.match(/([A-Za-z\s]+),?\s*(?:New Zealand)?$/);
        return cityMatch ? cityMatch[1].trim() : 'New Zealand';
      }
      return 'New Zealand';
    })();

    setSearchingGoogle(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post('/google-business-search', {
        restaurantName: restaurant.name,
        city: city,
        restaurantId: id
      });

      if (response.data.success) {
        const data = response.data.data;
        
        // Update local state with extracted data
        const updates = {};
        if (data.address) updates.address = data.address;
        if (data.phone) updates.phone = data.phone;
        if (data.websiteUrl) updates.website_url = data.websiteUrl;
        if (data.instagramUrl) updates.instagram_url = data.instagramUrl;
        if (data.facebookUrl) updates.facebook_url = data.facebookUrl;
        if (data.openingHours && data.openingHours.length > 0) {
          updates.opening_hours = data.openingHours;
        }

        // Merge with existing data
        setRestaurant(prev => ({
          ...prev,
          ...updates
        }));

        setSuccess(`Found business information: ${Object.keys(updates).length} fields updated`);
        
        // Refresh data from server
        setTimeout(() => {
          fetchRestaurantDetails();
        }, 1500);
      }
    } catch (err) {
      console.error('Google search error:', err);
      setError(err.response?.data?.error || 'Failed to search for business information');
    } finally {
      setSearchingGoogle(false);
    }
  };

  const handleOpeningHoursChange = (day, field, value, index = null) => {
    const currentHours = editedData.opening_hours || {};
    
    // Handle array format (multiple time slots per day)
    if (Array.isArray(currentHours)) {
      const updatedHours = [...currentHours];
      if (index !== null) {
        // Update specific slot
        const slotIndex = updatedHours.findIndex((slot, i) => 
          slot.day === day && i === index
        );
        if (slotIndex !== -1) {
          updatedHours[slotIndex].hours[field] = value;
        }
      }
      setEditedData(prev => ({
        ...prev,
        opening_hours: updatedHours
      }));
    } else {
      // Handle object format (single time slot per day)
      setEditedData(prev => ({
        ...prev,
        opening_hours: {
          ...currentHours,
          [day]: {
            ...currentHours[day],
            [field]: value
          }
        }
      }));
    }
  };

  const addOpeningHoursSlot = (day) => {
    const currentHours = editedData.opening_hours || [];
    if (!Array.isArray(currentHours)) {
      // Convert object to array format
      const arrayFormat = [];
      Object.keys(currentHours).forEach(d => {
        if (currentHours[d]) {
          arrayFormat.push({
            day: d,
            hours: currentHours[d]
          });
        }
      });
      setEditedData(prev => ({
        ...prev,
        opening_hours: [...arrayFormat, {
          day: day,
          hours: { open: '09:00', close: '17:00' }
        }]
      }));
    } else {
      setEditedData(prev => ({
        ...prev,
        opening_hours: [...currentHours, {
          day: day,
          hours: { open: '09:00', close: '17:00' }
        }]
      }));
    }
  };

  const removeOpeningHoursSlot = (day, index) => {
    const currentHours = editedData.opening_hours || [];
    if (Array.isArray(currentHours)) {
      const updatedHours = currentHours.filter((slot, i) => 
        !(slot.day === day && i === index)
      );
      setEditedData(prev => ({
        ...prev,
        opening_hours: updatedHours
      }));
    }
  };

  const renderOpeningHours = () => {
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const hours = isEditing ? editedData.opening_hours : restaurant?.opening_hours;
    
    if (!hours) {
      return daysOfWeek.map(day => (
        <div key={day} className="flex items-center justify-between">
          <span className="text-sm font-medium w-24">{day}</span>
          {isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => addOpeningHoursSlot(day)}
            >
              Add Hours
            </Button>
          ) : (
            <span className="text-sm text-gray-500">Closed</span>
          )}
        </div>
      ));
    }

    // Handle array format (multiple time slots per day)
    if (Array.isArray(hours)) {
      const groupedHours = {};
      hours.forEach((slot, index) => {
        if (!groupedHours[slot.day]) {
          groupedHours[slot.day] = [];
        }
        groupedHours[slot.day].push({ ...slot.hours, index });
      });

      return daysOfWeek.map(day => {
        const daySlots = groupedHours[day] || [];
        
        return (
          <div key={day} className="space-y-2 mb-3">
            <div className="flex items-start gap-4">
              <span className="text-sm font-medium w-24 pt-2">{day}</span>
              <div className="flex-1 space-y-2">
                {daySlots.length === 0 ? (
                  isEditing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addOpeningHoursSlot(day)}
                      className="mt-1"
                    >
                      Add Hours
                    </Button>
                  ) : (
                    <span className="text-sm text-gray-500 inline-block pt-2">Closed</span>
                  )
                ) : (
                  daySlots.map((slot, slotIndex) => (
                    <div key={slotIndex} className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Input
                            type="time"
                            value={slot.open || ''}
                            onChange={(e) => handleOpeningHoursChange(day, 'open', e.target.value, slot.index)}
                            className="w-32"
                          />
                          <span className="text-gray-500">-</span>
                          <Input
                            type="time"
                            value={slot.close || ''}
                            onChange={(e) => handleOpeningHoursChange(day, 'close', e.target.value, slot.index)}
                            className="w-32"
                          />
                          {daySlots.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOpeningHoursSlot(day, slot.index)}
                              className="h-8 w-8 flex-shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <span className="text-sm">
                          {slot.open} - {slot.close}
                        </span>
                      )}
                    </div>
                  ))
                )}
                {isEditing && daySlots.length > 0 && daySlots.length < 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addOpeningHoursSlot(day)}
                  >
                    Add Time Slot
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      });
    }

    // Handle object format (single time slot per day)
    return daysOfWeek.map(day => (
      <div key={day} className="flex items-center gap-4 mb-2">
        <span className="text-sm font-medium w-24">{day}</span>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={hours[day]?.open || ''}
              onChange={(e) => handleOpeningHoursChange(day, 'open', e.target.value)}
              className="w-32"
            />
            <span className="text-gray-500">-</span>
            <Input
              type="time"
              value={hours[day]?.close || ''}
              onChange={(e) => handleOpeningHoursChange(day, 'close', e.target.value)}
              className="w-32"
            />
          </div>
        ) : (
          <span className="text-sm">
            {hours[day] 
              ? `${hours[day].open} - ${hours[day].close}`
              : 'Closed'}
          </span>
        )}
      </div>
    ));
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      lead: 'bg-gray-100 text-gray-800',
      info_gathered: 'bg-blue-100 text-blue-800',
      registered: 'bg-purple-100 text-purple-800',
      menu_imported: 'bg-orange-100 text-orange-800',
      configured: 'bg-green-100 text-green-800',
      completed: 'bg-emerald-100 text-emerald-800'
    };

    return (
      <Badge className={statusColors[status] || statusColors.lead}>
        {status?.replace('_', ' ').toUpperCase() || 'LEAD'}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Building2 className="h-8 w-8 text-brand-blue animate-pulse" />
      </div>
    );
  }

  if (error && !restaurant) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/restaurants')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isNewRestaurant ? 'Add New Restaurant' : (restaurant?.name || 'Restaurant Details')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isNewRestaurant ? 'Fill in the details below' : (restaurant?.address || 'No address provided')}
            </p>
          </div>
          {!isNewRestaurant && getStatusBadge(restaurant?.onboarding_status)}
        </div>
        <div className="flex gap-2">
          {!isNewRestaurant && (
            <Button
              onClick={handleGoogleSearch}
              variant="outline"
              disabled={searchingGoogle || !restaurant?.name}
              title="Search Google for business information"
            >
              {searchingGoogle ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Google Search
                </>
              )}
            </Button>
          )}
          
          {!isEditing && !isNewRestaurant ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Details
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gradient-to-r from-brand-blue to-brand-green"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : (isNewRestaurant ? 'Create Restaurant' : 'Save Changes')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contact">Contact & Lead</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="platforms">Platforms & Social</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Restaurant Name</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.name || ''}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.name || '-'}</p>
                  )}
                </div>
                
                <div>
                  <Label>Organisation Name</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.organisation_name || ''}
                      onChange={(e) => handleFieldChange('organisation_name', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.organisation_name || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>City</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.city || ''}
                      onChange={(e) => handleFieldChange('city', e.target.value)}
                      placeholder="e.g., Wellington, Auckland, Christchurch"
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.city || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>Address</Label>
                  {isEditing ? (
                    <Textarea
                      value={editedData.address || ''}
                      onChange={(e) => handleFieldChange('address', e.target.value)}
                      rows={2}
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.address || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>Phone</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.phone || ''}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.phone || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>Email</Label>
                  {isEditing ? (
                    <Input
                      type="email"
                      value={editedData.email || ''}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.email || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>Cuisine</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.cuisine?.join(', ') || ''}
                      onChange={(e) => handleFieldChange('cuisine', e.target.value.split(',').map(c => c.trim()))}
                      placeholder="e.g., Italian, Pizza, Pasta"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {restaurant?.cuisine?.map((c, i) => (
                        <Badge key={i} variant="secondary">{c}</Badge>
                      )) || <span className="text-sm">-</span>}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Subdomain</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.subdomain || ''}
                      onChange={(e) => handleFieldChange('subdomain', e.target.value)}
                      placeholder="restaurant-name"
                    />
                  ) : (
                    <p className="text-sm mt-1">
                      {restaurant?.subdomain ? (
                        <a 
                          href={`https://${restaurant.subdomain}.pumpd.co.nz`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-blue hover:underline"
                        >
                          {restaurant.subdomain}.pumpd.co.nz
                        </a>
                      ) : '-'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Opening Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {renderOpeningHours()}
                </div>
                
                {isEditing && (
                  <div className="mt-4">
                    <Label>Opening Hours Description</Label>
                    <Textarea
                      value={editedData.opening_hours_text || ''}
                      onChange={(e) => handleFieldChange('opening_hours_text', e.target.value)}
                      placeholder="e.g., Open daily 11am-10pm, closed Mondays"
                      rows={2}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Contact & Lead Tab */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact & Lead Information</CardTitle>
              <CardDescription>Contact details and lead tracking information</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Contact Name</Label>
                {isEditing ? (
                  <Input
                    value={editedData.contact_name || ''}
                    onChange={(e) => handleFieldChange('contact_name', e.target.value)}
                  />
                ) : (
                  <p className="text-sm mt-1">{restaurant?.contact_name || '-'}</p>
                )}
              </div>

              <div>
                <Label>Contact Email</Label>
                {isEditing ? (
                  <Input
                    type="email"
                    value={editedData.contact_email || ''}
                    onChange={(e) => handleFieldChange('contact_email', e.target.value)}
                  />
                ) : (
                  <p className="text-sm mt-1">{restaurant?.contact_email || '-'}</p>
                )}
              </div>

              <div>
                <Label>Contact Phone</Label>
                {isEditing ? (
                  <Input
                    value={editedData.contact_phone || ''}
                    onChange={(e) => handleFieldChange('contact_phone', e.target.value)}
                  />
                ) : (
                  <p className="text-sm mt-1">{restaurant?.contact_phone || '-'}</p>
                )}
              </div>

              <div>
                <Label>Weekly Sales Range</Label>
                {isEditing ? (
                  <Select
                    value={editedData.weekly_sales_range || ''}
                    onValueChange={(value) => handleFieldChange('weekly_sales_range', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-1000">$0 - $1,000</SelectItem>
                      <SelectItem value="1000-5000">$1,000 - $5,000</SelectItem>
                      <SelectItem value="5000-10000">$5,000 - $10,000</SelectItem>
                      <SelectItem value="10000-25000">$10,000 - $25,000</SelectItem>
                      <SelectItem value="25000+">$25,000+</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm mt-1">{restaurant?.weekly_sales_range || '-'}</p>
                )}
              </div>

              <div>
                <Label>Lead Created</Label>
                <p className="text-sm mt-1">
                  {restaurant?.lead_created_at 
                    ? new Date(restaurant.lead_created_at).toLocaleString()
                    : '-'}
                </p>
              </div>

              <div>
                <Label>User Account Email</Label>
                {isEditing ? (
                  <Input
                    type="email"
                    value={editedData.user_email || ''}
                    onChange={(e) => handleFieldChange('user_email', e.target.value)}
                  />
                ) : (
                  <p className="text-sm mt-1">{restaurant?.user_email || '-'}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Branding & Visual Identity</CardTitle>
              <CardDescription>Logo, colors, and theme settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Theme</Label>
                  {isEditing ? (
                    <Select
                      value={editedData.theme || 'light'}
                      onValueChange={(value) => handleFieldChange('theme', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="mt-1">
                      {restaurant?.theme || 'light'}
                    </Badge>
                  )}
                </div>

                <div>
                  <Label>Primary Color</Label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={editedData.primary_color || '#000000'}
                        onChange={(e) => handleFieldChange('primary_color', e.target.value)}
                        className="w-16 h-9"
                      />
                      <Input
                        value={editedData.primary_color || ''}
                        onChange={(e) => handleFieldChange('primary_color', e.target.value)}
                        placeholder="#000000"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      {restaurant?.primary_color && (
                        <div 
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: restaurant.primary_color }}
                        />
                      )}
                      <span className="text-sm">{restaurant?.primary_color || '-'}</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label>Secondary Color</Label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={editedData.secondary_color || '#000000'}
                        onChange={(e) => handleFieldChange('secondary_color', e.target.value)}
                        className="w-16 h-9"
                      />
                      <Input
                        value={editedData.secondary_color || ''}
                        onChange={(e) => handleFieldChange('secondary_color', e.target.value)}
                        placeholder="#000000"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      {restaurant?.secondary_color && (
                        <div 
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: restaurant.secondary_color }}
                        />
                      )}
                      <span className="text-sm">{restaurant?.secondary_color || '-'}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Logo URL</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.logo_url || ''}
                      onChange={(e) => handleFieldChange('logo_url', e.target.value)}
                      placeholder="https://..."
                    />
                  ) : (
                    <div className="mt-1">
                      {restaurant?.logo_url ? (
                        <img 
                          src={restaurant.logo_url} 
                          alt="Logo" 
                          className="h-20 object-contain"
                        />
                      ) : (
                        <span className="text-sm">-</span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Logo (No Background) URL</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.logo_nobg_url || ''}
                      onChange={(e) => handleFieldChange('logo_nobg_url', e.target.value)}
                      placeholder="https://..."
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.logo_nobg_url || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>Logo (Standard) URL</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.logo_standard_url || ''}
                      onChange={(e) => handleFieldChange('logo_standard_url', e.target.value)}
                      placeholder="https://..."
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.logo_standard_url || '-'}</p>
                  )}
                </div>

                <div>
                  <Label>Logo (Thermal) URL</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.logo_thermal_url || ''}
                      onChange={(e) => handleFieldChange('logo_thermal_url', e.target.value)}
                      placeholder="https://..."
                    />
                  ) : (
                    <p className="text-sm mt-1">{restaurant?.logo_thermal_url || '-'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment & Service Configuration</CardTitle>
              <CardDescription>Stripe and service settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Stripe Connect URL</Label>
                {isEditing ? (
                  <Textarea
                    value={editedData.stripe_connect_url || ''}
                    onChange={(e) => handleFieldChange('stripe_connect_url', e.target.value)}
                    rows={2}
                  />
                ) : (
                  <div className="mt-1">
                    {restaurant?.stripe_connect_url ? (
                      <a 
                        href={restaurant.stripe_connect_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-blue hover:underline break-all"
                      >
                        {restaurant.stripe_connect_url}
                      </a>
                    ) : (
                      <span className="text-sm">-</span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label>Payment Settings (JSON)</Label>
                {isEditing ? (
                  <Textarea
                    value={JSON.stringify(editedData.payment_settings || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        handleFieldChange('payment_settings', JSON.parse(e.target.value));
                      } catch {}
                    }}
                    rows={6}
                    className="font-mono text-xs"
                  />
                ) : (
                  <pre className="text-xs bg-gray-50 p-2 rounded mt-1">
                    {JSON.stringify(restaurant?.payment_settings || {}, null, 2)}
                  </pre>
                )}
              </div>

              <div>
                <Label>Service Settings (JSON)</Label>
                {isEditing ? (
                  <Textarea
                    value={JSON.stringify(editedData.service_settings || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        handleFieldChange('service_settings', JSON.parse(e.target.value));
                      } catch {}
                    }}
                    rows={6}
                    className="font-mono text-xs"
                  />
                ) : (
                  <pre className="text-xs bg-gray-50 p-2 rounded mt-1">
                    {JSON.stringify(restaurant?.service_settings || {}, null, 2)}
                  </pre>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platforms & Social Tab */}
        <TabsContent value="platforms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform & Social Media Links</CardTitle>
              <CardDescription>Delivery platforms and social media URLs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>UberEats URL</Label>
                {isEditing ? (
                  <Input
                    value={editedData.ubereats_url || ''}
                    onChange={(e) => handleFieldChange('ubereats_url', e.target.value)}
                    placeholder="https://www.ubereats.com/..."
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.ubereats_url ? (
                      <a 
                        href={restaurant.ubereats_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.ubereats_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              <div>
                <Label>DoorDash URL</Label>
                {isEditing ? (
                  <Input
                    value={editedData.doordash_url || ''}
                    onChange={(e) => handleFieldChange('doordash_url', e.target.value)}
                    placeholder="https://www.doordash.com/..."
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.doordash_url ? (
                      <a 
                        href={restaurant.doordash_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.doordash_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              <div>
                <Label>Website URL</Label>
                {isEditing ? (
                  <Input
                    value={editedData.website_url || ''}
                    onChange={(e) => handleFieldChange('website_url', e.target.value)}
                    placeholder="https://..."
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.website_url ? (
                      <a 
                        href={restaurant.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.website_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              <div>
                <Label>Instagram URL</Label>
                {isEditing ? (
                  <Input
                    value={editedData.instagram_url || ''}
                    onChange={(e) => handleFieldChange('instagram_url', e.target.value)}
                    placeholder="https://instagram.com/..."
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.instagram_url ? (
                      <a 
                        href={restaurant.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.instagram_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>

              <div>
                <Label>Facebook URL</Label>
                {isEditing ? (
                  <Input
                    value={editedData.facebook_url || ''}
                    onChange={(e) => handleFieldChange('facebook_url', e.target.value)}
                    placeholder="https://facebook.com/..."
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {restaurant?.facebook_url ? (
                      <a 
                        href={restaurant.facebook_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        {restaurant.facebook_url}
                      </a>
                    ) : '-'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow Tab */}
        <TabsContent value="workflow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Status</CardTitle>
              <CardDescription>Track onboarding progress and notes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Onboarding Status</Label>
                {isEditing ? (
                  <Select
                    value={editedData.onboarding_status || 'lead'}
                    onValueChange={(value) => handleFieldChange('onboarding_status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="info_gathered">Info Gathered</SelectItem>
                      <SelectItem value="registered">Registered</SelectItem>
                      <SelectItem value="menu_imported">Menu Imported</SelectItem>
                      <SelectItem value="configured">Configured</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="mt-1">
                    {getStatusBadge(restaurant?.onboarding_status)}
                  </div>
                )}
              </div>

              <div>
                <Label>Onboarding Completed</Label>
                <p className="text-sm mt-1">
                  {restaurant?.onboarding_completed_at 
                    ? new Date(restaurant.onboarding_completed_at).toLocaleString()
                    : 'Not completed'}
                </p>
              </div>

              <div>
                <Label>Password Hint</Label>
                {isEditing ? (
                  <Input
                    value={editedData.user_password_hint || ''}
                    onChange={(e) => handleFieldChange('user_password_hint', e.target.value)}
                    placeholder="e.g., Restaurantname789!"
                  />
                ) : (
                  <p className="text-sm mt-1">{restaurant?.user_password_hint || '-'}</p>
                )}
              </div>

              <div>
                <Label>Workflow Notes</Label>
                {isEditing ? (
                  <Textarea
                    value={editedData.workflow_notes || ''}
                    onChange={(e) => handleFieldChange('workflow_notes', e.target.value)}
                    rows={4}
                    placeholder="Any notes about the onboarding process..."
                  />
                ) : (
                  <p className="text-sm mt-1 whitespace-pre-wrap">
                    {restaurant?.workflow_notes || '-'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Menus */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Menus</CardTitle>
              <CardDescription>Latest menu versions for this restaurant</CardDescription>
            </CardHeader>
            <CardContent>
              {restaurant?.menus && restaurant.menus.length > 0 ? (
                <div className="space-y-2">
                  {restaurant.menus.slice(0, 5).map((menu) => (
                    <div key={menu.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="text-sm font-medium">Version {menu.version}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {menu.platforms?.name || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {menu.is_active && (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(menu.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/menus?restaurant=${id}`)}
                  >
                    View All Menus
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No menus found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}