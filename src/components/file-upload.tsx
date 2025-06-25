
'use client';

import React from 'react';
import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FileUploadProps {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  id: string;
}

export function FileUpload({ value, onValueChange, label, id }: FileUploadProps) {
  // Use a unique id for the input field to avoid label conflicts
  const inputId = `${id}-input`;

  return (
    <div>
      <Label htmlFor={inputId}>{label}</Label>
      {value ? (
        <div className="mt-2 flex items-center justify-between p-2 pl-3 border rounded-md bg-muted/50">
          <div className="flex items-center gap-2 truncate">
            <FileText className="h-5 w-5 flex-shrink-0 text-primary" />
            <span className="truncate text-sm font-medium">{value}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:bg-destructive/10"
            onClick={() => onValueChange('')}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Remove file</span>
          </Button>
        </div>
      ) : (
        <div className="mt-2">
            <Input
              id={inputId}
              name="evidenceUrl"
              placeholder="Enter URL or filename for reference"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Actual file upload is not functional. Enter a reference URL or filename to simulate.
            </p>
        </div>
      )}
    </div>
  );
}
