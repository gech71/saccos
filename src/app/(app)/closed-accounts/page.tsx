
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockMembers, mockSchools } from '@/data/mock';
import type { Member, School } from '@/types';
import { Search, Filter, SchoolIcon, FileText, FileDown, Archive } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { exportToExcel } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// Helper function to load data from localStorage or fall back to mock data
const loadFromLocalStorage = <T,>(key: string, mockData: T[]): T[] => {
    if (typeof window === 'undefined') return mockData;
    try {
        const item = window.localStorage.getItem(key);
        return item ? (JSON.parse(item) as T[]) : mockData;
    } catch (error) {
        console.error(`Error reading ${key} from localStorage`, error);
        return mockData;
    }
};

export default function ClosedAccountsPage() {
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [allSchools] = useState<School[]>(mockSchools);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');

  useEffect(() => {
    setAllMembers(loadFromLocalStorage('members', mockMembers));
  }, []);

  const closedAccounts = useMemo(() => {
    return allMembers.filter(member => member.status === 'inactive');
  }, [allMembers]);

  const filteredClosedAccounts = useMemo(() => {
    return closedAccounts.filter(member => {
      const matchesSearchTerm = member.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || member.schoolId === selectedSchoolFilter;
      return matchesSearchTerm && matchesSchoolFilter;
    });
  }, [closedAccounts, searchTerm, selectedSchoolFilter]);

  const handleExport = () => {
    const dataToExport = filteredClosedAccounts.map(member => ({
      'Member Name': member.fullName,
      'School': member.schoolName || allSchools.find(s => s.id === member.schoolId)?.name,
      'Account Number': member.savingsAccountNumber || 'N/A',
      'Closure Date': member.closureDate ? format(new Date(member.closureDate), 'PPP') : 'N/A',
    }));
    exportToExcel(dataToExport, 'closed_accounts_export');
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Closed Accounts" subtitle="View a list of all closed member accounts.">
         <Button onClick={handleExport} variant="outline">
            <FileDown className="mr-2 h-4 w-4" /> Export List
        </Button>
      </PageTitle>

       <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by member name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
            aria-label="Search members"
          />
        </div>
        <Select value={selectedSchoolFilter} onValueChange={setSelectedSchoolFilter}>
          <SelectTrigger className="w-full sm:w-[220px]" aria-label="Filter by school">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground md:hidden" />
            <SchoolIcon className="mr-2 h-4 w-4 text-muted-foreground hidden md:inline" />
            <SelectValue placeholder="Filter by school" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {allSchools.map(school => (
              <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member Name</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Account Number</TableHead>
              <TableHead>Closure Date</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center w-[200px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClosedAccounts.length > 0 ? filteredClosedAccounts.map(member => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.fullName}</TableCell>
                <TableCell>{member.schoolName || allSchools.find(s => s.id === member.schoolId)?.name}</TableCell>
                <TableCell>{member.savingsAccountNumber || 'N/A'}</TableCell>
                <TableCell>
                    {member.closureDate ? format(new Date(member.closureDate), 'PPP') : 'N/A'}
                </TableCell>
                <TableCell className="text-center">
                    <Badge variant="destructive">Closed</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/account-statement?memberId=${member.id}`}>
                      <FileText className="mr-2 h-4 w-4" />
                      View Final Statement
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No closed accounts found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
