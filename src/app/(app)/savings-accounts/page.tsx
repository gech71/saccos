
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
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
import type { School } from '@prisma/client';
import { Search, Filter, SchoolIcon, DollarSign as DollarSignIcon, Users, TrendingUp, FileDown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle as ShadcnCardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { exportToExcel } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getSavingsAccountPageData, type SavingsAccountSummary } from './actions';

export default function SavingsAccountsPage() {
  const [accountSummaries, setAccountSummaries] = useState<SavingsAccountSummary[]>([]);
  const [allSchools, setAllSchools] = useState<Pick<School, 'id', 'name'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    async function fetchData() {
        setIsLoading(true);
        const data = await getSavingsAccountPageData();
        setAccountSummaries(data.summaries);
        setAllSchools(data.schools);
        setIsLoading(false);
    }
    fetchData();
  }, []);


  const filteredSummaries = useMemo(() => {
    return accountSummaries.filter(summary => {
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearchTerm = summary.fullName.toLowerCase().includes(searchTermLower) ||
                                summary.memberId.toLowerCase().includes(searchTermLower);
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || summary.schoolId === selectedSchoolFilter;
      return matchesSearchTerm && matchesSchoolFilter;
    });
  }, [accountSummaries, searchTerm, selectedSchoolFilter]);

  const paginatedSummaries = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredSummaries.slice(startIndex, endIndex);
  }, [filteredSummaries, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredSummaries.length / rowsPerPage);
  }, [filteredSummaries.length, rowsPerPage]);

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

  const globalSummaryStats = useMemo(() => {
    const totalSavingsGlobal = filteredSummaries.reduce((sum, m) => sum + m.savingsBalance, 0);
    const averageSavings = filteredSummaries.length > 0 ? totalSavingsGlobal / filteredSummaries.length : 0;
    return { totalSavingsGlobal, averageSavings, accountCount: filteredSummaries.length };
  }, [filteredSummaries]);

  const handleExport = () => {
    const dataToExport = filteredSummaries.map(summary => ({
      'Member Name': summary.fullName,
      'School': summary.schoolName,
      'Account Number': summary.savingsAccountNumber || 'N/A',
      'Account Type': summary.savingAccountTypeName || 'N/A',
      'Current Balance (Birr)': summary.savingsBalance.toFixed(2),
      'Contribution Fulfillment (%)': summary.fulfillmentPercentage.toFixed(1),
    }));
    exportToExcel(dataToExport, 'savings_accounts_summary_export');
  };
  
  if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Savings Accounts Summary" subtitle="View member savings balances and contribution fulfillment for each account.">
        <Button onClick={handleExport} variant="outline" disabled={filteredSummaries.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Export
        </Button>
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Savings Balance (in view)</ShadcnCardTitle>
                <DollarSignIcon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">{globalSummaryStats.totalSavingsGlobal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</div></CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Average Savings Balance (in view)</ShadcnCardTitle>
                <TrendingUp className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">{globalSummaryStats.averageSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</div></CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Active Accounts (in view)</ShadcnCardTitle>
                <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">{globalSummaryStats.accountCount}</div></CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by member name or ID..."
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
              <TableHead>Member ID</TableHead>
              <TableHead>Member Name</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Account Number</TableHead>
              <TableHead>Account Type</TableHead>
              <TableHead className="text-right">Current Balance (Birr)</TableHead>
              <TableHead className="text-center w-[200px]">Contribution Fulfillment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSummaries.length > 0 ? paginatedSummaries.map(summary => (
              <TableRow key={`${summary.memberId}-${summary.savingsAccountNumber}`}>
                <TableCell className="font-mono text-xs">{summary.memberId}</TableCell>
                <TableCell className="font-medium">{summary.fullName}</TableCell>
                <TableCell>{summary.schoolName}</TableCell>
                <TableCell>{summary.savingsAccountNumber || 'N/A'}</TableCell>
                <TableCell>{summary.savingAccountTypeName || 'N/A'}</TableCell>
                <TableCell className="text-right font-semibold text-green-600">{summary.savingsBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                <TableCell className="text-center">
                    {summary.expectedMonthlySaving > 0 ? (
                      <div className="flex flex-col items-center">
                        <Progress value={Math.min(100, summary.fulfillmentPercentage)} className="h-2 w-full" />
                        <span className="text-xs mt-1">{Math.min(100, summary.fulfillmentPercentage).toFixed(1)}%</span>
                      </div>
                    ) : (
                        <span className="text-muted-foreground text-xs">N/A (No exp. contrib.)</span>
                    )}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No member savings accounts found matching your criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

       {filteredSummaries.length > 0 && (
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
                <div>{filteredSummaries.length} account(s) found.</div>
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
