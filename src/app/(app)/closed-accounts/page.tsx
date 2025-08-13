
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
import { Search, Filter, SchoolIcon, FileText, FileDown, Archive, Loader2, DollarSign, Percent, PieChart } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getClosedAccounts, type ClosedAccountWithDetails } from './actions';
import type { School } from '@/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClosedAccountsPage() {
  const [closedAccounts, setClosedAccounts] = useState<ClosedAccountWithDetails[]>([]);
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

  const getPaginationItems = () => {
    if (totalPages <= 1) return [];
    const delta = 1;
    const left = currentPage - delta;
    const right = currentPage + delta + 1;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= left && i < right)) {
            range.push(i);
        }
    }

    let l: number | undefined;
    for (const i of range) {
        if (l) {
            if (i - l === 2) {
                rangeWithDots.push(l + 1);
            } else if (i - l !== 1) {
                rangeWithDots.push('...');
            }
        }
        rangeWithDots.push(i);
        l = i;
    }

    return rangeWithDots;
  };
  
  const paginationItems = getPaginationItems();

  const handleExport = () => {
    if (filteredClosedAccounts.length === 0) return;
    const dataToExport = filteredClosedAccounts.map(member => ({
      'Member Name': member.fullName,
      'School': member.school?.name ?? 'N/A',
      'Account Number': member.savingsAccountNumber || 'N/A',
      'Closure Date': member.closureDate ? format(new Date(member.closureDate), 'PPP') : 'N/A',
      'Savings Payout (Birr)': member.finalSavingsPayout,
      'Interest Payout (Birr)': member.finalInterestPayout,
      'Shares Refunded (Birr)': member.finalSharesRefund,
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
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : paginatedAccounts.length > 0 ? (
        <Accordion type="single" collapsible className="w-full space-y-2">
            <div className="overflow-x-auto rounded-lg border shadow-sm">
                <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Member Name</TableHead>
                        <TableHead>School</TableHead>
                        <TableHead>Account Number</TableHead>
                        <TableHead>Closure Date</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {paginatedAccounts.map(member => (
                    <AccordionItem value={member.id} key={member.id} className="border-b-0">
                        <TableRow>
                            <TableCell className="p-0">
                                <AccordionTrigger className="p-4 [&[data-state=open]>svg]:text-primary"></AccordionTrigger>
                            </TableCell>
                            <TableCell className="font-medium">{member.fullName}</TableCell>
                            <TableCell>{member.school?.name ?? 'N/A'}</TableCell>
                            <TableCell>{member.savingsAccountNumber || 'N/A'}</TableCell>
                            <TableCell>
                                {member.closureDate ? format(new Date(member.closureDate), 'PPP') : 'N/A'}
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge variant="destructive">Closed</Badge>
                            </TableCell>
                        </TableRow>
                        <AccordionContent asChild>
                            <tr className="bg-muted/50 hover:bg-muted/50">
                                <td colSpan={6} className="p-0">
                                    <div className="p-6">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="font-headline text-lg">Final Statement Details</CardTitle>
                                                <CardDescription>A summary of the final payout transactions processed for this member upon account closure.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="flex items-start gap-4">
                                                    <div className="flex-shrink-0 bg-green-100 text-green-700 rounded-lg p-3">
                                                        <DollarSign className="h-6 w-6"/>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Savings Balance Payout</p>
                                                        <p className="text-xl font-bold">{member.finalSavingsPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-4">
                                                    <div className="flex-shrink-0 bg-yellow-100 text-yellow-700 rounded-lg p-3">
                                                        <Percent className="h-6 w-6"/>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Final Interest Paid</p>
                                                        <p className="text-xl font-bold">{member.finalInterestPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</p>
                                                    </div>
                                                </div>
                                                 <div className="flex items-start gap-4">
                                                    <div className="flex-shrink-0 bg-blue-100 text-blue-700 rounded-lg p-3">
                                                        <PieChart className="h-6 w-6"/>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Shares Refunded</p>
                                                        <p className="text-xl font-bold">{member.finalSharesRefund.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </td>
                            </tr>
                        </AccordionContent>
                    </AccordionItem>
                ))}
                </TableBody>
                </Table>
            </div>
        </Accordion>
      ) : (
        <div className="text-center py-16 text-muted-foreground">No closed accounts found.</div>
      )}

       {filteredClosedAccounts.length > 0 && (
        <div className="flex flex-col items-center gap-4 pt-4">
            <div className="flex items-center space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    Previous
                </Button>
                <div className="flex items-center gap-1">
                    {paginationItems.map((item, index) =>
                        typeof item === 'number' ? (
                            <Button
                                key={index}
                                variant={currentPage === item ? 'default' : 'outline'}
                                size="sm"
                                className="h-9 w-9 p-0"
                                onClick={() => setCurrentPage(item)}
                            >
                                {item}
                            </Button>
                        ) : (
                            <span key={index} className="px-2">
                                {item}
                            </span>
                        )
                    )}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                >
                    Next
                </Button>
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8 text-sm text-muted-foreground">
                <div>Page {currentPage} of {totalPages || 1}</div>
                <div>{filteredClosedAccounts.length} closed account(s) found.</div>
                <div className="flex items-center space-x-2">
                    <p className="font-medium">Rows:</p>
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
                            {[10, 15, 20, 25, 50].map((pageSize) => (
                                <SelectItem key={pageSize} value={`${pageSize}`}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

    