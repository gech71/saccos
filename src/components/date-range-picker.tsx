
'use client';

import React, { useState, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { format, isValid, parse } from 'date-fns';
import { Calendar as CalendarIcon, AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  className?: string;
  disabled?: boolean;
}

const years = Array.from({ length: new Date().getFullYear() - 1989 }, (_, i) => new Date().getFullYear() - i);
const months = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"
];

export function DateRangePicker({
  dateRange,
  onDateChange,
  className,
  disabled,
}: DateRangePickerProps) {
  const [startInputValue, setStartInputValue] = useState('');
  const [endInputValue, setEndInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dateRange?.from && isValid(dateRange.from)) {
      setStartInputValue(format(dateRange.from, 'yyyy-MM-dd'));
    } else {
      setStartInputValue('');
    }
    if (dateRange?.to && isValid(dateRange.to)) {
      setEndInputValue(format(dateRange.to, 'yyyy-MM-dd'));
    } else {
      setEndInputValue('');
    }
  }, [dateRange]);

  const handleDateSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to && range.from > range.to) {
        setError("Start date cannot be after end date.");
    } else {
        setError(null);
    }
    onDateChange(range);
  };
  
  const handleInputChange = (field: 'from' | 'to', value: string) => {
    if (field === 'from') {
      setStartInputValue(value);
    } else {
      setEndInputValue(value);
    }

    const newDate = parse(value, 'yyyy-MM-dd', new Date());
    if (isValid(newDate)) {
      const newRange = { ...dateRange, [field]: newDate };
       if (newRange.from && newRange.to && newRange.from > newRange.to) {
            setError("Start date cannot be after end date.");
        } else {
            setError(null);
        }
      onDateChange(newRange);
    }
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Start Date */}
        <div className="space-y-2">
            <Label htmlFor="start-date" className="font-normal">Start Date</Label>
            <Popover>
            <PopoverTrigger asChild>
                <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="start-date"
                        value={startInputValue}
                        onChange={(e) => handleInputChange('from', e.target.value)}
                        className="pl-10"
                        placeholder="YYYY-MM-DD"
                        disabled={disabled}
                    />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    initialFocus
                    mode="single"
                    selected={dateRange?.from}
                    onSelect={(date) => handleDateSelect({ ...dateRange, from: date })}
                    disabled={disabled}
                    captionLayout="dropdown-buttons"
                    fromYear={1990}
                    toYear={new Date().getFullYear()}
                />
            </PopoverContent>
            </Popover>
        </div>

        {/* End Date */}
         <div className="space-y-2">
            <Label htmlFor="end-date" className="font-normal">End Date</Label>
            <Popover>
            <PopoverTrigger asChild>
                <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="end-date"
                        value={endInputValue}
                        onChange={(e) => handleInputChange('to', e.target.value)}
                        className="pl-10"
                        placeholder="YYYY-MM-DD"
                        disabled={disabled}
                    />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                 <Calendar
                    initialFocus
                    mode="single"
                    selected={dateRange?.to}
                    onSelect={(date) => handleDateSelect({ ...dateRange, to: date })}
                    disabled={(date) => disabled || (dateRange?.from ? date < dateRange.from : false)}
                    captionLayout="dropdown-buttons"
                    fromYear={1990}
                    toYear={new Date().getFullYear()}
                />
            </PopoverContent>
            </Popover>
        </div>
      </div>
      {error && (
        <div className="flex items-center text-sm text-destructive mt-2">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}
    </div>
  );
}
