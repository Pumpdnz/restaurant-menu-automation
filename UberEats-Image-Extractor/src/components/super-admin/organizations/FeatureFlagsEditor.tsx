import React from 'react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Switch } from '../../ui/switch';
import { Card } from '../../ui/card';

interface FeatureFlag {
  enabled: boolean;
  ratePerItem: number;
}

interface FeatureFlagsEditorProps {
  featureFlags: Record<string, FeatureFlag>;
  onChange: (flags: Record<string, FeatureFlag>) => void;
  disabled?: boolean;
}

const FEATURE_LABELS: Record<string, string> = {
  standardExtraction: 'Standard Extraction',
  premiumExtraction: 'Premium Extraction',
  logoExtraction: 'Logo Extraction',
  logoProcessing: 'Logo Processing',
  googleSearchExtraction: 'Google Search',
  platformDetailsExtraction: 'Platform Details',
  csvDownload: 'CSV Download',
  csvWithImagesDownload: 'CSV with Images',
  imageUploadToCDN: 'Image Upload to CDN',
  imageZipDownload: 'Image ZIP Download'
};

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  standardExtraction: 'Basic menu extraction from delivery platforms',
  premiumExtraction: 'Advanced extraction with option sets and modifiers',
  logoExtraction: 'Restaurant logo extraction from platforms',
  logoProcessing: 'Logo background removal and processing',
  googleSearchExtraction: 'Google business information search',
  platformDetailsExtraction: 'Platform-specific restaurant details',
  csvDownload: 'Export menus as CSV files',
  csvWithImagesDownload: 'Export menus as CSV with image URLs',
  imageUploadToCDN: 'Upload menu images to CDN',
  imageZipDownload: 'Download images as ZIP archive'
};

export function FeatureFlagsEditor({ featureFlags, onChange, disabled }: FeatureFlagsEditorProps) {
  const handleToggle = (feature: string) => {
    onChange({
      ...featureFlags,
      [feature]: {
        ...featureFlags[feature],
        enabled: !featureFlags[feature].enabled
      }
    });
  };

  const handleRateChange = (feature: string, rate: string) => {
    const numRate = parseFloat(rate) || 0;
    onChange({
      ...featureFlags,
      [feature]: {
        ...featureFlags[feature],
        ratePerItem: numRate
      }
    });
  };

  return (
    <div className="space-y-3">
      {Object.entries(featureFlags).map(([feature, config]) => (
        <Card key={feature} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.enabled}
                  onCheckedChange={() => handleToggle(feature)}
                  disabled={disabled}
                />
                <Label className="font-medium">
                  {FEATURE_LABELS[feature] || feature}
                </Label>
              </div>
              <p className="text-sm text-gray-500 mt-1 ml-9">
                {FEATURE_DESCRIPTIONS[feature]}
              </p>
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
              <Label className="text-sm text-gray-600">Rate: $</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={config.ratePerItem}
                onChange={(e) => handleRateChange(feature, e.target.value)}
                disabled={disabled || !config.enabled}
                className="w-24"
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}