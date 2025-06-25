
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Search, Filter, Check, ChevronsUpDown, FileDown, DollarSign, Banknote, Wallet, UploadCloud } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { mockLoanRepayments, mockLoans, mockMembers } from '@/data/mock';
import type { LoanRepayment, Loan, Member } from '@/types';
import { cn } from '@/lib/utils';
import { exportToExcel } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { FileUpload } from '@/components/file-upload';

const initialRepaymentFormState: Partial<LoanRepayment> = {
  loanId: '',
  memberId: '',
  amountPaid: 0,
  paymentDate: new Date().toISOString().split('T')[0],
  depositMode: 'Cash',
  paymentDetails: {
    sourceName: '',
    transactionReference: '',
    evidenceUrl: '',
  },
};

export default function LoanRepaymentsPage() {
  const [repayments, setRepayments] = useState<LoanRepayment[]>(mockLoanRepayments);
  const [loans, setLoans] = useState<Loan[]>(mockLoans);
  const [members] = useState<Member[]>(mockMembers);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRepayment, setCurrentRepayment] = useState<Partial<LoanRepayment>>(initialRepaymentFormState);
  const [openLoanCombobox, setOpenLoanCombobox] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null);
  const [loggedInMemberId, setLoggedInMemberId] = useState<string | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('userRole') as 'admin' | 'member' | null;
    const memberId = localStorage.getItem('loggedInMemberId');
    setUserRole(role);
    setLoggedInMemberId(memberId);
  }, []);

  const activeLoans = useMemo(() => loans.filter(l => l.status === 'active' || l.status === 'overdue'), [loans]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nameParts = name.split('.');

    if (nameParts.length > 1 && nameParts[0] === 'paymentDetails') {
      const detailKey = nameParts[1] as keyof NonNullable<LoanRepayment['paymentDetails']>;
      setCurrentRepayment(prev => ({ ...prev, paymentDetails: { ...(prev.paymentDetails || {}), [detailKey]: value } }));
    } else {
      setCurrentRepayment(prev => ({ ...prev, [name]: name === 'amountPaid' ? parseFloat(value) : value }));
    }
  };
  
  const handleDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setCurrentRepayment(prev => ({ ...prev, depositMode: value }));
  };

  const handleLoanSelect = (loanId: string) => {
    const selectedLoan = activeLoans.find(l => l.id === loanId);
    if (selectedLoan) {
      setCurrentRepayment(prev => ({ ...prev, loanId, memberId: selectedLoan.memberId }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRepayment.loanId || !currentRepayment.amountPaid || currentRepayment.amountPaid <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'A loan and a valid payment amount are required.' });
      return;
    }
    if ((currentRepayment.depositMode === 'Bank' || currentRepayment.depositMode === 'Wallet') && !currentRepayment.paymentDetails?.sourceName) {
      toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${currentRepayment.depositMode} Name.` });
      return;
    }
    
    const memberName = members.find(m => m.id === currentRepayment.memberId)?.fullName;
    const newRepayment: LoanRepayment = {
      ...initialRepaymentFormState,
      ...currentRepayment,
      id: `repay-${Date.now()}`,
      memberName,
    } as LoanRepayment;

    setRepayments(prev => [newRepayment, ...prev]);
    
    // Simulate updating the loan balance
    setLoans(prevLoans => prevLoans.map(loan => {
        if (loan.id === newRepayment.loanId) {
            const newBalance = loan.remainingBalance - newRepayment.amountPaid;
            return {
                ...loan,
                remainingBalance: newBalance,
                status: newBalance <= 0 ? 'paid_off' : loan.status,
            };
        }
        return loan;
    }));
    
    toast({ title: 'Repayment Recorded', description: `Repayment of $${newRepayment.amountPaid.toFixed(2)} for ${memberName} recorded.` });
    setIsModalOpen(false);
    setCurrentRepayment(initialRepaymentFormState);
  };

  const filteredRepayments = useMemo(() => {
    return repayments.filter(repayment => {
      if (userRole === 'member' && repayment.memberId !== loggedInMemberId) {
        return false;
      }
      const member = members.find(m => m.id === repayment.memberId);
      return userRole === 'admin' ? (member ? member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) : false) : true;
    });
  }, [repayments, members, searchTerm, userRole, loggedInMemberId]);

  const handleExport = () => {
    const dataToExport = filteredRepayments.map(r => ({
      'Member Name': r.memberName || 'N/A',
      'Loan Acct. #': loans.find(l => l.id === r.loanId)?.loanAccountNumber || r.loanId,
      'Amount Paid ($)': r.amountPaid,
      'Payment Date': new Date(r.paymentDate).toLocaleDateString(),
      'Payment Mode': r.depositMode || 'N/A',
    }));
    exportToExcel(dataToExport, 'loan_repayments_export');
  };

  return (
    <div className="space-y-6">
      <PageTitle title={userRole === 'member' ? 'My Loan Repayments' : "Loan Repayments"} subtitle={userRole === 'member' ? 'Your loan payment history.' : "Record and view member loan repayments."}>
        {userRole === 'admin' && (
          <>
            <Button onClick={handleExport} variant="outline"><FileDown className="mr-2 h-4 w-4" /> Export</Button>
            <Button onClick={() => setIsModalOpen(true)}><PlusCircle className="mr-2 h-5 w-5" /> Record Repayment</Button>
          </>
        )}
      </PageTitle>

      {userRole === 'admin' && (
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input type="search" placeholder="Search by member name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full" />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              {userRole === 'admin' && <TableHead>Member</TableHead>}
              <TableHead>Loan Acct. #</TableHead>
              <TableHead className="text-right">Amount Paid ($)</TableHead>
              <TableHead>Payment Date</TableHead>
              <TableHead>Payment Mode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRepayments.length > 0 ? filteredRepayments.map(repayment => (
              <TableRow key={repayment.id}>
                {userRole === 'admin' && <TableCell className="font-medium">{repayment.memberName}</TableCell>}
                <TableCell className="font-mono text-xs">{loans.find(l => l.id === repayment.loanId)?.loanAccountNumber}</TableCell>
                <TableCell className="text-right font-semibold text-green-600">${repayment.amountPaid.toFixed(2)}</TableCell>
                <TableCell>{new Date(repayment.paymentDate).toLocaleDateString()}</TableCell>
                <TableCell>{repayment.depositMode || 'N/A'}</TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={userRole === 'admin' ? 5 : 4} className="h-24 text-center">No repayments found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">Record Loan Repayment</DialogTitle>
            <DialogDescription>Select an active loan and enter the repayment details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="loanIdRepay">Loan</Label>
              <Popover open={openLoanCombobox} onOpenChange={setOpenLoanCombobox}>
                <PopoverTrigger asChild>
                  <Button id="loanIdRepay" variant="outline" role="combobox" className="w-full justify-between">
                    {currentRepayment.loanId ? `Acct #${loans.find(l=>l.id === currentRepayment.loanId)?.loanAccountNumber} - ${loans.find(l=>l.id === currentRepayment.loanId)?.memberName}` : "Select a loan..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search by member or loan ID..." />
                    <CommandList><CommandEmpty>No active loans found.</CommandEmpty><CommandGroup>
                        {activeLoans.map(loan => (
                          <CommandItem key={loan.id} value={`${loan.memberName} ${loan.id} ${loan.loanAccountNumber}`} onSelect={() => { handleLoanSelect(loan.id); setOpenLoanCombobox(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", currentRepayment.loanId === loan.id ? "opacity-100" : "opacity-0")} />
                            {loan.memberName} ({loan.loanTypeName}) - Acct: {loan.loanAccountNumber} - Bal: ${loan.remainingBalance.toFixed(2)}
                          </CommandItem>
                        ))}
                    </CommandGroup></CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amountPaid">Amount Paid ($)</Label>
                <Input id="amountPaid" name="amountPaid" type="number" step="0.01" value={currentRepayment.amountPaid || ''} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="paymentDate">Payment Date</Label>
                <Input id="paymentDate" name="paymentDate" type="date" value={currentRepayment.paymentDate} onChange={handleInputChange} required />
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
                    <Label htmlFor="paymentDetails.sourceName">{currentRepayment.depositMode} Name</Label>
                    <Input id="paymentDetails.sourceName" name="paymentDetails.sourceName" value={currentRepayment.paymentDetails?.sourceName || ''} onChange={handleInputChange} />
                  </div>
                  <div>
                    <Label htmlFor="paymentDetails.transactionReference">Transaction Ref</Label>
                    <Input id="paymentDetails.transactionReference" name="paymentDetails.transactionReference" value={currentRepayment.paymentDetails?.transactionReference || ''} onChange={handleInputChange} />
                  </div>
                </div>
                 <div className="pl-1 pt-4">
                    <FileUpload
                        id="repaymentEvidence"
                        label="Evidence Attachment"
                        value={currentRepayment.paymentDetails?.evidenceUrl || ''}
                        onValueChange={(newValue) => {
                            setCurrentRepayment(prev => ({
                                ...prev,
                                paymentDetails: {
                                    ...(prev.paymentDetails || { sourceName: '', transactionReference: '', evidenceUrl: '' }),
                                    evidenceUrl: newValue,
                                }
                            }));
                        }}
                    />
                </div>
              </div>
            )}
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">Record Repayment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
