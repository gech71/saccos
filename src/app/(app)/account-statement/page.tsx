
'use client';

import React, { useState, useRef } from 'react';
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
import { Calendar as CalendarIcon, Loader2, Printer, Check, ChevronsUpDown } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format, compareAsc } from 'date-fns';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

interface StatementData {
  member: Member;
  dateRange: DateRange;
  balanceBroughtForward: number;
  transactions: (Saving & { debit: number; credit: number; balance: number })[];
  closingBalance: number;
}

export default function AccountStatementPage() {
  const { toast } = useToast();
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);

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
  
  const handlePrint = () => {
    window.print();
  }

  return (
    <div className="space-y-8">
      <PageTitle title="Account Statement" subtitle="Generate a detailed savings account statement for a member." />

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

      {statementData && (
        <Card>
          <CardHeader className="flex flex-row justify-between items-center no-print">
            <div>
              <CardTitle>Generated Statement</CardTitle>
              <CardDescription>
                For {statementData.member.fullName} from {format(statementData.dateRange.from!, 'PPP')} to {format(statementData.dateRange.to!, 'PPP')}
              </CardDescription>
            </div>
            <Button onClick={handlePrint} variant="outline">
              <Printer className="mr-2 h-4 w-4" /> Print Statement
            </Button>
          </CardHeader>
          <CardContent ref={printableRef} className="printable-area">
            <div className="p-6 border rounded-lg">
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b mb-4">
                    <div>
                        <Logo />
                        <p className="text-sm text-muted-foreground mt-1">Savings & Credit Association</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-bold text-primary">Account Statement</h2>
                        <p className="text-muted-foreground">
                            Period: {format(statementData.dateRange.from!, 'PPP')} to {format(statementData.dateRange.to!, 'PPP')}
                        </p>
                    </div>
                </div>

                {/* Member Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <Label className="font-semibold">Member Name:</Label>
                        <p>{statementData.member.fullName}</p>
                    </div>
                     <div>
                        <Label className="font-semibold">Account Number:</Label>
                        <p>{statementData.member.savingsAccountNumber}</p>
                    </div>
                    <div>
                        <Label className="font-semibold">School:</Label>
                        <p>{statementData.member.schoolName}</p>
                    </div>
                    <div>
                        <Label className="font-semibold">Address:</Label>
                        <p>{`${statementData.member.address.wereda}, ${statementData.member.address.subCity}, ${statementData.member.address.city}`}</p>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="overflow-x-auto rounded-lg border shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[120px]">Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
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
                                    <TableCell className="text-right text-destructive">{tx.debit > 0 ? `$${tx.debit.toFixed(2)}` : '-'}</TableCell>
                                    <TableCell className="text-right text-green-600">{tx.credit > 0 ? `$${tx.credit.toFixed(2)}` : '-'}</TableCell>
                                    <TableCell className="text-right">${tx.balance.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                             <TableRow className="font-semibold bg-muted/50">
                                <TableCell colSpan={4}>Closing Balance as of {format(statementData.dateRange.to!, 'PPP')}</TableCell>
                                <TableCell className="text-right">${statementData.closingBalance.toFixed(2)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                 <div className="text-center text-xs text-muted-foreground mt-4">
                    <p>Thank you for being a valued member of AcademInvest.</p>
                </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
