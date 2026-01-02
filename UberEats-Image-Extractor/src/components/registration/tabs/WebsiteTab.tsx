import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Separator } from '../../ui/separator';
import { Badge } from '../../ui/badge';
import { Image as ImageIcon, AlertCircle, Link2, CheckCircle2 } from 'lucide-react';
import type { YoloModeFormData, Restaurant } from '../YoloModeDialog';

// Header image field type
type HeaderImageField = 'website_og_image' | 'ubereats_og_image' | 'doordash_og_image' | 'facebook_cover_image';

interface WebsiteTabProps {
  formData: YoloModeFormData;
  updateFormData: <S extends keyof YoloModeFormData, K extends keyof YoloModeFormData[S]>(
    section: S,
    key: K,
    value: YoloModeFormData[S][K]
  ) => void;
  restaurant: Restaurant;
  /**
   * Callback when a header image URL is applied
   * Should save to database immediately (URL converted to base64 on backend)
   * Returns a promise that resolves when save is complete
   */
  onHeaderImageSave?: (field: HeaderImageField, url: string) => Promise<void>;
  /**
   * Whether a save operation is in progress
   */
  isHeaderImageSaving?: boolean;
}

// All possible image sources
const ALL_IMAGE_SOURCES = [
  { value: 'website_og_image', label: 'Website OG Image', field: 'website_og_image' },
  { value: 'ubereats_og_image', label: 'UberEats Image', field: 'ubereats_og_image' },
  { value: 'doordash_og_image', label: 'DoorDash Image', field: 'doordash_og_image' },
  { value: 'facebook_cover_image', label: 'Facebook Cover', field: 'facebook_cover_image' },
] as const;

// All possible logo sources
const ALL_LOGO_SOURCES = [
  { value: 'logo_url', label: 'Original Logo', field: 'logo_url' },
  { value: 'logo_nobg_url', label: 'Logo (No Background)', field: 'logo_nobg_url' },
  { value: 'logo_standard_url', label: 'Standard Logo', field: 'logo_standard_url' },
  { value: 'logo_thermal_url', label: 'Thermal Logo', field: 'logo_thermal_url' },
  { value: 'logo_thermal_alt_url', label: 'Thermal Alt Logo', field: 'logo_thermal_alt_url' },
  { value: 'logo_thermal_contrast_url', label: 'Thermal Contrast', field: 'logo_thermal_contrast_url' },
  { value: 'logo_thermal_adaptive_url', label: 'Thermal Adaptive', field: 'logo_thermal_adaptive_url' },
  { value: 'logo_favicon_url', label: 'Favicon Logo', field: 'logo_favicon_url' },
] as const;

const TINT_OPTIONS = [
  { value: 'none', label: 'None (Original)' },
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
  { value: 'primary', label: 'Primary Color' },
  { value: 'secondary', label: 'Secondary Color' },
  { value: 'custom', label: 'Custom Color' },
];

const TEXT_COLOR_OPTIONS = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
  { value: 'primary', label: 'Primary Color' },
  { value: 'secondary', label: 'Secondary Color' },
  { value: 'custom', label: 'Custom Color' },
];

// Logo preview component (small, square)
function LogoPreview({ url, label }: { url?: string; label: string }) {
  if (!url) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 rounded border bg-muted/50 flex items-center justify-center overflow-hidden">
        <img
          src={url}
          alt={label}
          className="max-h-full max-w-full object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
      <span className="text-sm">{label}</span>
    </div>
  );
}

