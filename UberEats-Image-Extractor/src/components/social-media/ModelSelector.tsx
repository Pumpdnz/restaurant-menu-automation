import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SoraModel } from '@/hooks/useSocialMedia';
import { Zap, Sparkles } from 'lucide-react';

interface ModelSelectorProps {
  value: SoraModel;
  onChange: (model: SoraModel) => void;
}

interface ModelOption {
  id: SoraModel;
  name: string;
  speed: string;
  quality: string;
  cost: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  recommended?: boolean;
}

const models: ModelOption[] = [
  {
    id: 'sora-2',
    name: 'Sora 2',
    speed: 'Fast',
    quality: 'Good',
    cost: '$0.40-0.60 per video',
    description: 'Recommended for most use cases. Generates videos in 2-5 minutes.',
    icon: Zap,
    recommended: true,
  },
  {
    id: 'sora-2-pro',
    name: 'Sora 2 Pro',
    speed: 'Slow',
    quality: 'Excellent',
    cost: '$0.80-1.20 per video',
    description: 'Best quality for professional content. Takes 5-15 minutes.',
    icon: Sparkles,
    recommended: false,
  },
];

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">AI Model</Label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map((model) => {
          const Icon = model.icon;
          return (
            <Card
              key={model.id}
              className={`p-4 cursor-pointer transition-all hover:shadow-md relative ${
                value === model.id
                  ? 'border-primary border-2 bg-primary/5'
                  : 'border-gray-200 hover:border-primary/50'
              }`}
              onClick={() => onChange(model.id)}
            >
              {model.recommended && (
                <Badge className="absolute -top-2 -right-2" variant="default">
                  Recommended
                </Badge>
              )}
              <div className="flex items-start gap-3">
                <Icon className={`w-6 h-6 mt-1 ${value === model.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold">{model.name}</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Speed:</span>
                      <span className="font-medium">{model.speed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quality:</span>
                      <span className="font-medium">{model.quality}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost:</span>
                      <span className="font-medium text-xs">{model.cost}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{model.description}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
