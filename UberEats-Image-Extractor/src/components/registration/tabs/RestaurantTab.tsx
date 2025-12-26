import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { OpeningHoursEditor, type OpeningHoursSlot } from '../../OpeningHoursEditor';
import { Edit, Check, X, Clock } from 'lucide-react';
import type { YoloModeFormData, RegistrationStatus } from '../YoloModeDialog';

interface RestaurantTabProps {
  formData: YoloModeFormData;
  updateFormData: <S extends keyof YoloModeFormData, K extends keyof YoloModeFormData[S]>(
    section: S,
    key: K,
    value: YoloModeFormData[S][K]
  ) => void;
  registrationStatus: RegistrationStatus | null;
}

// Helper to format time for display
function formatTime(time: string): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const mins = m?.padStart(2, '0') || '00';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${mins} ${ampm}`;
}

// Format opening hours for display
function formatHoursForDisplay(hours: Record<string, any> | OpeningHoursSlot[] | null): { day: string; times: string }[] {
  if (!hours) return [];

  const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Handle array format
  if (Array.isArray(hours)) {
    const grouped: Record<string, string[]> = {};
    hours.forEach((slot: OpeningHoursSlot) => {
      const time = `${formatTime(slot.hours.open)} - ${formatTime(slot.hours.close)}`;
      if (!grouped[slot.day]) {
        grouped[slot.day] = [];
      }
      grouped[slot.day].push(time);
    });

    return DAYS_ORDER
      .filter(day => grouped[day])
      .map(day => ({
        day,
        times: grouped[day].join(', ')
      }));
  }

  // Handle object format (keyed by day or index)
  if (typeof hours === 'object') {
    // Check if it's indexed by numbers (array-like object)
    const keys = Object.keys(hours);
    if (keys.length > 0 && !isNaN(parseInt(keys[0], 10))) {
      // It's an array-like object with numeric keys
      const result: { day: string; times: string }[] = [];
      const grouped: Record<string, string[]> = {};

      keys.forEach(key => {
        const slot = hours[key];
        if (slot && typeof slot === 'object' && 'day' in slot && 'hours' in slot) {
          const time = `${formatTime(slot.hours.open)} - ${formatTime(slot.hours.close)}`;
          if (!grouped[slot.day]) {
            grouped[slot.day] = [];
          }
          grouped[slot.day].push(time);
        }
      });

      return DAYS_ORDER
        .filter(day => grouped[day])
        .map(day => ({
          day,
          times: grouped[day].join(', ')
        }));
    }

    // It's a proper object keyed by day name
    return Object.entries(hours)
      .filter(([_, value]) => value && typeof value === 'object')
      .map(([day, value]) => {
        if ('open' in value && 'close' in value) {
          return {
            day,
            times: `${formatTime(value.open)} - ${formatTime(value.close)}`
          };
        }
        return { day, times: 'Invalid format' };
      })
      .sort((a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day));
  }

  return [];
}

export function RestaurantTab({ formData, updateFormData, registrationStatus }: RestaurantTabProps) {
  const isRestaurantComplete = registrationStatus?.pumpdRestaurant?.registration_status === 'completed';
  const [isEditingHours, setIsEditingHours] = useState(false);

  // Format hours for display
  const formattedHours = useMemo(() =>
    formatHoursForDisplay(formData.restaurant.opening_hours),
    [formData.restaurant.opening_hours]
  );

  // Handle opening hours change from editor
  const handleHoursChange = (newHours: OpeningHoursSlot[]) => {
    updateFormData('restaurant', 'opening_hours', newHours as any);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Registration Mode</CardTitle>
            <Badge variant={isRestaurantComplete ? "default" : "outline"}>
              {isRestaurantComplete ? "Registered" : "Not Registered"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={formData.restaurant.registrationMode}
            onValueChange={(value) =>
              updateFormData('restaurant', 'registrationMode', value as YoloModeFormData['restaurant']['registrationMode'])
            }
            disabled={isRestaurantComplete}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="existing_account_first_restaurant" id="mode-existing-first" />
              <Label htmlFor="mode-existing-first" className="cursor-pointer">
                First Restaurant for Account
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="existing_account_additional_restaurant" id="mode-existing-add" />
              <Label htmlFor="mode-existing-add" className="cursor-pointer">
                Additional Restaurant for Account
              </Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-muted-foreground mt-2">
            Note: New account creation is handled in the Account tab. Select "First Restaurant" if this is the first restaurant for a new or existing account.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Restaurant Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="restaurant-name">Restaurant Name</Label>
              <Input
                id="restaurant-name"
                value={formData.restaurant.name}
                onChange={(e) => updateFormData('restaurant', 'name', e.target.value)}
                placeholder="Restaurant Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restaurant-phone">Phone</Label>
              <Input
                id="restaurant-phone"
                type="tel"
                value={formData.restaurant.phone}
                onChange={(e) => updateFormData('restaurant', 'phone', e.target.value)}
                placeholder="+64 9 123 4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="restaurant-address">Address</Label>
            <Input
              id="restaurant-address"
              value={formData.restaurant.address}
              onChange={(e) => updateFormData('restaurant', 'address', e.target.value)}
              placeholder="123 Main Street"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="restaurant-city">City</Label>
              <Input
                id="restaurant-city"
                value={formData.restaurant.city}
                onChange={(e) => updateFormData('restaurant', 'city', e.target.value)}
                placeholder="Auckland"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restaurant-subdomain">Subdomain</Label>
              <Input
                id="restaurant-subdomain"
                value={formData.restaurant.subdomain}
                onChange={(e) => updateFormData('restaurant', 'subdomain', e.target.value)}
                placeholder="restaurant-name"
              />
              <p className="text-xs text-muted-foreground">
                URL: {formData.restaurant.subdomain || 'subdomain'}.pumpd.co.nz
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Opening Hours
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingHours(!isEditingHours)}
              >
                {isEditingHours ? (
                  <><Check className="h-4 w-4 mr-1" /> Done</>
                ) : (
                  <><Edit className="h-4 w-4 mr-1" /> Edit</>
                )}
              </Button>
            </div>

            {isEditingHours ? (
              <div className="border rounded-md p-3">
                <OpeningHoursEditor
                  value={formData.restaurant.opening_hours}
                  onChange={handleHoursChange}
                  isEditing={true}
                />
              </div>
            ) : (
              <div className="border rounded-md p-3 bg-muted/30">
                {formattedHours.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {formattedHours.map(({ day, times }) => (
                      <div key={day} className="flex justify-between text-sm">
                        <span className="font-medium">{day}</span>
                        <span className="text-muted-foreground">{times}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No opening hours configured. Click Edit to add hours.
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
