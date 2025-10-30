import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { InfoIcon } from 'lucide-react';

interface ImageModelSelectorProps {
  // Gemini model is fixed, this is just informational
}

export function ImageModelSelector({}: ImageModelSelectorProps) {
  return (
    <Card className="p-4 bg-blue-50/50 border-blue-200">
      <div className="flex items-start gap-3">
        <InfoIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <Label className="text-blue-900 font-semibold">AI Model</Label>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-900">Google Gemini 2.5 Flash Image</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                "Nano Banana"
              </span>
            </div>
            <div className="text-xs text-blue-700 space-y-0.5">
              <div className="flex justify-between">
                <span>Cost:</span>
                <span className="font-medium">~$0.04 per image</span>
              </div>
              <div className="flex justify-between">
                <span>Speed:</span>
                <span className="font-medium">10-30 seconds</span>
              </div>
              <div className="flex justify-between">
                <span>Quality:</span>
                <span className="font-medium">High quality, professional</span>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2 pt-2 border-t border-blue-200">
              All generated images include SynthID watermark (invisible, AI-detection only)
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
