
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { mockMembers, mockSavings } from '@/data/mock';
import type { Member, Saving } from '@/types';
import { Calendar as CalendarIcon, Loader2, FileDown, Check, ChevronsUpDown } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format, compareAsc } from 'date-fns';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { StatCard } from '@/components/stat-card';
import { WalletCards } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface StatementData {
  member: Member;
  dateRange: DateRange;
  balanceBroughtForward: number;
  transactions: (Saving & { debit: number; credit: number; balance: number })[];
  closingBalance: number;
}

export default function AccountStatementPage() {
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null);
  const [loggedInMemberId, setLoggedInMemberId] = useState<string | null>(null);
  
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const member = useMemo(() => {
    if (userRole === 'member' && loggedInMemberId) {
        return mockMembers.find(m => m.id === loggedInMemberId);
    }
    return null;
  }, [userRole, loggedInMemberId]);

  useEffect(() => {
    const role = localStorage.getItem('userRole') as 'admin' | 'member' | null;
    const memberId = localStorage.getItem('loggedInMemberId');
    setUserRole(role);
    setLoggedInMemberId(memberId);
    if (role === 'member' && memberId) {
      setSelectedMemberId(memberId);
    }
  }, []);

  const handleGenerateStatement = () => {
    if (!selectedMemberId || !dateRange?.from || !dateRange?.to) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a member and a valid date range.' });
      return;
    }
    setIsLoading(true);

    setTimeout(() => {
      const member = mockMembers.find(m => m.id === selectedMemberId);
      if (!member) {
        toast({ variant: 'destructive', title: 'Error', description: 'Selected member not found.' });
        setIsLoading(false);
        return;
      }
      
      const allMemberTransactions = mockSavings
        .filter(s => s.memberId === selectedMemberId && s.status === 'approved')
        .sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)));

      const balanceBroughtForward = allMemberTransactions
        .filter(tx => new Date(tx.date) < dateRange.from!)
        .reduce((balance, tx) => {
          if (tx.transactionType === 'deposit' || tx.transactionType === 'interest') return balance + tx.amount;
          if (tx.transactionType === 'withdrawal') return balance - tx.amount;
          return balance;
        }, 0);

      let runningBalance = balanceBroughtForward;
      const transactionsInPeriod = allMemberTransactions
        .filter(tx => new Date(tx.date) >= dateRange.from! && new Date(tx.date) <= dateRange.to!)
        .map(tx => {
          const credit = (tx.transactionType === 'deposit' || tx.transactionType === 'interest') ? tx.amount : 0;
          const debit = tx.transactionType === 'withdrawal' ? tx.amount : 0;
          runningBalance = runningBalance + credit - debit;
          return { ...tx, debit, credit, balance: runningBalance };
        });

      setStatementData({
        member,
        dateRange,
        balanceBroughtForward,
        transactions: transactionsInPeriod,
        closingBalance: runningBalance,
      });

      setIsLoading(false);
      toast({ title: 'Statement Generated', description: `Statement for ${member.fullName} is ready.` });
    }, 500);
  };
  
  const handleDownloadPdf = async () => {
    const statementElement = document.getElementById('printable-statement-content');
    if (!statementData || !statementElement) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Statement data is not available to download.',
      });
      return;
    }

    setIsDownloading(true);

    try {
      const canvas = await html2canvas(statementElement, {
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = canvasWidth / canvasHeight;
      
      let imgWidth = pdfWidth - 40;
      let imgHeight = imgWidth / ratio;
      
      if (imgHeight > pdfHeight - 40) {
        imgHeight = pdfHeight - 40;
        imgWidth = imgHeight * ratio;
      }
      
      const x = (pdfWidth - imgWidth) / 2;
      const y = 20;

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);

      const fileName = `AcademInvest-Statement-${statementData.member.fullName.replace(/\s/g, '_')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      pdf.save(fileName);
      
      toast({ title: 'Download Started', description: 'Your statement PDF is being downloaded.' });

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Download Failed',
        description: 'An error occurred while generating the PDF.',
      });
    } finally {
      setIsDownloading(false);
    }
  };


  return (
    <div className="space-y-8">
        <div className="no-print">
            <PageTitle title="Account Statement" subtitle={userRole === 'admin' ? "Generate a detailed savings account statement for a member." : "View and print your account statement for a selected period."} />

            {userRole === 'member' && member && (
                <div className="mb-6">
                    <StatCard
                      title="My Current Savings Balance"
                      value={`$${member.savingsBalance.toFixed(2)}`}
                      icon={<WalletCards className="h-6 w-6 text-accent" />}
                      description={`Account #: ${member.savingsAccountNumber}`}
                    />
                </div>
              )}

            <Card className="statement-form">
                <CardHeader>
                <CardTitle>Selection Criteria</CardTitle>
                <CardDescription>Select a member and date range to generate their statement.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <Label htmlFor="member-select">Member</Label>
                    <Popover open={openMemberCombobox} onOpenChange={setOpenMemberCombobox}>
                    <PopoverTrigger asChild>
                        <Button
                        id="member-select"
                        variant="outline"
                        role="combobox"
                        aria-expanded={openMemberCombobox}
                        className="w-full justify-between"
                        disabled={userRole === 'member'}
                        >
                        {selectedMemberId
                            ? mockMembers.find((member) => member.id === selectedMemberId)?.fullName
                            : "Select member..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                        <CommandInput placeholder="Search member by name or account..." />
                        <CommandList>
                            <CommandEmpty>No member found.</CommandEmpty>
                            <CommandGroup>
                            {mockMembers.map((member) => (
                                <CommandItem
                                key={member.id}
                                value={`${member.fullName} ${member.savingsAccountNumber}`}
                                onSelect={() => {
                                    setSelectedMemberId(member.id === selectedMemberId ? "" : member.id)
                                    setOpenMemberCombobox(false)
                                }}
                                >
                                <Check
                                    className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedMemberId === member.id ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {member.fullName} ({member.savingsAccountNumber || 'No Acct #'})
                                </CommandItem>
                            ))}
                            </CommandGroup>
                        </CommandList>
                        </Command>
                    </PopoverContent>
                    </Popover>
                </div>
                <div>
                    <Label htmlFor="date-range-picker">Statement Period</Label>
                    <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        id="date-range-picker"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                            dateRange.to ? (
                            <>
                                {format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}
                            </>
                            ) : (
                            format(dateRange.from, 'LLL dd, y')
                            )
                        ) : (
                            <span>Pick a date range</span>
                        )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        />
                    </PopoverContent>
                    </Popover>
                </div>
                </CardContent>
                <CardFooter>
                <Button onClick={handleGenerateStatement} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Statement
                </Button>
                </CardFooter>
            </Card>
        </div>

      {statementData && (
        <Card id="printable-statement">
          <CardHeader className="flex flex-row justify-between items-center no-print">
            <div>
              <CardTitle>Generated Statement</CardTitle>
              <CardDescription>
                For {statementData.member.fullName} from {format(statementData.dateRange.from!, 'PPP')} to {format(statementData.dateRange.to!, 'PPP')}
              </CardDescription>
            </div>
            <Button onClick={handleDownloadPdf} variant="outline" disabled={isDownloading}>
              {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Download Report
            </Button>
          </CardHeader>
          <CardContent>
            <div id="printable-statement-content" className="p-6 border rounded-lg bg-white text-black">
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b mb-4 border-gray-300">
                    <div>
                        <Logo />
                        <p className="text-sm text-gray-500 mt-1">Savings & Credit Association</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-bold text-primary">Account Statement</h2>
                        <p className="text-gray-500">
                            Period: {format(statementData.dateRange.from!, 'PPP')} to {format(statementData.dateRange.to!, 'PPP')}
                        </p>
                    </div>
                </div>

                {/* Member Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <Label className="font-semibold text-gray-700">Member Name:</Label>
                        <p>{statementData.member.fullName}</p>
                    </div>
                     <div>
                        <Label className="font-semibold text-gray-700">Account Number:</Label>
                        <p>{statementData.member.savingsAccountNumber}</p>
                    </div>
                    <div>
                        <Label className="font-semibold text-gray-700">School:</Label>
                        <p>{statementData.member.schoolName}</p>
                    </div>
                    <div>
                        <Label className="font-semibold text-gray-700">Address:</Label>
                        <p>{`${statementData.member.address.wereda}, ${statementData.member.address.subCity}, ${statementData.member.address.city}`}</p>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="overflow-x-auto rounded-lg border border-gray-300 shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-100">
                                <TableHead className="w-[120px] text-gray-600">Date</TableHead>
                                <TableHead className="text-gray-600">Description</TableHead>
                                <TableHead className="text-right text-gray-600">Debit</TableHead>
                                <TableHead className="text-right text-gray-600">Credit</TableHead>
                                <TableHead className="text-right text-gray-600">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="font-semibold">
                                <TableCell colSpan={4}>Balance Brought Forward</TableCell>
                                <TableCell className="text-right">${statementData.balanceBroughtForward.toFixed(2)}</TableCell>
                            </TableRow>
                            {statementData.transactions.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell>{format(new Date(tx.date), 'PPP')}</TableCell>
                                    <TableCell className="capitalize">{tx.transactionType} ({tx.notes || 'N/A'})</TableCell>
                                    <TableCell className="text-right text-red-600">{tx.debit > 0 ? `$${tx.debit.toFixed(2)}` : '-'}</TableCell>
                                    <TableCell className="text-right text-green-600">{tx.credit > 0 ? `$${tx.credit.toFixed(2)}` : '-'}</TableCell>
                                    <TableCell className="text-right">${tx.balance.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                             <TableRow className="font-semibold bg-gray-100">
                                <TableCell colSpan={4}>Closing Balance as of {format(statementData.dateRange.to!, 'PPP')}</TableCell>
                                <TableCell className="text-right">${statementData.closingBalance.toFixed(2)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                 <div className="text-center text-xs text-gray-500 mt-4">
                    <p>Thank you for being a valued member of AcademInvest.</p>
                </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
