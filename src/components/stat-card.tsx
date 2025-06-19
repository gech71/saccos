import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  className?: string;
  valueClassName?: string;
}

export function StatCard({ title, value, icon, description, className, valueClassName }: StatCardProps) {
  return (
    <Card className={cn("shadow-lg hover:shadow-xl transition-shadow duration-300", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold text-primary", valueClassName)}>{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}
