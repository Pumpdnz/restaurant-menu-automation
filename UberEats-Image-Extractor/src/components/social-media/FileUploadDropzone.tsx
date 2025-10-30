import React, { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface FileUploadDropzoneProps {
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  accept?: string;
}

export function FileUploadDropzone({
  files,
  onChange,
  multiple = true,
  maxFiles = 10,
  accept = 'image/*',
}: FileUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      const imageFiles = droppedFiles.filter((file) => file.type.startsWith('image/'));

      if (imageFiles.length === 0) {
        return;
      }

      if (multiple) {
        const newFiles = [...files, ...imageFiles].slice(0, maxFiles);
        onChange(newFiles);
      } else {
        onChange([imageFiles[0]]);
      }
    },
    [files, multiple, maxFiles, onChange]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files ? Array.from(e.target.files) : [];

      if (selectedFiles.length === 0) return;

      if (multiple) {
        const newFiles = [...files, ...selectedFiles].slice(0, maxFiles);
        onChange(newFiles);
      } else {
        onChange([selectedFiles[0]]);
      }

      // Reset input
      e.target.value = '';
    },
    [files, multiple, maxFiles, onChange]
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      const newFiles = files.filter((_, i) => i !== index);
      onChange(newFiles);
    },
    [files, onChange]
  );

  return (
    <Card className="p-6 space-y-4">
      <Label>Upload Image{multiple ? 's' : ''}</Label>

      {/* Dropzone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          isDragging
            ? 'border-primary bg-primary/10 scale-[1.02]'
            : 'border-gray-300 hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload
          className={`w-12 h-12 mx-auto mb-4 transition-colors ${
            isDragging ? 'text-primary' : 'text-muted-foreground'
          }`}
        />

        <div className="space-y-2">
          <p className="text-sm font-medium">
            {isDragging ? 'Drop files here' : 'Drag and drop images here'}
          </p>
          <p className="text-xs text-muted-foreground">or</p>

          <input
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload-input"
            multiple={multiple}
          />
          <label htmlFor="file-upload-input">
            <Button
              variant="secondary"
              type="button"
              onClick={() => document.getElementById('file-upload-input')?.click()}
            >
              Choose File{multiple ? 's' : ''}
            </Button>
          </label>

          {multiple && (
            <p className="text-xs text-muted-foreground mt-2">
              Upload up to {maxFiles} images at once
            </p>
          )}
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm">Selected Files ({files.length})</Label>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <ImageIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFile(index)}
                  className="flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
