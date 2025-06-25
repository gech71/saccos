'use client';

import React from 'react';
import { FileText, X, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface FileUploadProps {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  id: string;
}

export function FileUpload({ value, onValueChange, label, id }: FileUploadProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
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
            <Button id={id} type="button" variant="outline" className="w-full" onClick={() => onValueChange('simulated_evidence.pdf')}>
                <UploadCloud className="mr-2 h-4 w-4" />
                Attach File (Simulated)
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              File uploads are simulated. Clicking will attach a placeholder document.
            </p>
        </div>
      )}
    </div>
  );
}
