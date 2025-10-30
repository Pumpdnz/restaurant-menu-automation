import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { VideoMode } from '@/hooks/useSocialMedia';
import { Image, Wand2, Type } from 'lucide-react';

interface ModeSelectorProps {
  value: VideoMode;
  onChange: (mode: VideoMode) => void;
}

interface ModeOption {
  id: VideoMode;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const modes: ModeOption[] = [
  {
    id: 'text-to-video',
    title: 'Text → Video',
    description: 'Generate video entirely from text description',
    icon: Type,
  },
  {
    id: 'image-to-video',
    title: 'Database Image → Video',
    description: 'Use an existing menu image as the first frame',
    icon: Image,
  },
  {
    id: 'generated-image-to-video',
    title: 'AI Image → Video',
    description: 'Generate an image with AI, then animate it',
    icon: Wand2,
  },
];

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold">Generation Mode</Label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modes.map((mode) => {
          const Icon = mode.icon;
          return (
            <Card
              key={mode.id}
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                value === mode.id
                  ? 'border-primary border-2 bg-primary/5'
                  : 'border-gray-200 hover:border-primary/50'
              }`}
              onClick={() => onChange(mode.id)}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <Icon className={`w-8 h-8 ${value === mode.id ? 'text-primary' : 'text-muted-foreground'}`} />
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
