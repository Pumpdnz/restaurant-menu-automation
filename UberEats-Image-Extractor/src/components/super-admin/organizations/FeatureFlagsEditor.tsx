import React from 'react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Card } from '../../ui/card';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface FeatureFlag {
  enabled: boolean;
  ratePerItem?: number;
}

interface NestedFeatureFlags {
  enabled: boolean;
  [key: string]: boolean | FeatureFlag | undefined;
}

type FeatureFlagValue = FeatureFlag | NestedFeatureFlags;

interface FeatureFlagsEditorProps {
  featureFlags: Record<string, FeatureFlagValue>;
  onChange: (flags: Record<string, FeatureFlagValue>) => void;
  disabled?: boolean;
}

const FEATURE_LABELS: Record<string, string> = {
  // Original extraction features
  standardExtraction: 'Standard Extraction',
  premiumExtraction: 'Premium Extraction',
  logoExtraction: 'Logo Extraction',
  logoProcessing: 'Logo Processing',
  googleSearchExtraction: 'Google Search',
  platformDetailsExtraction: 'Platform Details',
  csvDownload: 'CSV Download',
  csvWithImagesDownload: 'CSV with Images',
  imageUploadToCDN: 'Image Upload to CDN',
  imageZipDownload: 'Image ZIP Download',

  // New feature areas
  tasksAndSequences: 'Tasks & Sequences',
  socialMedia: 'Social Media',
  leadScraping: 'Lead Scraping',
  brandingExtraction: 'Branding Extraction',
  registration: 'Registration Features',

  // Registration sub-features
  userAccountRegistration: 'User Account Registration',
  restaurantRegistration: 'Restaurant Registration',
  menuUploading: 'Menu Uploading',
  itemTagUploading: 'Item Tag Uploading',
  optionSetUploading: 'Option Set Uploading',
  codeInjection: 'Code Injection Generation',
  websiteSettings: 'Website Settings',
  stripePayments: 'Stripe Payments',
  servicesConfiguration: 'Services Configuration',
  onboardingUserManagement: 'Onboarding User Management',
  onboardingSync: 'Onboarding Sync',
  finalisingSetup: 'Finalising Setup',

  // Lead scraping sub-features
  scrapeJobs: 'Scrape Jobs',
  stepEnrichment: 'Step Enrichment',
  leadConversion: 'Lead Conversion',

  // Branding sub-features
  firecrawlBranding: 'Firecrawl Branding Format'
};

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  // Original extraction features
  standardExtraction: 'Basic menu extraction from delivery platforms',
  premiumExtraction: 'Advanced extraction with option sets and modifiers',
  logoExtraction: 'Restaurant logo extraction from platforms',
  logoProcessing: 'Logo background removal and processing',
  googleSearchExtraction: 'Google business information search',
  platformDetailsExtraction: 'Platform-specific restaurant details',
  csvDownload: 'Export menus as CSV files',
  csvWithImagesDownload: 'Export menus as CSV with image URLs',
  imageUploadToCDN: 'Upload menu images to CDN',
  imageZipDownload: 'Download images as ZIP archive',

  // New feature areas
  tasksAndSequences: 'Sales tasks and sequence management (UI only)',
  socialMedia: 'Social media content generation',
  leadScraping: 'Lead discovery and enrichment from platforms',
  brandingExtraction: 'Brand colors and logo extraction using Firecrawl',
  registration: 'Restaurant registration automation on Pumpd',

  // Registration sub-features
  userAccountRegistration: 'Create user accounts on Pumpd dashboard',
  restaurantRegistration: 'Register restaurant entity on Pumpd',
  menuUploading: 'Upload CSV menu data to Pumpd',
  itemTagUploading: 'Add tags to menu items',
  optionSetUploading: 'Add option sets and modifiers',
  codeInjection: 'Generate head/body code injections',
  websiteSettings: 'Configure website appearance and branding',
  stripePayments: 'Setup Stripe payment gateway',
  servicesConfiguration: 'Configure restaurant services',
  onboardingUserManagement: 'Create onboarding system users',
  onboardingSync: 'Sync restaurant data with Pumpd onboarding record',
  finalisingSetup: 'Complete system settings, API keys, integrations',

  // Lead scraping sub-features
  scrapeJobs: 'Create and execute lead scrape jobs',
  stepEnrichment: 'Per-API-call enrichment tracking',
  leadConversion: 'Convert leads to restaurant records',

  // Branding sub-features
  firecrawlBranding: 'Use Firecrawl branding format for extraction'
};

// Helper to check if a value is a simple feature flag (has enabled and optionally ratePerItem)
function isSimpleFeatureFlag(value: unknown): value is FeatureFlag {
  return (
    typeof value === 'object' &&
    value !== null &&
    'enabled' in value &&
    typeof (value as FeatureFlag).enabled === 'boolean' &&
    !hasNestedFeatures(value)
  );
}

// Helper to check if a feature has nested sub-features
function hasNestedFeatures(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const keys = Object.keys(value);
  return keys.some(key =>
    key !== 'enabled' &&
    key !== 'ratePerItem' &&
    typeof (value as Record<string, unknown>)[key] === 'object'
  );
}

