
'use client';

import React, { useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockLoans, mockMembers, mockSchools } from '@/data/mock';
import type { Loan, Member, School } from '@/types';
import { Search, Filter, AlertTriangle, SchoolIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle as ShadcnCardTitle } from '@/components/ui/card';
import { differenceInDays, parseISO } from 'date-fns';
import Link from 'next/link';

interface OverdueLoanInfo extends Loan {
    daysOverdue: number;
}

export default function OverdueLoansPage() {
    const [loans] = useState<Loan[]>(mockLoans);
    const [members] = useState<Member[]>(mockMembers);
    const [schools] = useState<School[]>(mockSchools);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');

    const overdueLoans = useMemo((): OverdueLoanInfo[] => {
        const today = new Date();
        return loans
            .filter(loan => {
                if (loan.status !== 'overdue' && loan.status !== 'active') return false;
                if (!loan.nextDueDate) return false;
                return parseISO(loan.nextDueDate) < today;
            })
            .map(loan => ({
                ...loan,
                daysOverdue: differenceInDays(today, parseISO(loan.nextDueDate!)),
            }));
    }, [loans]);

    const filteredOverdueLoans = useMemo(() => {
        return overdueLoans.filter(loan => {
            const member = members.find(m => m.id === loan.memberId);
            if (!member) return false;
            
            const matchesSearchTerm = loan.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
            const matchesSchoolFilter = selectedSchoolFilter === 'all' || member.schoolId === selectedSchoolFilter;
            
            return matchesSearchTerm && matchesSchoolFilter;
        });
    }, [overdueLoans, members, searchTerm, selectedSchoolFilter]);

    const totalOverdueAmount = useMemo(() => {
        // This is a simplified calculation. Real-world would involve calculating principal + accrued interest.
        // For this demo, we sum the remaining balances of overdue loans.
        return filteredOverdueLoans.reduce((sum, loan) => sum + loan.remainingBalance, 0);
    }, [filteredOverdueLoans]);

    return (
        <div className="space-y-6">
            <PageTitle title="Overdue Loans" subtitle="Monitor and manage loans with missed payment deadlines." />

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
                    <CardContent><div className="text-2xl font-bold text-destructive">${totalOverdueAmount.toFixed(2)}</div></CardContent>
                </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input type="search" placeholder="Search by member name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full" />
                </div>
                <Select value={selectedSchoolFilter} onValueChange={setSelectedSchoolFilter}>
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
                            <TableHead className="text-right">Remaining Balance ($)</TableHead>
                            <TableHead>Next Due Date</TableHead>
                            <TableHead className="text-center text-destructive">Days Overdue</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredOverdueLoans.length > 0 ? filteredOverdueLoans.map(loan => (
                            <TableRow key={loan.id} className="bg-destructive/5">
                                <TableCell className="font-medium">{loan.memberName}</TableCell>
                                <TableCell className="font-mono text-xs">{loan.loanAccountNumber}</TableCell>
                                <TableCell>{loan.loanTypeName}</TableCell>
                                <TableCell className="text-right font-semibold">${loan.remainingBalance.toFixed(2)}</TableCell>
                                <TableCell>{new Date(loan.nextDueDate!).toLocaleDateString()}</TableCell>
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
        </div>
    );
}
