
'use client';

import React, {useRef, useState} from 'react';
import {FileText, X, UploadCloud, Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Label} from '@/components/ui/label';
import {useToast} from '@/hooks/use-toast';

interface FileUploadProps {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  id: string;
}

const ACCEPTED_FILE_TYPES = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/jfif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";


export function FileUpload({value, onValueChange, label, id}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {toast} = useToast();

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (result.success) {
          onValueChange(result.url);
          toast({
            title: 'Upload Successful',
            description: `${file.name} has been uploaded.`,
          });
        } else {
          throw new Error(result.error || 'File upload failed.');
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred.',
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {value ? (
        <div className="mt-2 flex items-center justify-between p-2 pl-3 border rounded-md bg-muted/50">
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 truncate hover:underline"
          >
            <FileText className="h-5 w-5 flex-shrink-0 text-primary" />
            <span className="truncate text-sm font-medium">
              Document Attached
            </span>
          </a>
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
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            id={id}
            accept={ACCEPTED_FILE_TYPES}
            disabled={isLoading}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleAttachClick}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-4 w-4" />
                Attach File
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            Attach a document (PDF, DOC, image).
          </p>
        </div>
      )}
    </div>
  );
}