// Get nested features from a parent feature
function getNestedFeatures(value: NestedFeatureFlags): Record<string, FeatureFlag> {
  const nested: Record<string, FeatureFlag> = {};
  for (const [key, val] of Object.entries(value)) {
    if (key !== 'enabled' && typeof val === 'object' && val !== null && 'enabled' in val) {
      nested[key] = val as FeatureFlag;
    }
  }
  return nested;
}

export function FeatureFlagsEditor({ featureFlags, onChange, disabled }: FeatureFlagsEditorProps) {
  const [expandedFeatures, setExpandedFeatures] = React.useState<Set<string>>(new Set());

  const toggleExpanded = (feature: string) => {
    const newExpanded = new Set(expandedFeatures);
    if (newExpanded.has(feature)) {
      newExpanded.delete(feature);
    } else {
      newExpanded.add(feature);
    }
    setExpandedFeatures(newExpanded);
  };

  const handleToggle = (feature: string, parentFeature?: string) => {
    if (parentFeature) {
      // Toggle nested feature
      const parent = featureFlags[parentFeature] as NestedFeatureFlags;
      onChange({
        ...featureFlags,
        [parentFeature]: {
          ...parent,
          [feature]: {
            ...(parent[feature] as FeatureFlag),
            enabled: !(parent[feature] as FeatureFlag).enabled
          }
        }
      });
    } else {
      // Toggle top-level feature
      onChange({
        ...featureFlags,
        [feature]: {
          ...featureFlags[feature],
          enabled: !featureFlags[feature].enabled
        }
      });
    }
  };

  const handleRateChange = (feature: string, rate: string, parentFeature?: string) => {
    const numRate = parseFloat(rate) || 0;
    if (parentFeature) {
      // Update nested feature rate
      const parent = featureFlags[parentFeature] as NestedFeatureFlags;
      onChange({
        ...featureFlags,
        [parentFeature]: {
          ...parent,
          [feature]: {
            ...(parent[feature] as FeatureFlag),
            ratePerItem: numRate
          }
        }
      });
    } else {
      // Update top-level feature rate
      onChange({
        ...featureFlags,
        [feature]: {
          ...featureFlags[feature],
          ratePerItem: numRate
        }
      });
    }
  };

  const renderFeatureCard = (
    feature: string,
    config: FeatureFlag,
    parentFeature?: string,
    isNested: boolean = false
  ) => {
    const hasRate = config.ratePerItem !== undefined;

    return (
      <Card key={`${parentFeature || ''}-${feature}`} className={`p-4 ${isNested ? 'ml-6 border-l-2 border-purple-200' : ''}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <Switch
                checked={config.enabled}
                onCheckedChange={() => handleToggle(feature, parentFeature)}
                disabled={disabled || (parentFeature && !featureFlags[parentFeature]?.enabled)}
              />
              <Label className={`font-medium ${isNested ? 'text-sm' : ''}`}>
                {FEATURE_LABELS[feature] || feature}
              </Label>
            </div>
            {FEATURE_DESCRIPTIONS[feature] && (
              <p className="text-sm text-gray-500 mt-1 ml-9">
                {FEATURE_DESCRIPTIONS[feature]}
              </p>
            )}
          </div>

          {hasRate && (
            <div className="flex items-center space-x-2 ml-4">
              <Label className="text-sm text-gray-600">Rate: $</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={config.ratePerItem ?? 0}
                onChange={(e) => handleRateChange(feature, e.target.value, parentFeature)}
                disabled={disabled || !config.enabled}
                className="w-24"
              />
            </div>
          )}
        </div>
      </Card>
    );
  };

  const renderFeatureWithNested = (feature: string, config: NestedFeatureFlags) => {
    const isExpanded = expandedFeatures.has(feature);
    const nestedFeatures = getNestedFeatures(config);
    const hasNested = Object.keys(nestedFeatures).length > 0;

    return (
      <div key={feature} className="space-y-2">
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                {hasNested && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(feature)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                )}
                <Switch
                  checked={config.enabled}
                  onCheckedChange={() => handleToggle(feature)}
                  disabled={disabled}
                />
                <Label className="font-medium">
                  {FEATURE_LABELS[feature] || feature}
                </Label>
                {hasNested && (
                  <span className="text-xs text-gray-400 ml-2">
                    ({Object.keys(nestedFeatures).length} sub-features)
                  </span>
                )}
              </div>
              {FEATURE_DESCRIPTIONS[feature] && (
                <p className="text-sm text-gray-500 mt-1 ml-9">
                  {FEATURE_DESCRIPTIONS[feature]}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Nested features */}
        {hasNested && isExpanded && config.enabled && (
          <div className="space-y-2">
            {Object.entries(nestedFeatures).map(([nestedKey, nestedConfig]) =>
              renderFeatureCard(nestedKey, nestedConfig, feature, true)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {Object.entries(featureFlags).map(([feature, config]) => {
        if (isSimpleFeatureFlag(config)) {
          return renderFeatureCard(feature, config);
        } else if (hasNestedFeatures(config)) {
          return renderFeatureWithNested(feature, config as NestedFeatureFlags);
        } else {
          // Treat as simple feature flag with just enabled
          return renderFeatureCard(feature, { enabled: config.enabled, ratePerItem: (config as FeatureFlag).ratePerItem });
        }
      })}
    </div>
  );
}