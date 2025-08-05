

'use client';

import { getMemberDetails } from './actions';
import type { MemberDetails } from './actions';
import { notFound, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, formatDistanceToNow } from 'date-fns';
import { User, School, Phone, Home, ShieldAlert, PiggyBank, HandCoins, Landmark, Banknote, ReceiptText, ArrowUpCircle, ArrowDownCircle, AlertCircle, CalendarIcon, Filter, Loader2, History, Award } from 'lucide-react';
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

const StatInfo = ({ icon, label, value, subValue }: { icon: React.ReactNode, label: string, value: React.ReactNode, subValue?: string }) => (
    <div className="flex items-start gap-4">
        <div className="text-primary mt-1 flex-shrink-0">{icon}</div>
        <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="font-semibold">{value || 'N/A'}</div>
            {subValue && <div className="text-xs text-muted-foreground">{subValue}</div>}
        </div>
    </div>
);

const SectionCard = ({ title, description, children, actionButton }: { title: string, description?: string, children: React.ReactNode, actionButton?: React.ReactNode }) => (
    <Card className="shadow-sm">
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
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    
    const getLoanStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <Badge variant="secondary">Pending</Badge>;
            case 'active': return <Badge variant="default">Active</Badge>;
            case 'overdue': return <Badge variant="destructive">Overdue</Badge>;
            case 'paid_off': return <Badge className="bg-green-100 text-green-800 border-green-200">Paid Off</Badge>;
            case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };
     const getServiceChargeStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <Badge variant="secondary">Pending</Badge>;
            case 'paid': return <Badge variant="default">Paid</Badge>;
            case 'waived': return <Badge variant="outline">Waived</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (isLoading || !details) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }
    
    const { member, school, allSavingsTransactions, savingAccounts, shares, loans, loanRepayments, dividends, address, schoolHistory } = details;

    return (
        <div className="mx-auto p-4 md:p-8 space-y-8 bg-background">
            {/* Header Card */}
            <Card className="overflow-hidden shadow-lg rounded-xl">
                <div className="p-6 flex flex-col md:flex-row items-center gap-6 bg-card">
                    <Avatar className="h-24 w-24 border-4 border-muted shadow-lg flex-shrink-0">
                        <AvatarImage src={`https://placehold.co/128x128.png?text=${member.fullName.charAt(0)}`} alt={member.fullName} data-ai-hint="user avatar"/>
                        <AvatarFallback className="text-muted-foreground"><User className="h-12 w-12" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-3xl font-bold text-primary">{member.fullName}</h2>
                        <div className="text-lg text-muted-foreground">{member.email}</div>
                        <Badge variant={member.status === 'active' ? 'default' : 'destructive'} className="mt-2 text-foreground font-bold">{member.status}</Badge>
                    </div>
                </div>
            </Card>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-6 md:grid-cols-6 h-auto">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="savings">Savings</TabsTrigger>
                    <TabsTrigger value="shares">Shares</TabsTrigger>
                    <TabsTrigger value="loans">Loans</TabsTrigger>
                    <TabsTrigger value="dividends">Dividends</TabsTrigger>
                    <TabsTrigger value="history">School History</TabsTrigger>
                </TabsList>
                
                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                         <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Total Savings</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{summaryStats.totalSavings.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr</div></CardContent></Card>
                         <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Total Shares Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{summaryStats.totalShares.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr</div></CardContent></Card>
                         <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Active Loan Balance</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{summaryStats.totalLoans.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr</div></CardContent></Card>
                         <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Member Since</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{format(new Date(member.joinDate), 'PP')}</div><div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(member.joinDate))} ago</div></CardContent></Card>
                    </div>
                     <SectionCard title="Member Information">
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
                            <StatInfo icon={<Phone className="h-5 w-5"/>} label="Phone Number" value={member.phoneNumber} />
                            <StatInfo icon={<User className="h-5 w-5"/>} label="Gender" value={member.sex} />
                            <StatInfo icon={<School className="h-5 w-5"/>} label="Current School" value={school?.name} />
                            <StatInfo 
                                icon={<Home className="h-5 w-5"/>} 
                                label="Address" 
                                value={`${address?.subCity || 'N/A'}, ${address?.city || 'N/A'}`} 
                                subValue={`Wereda: ${address?.wereda || 'N/A'}, Kebele: ${address?.kebele || 'N/A'}, H.No: ${address?.houseNumber || 'N/A'}`} 
                            />
                         </div>
                    </SectionCard>
                </TabsContent>

                {/* Savings Tab */}
                <TabsContent value="savings" className="mt-6 space-y-6">
                    <SectionCard title="Saving Accounts Summary">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {savingAccounts.map(acc => (
                               <Card key={acc.id} className="p-4 flex flex-col justify-between shadow-sm bg-card hover:bg-muted/50 transition-colors">
                                  <div className="flex-1 mb-4">
                                      <div className="text-base font-semibold text-primary">{acc.savingAccountType?.name}</div>
                                      <div className="text-sm text-muted-foreground">Acct #: {acc.accountNumber}</div>
                                  </div>
                                  <div className="flex justify-between items-baseline">
                                    <div>
                                      <div className="text-xs text-muted-foreground">Initial Balance</div>
                                      <div className="font-medium">{acc.initialBalance.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr</div>
                                    </div>
                                    <div className="text-right">
                                     <div className="text-xs text-muted-foreground">Current Balance</div>
                                     <div className="text-lg font-bold text-green-600">{acc.balance.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr</div>
                                  </div>
                                  </div>
                               </Card>
                            ))}
                        </div>
                    </SectionCard>
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
                            {transactionDateRange && <Button variant="ghost" onClick={() => setTransactionDateRange(undefined)}>Clear</Button>}
                        </div>
                        <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead className="w-[15%]">Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right w-[15%]">Debit</TableHead>
                                    <TableHead className="text-right w-[15%]">Credit</TableHead>
                                    <TableHead className="w-[15%] truncate">Reference</TableHead>
                                    <TableHead className="text-right w-[15%]">Balance</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                    {paginatedTransactions.length > 0 ? paginatedTransactions.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell>{format(new Date(tx.date), 'PPP')}</TableCell>
                                            <TableCell className="capitalize">{tx.notes || tx.transactionType}</TableCell>
                                            <TableCell className="font-medium text-destructive text-right">
                                                {tx.transactionType === 'withdrawal' ? tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                                            </TableCell>
                                            <TableCell className="font-medium text-green-600 text-right">
                                                {tx.transactionType === 'deposit' ? tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground truncate">{tx.transactionReference || 'N/A'}</TableCell>
                                            <TableCell className="font-semibold text-right">{tx.balanceAfter.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow><TableCell colSpan={6} className="h-24 text-center">No transactions match the current filters.</TableCell></TableRow>
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
                </TabsContent>
                
                {/* Shares Tab */}
                <TabsContent value="shares" className="mt-6">
                    <SectionCard title="Share Allocations">
                       <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead>Allocation Date</TableHead>
                                    <TableHead>Share Type</TableHead>
                                    <TableHead className="text-right">Count</TableHead>
                                    <TableHead className="text-right">Value per Share</TableHead>
                                    <TableHead className="text-right">Total Value</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                     {shares.length > 0 ? shares.map(share => (
                                        <TableRow key={share.id}>
                                            <TableCell>{format(new Date(share.allocationDate), 'PPP')}</TableCell>
                                            <TableCell>{share.shareTypeName}</TableCell>
                                            <TableCell className="text-right">{share.count}</TableCell>
                                            <TableCell className="text-right">{share.valuePerShare.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                            <TableCell className="text-right font-semibold">{(share.count * share.valuePerShare).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                        </TableRow>
                                     )) : (
                                         <TableRow><TableCell colSpan={5} className="h-24 text-center">No share allocations found.</TableCell></TableRow>
                                     )}
                                </TableBody>
                            </Table>
                       </div>
                    </SectionCard>
                </TabsContent>
                
                {/* Loans Tab */}
                <TabsContent value="loans" className="mt-6 space-y-6">
                    {loans.length > 0 ? loans.map(loan => {
                        const specificRepayments = loanRepayments.filter(r => r.loanId === loan.id);
                        return (
                             <SectionCard key={loan.id} title={`Loan Details: ${loan.loanTypeName} (${loan.loanAccountNumber})`}>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 border-b pb-4">
                                    <StatInfo icon={<></>} label="Principal Amount" value={`${loan.principalAmount.toLocaleString(undefined, {minimumFractionDigits:2})} Birr`} />
                                    <StatInfo icon={<></>} label="Remaining Balance" value={`${loan.remainingBalance.toLocaleString(undefined, {minimumFractionDigits:2})} Birr`} />
                                    <StatInfo icon={<></>} label="Status" value={getLoanStatusBadge(loan.status)} />
                                    <StatInfo icon={<></>} label="Disbursed" value={format(new Date(loan.disbursementDate), 'PPP')} />
                                </div>
                                <h4 className="font-medium mb-2">Repayment History for this Loan</h4>
                                <div className="overflow-x-auto rounded-md border">
                                    <Table>
                                        <TableHeader><TableRow>
                                            <TableHead>Payment Date</TableHead>
                                            <TableHead className="text-right">Total Paid</TableHead>
                                            <TableHead className="text-right">Principal Paid</TableHead>
                                            <TableHead className="text-right">Interest Paid</TableHead>
                                            <TableHead className="text-right">Remaining Balance</TableHead>
                                        </TableRow></TableHeader>
                                        <TableBody>
                                            {specificRepayments.length > 0 ? specificRepayments.map(repayment => (
                                                <TableRow key={repayment.id}>
                                                    <TableCell>{format(new Date(repayment.paymentDate), 'PPP')}</TableCell>
                                                    <TableCell className="text-right font-semibold text-primary">{repayment.amountPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                                    <TableCell className="text-right text-green-600">{repayment.principalPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                                    <TableCell className="text-right text-orange-600">{repayment.interestPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                                    <TableCell className="text-right font-medium">{repayment.balanceAfter.toLocaleString(undefined, {minimumFractionDigits:2})}</TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow><TableCell colSpan={5} className="h-24 text-center">No repayments for this loan yet.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </SectionCard>
                        )
                    }) : (
                        <SectionCard title="Loan History">
                            <div className="text-muted-foreground text-center py-8">This member has not taken any loans.</div>
                        </SectionCard>
                    )}
                </TabsContent>
                
                 {/* Dividends Tab */}
                <TabsContent value="dividends" className="mt-6">
                    <SectionCard title="Dividend History">
                       <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead>Distribution Date</TableHead>
                                    <TableHead className="text-right">Shares at Distribution</TableHead>
                                    <TableHead className="text-right">Dividend Amount</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                     {dividends.length > 0 ? dividends.map(dividend => (
                                        <TableRow key={dividend.id}>
                                            <TableCell>{format(new Date(dividend.distributionDate), 'PPP')}</TableCell>
                                            <TableCell className="text-right">{dividend.shareCountAtDistribution}</TableCell>
                                            <TableCell className="text-right font-semibold text-primary">{dividend.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                            <TableCell>{dividend.notes || 'N/A'}</TableCell>
                                        </TableRow>
                                     )) : (
                                         <TableRow><TableCell colSpan={4} className="h-24 text-center">No dividend history found.</TableCell></TableRow>
                                     )}
                                </TableBody>
                            </Table>
                       </div>
                    </SectionCard>
                </TabsContent>
                
                {/* School History Tab */}
                <TabsContent value="history" className="mt-6">
                    <SectionCard title="School Transfer History">
                       <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader><TableRow>
                                    <TableHead>School Name</TableHead>
                                    <TableHead>Start Date</TableHead>
                                    <TableHead>End Date</TableHead>
                                    <TableHead>Reason</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                     {schoolHistory.length > 0 ? schoolHistory.map(history => (
                                        <TableRow key={history.id}>
                                            <TableCell className="font-medium">{history.schoolName}</TableCell>
                                            <TableCell>{format(new Date(history.startDate), 'PPP')}</TableCell>
                                            <TableCell>
                                                {history.endDate ? (
                                                    format(new Date(history.endDate), 'PPP')
                                                ) : (
                                                    <span className="font-semibold text-green-600">Current</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{history.reason || 'N/A'}</TableCell>
                                        </TableRow>
                                     )) : (
                                         <TableRow><TableCell colSpan={4} className="h-24 text-center">No school history found.</TableCell></TableRow>
                                     )}
                                </TableBody>
                            </Table>
                       </div>
                    </SectionCard>
                </TabsContent>

            </Tabs>
        </div>
    );
}
