
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { mockMembers, mockSchools, mockShares, mockSavings, mockShareTypes } from '@/data/mock'; // Added mockSavings, mockShareTypes
import type { Member, School, Share, Saving, ShareType, MemberShareCommitment } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { differenceInMonths, parseISO } from 'date-fns';
import { Search, Filter, SchoolIcon, Edit, ListChecks, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OverdueShareDetail {
  shareTypeId: string;
  shareTypeName: string;
  monthlyCommittedAmount: number;
  totalExpectedContribution: number;
  totalAllocatedValue: number;
  overdueAmount: number;
}

interface OverdueMemberInfo {
  memberId: string;
  fullName: string;
  schoolName?: string;
  schoolId: string;
  overdueSavingsAmount: number;
  overdueSharesDetails: OverdueShareDetail[];
  hasAnyOverdue: boolean;
}

export default function OverduePaymentsPage() {
  const [allMembers] = useState<Member[]>(mockMembers);
  const [allSchools] = useState<School[]>(mockSchools);
  const [allShares] = useState<Share[]>(mockShares);
  const [allSavings] = useState<Saving[]>(mockSavings);
  const [allShareTypes] = useState<ShareType[]>(mockShareTypes);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const { toast } = useToast();

  const overdueMembersData = useMemo((): OverdueMemberInfo[] => {
    const currentDate = new Date();
    return allMembers
      .map(member => {
        const joinDate = parseISO(member.joinDate);
        let contributionPeriods = 0;
        if (joinDate <= currentDate) {
          contributionPeriods = differenceInMonths(currentDate, joinDate) + 1;
        }
        contributionPeriods = Math.max(0, contributionPeriods);

        // Calculate overdue savings
        const expectedMonthlySaving = member.expectedMonthlySaving || 0;
        const totalExpectedSavings = expectedMonthlySaving * contributionPeriods;
        const memberSavingsBalance = member.savingsBalance;
        const overdueSavingsAmount = Math.max(0, totalExpectedSavings - memberSavingsBalance);

        // Calculate overdue shares
        const overdueSharesDetails: OverdueShareDetail[] = (member.shareCommitments || [])
          .map(commitment => {
            const shareType = allShareTypes.find(st => st.id === commitment.shareTypeId);
            if (!shareType || (commitment.monthlyCommittedAmount || 0) === 0) {
                return null;
            }

            const monthlyCommitted = commitment.monthlyCommittedAmount || 0;
            const totalExpectedShareContributionForType = monthlyCommitted * contributionPeriods;
            
            const memberSharesOfType = allShares.filter(
              s => s.memberId === member.id && s.shareTypeId === commitment.shareTypeId
            );
            const totalAllocatedValueForShareType = memberSharesOfType.reduce(
              (sum, s) => sum + (s.totalValueForAllocation || (s.count * s.valuePerShare)),
              0
            );
            
            const overdueAmount = Math.max(0, totalExpectedShareContributionForType - totalAllocatedValueForShareType);
            
            if (overdueAmount > 0) {
                return {
                shareTypeId: commitment.shareTypeId,
                shareTypeName: commitment.shareTypeName || shareType.name,
                monthlyCommittedAmount: monthlyCommitted,
                totalExpectedContribution: totalExpectedShareContributionForType,
                totalAllocatedValue: totalAllocatedValueForShareType,
                overdueAmount,
                };
            }
            return null;
          })
          .filter((detail): detail is OverdueShareDetail => detail !== null);
          
        const hasAnyOverdue = overdueSavingsAmount > 0 || overdueSharesDetails.some(s => s.overdueAmount > 0);

        return {
          memberId: member.id,
          fullName: member.fullName,
          schoolName: member.schoolName || allSchools.find(s => s.id === member.schoolId)?.name,
          schoolId: member.schoolId,
          overdueSavingsAmount,
          overdueSharesDetails,
          hasAnyOverdue,
        };
      })
      .filter(memberInfo => memberInfo.hasAnyOverdue); // Only include members with any overdue amount
  }, [allMembers, allShares, allSavings, allShareTypes, allSchools]);


  const filteredOverdueMembers = useMemo(() => {
    return overdueMembersData.filter(member => {
      const matchesSearchTerm = member.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || member.schoolId === selectedSchoolFilter;
      return matchesSearchTerm && matchesSchoolFilter;
    });
  }, [overdueMembersData, searchTerm, selectedSchoolFilter]);
  
  const handleRecordPayment = (memberId: string) => {
    // Placeholder for opening payment modal
    toast({ title: 'Record Payment Clicked', description: `For member ID: ${memberId}. Modal not yet implemented.` });
    console.log("Record payment for member:", memberId);
  };
  
  const totalOverdueSavings = useMemo(() => {
    return filteredOverdueMembers.reduce((sum, member) => sum + member.overdueSavingsAmount, 0);
  }, [filteredOverdueMembers]);

  const totalOverdueSharesValue = useMemo(() => {
    return filteredOverdueMembers.reduce((sum, member) => {
      return sum + member.overdueSharesDetails.reduce((shareSum, detail) => shareSum + detail.overdueAmount, 0);
    }, 0);
  }, [filteredOverdueMembers]);


  return (
    <div className="space-y-6">
      <PageTitle title="Overdue Payments" subtitle="Track and manage members with outstanding savings or share contributions.">
      </PageTitle>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Members with Overdue Payments</CardTitle>
                <ListChecks className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">{filteredOverdueMembers.length}</div>
            </CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Overdue Savings (in view)</CardTitle>
                <DollarSign className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">${totalOverdueSavings.toFixed(2)}</div>
            </CardContent>
        </Card>
         <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Overdue Shares Value (in view)</CardTitle>
                <DollarSign className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">${totalOverdueSharesValue.toFixed(2)}</div>
            </CardContent>
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
            aria-label="Search overdue members"
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
              <TableHead className="text-right text-destructive">Overdue Savings ($)</TableHead>
              <TableHead className="text-left">Overdue Shares Details</TableHead>
              <TableHead className="text-center w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOverdueMembers.length > 0 ? filteredOverdueMembers.map(member => (
              <TableRow key={member.memberId} className={member.hasAnyOverdue ? 'bg-destructive/5 hover:bg-destructive/10' : ''}>
                <TableCell className="font-medium">{member.fullName}</TableCell>
                <TableCell>{member.schoolName}</TableCell>
                <TableCell className="text-right font-semibold text-destructive">
                  {member.overdueSavingsAmount > 0 ? `$${member.overdueSavingsAmount.toFixed(2)}` : <span className="text-muted-foreground/70">-</span>}
                </TableCell>
                <TableCell>
                  {member.overdueSharesDetails.length > 0 ? (
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                      {member.overdueSharesDetails.map(detail => (
                        <li key={detail.shareTypeId}>
                          <span className="font-medium">{detail.shareTypeName}</span>: <span className="text-destructive font-semibold">${detail.overdueAmount.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <span className="text-muted-foreground/70">-</span>}
                </TableCell>
                <TableCell className="text-center">
                  {member.hasAnyOverdue && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRecordPayment(member.memberId)}
                      className="border-primary text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <Edit className="mr-1.5 h-3.5 w-3.5" />
                      Record Payment
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No overdue payments found matching your criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
       {filteredOverdueMembers.length > 10 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline">Load More Members</Button>
        </div>
      )}
    </div>
  );
}
