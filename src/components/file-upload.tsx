
'use client';

import React from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
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
      <Label>{label}</Label>
      {value ? (
        <div className="mt-2 flex items-center justify-between p-3 border rounded-md bg-muted/50">
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
        <>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md border-border hover:border-primary transition-colors">
            <div className="space-y-1 text-center">
              <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
              <div className="flex text-sm text-muted-foreground">
                <p className="pl-1">Upload a file or drag and drop</p>
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG, PDF up to 10MB (mock)</p>
            </div>
          </div>
          <Input
            id={inputId}
            name="evidenceUrl"
            placeholder="Enter URL or filename for reference"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Actual file upload is not functional. Enter a reference URL or filename above to simulate an attachment.
          </p>
        </>
      )}
    </div>
  );
}
