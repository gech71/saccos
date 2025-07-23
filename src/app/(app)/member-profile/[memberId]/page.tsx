
'use client';

import { getMemberDetails } from './actions';
import type { MemberDetails } from './actions';
import { notFound, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { User, School, Phone, PiggyBank, HandCoins, Landmark, Banknote, ReceiptText, ArrowUpCircle, ArrowDownCircle, AlertCircle, CalendarIcon, Filter, Loader2 } from 'lucide-react';
import React, { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageTitle } from '@/components/page-title';

const StatInfo = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: React.ReactNode }) => (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
        <div className="text-primary mt-1">{icon}</div>
        <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-semibold">{value || 'N/A'}</p>
        </div>
    </div>
);

const SectionCard = ({ title, description, children, actionButton }: { title: string, description?: string, children: React.ReactNode, actionButton?: React.ReactNode }) => (
    <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl text-primary font-headline">{title}</CardTitle>
              {description && <CardDescription className="mt-1">{description}</CardDescription>}
            </div>
            {actionButton}
          </div>
        </CardHeader>
        <CardContent>
            {children}
        </CardContent>
    </Card>
);

export default function MemberProfilePage() {
    const params = useParams();
    const memberId = params.memberId as string;
    const [details, setDetails] = useState<MemberDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [transactionFilter, setTransactionFilter] = useState<'all' | 'deposit' | 'withdrawal'>('all');
    const [transactionDateRange, setTransactionDateRange] = useState<DateRange | undefined>(undefined);
    
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    useEffect(() => {
        if (!memberId) return;

        async function loadData() {
            setIsLoading(true);
            try {
                const data = await getMemberDetails(memberId);
                if (!data) {
                    notFound();
                } else {
                    setDetails(data);
                }
            } catch (error) {
                console.error("Failed to load member details", error);
                notFound();
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [memberId]);

    const filteredTransactions = useMemo(() => {
        if (!details) return [];
        return details.allSavingsTransactions.filter(tx => {
            const matchesType = transactionFilter === 'all' || tx.transactionType === transactionFilter;
            const txDate = new Date(tx.date);
            const matchesDate = !transactionDateRange || (
                (!transactionDateRange.from || txDate >= transactionDateRange.from) &&
                (!transactionDateRange.to || txDate <= transactionDateRange.to)
            );
            return matchesType && matchesDate;
        });
    }, [details, transactionFilter, transactionDateRange]);

    const paginatedTransactions = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filteredTransactions.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredTransactions, currentPage, rowsPerPage]);
    
    const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage);

    const summaryStats = useMemo(() => {
        if (!details) return { totalSavings: 0, totalShares: 0, totalLoans: 0, totalInitialBalance: 0 };
        const totalSavings = details.savingAccounts.reduce((sum, acc) => sum + acc.balance, 0);
        const totalShares = details.shares.reduce((sum, share) => sum + (share.count * share.valuePerShare), 0);
        const totalLoans = details.loans.filter(l => l.status === 'active' || l.status === 'overdue').reduce((sum, loan) => sum + loan.remainingBalance, 0);
        const totalInitialBalance = details.savingAccounts.reduce((sum, acc) => sum + acc.initialBalance, 0);

        return { totalSavings, totalShares, totalLoans, totalInitialBalance };
    }, [details]);

    if (isLoading || !details) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }
    
    const { member, school, monthlySavings, monthlyLoanRepayments, shares, loans, serviceCharges } = details;

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8 bg-background">
            <PageTitle title="Member Profile" subtitle={`A complete financial overview of ${member.fullName}.`}/>

            {/* Header Card */}
            <Card className="overflow-hidden shadow-xl bg-gradient-to-r from-yellow-500 via-yellow-600 to-amber-700 text-white rounded-xl">
                <div className="p-6 flex flex-col md:flex-row items-center gap-6">
                    <Avatar className="h-24 w-24 border-4 border-white/50 shadow-lg flex-shrink-0">
                        <AvatarImage src={`https://placehold.co/128x128.png?text=${member.fullName.charAt(0)}`} alt={member.fullName} data-ai-hint="user avatar"/>
                        <AvatarFallback className="text-slate-600"><User className="h-12 w-12" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-3xl font-bold">{member.fullName}</h2>
                        <p className="text-lg text-white/80">{member.email}</p>
                        <Badge variant="secondary" className="mt-2 bg-white/90 text-amber-800 font-bold">{member.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 text-center md:text-right w-full md:w-auto">
                        <div>
                            <p className="text-sm font-light opacity-80">Total Savings</p>
                            <p className="text-xl font-bold">{summaryStats.totalSavings.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr</p>
                        </div>
                        <div>
                            <p className="text-sm font-light opacity-80">Total Shares</p>
                            <p className="text-xl font-bold">{summaryStats.totalShares.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr</p>
                        </div>
                        <div>
                            <p className="text-sm font-light opacity-80">Active Loans</p>
                            <p className="text-xl font-bold">{summaryStats.totalLoans.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr</p>
                        </div>
                        <div>
                            <p className="text-sm font-light opacity-80">Join Date</p>
                            <p className="text-xl font-bold">{format(new Date(member.joinDate), 'PP')}</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Financial Summary & Personal Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <SectionCard title="All Savings Transactions" description="A complete log of all deposits and withdrawals.">
                         <div className="flex flex-col md:flex-row gap-2 mb-4">
                            <Select value={transactionFilter} onValueChange={(val) => setTransactionFilter(val as any)}>
                                <SelectTrigger className="w-full md:w-[180px]">
                                    <SelectValue placeholder="Filter by type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="deposit">Deposits</SelectItem>
                                    <SelectItem value="withdrawal">Withdrawals</SelectItem>
                                </SelectContent>
                            </Select>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full md:w-auto justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {transactionDateRange?.from ? (
                                            transactionDateRange.to ? (
                                                <>{format(transactionDateRange.from, "LLL dd, y")} - {format(transactionDateRange.to, "LLL dd, y")}</>
                                            ) : (
                                                format(transactionDateRange.from, "LLL dd, y")
                                            )
                                        ) : (
                                            <span>Pick a date</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="range" selected={transactionDateRange} onSelect={setTransactionDateRange} initialFocus />
                                </PopoverContent>
                            </Popover>
                            <Button variant="ghost" onClick={() => setTransactionDateRange(undefined)} className={!transactionDateRange ? 'hidden' : ''}>Clear</Button>
                        </div>
                        <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Amount (Birr)</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedTransactions.length > 0 ? paginatedTransactions.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell>{format(new Date(tx.date), 'PPP')}</TableCell>
                                            <TableCell>
                                                <span className={`flex items-center gap-1.5 ${tx.transactionType === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {tx.transactionType === 'deposit' ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                                                    <span className="capitalize">{tx.transactionType}</span>
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{tx.notes}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow><TableCell colSpan={4} className="h-24 text-center">No transactions match the current filters.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-2 pt-4">
                                <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                                <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                            </div>
                        )}
                    </SectionCard>
                </div>

                <div className="space-y-8">
                     <SectionCard title="Financial Summary">
                        <div className="space-y-4">
                            <StatInfo icon={<PiggyBank className="h-5 w-5"/>} label="Total Initial Balance" value={`${summaryStats.totalInitialBalance.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr`} />
                            {details.savingAccounts.map(acc => (
                               <div key={acc.id} className="ml-4 pl-4 border-l-2">
                                  <p className="text-sm font-semibold">{acc.savingAccountType?.name}</p>
                                  <p className="text-xs text-muted-foreground">Balance: {acc.balance.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr</p>
                               </div>
                            ))}
                        </div>
                    </SectionCard>
                    <SectionCard title="Member Information">
                        <div className="space-y-4">
                            <StatInfo icon={<Phone className="h-5 w-5"/>} label="Phone Number" value={member.phoneNumber} />
                            <StatInfo icon={<School className="h-5 w-5"/>} label="School" value={school?.name} />
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
}
