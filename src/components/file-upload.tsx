'use client';
import React, { useRef, useState } from 'react';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';

interface FileUploadProps {
  id: string;
  label: string;
  value: string;
  onValueChange: (url: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ id, label, value, onValueChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) onValueChange(data.url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">{label}</label>
      <input ref={inputRef} type="file" id={id} className="hidden" onChange={handleChange} />
      <Button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}>
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload File'}
      </Button>
      {value && <p className="text-sm truncate">{value}</p>}
    </div>
  );
};
