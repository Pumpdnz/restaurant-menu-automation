import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface VideoPromptInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  helperText?: string;
  required?: boolean;
  rows?: number;
  maxLength?: number;
}

export function VideoPromptInput({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  required = false,
  rows = 4,
  maxLength = 500,
}: VideoPromptInputProps) {
  const charCount = value.length;

  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="resize-none"
      />
      <div className="flex justify-between text-sm">
        {helperText && <span className="text-muted-foreground">{helperText}</span>}
        <span className={`ml-auto ${charCount > maxLength * 0.9 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {charCount}/{maxLength}
        </span>
      </div>
    </div>
  );
}
