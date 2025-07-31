

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Search, Check, ChevronsUpDown, FileDown, DollarSign, Banknote, Wallet, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { LoanRepayment, Loan, Member, LoanType } from '@prisma/client';
import { cn } from '@/lib/utils';
import { exportToExcel } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { FileUpload } from '@/components/file-upload';
import { getLoanRepaymentsPageData, addLoanRepayment, type LoanRepaymentsPageData, type LoanRepaymentInput } from './actions';
import { useAuth } from '@/contexts/auth-context';

type RepaymentWithDetails = LoanRepayment & { 
    loan?: { loanAccountNumber: string | null },
    member?: { fullName: string },
};
type ActiveLoanWithMember = Loan & { member: Member | null } & { loanType: { name: string } | null };

const initialRepaymentFormState: Partial<LoanRepaymentInput> = {
  loanId: '',
  amountPaid: 0,
  paymentDate: new Date().toISOString().split('T')[0],
  depositMode: 'Cash',
  sourceName: '',
  transactionReference: '',
  evidenceUrl: '',
};

export default function LoanRepaymentsPage() {
  const [repayments, setRepayments] = useState<RepaymentWithDetails[]>([]);
  const [activeLoans, setActiveLoans] = useState<ActiveLoanWithMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRepayment, setCurrentRepayment] = useState<Partial<LoanRepaymentInput>>(initialRepaymentFormState);
  const [openLoanCombobox, setOpenLoanCombobox] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [minimumPayment, setMinimumPayment] = useState<number>(0);

  const [searchTerm, setSearchTerm] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const canCreate = useMemo(() => user?.permissions.includes('loanRepayment:create'), [user]);

  const fetchPageData = async () => {
    setIsLoading(true);
    try {
        const data = await getLoanRepaymentsPageData();
        setRepayments(data.repayments);
        setActiveLoans(data.activeLoans);
    } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load data.'})
    } finally {
        setIsLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      fetchPageData();
    }
  }, [user, toast]);
  
  useEffect(() => {
    setCurrentRepayment(initialRepaymentFormState);
    setMinimumPayment(0);
  }, [isModalOpen])
  
  useEffect(() => {
    if (currentRepayment.loanId) {
      const loan = activeLoans.find(l => l.id === currentRepayment.loanId);
      if (loan) {
        const principalPortion = loan.loanTerm > 0 ? loan.principalAmount / loan.loanTerm : 0;
        const interestPortion = loan.remainingBalance * (loan.interestRate / 12);
        const minPayment = principalPortion + interestPortion;
        setMinimumPayment(minPayment);
      }
    } else {
      setMinimumPayment(0);
    }
  }, [currentRepayment.loanId, activeLoans]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentRepayment(prev => ({ ...prev, [name]: name === 'amountPaid' ? parseFloat(value) : value }));
  };
  
  const handleDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setCurrentRepayment(prev => ({ ...prev, depositMode: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRepayment.loanId || !currentRepayment.amountPaid || currentRepayment.amountPaid <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'A loan and a valid payment amount are required.' });
      return;
    }
    if (currentRepayment.amountPaid < minimumPayment) {
      toast({ variant: 'destructive', title: 'Error', description: `Payment amount must be at least ${minimumPayment.toFixed(2)} Birr.` });
      return;
    }
    if ((currentRepayment.depositMode === 'Bank' || currentRepayment.depositMode === 'Wallet') && !currentRepayment.sourceName) {
      toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${currentRepayment.depositMode} Name.` });
      return;
    }
    
    setIsSubmitting(true);
    const result = await addLoanRepayment(currentRepayment as LoanRepaymentInput);

    if (result.success) {
        toast({ title: 'Repayment Recorded', description: result.message });
        await fetchPageData(); // Refresh data
        setIsModalOpen(false);
        setCurrentRepayment(initialRepaymentFormState);
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsSubmitting(false);
  };

  const filteredRepayments = useMemo(() => {
    return repayments.filter(repayment => {
      return repayment.member?.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [repayments, searchTerm]);
  
  const paginatedRepayments = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredRepayments.slice(startIndex, endIndex);
  }, [filteredRepayments, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredRepayments.length / rowsPerPage);
  }, [filteredRepayments.length, rowsPerPage]);

  const getPaginationItems = () => {
    if (totalPages <= 1) return [];
    const delta = 1;
    const left = currentPage - delta;
    const right = currentPage + delta + 1;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= left && i < right)) {
            range.push(i);
        }
    }

    let l: number | undefined;
    for (const i of range) {
        if (l) {
            if (i - l === 2) {
                rangeWithDots.push(l + 1);
            } else if (i - l !== 1) {
                rangeWithDots.push('...');
            }
        }
        rangeWithDots.push(i);
        l = i;
    }

    return rangeWithDots;
  };
  
  const paginationItems = getPaginationItems();

  const handleExport = () => {
    const dataToExport = filteredRepayments.map(r => {
      return {
        'Member Name': r.member?.fullName || 'N/A',
        'Loan Acct. #': r.loan?.loanAccountNumber || r.loanId,
        'Amount Paid (Birr)': r.amountPaid,
        'Payment Date': new Date(r.paymentDate).toLocaleDateString(),
        'Payment Mode': r.depositMode || 'N/A',
      }
    });
    exportToExcel(dataToExport, 'loan_repayments_export');
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Loan Repayments" subtitle="Record and view member loan repayments.">
          <Button onClick={handleExport} variant="outline"><FileDown className="mr-2 h-4 w-4" /> Export</Button>
          {canCreate && (
            <Button onClick={() => setIsModalOpen(true)}><PlusCircle className="mr-2 h-5 w-5" /> Record Repayment</Button>
          )}
      </PageTitle>

      <div className="relative flex-grow">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input type="search" placeholder="Search by member name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full" />
      </div>

      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Loan Acct. #</TableHead>
              <TableHead className="text-right">Amount Paid (Birr)</TableHead>
              <TableHead>Payment Date</TableHead>
              <TableHead>Payment Mode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            ) : paginatedRepayments.length > 0 ? paginatedRepayments.map(repayment => {
                return (
                    <TableRow key={repayment.id}>
                        <TableCell className="font-medium">{repayment.member?.fullName}</TableCell>
                        <TableCell className="font-mono text-xs">{repayment.loan?.loanAccountNumber}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">{repayment.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                        <TableCell>{new Date(repayment.paymentDate).toLocaleDateString()}</TableCell>
                        <TableCell>{repayment.depositMode || 'N/A'}</TableCell>
                    </TableRow>
                )
            }) : (
              <TableRow><TableCell colSpan={5} className="h-24 text-center">No repayments found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {filteredRepayments.length > 0 && (
        <div className="flex flex-col items-center gap-4 pt-4">
            <div className="flex items-center space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    Previous
                </Button>
                <div className="flex items-center gap-1">
                    {paginationItems.map((item, index) =>
                        typeof item === 'number' ? (
                            <Button
                                key={index}
                                variant={currentPage === item ? 'default' : 'outline'}
                                size="sm"
                                className="h-9 w-9 p-0"
                                onClick={() => setCurrentPage(item)}
                            >
                                {item}
                            </Button>
                        ) : (
                            <span key={index} className="px-2">
                                {item}
                            </span>
                        )
                    )}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                >
                    Next
                </Button>
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8 text-sm text-muted-foreground">
                <div>Page {currentPage} of {totalPages || 1}</div>
                <div>{filteredRepayments.length} repayment(s) found.</div>
                <div className="flex items-center space-x-2">
                    <p className="font-medium">Rows:</p>
                    <Select
                        value={`${rowsPerPage}`}
                        onValueChange={(value) => {
                            setRowsPerPage(Number(value));
                            setCurrentPage(1);
                        }}
                    >
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={`${rowsPerPage}`} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[10, 15, 20, 25, 50].map((pageSize) => (
                                <SelectItem key={pageSize} value={`${pageSize}`}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">Record Loan Repayment</DialogTitle>
            <DialogDescription>Select an active loan and enter the repayment details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="loanIdRepay">Loan <span className="text-destructive">*</span></Label>
              <Popover open={openLoanCombobox} onOpenChange={setOpenLoanCombobox}>
                <PopoverTrigger asChild>
                  <Button id="loanIdRepay" variant="outline" role="combobox" className="w-full justify-between">
                    {currentRepayment.loanId ? `Acct #${activeLoans.find(l=>l.id === currentRepayment.loanId)?.loanAccountNumber} - ${activeLoans.find(l=>l.id === currentRepayment.loanId)?.member?.fullName}` : "Select a loan..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search by member or loan ID..." />
                    <CommandList><CommandEmpty>No active loans found.</CommandEmpty><CommandGroup>
                        {activeLoans.map(loan => (
                          <CommandItem key={loan.id} value={`${loan.member?.fullName} ${loan.id} ${loan.loanAccountNumber}`} onSelect={() => { setCurrentRepayment(prev => ({ ...prev, loanId: loan.id })); setOpenLoanCombobox(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", currentRepayment.loanId === loan.id ? "opacity-100" : "opacity-0")} />
                            {loan.member?.fullName} ({loan.loanType?.name}) - Acct: {loan.loanAccountNumber} - Bal: {loan.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr
                          </CommandItem>
                        ))}
                    </CommandGroup></CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amountPaid">Amount Paid (Birr) <span className="text-destructive">*</span></Label>
                <Input id="amountPaid" name="amountPaid" type="number" step="any" value={currentRepayment.amountPaid || ''} onChange={handleInputChange} min={minimumPayment} required />
                 {minimumPayment > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum payment: {minimumPayment.toFixed(2)} Birr
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="paymentDate">Payment Date <span className="text-destructive">*</span></Label>
                <Input id="paymentDate" name="paymentDate" type="date" value={currentRepayment.paymentDate || ''} onChange={handleInputChange} required />
              </div>
            </div>
            <Separator />
            <div>
              <Label>Payment Mode</Label>
              <RadioGroup value={currentRepayment.depositMode || 'Cash'} onValueChange={handleDepositModeChange} className="flex flex-wrap gap-x-4 pt-2">
                <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="repayCash" /><Label htmlFor="repayCash">Cash</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="repayBank" /><Label htmlFor="repayBank">Bank</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="Wallet" id="repayWallet" /><Label htmlFor="repayWallet">Wallet</Label></div>
              </RadioGroup>
            </div>
            {(currentRepayment.depositMode === 'Bank' || currentRepayment.depositMode === 'Wallet') && (
              <div className="space-y-4 pt-2 pl-2 border-l-2 border-primary/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sourceName">{currentRepayment.depositMode} Name <span className="text-destructive">*</span></Label>
                    <Input id="sourceName" name="sourceName" value={currentRepayment.sourceName || ''} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor="transactionReference">Transaction Ref</Label>
                    <Input id="transactionReference" name="transactionReference" value={currentRepayment.transactionReference || ''} onChange={handleInputChange} />
                  </div>
                </div>
                 <div className="pl-1 pt-4">
                    <FileUpload
                        id="repaymentEvidence"
                        label="Evidence Attachment"
                        value={currentRepayment.evidenceUrl || ''}
                        onValueChange={(newValue) => {
                           setCurrentRepayment(prev => ({...prev, evidenceUrl: newValue}));
                        }}
                    />
                </div>
              </div>
            )}
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Repayment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

