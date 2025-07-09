
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
import { Search, Filter, SchoolIcon, FileText, FileDown, Archive, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { exportToExcel } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getClosedAccounts, type ClosedAccountWithSchool } from './actions';
import type { School } from '@/types';

export default function ClosedAccountsPage() {
  const [closedAccounts, setClosedAccounts] = useState<ClosedAccountWithSchool[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    async function fetchData() {
        setIsLoading(true);
        const accounts = await getClosedAccounts();
        setClosedAccounts(accounts);
        
        // Extract unique schools from the accounts for filtering
        const schoolsFromAccounts = accounts.reduce((acc, curr) => {
            if (curr.school && !acc.find(s => s.id === curr.schoolId)) {
                acc.push(curr.school);
            }
            return acc;
        }, [] as School[]);
        setAllSchools(schoolsFromAccounts);
        setIsLoading(false);
    }
    fetchData();
  }, []);


  const filteredClosedAccounts = useMemo(() => {
    return closedAccounts.filter(member => {
      const matchesSearchTerm = member.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || member.schoolId === selectedSchoolFilter;
      return matchesSearchTerm && matchesSchoolFilter;
    });
  }, [closedAccounts, searchTerm, selectedSchoolFilter]);
  
  const paginatedAccounts = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredClosedAccounts.slice(startIndex, endIndex);
  }, [filteredClosedAccounts, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredClosedAccounts.length / rowsPerPage);
  }, [filteredClosedAccounts.length, rowsPerPage]);

  const handleExport = () => {
    if (filteredClosedAccounts.length === 0) return;
    const dataToExport = filteredClosedAccounts.map(member => ({
      'Member Name': member.fullName,
      'School': member.school?.name ?? 'N/A',
      'Account Number': member.savingsAccountNumber || 'N/A',
      'Closure Date': member.closureDate ? format(new Date(member.closureDate), 'PPP') : 'N/A',
    }));
    exportToExcel(dataToExport, 'closed_accounts_export');
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Closed Accounts" subtitle="View a list of all closed member accounts.">
         <Button onClick={handleExport} variant="outline" disabled={filteredClosedAccounts.length === 0}>
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
            {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : paginatedAccounts.length > 0 ? paginatedAccounts.map(member => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.fullName}</TableCell>
                <TableCell>{member.school?.name ?? 'N/A'}</TableCell>
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

       {filteredClosedAccounts.length > 0 && (
        <div className="flex flex-col items-center gap-2 pt-4">
          <div className="flex items-center space-x-6 lg:space-x-8">
              <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium">Rows per page</p>
                  <Select
                      value={`${rowsPerPage}`}
                      onValueChange={(value) => {
                          setRowsPerPage(Number(value));
                          setCurrentPage(1);
                      }}
                  >
                      <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={`${rowsPerPage}`} />
                      </SelectTrigger>
                      <SelectContent side="top">
                          {[10, 15, 20, 25].map((pageSize) => (
                              <SelectItem key={pageSize} value={`${pageSize}`}>
                                  {pageSize}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
              <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                  Page {currentPage} of {totalPages || 1}
              </div>
              <div className="flex items-center space-x-2">
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                  >
                      Previous
                  </Button>
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                  >
                      Next
                  </Button>
              </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredClosedAccounts.length} closed account(s) found.
          </div>
        </div>
      )}
    </div>
  );
}
