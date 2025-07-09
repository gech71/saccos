
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { School } from '@prisma/client';
import { Search, Filter, AlertTriangle, SchoolIcon, Loader2, FileDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle as ShadcnCardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { getOverdueLoansPageData, type OverdueLoanInfo } from './actions';
import { exportToExcel } from '@/lib/utils';

export default function OverdueLoansPage() {
    const [overdueLoans, setOverdueLoans] = useState<OverdueLoanInfo[]>([]);
    const [schools, setSchools] = useState<Pick<School, 'id', 'name'>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            const data = await getOverdueLoansPageData();
            setOverdueLoans(data.overdueLoans);
            setSchools(data.schools);
            setIsLoading(false);
        }
        fetchData();
    }, []);

    const filteredOverdueLoans = useMemo(() => {
        return overdueLoans.filter(loan => {
            const matchesSearchTerm = loan.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
            return matchesSearchTerm;
        });
    }, [overdueLoans, searchTerm]);
    
    const paginatedOverdueLoans = useMemo(() => {
      const startIndex = (currentPage - 1) * rowsPerPage;
      const endIndex = startIndex + rowsPerPage;
      return filteredOverdueLoans.slice(startIndex, endIndex);
    }, [filteredOverdueLoans, currentPage, rowsPerPage]);

    const totalPages = useMemo(() => {
      return Math.ceil(filteredOverdueLoans.length / rowsPerPage);
    }, [filteredOverdueLoans.length, rowsPerPage]);

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

    const totalOverdueAmount = useMemo(() => {
        return filteredOverdueLoans.reduce((sum, loan) => sum + loan.remainingBalance, 0);
    }, [filteredOverdueLoans]);
    
    const handleExport = () => {
      if (filteredOverdueLoans.length === 0) return;
      const dataToExport = filteredOverdueLoans.map(loan => ({
        'Member Name': loan.memberName,
        'Loan Acct. #': loan.loanAccountNumber || 'N/A',
        'Loan Type': loan.loanTypeName || 'N/A',
        'Remaining Balance (Birr)': loan.remainingBalance,
        'Next Due Date': loan.nextDueDate ? new Date(loan.nextDueDate).toLocaleDateString() : 'N/A',
        'Days Overdue': loan.daysOverdue,
      }));
      exportToExcel(dataToExport, 'overdue_loans_export');
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <PageTitle title="Overdue Loans" subtitle="Monitor and manage loans with missed payment deadlines.">
                <Button onClick={handleExport} variant="outline" disabled={filteredOverdueLoans.length === 0}>
                    <FileDown className="mr-2 h-4 w-4" /> Export
                </Button>
            </PageTitle>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Card className="shadow-md border-destructive">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Overdue Loans</ShadcnCardTitle>
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold text-destructive">{filteredOverdueLoans.length}</div></CardContent>
                </Card>
                <Card className="shadow-md border-destructive">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Overdue Balance</ShadcnCardTitle>
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                    </CardHeader>
                    <CardContent><div className="text-2xl font-bold text-destructive">{totalOverdueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</div></CardContent>
                </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input type="search" placeholder="Search by member name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full" />
                </div>
                {/* School filter functionality would require a more complex backend query joining through members to schools */}
                <Select value={selectedSchoolFilter} onValueChange={setSelectedSchoolFilter} disabled>
                    <SelectTrigger className="w-full sm:w-[220px]">
                        <Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Filter by school" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Schools</SelectItem>
                        {schools.map(school => <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div className="overflow-x-auto rounded-lg border shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Member</TableHead>
                            <TableHead>Loan Acct. #</TableHead>
                            <TableHead>Loan Type</TableHead>
                            <TableHead className="text-right">Remaining Balance (Birr)</TableHead>
                            <TableHead>Next Due Date</TableHead>
                            <TableHead className="text-center text-destructive">Days Overdue</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedOverdueLoans.length > 0 ? paginatedOverdueLoans.map(loan => (
                            <TableRow key={loan.id} className="bg-destructive/5">
                                <TableCell className="font-medium">{loan.memberName}</TableCell>
                                <TableCell className="font-mono text-xs">{loan.loanAccountNumber}</TableCell>
                                <TableCell>{loan.loanTypeName}</TableCell>
                                <TableCell className="text-right font-semibold">{loan.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                                <TableCell>{loan.nextDueDate ? new Date(loan.nextDueDate).toLocaleDateString() : 'N/A'}</TableCell>
                                <TableCell className="text-center font-bold text-destructive">{loan.daysOverdue}</TableCell>
                                <TableCell className="text-center">
                                    <Button asChild variant="outline" size="sm" className="border-primary text-primary">
                                        <Link href="/loan-repayments">Record Payment</Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center">No overdue loans found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            
            {filteredOverdueLoans.length > 0 && (
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
                      <div>{filteredOverdueLoans.length} overdue loan(s) found.</div>
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
