
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
import { getSavingsAccountPageData, type MemberSavingsSummary } from './actions';
import { useAuth } from '@/contexts/auth-context';

export default function SavingsAccountsPage() {
  const [memberSummaries, setMemberSummaries] = useState<MemberSavingsSummary[]>([]);
  const [allSchools, setAllSchools] = useState<Pick<School, 'id', 'name'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      async function fetchData() {
          setIsLoading(true);
          const data = await getSavingsAccountPageData(user);
          setMemberSummaries(data.summaries);
          setAllSchools(data.schools);
          setIsLoading(false);
      }
      fetchData();
    }
  }, [user]);


  const filteredMemberSummaries = useMemo(() => {
    return memberSummaries.filter(summary => {
      const matchesSearchTerm = summary.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || summary.schoolId === selectedSchoolFilter;
      return matchesSearchTerm && matchesSchoolFilter;
    });
  }, [memberSummaries, searchTerm, selectedSchoolFilter]);

  const globalSummaryStats = useMemo(() => {
    const totalSavingsGlobal = filteredMemberSummaries.reduce((sum, m) => sum + m.savingsBalance, 0);
    const averageSavings = filteredMemberSummaries.length > 0 ? totalSavingsGlobal / filteredMemberSummaries.length : 0;
    return { totalSavingsGlobal, averageSavings, memberCount: filteredMemberSummaries.length };
  }, [filteredMemberSummaries]);

  const handleExport = () => {
    const dataToExport = filteredMemberSummaries.map(summary => ({
      'Member Name': summary.fullName,
      'School': summary.schoolName,
      'Account Number': summary.savingsAccountNumber || 'N/A',
      'Account Type': summary.savingAccountTypeName || 'N/A',
      'Current Balance ($)': summary.savingsBalance.toFixed(2),
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
      <PageTitle title="Savings Accounts Summary" subtitle="View member savings balances and contribution fulfillment.">
        <Button onClick={handleExport} variant="outline" disabled={filteredMemberSummaries.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Export
        </Button>
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Savings Balance (in view)</ShadcnCardTitle>
                <DollarSignIcon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">${globalSummaryStats.totalSavingsGlobal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Average Savings Balance (in view)</ShadcnCardTitle>
                <TrendingUp className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">${globalSummaryStats.averageSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Members (in view)</ShadcnCardTitle>
                <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">{globalSummaryStats.memberCount}</div></CardContent>
        </Card>
      </div>

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
              <TableHead>Account Type</TableHead>
              <TableHead className="text-right">Current Balance ($)</TableHead>
              <TableHead className="text-center w-[200px]">Contribution Fulfillment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMemberSummaries.length > 0 ? filteredMemberSummaries.map(summary => (
              <TableRow key={summary.memberId}>
                <TableCell className="font-medium">{summary.fullName}</TableCell>
                <TableCell>{summary.schoolName}</TableCell>
                <TableCell>{summary.savingsAccountNumber || 'N/A'}</TableCell>
                <TableCell>{summary.savingAccountTypeName || 'N/A'}</TableCell>
                <TableCell className="text-right font-semibold text-green-600">${summary.savingsBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No members found matching your criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
