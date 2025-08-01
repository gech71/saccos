

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Search, Check, ChevronsUpDown, FileDown, DollarSign, Banknote, Wallet, Loader2, Users, Filter } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import type { Loan, Member, LoanType, LoanRepayment } from '@prisma/client';
import { cn } from '@/lib/utils';
import { exportToExcel } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { FileUpload } from '@/components/file-upload';
import { getLoanRepaymentsPageData, addLoanRepayment, type LoanRepaymentsPageData, type LoanRepaymentInput, type RepaymentsByMember } from './actions';
import { useAuth } from '@/contexts/auth-context';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

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
  const [repaymentsByMember, setRepaymentsByMember] = useState<RepaymentsByMember[]>([]);
  const [activeLoans, setActiveLoans] = useState<ActiveLoanWithMember[]>([]);
  const [loanTypes, setLoanTypes] = useState<Pick<LoanType, 'id' | 'name'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRepayment, setCurrentRepayment] = useState<Partial<LoanRepaymentInput>>(initialRepaymentFormState);
  const [openLoanCombobox, setOpenLoanCombobox] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [minimumPayment, setMinimumPayment] = useState<number>(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLoanTypeFilter, setSelectedLoanTypeFilter] = useState('all');

  const canCreate = useMemo(() => user?.permissions.includes('loanRepayment:create'), [user]);

  const fetchPageData = async () => {
    setIsLoading(true);
    try {
        const data = await getLoanRepaymentsPageData();
        setRepaymentsByMember(data.repaymentsByMember);
        setActiveLoans(data.activeLoans);
        setLoanTypes(data.loanTypes);
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
    const selectedLoan = activeLoans.find(l => l.id === currentRepayment.loanId);
    if (selectedLoan) {
      const interestForMonth = selectedLoan.remainingBalance * (selectedLoan.interestRate / 12);
      const finalPaymentAmount = selectedLoan.remainingBalance + interestForMonth;
      if (currentRepayment.amountPaid > finalPaymentAmount + 0.01) { // Add tolerance for float issues
          toast({ variant: 'destructive', title: 'Error', description: `Payment amount cannot exceed the final settlement amount of ${finalPaymentAmount.toFixed(2)} Birr.` });
          return;
      }
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

  const filteredRepaymentsByMember = useMemo(() => {
    if (!repaymentsByMember) return [];
    
    const termLower = searchTerm.toLowerCase();
    
    return repaymentsByMember
      .map(group => {
        const filteredRepayments = group.repayments.filter(repayment => 
          (selectedLoanTypeFilter === 'all' || repayment.loan?.loanTypeName === selectedLoanTypeFilter)
        );
        
        if (filteredRepayments.length === 0) return null;
        
        if (!group.memberName.toLowerCase().includes(termLower)) return null;

        return {
          ...group,
          repayments: filteredRepayments,
          repaymentCount: filteredRepayments.length,
          totalRepaid: filteredRepayments.reduce((sum, r) => sum + r.amountPaid, 0),
        };
      })
      .filter((group): group is RepaymentsByMember => group !== null);
  }, [repaymentsByMember, searchTerm, selectedLoanTypeFilter]);

  const handleExport = () => {
    const dataToExport = filteredRepaymentsByMember.flatMap(group => 
        group.repayments.map(r => ({
            'Member Name': group.memberName || 'N/A',
            'Loan Acct. #': r.loan?.loanAccountNumber || r.loanId,
            'Loan Type': r.loan?.loanTypeName || 'N/A',
            'Amount Paid (Birr)': r.amountPaid,
            'Principal Paid (Birr)': r.principalPaid,
            'Interest Paid (Birr)': r.interestPaid,
            'Payment Date': new Date(r.paymentDate).toLocaleDateString(),
            'Payment Mode': r.depositMode || 'N/A',
        }))
    );
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

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input type="search" placeholder="Search by member name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full" />
        </div>
        <Select value={selectedLoanTypeFilter} onValueChange={setSelectedLoanTypeFilter}>
            <SelectTrigger className="w-full sm:w-[220px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by loan type" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Loan Types</SelectItem>
                {loanTypes.map(type => (
                    <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>

      <div>
        <Accordion type="multiple" className="w-full">
          {isLoading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : filteredRepaymentsByMember.length > 0 ? filteredRepaymentsByMember.map(group => (
              <AccordionItem value={group.memberId} key={group.memberId}>
                  <AccordionTrigger className="px-6 py-4 text-lg hover:bg-muted/50 hover:no-underline rounded-lg border">
                    <div className="flex-1 text-left flex items-center gap-4">
                      <Users className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{group.memberName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-normal text-muted-foreground">
                      <Badge variant="secondary">{group.repaymentCount} Repayment(s)</Badge>
                      <span className="font-semibold">{group.totalRepaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0">
                     <div className="overflow-x-auto border-t">
                          <Table>
                              <TableHeader>
                              <TableRow>
                                  <TableHead>Loan Acct. #</TableHead>
                                  <TableHead>Payment Date</TableHead>
                                  <TableHead className="text-right">Total Paid (Birr)</TableHead>
                                  <TableHead className="text-right">Principal Paid (Birr)</TableHead>
                                  <TableHead className="text-right">Interest Paid (Birr)</TableHead>
                                  <TableHead className="text-right">Remaining Balance</TableHead>
                                  <TableHead>Payment Mode</TableHead>
                              </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {group.repayments.map(repayment => (
                                      <TableRow key={repayment.id}>
                                          <TableCell className="font-mono text-xs">{repayment.loan?.loanAccountNumber}</TableCell>
                                          <TableCell>{format(parseISO(repayment.paymentDate), 'PPP')}</TableCell>
                                          <TableCell className="text-right font-semibold text-primary">{repayment.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                          <TableCell className="text-right text-green-600">{repayment.principalPaid?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</TableCell>
                                          <TableCell className="text-right text-orange-600">{repayment.interestPaid?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</TableCell>
                                          <TableCell className="text-right font-medium">{repayment.balanceAfter?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</TableCell>
                                          <TableCell><Badge variant="outline">{repayment.depositMode || 'N/A'}</Badge></TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                     </div>
                  </AccordionContent>
              </AccordionItem>
          )) : (
            <div className="p-12 text-center text-muted-foreground">No repayments found.</div>
          )}
        </Accordion>
      </div>
      
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
                <Input id="amountPaid" name="amountPaid" type="number" step="any" value={currentRepayment.amountPaid || ''} onChange={handleInputChange} required />
                 {minimumPayment > 0 && currentRepayment.loanId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Final settlement: {(activeLoans.find(l => l.id === currentRepayment.loanId)!.remainingBalance + activeLoans.find(l => l.id === currentRepayment.loanId)!.remainingBalance * (activeLoans.find(l => l.id === currentRepayment.loanId)!.interestRate / 12)).toFixed(2)}
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
