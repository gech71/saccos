
'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Loader2, FileDown, Check, ChevronsUpDown, DollarSign } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Badge } from '@/components/ui/badge';
import { useSearchParams } from 'next/navigation';
import { generateStatement, getMembersForStatement, type StatementData, type MemberForStatement } from './actions';
import { useAuth } from '@/contexts/auth-context';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

function AccountStatementContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [allMembers, setAllMembers] = useState<MemberForStatement[]>([]);

  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const selectedMember = useMemo(() => {
    return allMembers.find(m => m.id === selectedMemberId);
  }, [selectedMemberId, allMembers]);

  useEffect(() => {
    if (!user) return; // Wait for user context to be available
    
    async function fetchData() {
      const members = await getMembersForStatement();
      setAllMembers(members);
    }
    fetchData();

    const memberIdFromQuery = searchParams.get('memberId');
    if (memberIdFromQuery) {
        setSelectedMemberId(memberIdFromQuery);
    }
  }, [user, searchParams]);
  
  // Reset account selection when member changes
  useEffect(() => {
      setSelectedAccountId('');
      setStatementData(null);
  }, [selectedMemberId]);

  const handleGenerateStatement = async () => {
    if (!selectedMemberId || !selectedAccountId || !dateRange?.from || !dateRange?.to) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a member, an account, and a valid date range.' });
      return;
    }
    setIsLoading(true);

    try {
        const data = await generateStatement(selectedMemberId, selectedAccountId, dateRange);
        if (data) {
            setStatementData(data);
            toast({ title: 'Statement Generated', description: `Statement for ${data.member.fullName} is ready.` });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not generate statement.' });
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    } finally {
        setIsLoading(false);
    }
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
            <PageTitle title="Account Statement" subtitle="Generate a detailed savings account statement for any member." />

            <Card className="statement-form">
                <CardHeader>
                <CardTitle>Selection Criteria</CardTitle>
                <CardDescription>Select a member, account, and date range to generate their statement.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                            ? allMembers.find((member) => member.id === selectedMemberId)?.fullName
                            : "Select member..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                        <CommandInput placeholder="Search by name or ID..." />
                        <CommandList>
                            <CommandEmpty>No member found.</CommandEmpty>
                            <CommandGroup>
                            {allMembers.map((member) => (
                                <CommandItem
                                key={member.id}
                                value={`${member.fullName} ${member.id}`}
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
                                {member.fullName}
                                {member.status === 'inactive' && <Badge variant="outline" className="ml-auto text-destructive border-destructive">Closed</Badge>}
                                </CommandItem>
                            ))}
                            </CommandGroup>
                        </CommandList>
                        </Command>
                    </PopoverContent>
                    </Popover>
                </div>
                <div>
                  <Label htmlFor="account-select">Savings Account</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId} disabled={!selectedMember}>
                      <SelectTrigger id="account-select">
                          <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                      <SelectContent>
                          {selectedMember?.memberSavingAccounts.map(account => (
                              <SelectItem key={account.id} value={account.id}>
                                  {account.savingAccountType?.name} ({account.accountNumber})
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                </div>
                <div>
                    <Label htmlFor="date-range-picker">Statement Period</Label>
                    <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        id="date-range-picker"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        disabled={selectedMember?.status === 'inactive'}
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
                <Button onClick={handleGenerateStatement} disabled={isLoading || !selectedAccountId}>
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
                        <h2 className="text-2xl font-bold text-primary">
                             {statementData.member.status === 'inactive' ? 'Final Account Statement' : 'Account Statement'}
                        </h2>
                        <p className="text-gray-500">
                            Period: {format(statementData.dateRange.from!, 'PPP')} to {format(statementData.dateRange.to!, 'PPP')}
                        </p>
                    </div>
                </div>

                {/* Member Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <Label className="font-semibold text-gray-700">Member Name:</Label>
                        <div>{statementData.member.fullName}</div>
                    </div>
                     <div>
                        <Label className="font-semibold text-gray-700">Account Number:</Label>
                        <div>{statementData.account.accountNumber} ({statementData.account.savingAccountType?.name})</div>
                    </div>
                    <div>
                        <Label className="font-semibold text-gray-700">School:</Label>
                        <div>{statementData.schoolName}</div>
                    </div>
                    <div>
                        <Label className="font-semibold text-gray-700">Member Status:</Label>
                         <div>
                            <Badge variant={statementData.member.status === 'inactive' ? 'destructive' : 'default'}>{statementData.member.status || 'Active'}</Badge>
                        </div>
                    </div>
                </div>

                {/* Summary Section */}
                <Card className="mb-6 bg-muted/50 border-primary/20">
                    <CardHeader>
                        <CardTitle className="text-lg">Summary for Period</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Opening Balance</p>
                            <p className="font-semibold">{statementData.balanceBroughtForward.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Total Deposits</p>
                            <p className="font-semibold text-green-600">+ {statementData.totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Total Withdrawals</p>
                            <p className="font-semibold text-red-600">- {statementData.totalWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Closing Balance</p>
                            <p className="font-bold text-primary">{statementData.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</p>
                        </div>
                    </CardContent>
                </Card>


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
                                <TableCell className="text-right">{statementData.balanceBroughtForward.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                            </TableRow>
                            {statementData.transactions.length > 0 ? statementData.transactions.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell>{format(new Date(tx.date), 'PPP')}</TableCell>
                                    <TableCell className="capitalize">{tx.notes || tx.transactionType}</TableCell>
                                    <TableCell className="text-right text-red-600">{tx.debit > 0 ? `${tx.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr` : '-'}</TableCell>
                                    <TableCell className="text-right text-green-600">{tx.credit > 0 ? `${tx.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr` : '-'}</TableCell>
                                    <TableCell className="text-right">{tx.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">No transactions in this period.</TableCell>
                                </TableRow>
                            )}
                             <TableRow className="font-semibold bg-gray-100">
                                <TableCell colSpan={4}>Closing Balance as of {format(statementData.dateRange.to!, 'PPP')}</TableCell>
                                <TableCell className="text-right">{statementData.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
                 <div className="text-center text-xs text-gray-500 mt-4">
                    {statementData.member.status === 'inactive'
                        ? <p>This is the final statement for this closed account.</p>
                        : <p>Thank you for being a valued member of AcademInvest.</p>
                    }
                </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AccountStatementPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AccountStatementContent />
        </Suspense>
    )
}

    