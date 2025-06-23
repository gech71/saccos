
'use client';

import React, { useState, useMemo } from 'react';
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
import { mockMembers, mockSchools, mockSavingAccountTypes } from '@/data/mock';
import type { Member, School, SavingAccountType } from '@/types';
import { Search, Filter, SchoolIcon, DollarSign, Users, TrendingUp, FileDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle as ShadcnCardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { differenceInMonths, parseISO } from 'date-fns';
import { exportToExcel } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MemberSavingsSummary {
  memberId: string;
  fullName: string;
  schoolName?: string;
  schoolId: string;
  savingsBalance: number;
  savingsAccountNumber?: string;
  savingAccountTypeName?: string;
  fulfillmentPercentage: number;
}

export default function SavingsAccountsPage() {
  const [allMembers] = useState<Member[]>(mockMembers);
  const [allSchools] = useState<School[]>(mockSchools);
  const [allSavingAccountTypes] = useState<SavingAccountType[]>(mockSavingAccountTypes);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');

  const memberSavingsSummaries = useMemo((): MemberSavingsSummary[] => {
    return allMembers.map(member => {
      const { savingsBalance, expectedMonthlySaving, joinDate, savingAccountTypeId } = member;
      const joinDateObj = parseISO(joinDate);
      const currentDate = new Date();
      let contributionPeriods = 0;
      if (joinDateObj <= currentDate) {
        contributionPeriods = differenceInMonths(currentDate, joinDateObj) + 1;
      }
      contributionPeriods = Math.max(0, contributionPeriods);

      const totalExpected = (expectedMonthlySaving || 0) * contributionPeriods;
      const fulfillmentPercentage = totalExpected > 0 ? (savingsBalance / totalExpected) * 100 : (savingsBalance > 0 ? 100 : 0);
      
      const accountType = allSavingAccountTypes.find(sat => sat.id === savingAccountTypeId);

      return {
        memberId: member.id,
        fullName: member.fullName,
        schoolName: member.schoolName || allSchools.find(s => s.id === member.schoolId)?.name,
        schoolId: member.schoolId,
        savingsBalance,
        savingsAccountNumber: member.savingsAccountNumber,
        savingAccountTypeName: member.savingAccountTypeName || accountType?.name,
        fulfillmentPercentage,
      };
    });
  }, [allMembers, allSchools, allSavingAccountTypes]);

  const filteredMemberSummaries = useMemo(() => {
    return memberSavingsSummaries.filter(summary => {
      const matchesSearchTerm = summary.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || summary.schoolId === selectedSchoolFilter;
      return matchesSearchTerm && matchesSchoolFilter;
    });
  }, [memberSavingsSummaries, searchTerm, selectedSchoolFilter]);

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

  return (
    <div className="space-y-6">
      <PageTitle title="Savings Accounts Summary" subtitle="View member savings balances and contribution fulfillment.">
        <Button onClick={handleExport} variant="outline">
            <FileDown className="mr-2 h-4 w-4" /> Export
        </Button>
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Savings Balance (in view)</ShadcnCardTitle>
                <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">${globalSummaryStats.totalSavingsGlobal.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Average Savings Balance (in view)</ShadcnCardTitle>
                <TrendingUp className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">${globalSummaryStats.averageSavings.toFixed(2)}</div></CardContent>
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
                <TableCell className="text-right font-semibold text-green-600">${summary.savingsBalance.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                    {(allMembers.find(m=>m.id === summary.memberId)?.expectedMonthlySaving || 0) > 0 ? (
                      <div className="flex flex-col items-center">
                        <Progress value={Math.min(100, summary.fulfillmentPercentage)} className="h-2 w-full" />
                        <span className="text-xs mt-1">{Math.min(100, Math.max(0, summary.fulfillmentPercentage)).toFixed(1)}%</span>
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
