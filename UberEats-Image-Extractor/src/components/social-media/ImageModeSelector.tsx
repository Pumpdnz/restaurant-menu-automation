import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Image, Type, Sparkles } from 'lucide-react';

type ImageMode = 'uploaded' | 'text-to-image' | 'reference-images';

interface ImageModeSelectorProps {
  value: ImageMode;
  onChange: (mode: ImageMode) => void;
}

export function ImageModeSelector({ value, onChange }: ImageModeSelectorProps) {
  const modes = [
    {
      id: 'text-to-image' as ImageMode,
      title: 'Text → Image',
      description: 'Generate image from text description using AI',
      icon: Type,
      color: 'text-blue-500'
    },
    {
      id: 'reference-images' as ImageMode,
      title: 'Reference Images',
      description: 'Blend multiple images together or use a single image as a reference',
      icon: Sparkles,
      color: 'text-purple-500'
    },
    {
      id: 'uploaded' as ImageMode,
      title: 'Upload Image',
      description: 'Direct image upload (no AI generation)',
      icon: Image,
      color: 'text-gray-500'
    }
  ];

  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold">Generation Mode</Label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isSelected = value === mode.id;

          return (
            <Card
              key={mode.id}
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                isSelected
                  ? 'border-primary border-2 bg-primary/5'
                  : 'border-gray-200 hover:border-primary/50'
              }`}
              onClick={() => onChange(mode.id)}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <Icon className={`w-8 h-8 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <h3 className="font-semibold text-sm">{mode.title}</h3>
                <p className="text-xs text-muted-foreground">{mode.description}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
