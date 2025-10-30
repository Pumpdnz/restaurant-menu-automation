import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Monitor, Smartphone, Square, Film } from 'lucide-react';

interface ImageConfigFormProps {
  config: {
    aspectRatio: string;
  };
  onChange: (config: { aspectRatio: string }) => void;
}

export function ImageConfigForm({ config, onChange }: ImageConfigFormProps) {
  const aspectRatios = [
    // Landscape options
    {
      value: '16:9',
      label: '16:9 Landscape',
      description: 'Widescreen format',
      orientation: 'landscape',
      icon: Monitor,
      useCase: 'YouTube, Facebook, horizontal Sora videos'
    },
    {
      value: '4:3',
      label: '4:3 Landscape',
      description: 'Classic format',
      orientation: 'landscape',
      icon: Film,
      useCase: 'Traditional photos, presentations'
    },
    // Square
    {
      value: '1:1',
      label: '1:1 Square',
      description: 'Square format',
      orientation: 'square',
      icon: Square,
      useCase: 'Instagram posts, profile pictures'
    },
    // Portrait options
    {
      value: '9:16',
      label: '9:16 Portrait',
      description: 'Vertical format',
      orientation: 'portrait',
      icon: Smartphone,
      useCase: 'Stories, Reels, TikTok, vertical Sora videos'
    },
    {
      value: '3:4',
      label: '3:4 Portrait',
      description: 'Classic portrait',
      orientation: 'portrait',
      icon: Smartphone,
      useCase: 'Portrait photos, vertical content'
    }
  ];

  const handleRatioChange = (aspectRatio: string) => {
    onChange({ aspectRatio });
  };

  const selectedRatio = aspectRatios.find(r => r.value === config.aspectRatio);
  const isLandscape = selectedRatio?.orientation === 'landscape';
  const isPortrait = selectedRatio?.orientation === 'portrait';
  const isSquare = selectedRatio?.orientation === 'square';

  return (
    <Card className="p-6 space-y-6">
      {/* Aspect Ratio Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Image Format</Label>

        {/* Orientation tabs */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
              isLandscape
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            onClick={() => handleRatioChange('16:9')}
          >
            <Monitor className="w-5 h-5 mx-auto mb-1" />
            <div className="text-sm font-medium">Landscape</div>
            <div className="text-xs">Horizontal</div>
          </button>

          <button
            type="button"
            className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
              isSquare
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            onClick={() => handleRatioChange('1:1')}
          >
            <Square className="w-5 h-5 mx-auto mb-1" />
            <div className="text-sm font-medium">Square</div>
            <div className="text-xs">Instagram</div>
          </button>

          <button
            type="button"
            className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
              isPortrait
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            onClick={() => handleRatioChange('9:16')}
          >
            <Smartphone className="w-5 h-5 mx-auto mb-1" />
            <div className="text-sm font-medium">Portrait</div>
            <div className="text-xs">Vertical</div>
          </button>
        </div>

        {/* Aspect ratio options for selected orientation */}
        <RadioGroup value={config.aspectRatio} onValueChange={handleRatioChange}>
          <div className="grid grid-cols-1 gap-3">
            {aspectRatios
              .filter(ratio => {
                if (isLandscape) return ratio.orientation === 'landscape';
                if (isSquare) return ratio.orientation === 'square';
                if (isPortrait) return ratio.orientation === 'portrait';
                return false;
              })
              .map((ratio) => {
                const Icon = ratio.icon;
                return (
                  <label
                    key={ratio.value}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      config.aspectRatio === ratio.value
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <RadioGroupItem value={ratio.value} id={ratio.value} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold">{ratio.label}</span>
                      </div>
                      <div className="text-sm text-gray-600">{ratio.description}</div>
                      <div className="text-xs text-gray-500 mt-1">{ratio.useCase}</div>
                    </div>
                  </label>
                );
              })}
          </div>
        </RadioGroup>
      </div>

      {/* Preview visualization */}
      <div className="space-y-2">
        <Label className="text-sm text-gray-600">Preview</Label>
        <div className="flex justify-center p-6 bg-gray-50 rounded-lg">
          {isLandscape && (
            <div className="w-64 h-36 border-2 border-dashed border-gray-300 bg-white flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-sm font-medium">{selectedRatio?.label}</div>
                <div className="text-xs mt-1">{selectedRatio?.description}</div>
              </div>
            </div>
          )}
          {isSquare && (
            <div className="w-48 h-48 border-2 border-dashed border-gray-300 bg-white flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-sm font-medium">{selectedRatio?.label}</div>
                <div className="text-xs mt-1">{selectedRatio?.description}</div>
              </div>
            </div>
          )}
          {isPortrait && (
            <div className="w-36 h-64 border-2 border-dashed border-gray-300 bg-white flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-sm font-medium">{selectedRatio?.label}</div>
                <div className="text-xs mt-1 px-2">{selectedRatio?.description}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