// Header image preview component (wider, for OG images)
function HeaderImagePreview({ url, label }: { url?: string; label: string }) {
  if (!url) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="h-8 w-14 rounded border bg-muted/50 flex items-center justify-center overflow-hidden">
        <img
          src={url}
          alt={label}
          className="max-h-full max-w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function WebsiteTab({
  formData,
  updateFormData,
  restaurant,
  onHeaderImageSave,
  isHeaderImageSaving = false,
}: WebsiteTabProps) {
  // Local state for cuisine input to allow typing commas
  const [cuisineInput, setCuisineInput] = useState(formData.website.cuisines.join(', '));

  // Local state for header image URL input
  const [headerImageUrlInput, setHeaderImageUrlInput] = useState('');

  // Sync local state when form data changes externally
  useEffect(() => {
    setCuisineInput(formData.website.cuisines.join(', '));
  }, [formData.website.cuisines]);

  // Handle cuisine input blur - parse and update form data
  const handleCuisineBlur = () => {
    const cuisines = cuisineInput.split(',').map(c => c.trim()).filter(c => c);
    updateFormData('website', 'cuisines', cuisines);
  };

  // Filter logo sources to only show available ones
  const availableLogoSources = useMemo(() => {
    return ALL_LOGO_SOURCES.filter(source => {
      const value = restaurant[source.field as keyof Restaurant];
      return value && typeof value === 'string' && value.length > 0;
    });
  }, [restaurant]);

  // Get the actual logo URL for a given source
  const getLogoUrl = (source: string): string | undefined => {
    return restaurant[source as keyof Restaurant] as string | undefined;
  };

  // Get the actual header image URL for a given source
  const getHeaderImageUrl = (source: string): string | undefined => {
    return restaurant[source as keyof Restaurant] as string | undefined;
  };

  // Handle header image URL apply - saves directly to database
  const handleHeaderImageUrlSubmit = async () => {
    const selectedSource = formData.website.headerImageSource as HeaderImageField;
    if (headerImageUrlInput.trim() && onHeaderImageSave) {
      await onHeaderImageSave(selectedSource, headerImageUrlInput.trim());
      setHeaderImageUrlInput(''); // Clear input after successful save
    }
  };

  // Handle theme change - also update text color defaults
  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    updateFormData('website', 'theme', newTheme);

    // Update text colors to appropriate defaults for the new theme
    // Only update if current values are standard options (not custom)
    const defaultTextColor = newTheme === 'light' ? 'secondary' : 'white';

    if (formData.website.navTextColor !== 'custom') {
      updateFormData('website', 'navTextColor', defaultTextColor);
    }
    if (formData.website.cardTextColor !== 'custom') {
      updateFormData('website', 'cardTextColor', defaultTextColor);
    }
  };

  return (
    <div className="space-y-4">
      {/* Theme & Colors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Theme & Colors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <RadioGroup
              value={formData.website.theme}
              onValueChange={(value) => handleThemeChange(value as 'light' | 'dark')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="theme-dark" />
                <Label htmlFor="theme-dark" className="cursor-pointer">Dark</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="theme-light" />
                <Label htmlFor="theme-light" className="cursor-pointer">Light</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cuisine">Cuisine</Label>
              <Input
                id="cuisine"
                value={cuisineInput}
                onChange={(e) => setCuisineInput(e.target.value)}
                onBlur={handleCuisineBlur}
                placeholder="e.g., Italian, Thai, Pizza"
              />
              {formData.website.cuisines.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {formData.website.cuisines.map((c, i) => (
                    <Badge key={i} variant="secondary">{c}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primary-color"
                  value={formData.website.primaryColor}
                  onChange={(e) => updateFormData('website', 'primaryColor', e.target.value)}
                  placeholder="#000000"
                />
                <input
                  type="color"
                  value={formData.website.primaryColor || '#000000'}
                  onChange={(e) => updateFormData('website', 'primaryColor', e.target.value)}
                  className="h-10 w-10 rounded border cursor-pointer"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary-color">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary-color"
                  value={formData.website.secondaryColor}
                  onChange={(e) => updateFormData('website', 'secondaryColor', e.target.value)}
                  placeholder="#FFFFFF"
                />
                <input
                  type="color"
                  value={formData.website.secondaryColor || '#FFFFFF'}
                  onChange={(e) => updateFormData('website', 'secondaryColor', e.target.value)}
                  className="h-10 w-10 rounded border cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="disable-gradients"
              checked={formData.website.disableGradients}
              onCheckedChange={(checked) =>
                updateFormData('website', 'disableGradients', checked as boolean)
              }
            />
            <Label htmlFor="disable-gradients" className="cursor-pointer">
              Disable Gradients
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Header Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Header Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="configure-header"
              checked={formData.website.configureHeader}
              onCheckedChange={(checked) =>
                updateFormData('website', 'configureHeader', checked as boolean)
              }
            />
            <Label htmlFor="configure-header" className="cursor-pointer">
              Configure Header Section
            </Label>
          </div>

          {formData.website.configureHeader && (
            <div className="space-y-4 pl-6 border-l-2 border-muted">
              <div className="space-y-2">
                <Label>Header Background Image</Label>
                {/* Always show all 4 image source options */}
                <Select
                  value={formData.website.headerImageSource}
                  onValueChange={(value) => updateFormData('website', 'headerImageSource', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_IMAGE_SOURCES.map((source) => {
                      const imageUrl = getHeaderImageUrl(source.value);
                      const hasImage = !!imageUrl && imageUrl.length > 0;
                      return (
                        <SelectItem key={source.value} value={source.value}>
                          <div className="flex items-center gap-2">
                            {hasImage ? (
                              <HeaderImagePreview url={imageUrl} label={source.label} />
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-14 rounded border bg-muted/50 flex items-center justify-center">
                                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm text-muted-foreground">{source.label} (empty)</span>
                              </div>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {/* URL Input for adding/replacing header image */}
                {onHeaderImageSave && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      Paste image URL to add/replace selected source
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={headerImageUrlInput}
                        onChange={(e) => setHeaderImageUrlInput(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="flex-1"
                        disabled={isHeaderImageSaving}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isHeaderImageSaving) {
                            e.preventDefault();
                            handleHeaderImageUrlSubmit();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleHeaderImageUrlSubmit}
                        disabled={!headerImageUrlInput.trim() || isHeaderImageSaving}
                        className="px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {isHeaderImageSaving ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Apply & Save
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Image URL will be downloaded and converted to base64 when you click Apply.
                    </p>
                  </div>
                )}

                {/* Header Image Preview */}
                {getHeaderImageUrl(formData.website.headerImageSource) && (
                  <div className="p-2 bg-muted/30 rounded space-y-1">
                    <span className="text-sm text-muted-foreground">Preview:</span>
                    <img
                      src={getHeaderImageUrl(formData.website.headerImageSource)}
                      alt="Header background preview"
                      className="w-full max-h-32 object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Header Logo Source</Label>
                {availableLogoSources.length > 0 ? (
                  <>
                    <Select
                      value={formData.website.headerLogoSource}
                      onValueChange={(value) => updateFormData('website', 'headerLogoSource', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLogoSources.map((source) => (
                          <SelectItem key={source.value} value={source.value}>
                            <LogoPreview
                              url={getLogoUrl(source.value)}
                              label={source.label}
                            />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Logo Preview */}
                    {getLogoUrl(formData.website.headerLogoSource) && (
                      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                        <span className="text-sm text-muted-foreground">Preview:</span>
                        <img
                          src={getLogoUrl(formData.website.headerLogoSource)}
                          alt="Header logo preview"
                          className="h-10 max-w-[120px] object-contain"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted/30 rounded">
                    <AlertCircle className="h-4 w-4" />
                    No logos available. Extract branding first.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Header Logo Dark Tint</Label>
                  <Select
                    value={formData.website.headerLogoDarkTint}
                    onValueChange={(value) => updateFormData('website', 'headerLogoDarkTint', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TINT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Header Logo Light Tint</Label>
                  <Select
                    value={formData.website.headerLogoLightTint}
                    onValueChange={(value) => updateFormData('website', 'headerLogoLightTint', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TINT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation & Layout */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Navigation & Layout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nav Logo Source</Label>
              {availableLogoSources.length > 0 ? (
                <>
                  <Select
                    value={formData.website.navLogoSource}
                    onValueChange={(value) => updateFormData('website', 'navLogoSource', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLogoSources.map((source) => (
                        <SelectItem key={source.value} value={source.value}>
                          <LogoPreview
                            url={getLogoUrl(source.value)}
                            label={source.label}
                          />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Logo Preview */}
                  {getLogoUrl(formData.website.navLogoSource) && (
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <span className="text-xs text-muted-foreground">Preview:</span>
                      <img
                        src={getLogoUrl(formData.website.navLogoSource)}
                        alt="Nav logo preview"
                        className="h-8 max-w-[100px] object-contain"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted/30 rounded">
                  <AlertCircle className="h-4 w-4" />
                  No logos available
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Nav Text Color</Label>
              <Select
                value={formData.website.navTextColor}
                onValueChange={(value) => updateFormData('website', 'navTextColor', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEXT_COLOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.website.navTextColor === 'custom' && (
                <div className="flex gap-2">
                  <Input
                    value={formData.website.navTextCustomColor}
                    onChange={(e) => updateFormData('website', 'navTextCustomColor', e.target.value)}
                    placeholder="#000000"
                  />
                  <input
                    type="color"
                    value={formData.website.navTextCustomColor || '#000000'}
                    onChange={(e) => updateFormData('website', 'navTextCustomColor', e.target.value)}
                    className="h-10 w-10 rounded border cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Card/Box Text Color */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Card Text Color</Label>
              <Select
                value={formData.website.cardTextColor}
                onValueChange={(value) => updateFormData('website', 'cardTextColor', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEXT_COLOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.website.cardTextColor === 'custom' && (
                <div className="flex gap-2">
                  <Input
                    value={formData.website.cardTextCustomColor}
                    onChange={(e) => updateFormData('website', 'cardTextCustomColor', e.target.value)}
                    placeholder="#000000"
                  />
                  <input
                    type="color"
                    value={formData.website.cardTextCustomColor || '#000000'}
                    onChange={(e) => updateFormData('website', 'cardTextCustomColor', e.target.value)}
                    className="h-10 w-10 rounded border cursor-pointer"
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Item Layout</Label>
              <RadioGroup
                value={formData.website.itemLayout}
                onValueChange={(value) =>
                  updateFormData('website', 'itemLayout', value as 'list' | 'card')
                }
                className="flex gap-4 pt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="list" id="layout-list" />
                  <Label htmlFor="layout-list" className="cursor-pointer">List</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="card" id="layout-card" />
                  <Label htmlFor="layout-card" className="cursor-pointer">Card</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nav Logo Dark Tint</Label>
              <Select
                value={formData.website.navLogoDarkTint}
                onValueChange={(value) => updateFormData('website', 'navLogoDarkTint', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TINT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nav Logo Light Tint</Label>
              <Select
                value={formData.website.navLogoLightTint}
                onValueChange={(value) => updateFormData('website', 'navLogoLightTint', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TINT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Favicon Source</Label>
            {availableLogoSources.length > 0 ? (
              <Select
                value={formData.website.faviconSource}
                onValueChange={(value) => updateFormData('website', 'faviconSource', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableLogoSources.map((source) => (
                    <SelectItem key={source.value} value={source.value}>
                      <LogoPreview
                        url={getLogoUrl(source.value)}
                        label={source.label}
                      />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted/30 rounded">
                <AlertCircle className="h-4 w-4" />
                No logos available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
