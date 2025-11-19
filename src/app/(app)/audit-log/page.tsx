
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAuditLogs, type AuditLogWithActor } from './actions';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Search, Loader2, ListFilter, ChevronsRight, ChevronsLeft, ChevronRight, ChevronLeft } from 'lucide-react';
import { permissionsByGroup } from '../settings/permissions';

const auditActions = Object.values(permissionsByGroup).flat().map(p => p.id);

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogWithActor[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;
  
  const [filters, setFilters] = useState({
    actorName: '',
    action: '',
    targetId: ''
  });

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAuditLogs(currentPage, rowsPerPage, filters);
      setLogs(data.logs);
      setTotalCount(data.totalCount);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load audit logs.' });
    }
    setIsLoading(false);
  }, [currentPage, rowsPerPage, filters, toast]);
  
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({...prev, [key]: value}));
    setCurrentPage(1); // Reset to first page on filter change
  };
  
  const totalPages = Math.ceil(totalCount / rowsPerPage);

  const getActorName = (log: AuditLogWithActor) => {
    if (log.actorType === 'ADMIN' && log.user) {
      return `${log.user.name ?? log.actorName} (Admin)`;
    }
    if (log.actorType === 'MEMBER' && log.member) {
      return `${log.member.fullName ?? log.actorName} (Member)`;
    }
    return log.actorName || 'System';
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Audit Log" subtitle="Track all significant actions performed within the system." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Filter by actor name..." 
                value={filters.actorName} 
                onChange={e => handleFilterChange('actorName', e.target.value)}
                className="pl-9"
            />
        </div>
        <Select value={filters.action} onValueChange={(val) => handleFilterChange('action', val)}>
            <SelectTrigger>
                <SelectValue placeholder="Filter by action..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="">All Actions</SelectItem>
                {auditActions.map(action => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
            </SelectContent>
        </Select>
        <div className="relative">
             <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Filter by Target ID..."
                value={filters.targetId} 
                onChange={e => handleFilterChange('targetId', e.target.value)}
                className="pl-9"
            />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : logs.length > 0 ? (
              logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{getActorName(log)}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <div>{log.targetType}</div>
                    <div className="text-muted-foreground">{log.targetId}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <pre className="whitespace-pre-wrap font-sans bg-muted/50 p-2 rounded-md">
                      {log.details ? JSON.stringify(log.details, null, 2) : 'N/A'}
                    </pre>
                  </TableCell>
                   <TableCell className="text-muted-foreground text-xs">
                       {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                    </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No audit logs found for the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

       {totalPages > 1 && (
        <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
            <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}><ChevronsLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}><ChevronsRight className="h-4 w-4" /></Button>
            </div>
        </div>
      )}

    </div>
  );
}
