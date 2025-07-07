
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { School } from '@prisma/client';
import { Search, Filter, AlertTriangle, SchoolIcon, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle as ShadcnCardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { getOverdueLoansPageData, type OverdueLoanInfo } from './actions';

export default function OverdueLoansPage() {
    const [overdueLoans, setOverdueLoans] = useState<OverdueLoanInfo[]>([]);
    const [schools, setSchools] = useState<Pick<School, 'id', 'name'>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');

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
            // The action already fetches all overdue loans, so we filter client-side by school if needed
            // This could be improved by passing filter to the action, but is fine for now.
            // const matchesSchoolFilter = selectedSchoolFilter === 'all' || member.schoolId === selectedSchoolFilter;
            // For now, this is a placeholder as we don't have schoolId on the loan directly in this fetched data.
            // A more complex query would be needed in the action.
            return matchesSearchTerm;
        });
    }, [overdueLoans, searchTerm, selectedSchoolFilter]);

    const totalOverdueAmount = useMemo(() => {
        return filteredOverdueLoans.reduce((sum, loan) => sum + loan.remainingBalance, 0);
    }, [filteredOverdueLoans]);
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

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
                    <CardContent><div className="text-2xl font-bold text-destructive">Birr {totalOverdueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></CardContent>
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
                        {filteredOverdueLoans.length > 0 ? filteredOverdueLoans.map(loan => (
                            <TableRow key={loan.id} className="bg-destructive/5">
                                <TableCell className="font-medium">{loan.memberName}</TableCell>
                                <TableCell className="font-mono text-xs">{loan.loanAccountNumber}</TableCell>
                                <TableCell>{loan.loanTypeName}</TableCell>
                                <TableCell className="text-right font-semibold">Birr {loan.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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
        </div>
    );
}
