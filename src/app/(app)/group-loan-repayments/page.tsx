
'use client';

import React, { useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { mockSchools, mockMembers, mockLoans, mockLoanRepayments } from '@/data/mock';
import type { School, Member, Loan, LoanRepayment } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Filter, DollarSign, Banknote, Wallet, UploadCloud, Loader2, CheckCircle, RotateCcw } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface LoanWithMemberInfo extends Loan {
  schoolId: string;
}

const initialBatchTransactionState: Partial<Pick<LoanRepayment, 'paymentDate' | 'depositMode' | 'paymentDetails'>> = {
  paymentDate: new Date().toISOString().split('T')[0],
  depositMode: 'Cash',
  paymentDetails: {
    sourceName: '',
    transactionReference: '',
    evidenceUrl: '',
  },
};

export default function GroupLoanRepaymentsPage() {
  const { toast } = useToast();
  
  const [allSchools] = useState<School[]>(mockSchools);
  const [allMembers] = useState<Member[]>(mockMembers);
  const [allLoans, setAllLoans] = useState<Loan[]>(mockLoans);
  const [allRepayments, setAllRepayments] = useState<LoanRepayment[]>(mockLoanRepayments);

  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);
  const [eligibleLoans, setEligibleLoans] = useState<LoanWithMemberInfo[]>([]);

  const [repaymentAmounts, setRepaymentAmounts] = useState<Record<string, number>>({});
  const [batchDetails, setBatchDetails] = useState(initialBatchTransactionState);
  const [isPosting, setIsPosting] = useState(false);
  const [postedTransactions, setPostedTransactions] = useState<LoanRepayment[] | null>(null);

  const handleLoadLoans = () => {
    if (!selectedSchool) {
      toast({ variant: 'destructive', title: 'Missing Filters', description: 'Please select a school.' });
      return;
    }
    setIsLoadingLoans(true);
    setPostedTransactions(null);
    setRepaymentAmounts({});
    setTimeout(() => {
      const memberIdsInSchool = allMembers.filter(m => m.schoolId === selectedSchool).map(m => m.id);
      const filteredLoans = allLoans
        .filter(loan => memberIdsInSchool.includes(loan.memberId) && (loan.status === 'active' || loan.status === 'overdue'))
        .map(loan => ({...loan, schoolId: selectedSchool}));
      
      setEligibleLoans(filteredLoans);
      
      // Pre-fill repayment amounts with expected monthly payment
      const initialRepayments: Record<string, number> = {};
      filteredLoans.forEach(loan => {
          initialRepayments[loan.id] = loan.monthlyRepaymentAmount || 0;
      });
      setRepaymentAmounts(initialRepayments);
      
      setIsLoadingLoans(false);
      if (filteredLoans.length === 0) {
        toast({ title: 'No Active Loans Found', description: 'No active or overdue loans for members in the selected school.' });
      }
    }, 500);
  };

  const handleRepaymentAmountChange = (loanId: string, amount: string) => {
    setRepaymentAmounts(prev => ({ ...prev, [loanId]: parseFloat(amount) || 0 }));
  };

  const totalToCollect = useMemo(() => {
    return Object.values(repaymentAmounts).reduce((sum, amount) => sum + amount, 0);
  }, [repaymentAmounts]);

  const handleBatchDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
     const nameParts = name.split('.');
    if (nameParts.length > 1 && nameParts[0] === 'paymentDetails') {
        const fieldName = nameParts[1] as keyof NonNullable<LoanRepayment['paymentDetails']>;
        setBatchDetails(prev => ({
            ...prev,
            paymentDetails: {
                ...(prev?.paymentDetails || {}),
                [fieldName]: value,
            }
        }));
    } else {
       setBatchDetails(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setBatchDetails(prev => ({
      ...prev,
      depositMode: value,
      paymentDetails: value === 'Cash' ? undefined : (prev.paymentDetails || { sourceName: '', transactionReference: '', evidenceUrl: '' }),
    }));
  };

  const handleSubmitCollection = () => {
    const loansWithPayments = Object.entries(repaymentAmounts).filter(([, amount]) => amount > 0);
    if (loansWithPayments.length === 0) {
      toast({ variant: 'destructive', title: 'No Payments Entered', description: 'Please enter repayment amounts for at least one loan.' });
      return;
    }
    if ((batchDetails.depositMode === 'Bank' || batchDetails.depositMode === 'Wallet') && !batchDetails.paymentDetails?.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${batchDetails.depositMode} Name.` });
        return;
    }

    setIsPosting(true);
    const newRepayments: LoanRepayment[] = [];
    const updatedLoans = [...allLoans];

    loansWithPayments.forEach(([loanId, amountPaid]) => {
      const loan = eligibleLoans.find(l => l.id === loanId);
      if (loan) {
        const newRepayment: LoanRepayment = {
          id: `repay-${Date.now()}-${loanId}`,
          loanId: loan.id,
          memberId: loan.memberId,
          memberName: loan.memberName,
          amountPaid,
          paymentDate: batchDetails.date!,
          depositMode: batchDetails.depositMode,
          paymentDetails: batchDetails.depositMode === 'Cash' ? undefined : batchDetails.paymentDetails,
        };
        newRepayments.push(newRepayment);

        // Update loan balance
        const loanIndex = updatedLoans.findIndex(l => l.id === loanId);
        if (loanIndex > -1) {
            const newBalance = updatedLoans[loanIndex].remainingBalance - amountPaid;
            updatedLoans[loanIndex] = {
                ...updatedLoans[loanIndex],
                remainingBalance: newBalance,
                status: newBalance <= 0 ? 'paid_off' : updatedLoans[loanIndex].status,
            };
        }
      }
    });

    setTimeout(() => {
      setAllLoans(updatedLoans);
      setAllRepayments(prev => [...prev, ...newRepayments]);
      toast({ title: 'Repayments Recorded', description: `Recorded ${newRepayments.length} loan repayments.` });
      setIsPosting(false);
      setEligibleLoans([]);
      setRepaymentAmounts({});
      setPostedTransactions(newRepayments);
    }, 1000);
  };
  
  const startNewBatch = () => {
    setPostedTransactions(null);
    setSelectedSchool('');
    setEligibleLoans([]);
    setRepaymentAmounts({});
    setBatchDetails(initialBatchTransactionState);
  };

  return (
    <div className="space-y-8">
      <PageTitle title="Group Loan Repayments" subtitle="Process loan repayments for a group of members." />

      {!postedTransactions && (
        <>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-primary">Selection Criteria</CardTitle>
              <CardDescription>Select a school to load all active loans for its members.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <Label htmlFor="schoolFilter">School</Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger id="schoolFilter"><SelectValue placeholder="Select School" /></SelectTrigger>
                  <SelectContent>{allSchools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={handleLoadLoans} disabled={isLoadingLoans || !selectedSchool} className="w-full md:w-auto">
                {isLoadingLoans ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                Load Loans
              </Button>
            </CardContent>
          </Card>

          {eligibleLoans.length > 0 && (
            <Card className="shadow-lg animate-in fade-in duration-300">
              <CardHeader>
                <CardTitle className="font-headline text-primary">Active Loans for {allSchools.find(s => s.id === selectedSchool)?.name}</CardTitle>
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm text-muted-foreground gap-2">
                    <span>{eligibleLoans.length} active/overdue loans found.</span>
                    <span className="font-bold text-primary">Total Amount to be Collected: ${totalToCollect.toFixed(2)}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border shadow-sm mb-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member Name</TableHead>
                        <TableHead>Loan Acct. #</TableHead>
                        <TableHead>Remaining Balance</TableHead>
                        <TableHead>Exp. Monthly Repayment</TableHead>
                        <TableHead className="w-[200px]">Amount to be Paid ($)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eligibleLoans.map(loan => (
                        <TableRow key={loan.id}>
                          <TableCell className="font-medium">{loan.memberName}</TableCell>
                          <TableCell className="font-mono text-xs">{loan.loanAccountNumber}</TableCell>
                          <TableCell className="text-right">${loan.remainingBalance.toFixed(2)}</TableCell>
                          <TableCell className="text-right">${(loan.monthlyRepaymentAmount || 0).toFixed(2)}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={repaymentAmounts[loan.id] || ''}
                              onChange={(e) => handleRepaymentAmountChange(loan.id, e.target.value)}
                              className="text-right"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Separator className="my-6" />
                
                <Label className="text-lg font-semibold text-primary mb-2 block">Batch Payment Details</Label>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="batchDetails.date">Payment Date</Label>
                        <Input id="batchDetails.date" name="date" type="date" value={batchDetails.date || ''} onChange={handleBatchDetailChange} required />
                    </div>
                    <div>
                        <Label htmlFor="depositModeBatch">Payment Mode</Label>
                        <RadioGroup id="depositModeBatch" value={batchDetails.depositMode || 'Cash'} onValueChange={handleDepositModeChange} className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="cashBatch" /><Label htmlFor="cashBatch">Cash</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="bankBatch" /><Label htmlFor="bankBatch">Bank</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Wallet" id="walletBatch" /><Label htmlFor="walletBatch">Wallet</Label></div>
                        </RadioGroup>
                    </div>

                    {(batchDetails.depositMode === 'Bank' || batchDetails.depositMode === 'Wallet') && (
                        <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
                                <div>
                                    <Label htmlFor="paymentDetails.sourceNameBatch">{batchDetails.depositMode} Name</Label>
                                    <Input id="paymentDetails.sourceNameBatch" name="paymentDetails.sourceName" placeholder={`Enter ${batchDetails.depositMode} Name`} value={batchDetails.paymentDetails?.sourceName || ''} onChange={handleBatchDetailChange} />
                                </div>
                                <div>
                                    <Label htmlFor="paymentDetails.transactionReferenceBatch">Transaction Reference</Label>
                                    <Input id="paymentDetails.transactionReferenceBatch" name="paymentDetails.transactionReference" placeholder="e.g., TRN123XYZ" value={batchDetails.paymentDetails?.transactionReference || ''} onChange={handleBatchDetailChange} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSubmitCollection} disabled={isPosting || totalToCollect <= 0} className="w-full md:w-auto ml-auto">
                  {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Record {Object.values(repaymentAmounts).filter(amt => amt > 0).length} Repayments
                </Button>
              </CardFooter>
            </Card>
          )}
        </>
      )}

      {postedTransactions && (
        <Card className="shadow-lg animate-in fade-in duration-300">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="font-headline text-primary">Repayments Recorded Successfully</CardTitle>
                        <CardDescription>The following loan repayments have been recorded and balances have been updated.</CardDescription>
                    </div>
                    <Button onClick={startNewBatch} variant="outline">
                        <RotateCcw className="mr-2 h-4 w-4" /> Start New Batch Repayment
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                 <div className="overflow-x-auto rounded-lg border shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Member Name</TableHead>
                                <TableHead>Loan Acct. #</TableHead>
                                <TableHead className="text-right">Amount Paid ($)</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Payment Mode</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {postedTransactions.map(transaction => (
                                <TableRow key={transaction.id}>
                                    <TableCell className="font-medium">{transaction.memberName}</TableCell>
                                    <TableCell className="font-mono text-xs">{allLoans.find(l=>l.id === transaction.loanId)?.loanAccountNumber}</TableCell>
                                    <TableCell className="text-right">${transaction.amountPaid.toFixed(2)}</TableCell>
                                    <TableCell>{new Date(transaction.paymentDate).toLocaleDateString()}</TableCell>
                                    <TableCell><Badge variant={transaction.depositMode === 'Cash' ? 'secondary' : 'outline'}>{transaction.depositMode}</Badge></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
