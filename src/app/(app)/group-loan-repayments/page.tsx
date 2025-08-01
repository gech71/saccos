
'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
import type { LoanType, School } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { Filter, DollarSign, Banknote, Wallet, Loader2, CheckCircle, RotateCcw } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUpload } from '@/components/file-upload';
import { Badge } from '@/components/ui/badge';
import { getGroupLoanRepaymentsPageData, getLoansByCriteria, recordBatchRepayments, type LoanWithMemberInfo, type RepaymentBatchData } from './actions';
import { useAuth } from '@/contexts/auth-context';

const initialBatchTransactionState: {
  paymentDate: string;
  depositMode: 'Cash' | 'Bank' | 'Wallet';
  paymentDetails: {
    sourceName: string;
    transactionReference: string;
    evidenceUrl: string;
  };
} = {
  paymentDate: new Date().toISOString().split('T')[0],
  depositMode: 'Cash',
  paymentDetails: {
    sourceName: '',
    transactionReference: '',
    evidenceUrl: '',
  },
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const months = [
  { value: '0', label: 'January' }, { value: '1', label: 'February' }, { value: '2', label: 'March' },
  { value: '3', label: 'April' }, { value: '4', label: 'May' }, { value: '5', label: 'June' },
  { value: '6', label: 'July' }, { value: '7', label: 'August' }, { value: '8', label: 'September' },
  { value: '9', label: 'October' }, { value: '10', label: 'November' }, { value: '11', 'label': 'December' }
];

export default function GroupLoanRepaymentsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [allSchools, setAllSchools] = useState<Pick<School, 'id', 'name'>[]>([]);
  const [loanTypes, setLoanTypes] = useState<Pick<LoanType, 'id', 'name'>[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedLoanType, setSelectedLoanType] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());

  const [isLoadingLoans, setIsLoadingLoans] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [eligibleLoans, setEligibleLoans] = useState<LoanWithMemberInfo[]>([]);
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [repaymentAmounts, setRepaymentAmounts] = useState<Record<string, number>>({});
  
  const [batchDetails, setBatchDetails] = useState(initialBatchTransactionState);
  const [isPosting, setIsPosting] = useState(false);
  const [postedTransactions, setPostedTransactions] = useState<RepaymentBatchData | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const canCreate = useMemo(() => user?.permissions.includes('groupLoanRepayment:create'), [user]);

  useEffect(() => {
    async function fetchInitialData() {
        setIsPageLoading(true);
        const data = await getGroupLoanRepaymentsPageData();
        setAllSchools(data.schools);
        setLoanTypes(data.loanTypes);
        setIsPageLoading(false);
    }
    fetchInitialData();
  }, []);

  const paginatedLoans = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return eligibleLoans.slice(startIndex, endIndex);
  }, [eligibleLoans, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(eligibleLoans.length / rowsPerPage);
  }, [eligibleLoans.length, rowsPerPage]);

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

  const handleLoadLoans = async () => {
    if (!selectedSchool) {
      toast({ variant: 'destructive', title: 'Missing Filters', description: 'Please select a school.' });
      return;
    }
    setIsLoadingLoans(true);
    setPostedTransactions(null);
    setRepaymentAmounts({});
    try {
        const criteria = {
            schoolId: selectedSchool,
            loanTypeId: selectedLoanType === 'all' ? undefined : selectedLoanType,
        }
        const loans = await getLoansByCriteria(criteria);
        setEligibleLoans(loans);
        
        const initialRepayments: Record<string, number> = {};
        loans.forEach(loan => {
            const interestForMonth = loan.remainingBalance * (loan.interestRate / 12);
            const standardPayment = loan.monthlyRepaymentAmount || 0;
            const finalPayment = loan.remainingBalance + interestForMonth;
            initialRepayments[loan.id] = Math.min(standardPayment, finalPayment);
        });
        setRepaymentAmounts(initialRepayments);
        setSelectedLoanIds(loans.map(l => l.id));
        
        if (loans.length === 0) {
            toast({ title: 'No Active Loans Found', description: 'No active or overdue loans for the selected criteria.' });
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load loans.' });
    } finally {
        setIsLoadingLoans(false);
    }
  };
  
  const handleSelectAllChange = (checked: boolean) => {
    setSelectedLoanIds(checked ? eligibleLoans.map(loan => loan.id) : []);
  };

  const handleRowSelectChange = (loanId: string, checked: boolean) => {
    setSelectedLoanIds(prev =>
      checked ? [...prev, loanId] : prev.filter(id => id !== loanId)
    );
  };
  
  const isAllSelected = eligibleLoans.length > 0 && selectedLoanIds.length === eligibleLoans.length;

  const handleRepaymentAmountChange = (loanId: string, amount: string) => {
    setRepaymentAmounts(prev => ({ ...prev, [loanId]: parseFloat(amount) || 0 }));
  };

  const totalToCollect = useMemo(() => {
    return selectedLoanIds.reduce((sum, loanId) => {
        return sum + (repaymentAmounts[loanId] || 0);
    }, 0);
  }, [repaymentAmounts, selectedLoanIds]);

  const handleBatchDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nameParts = name.split('.');
    if (nameParts.length > 1 && nameParts[0] === 'paymentDetails') {
        const fieldName = nameParts[1] as keyof typeof initialBatchTransactionState.paymentDetails;
        setBatchDetails(prev => ({
            ...prev,
            paymentDetails: {
                ...(prev.paymentDetails),
                [fieldName]: value,
            }
        }));
    } else {
       setBatchDetails(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setBatchDetails(prev => ({ ...prev, depositMode: value }));
  };

  const handleSubmitCollection = async () => {
    const repaymentsToProcess: RepaymentBatchData = selectedLoanIds
        .map(loanId => {
            const loan = eligibleLoans.find(l => l.id === loanId);
            return {
                loanId,
                loanAccountNumber: loan?.loanAccountNumber || 'N/A',
                amountPaid: repaymentAmounts[loanId] || 0,
                paymentDate: batchDetails.paymentDate,
                depositMode: batchDetails.depositMode,
                paymentDetails: batchDetails.depositMode === 'Cash' ? undefined : batchDetails.paymentDetails,
            }
        })
        .filter(({ amountPaid }) => amountPaid > 0);

    if (repaymentsToProcess.length === 0) {
      toast({ variant: 'destructive', title: 'No Payments Entered', description: 'Please enter repayment amounts for at least one selected loan.' });
      return;
    }
    if ((batchDetails.depositMode === 'Bank' || batchDetails.depositMode === 'Wallet') && !batchDetails.paymentDetails.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${batchDetails.depositMode} Name.` });
        return;
    }

    setIsPosting(true);
    const result = await recordBatchRepayments(repaymentsToProcess);
    if (result.success) {
        toast({ title: 'Repayments Recorded', description: result.message });
        setPostedTransactions(repaymentsToProcess);
        setEligibleLoans([]);
        setRepaymentAmounts({});
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsPosting(false);
  };
  
  const startNewBatch = () => {
    setPostedTransactions(null);
    setSelectedSchool('');
    setSelectedLoanType('all');
    setEligibleLoans([]);
    setRepaymentAmounts({});
    setBatchDetails(initialBatchTransactionState);
  };
  
  if (isPageLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <PageTitle title="Group Loan Repayments" subtitle="Process loan repayments for a group of members." />

      {!postedTransactions && (
        <>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-primary">Selection Criteria</CardTitle>
              <CardDescription>Select filters to load all active loans for its members.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <Label htmlFor="schoolFilter">School <span className="text-destructive">*</span></Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger id="schoolFilter"><SelectValue placeholder="Select School" /></SelectTrigger>
                  <SelectContent>{allSchools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="loanTypeFilter">Loan Type</Label>
                <Select value={selectedLoanType} onValueChange={setSelectedLoanType}>
                  <SelectTrigger id="loanTypeFilter"><SelectValue placeholder="Select Loan Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Loan Types</SelectItem>
                    {loanTypes.map(lt => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="yearFilter">Repayment for Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger id="yearFilter"><SelectValue placeholder="Select Year" /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="monthFilter">Repayment for Month</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger id="monthFilter"><SelectValue placeholder="Select Month" /></SelectTrigger>
                  <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-4 flex justify-end">
                <Button onClick={handleLoadLoans} disabled={isLoadingLoans || !selectedSchool} className="w-full md:w-auto">
                    {isLoadingLoans ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                    Load Loans
                </Button>
              </div>
            </CardContent>
          </Card>

          {eligibleLoans.length > 0 && (
            <Card className="shadow-lg animate-in fade-in duration-300">
              <CardHeader>
                <CardTitle className="font-headline text-primary">Active Loans for {allSchools.find(s => s.id === selectedSchool)?.name}</CardTitle>
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm text-muted-foreground gap-2">
                    <span>{eligibleLoans.length} active/overdue loans found. {selectedLoanIds.length} selected.</span>
                    <span className="font-bold text-primary">Total Amount to be Collected: {totalToCollect.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border shadow-sm mb-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px] px-2">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={handleSelectAllChange}
                            aria-label="Select all loans"
                            disabled={!canCreate}
                          />
                        </TableHead>
                        <TableHead>Member Name</TableHead>
                        <TableHead>Loan Acct. #</TableHead>
                        <TableHead>Remaining Balance</TableHead>
                        <TableHead>Exp. Monthly Repayment</TableHead>
                        <TableHead className="w-[200px]">Amount to be Paid (Birr)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLoans.map(loan => {
                        const interestForMonth = loan.remainingBalance * (loan.interestRate / 12);
                        const principalPortion = loan.loanTerm > 0 ? loan.principalAmount / loan.loanTerm : 0;
                        const standardPayment = principalPortion + interestForMonth;
                        const finalPayment = loan.remainingBalance + interestForMonth;
                        const expectedPayment = Math.min(standardPayment, finalPayment);

                        return (
                        <TableRow key={loan.id} data-state={selectedLoanIds.includes(loan.id) ? 'selected' : undefined}>
                           <TableCell className="px-2">
                            <Checkbox
                              checked={selectedLoanIds.includes(loan.id)}
                              onCheckedChange={(checked) => handleRowSelectChange(loan.id, !!checked)}
                              aria-label={`Select loan for ${loan.member.fullName}`}
                              disabled={!canCreate}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{loan.member.fullName}</TableCell>
                          <TableCell className="font-mono text-xs">{loan.loanAccountNumber}</TableCell>
                          <TableCell className="text-right">{loan.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                          <TableCell className="text-right">{expectedPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={repaymentAmounts[loan.id] || ''}
                              onChange={(e) => handleRepaymentAmountChange(loan.id, e.target.value)}
                              className="text-right"
                              disabled={!selectedLoanIds.includes(loan.id) || !canCreate}
                            />
                          </TableCell>
                        </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                {eligibleLoans.length > 0 && (
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
                                      <span key={index} className="px-2">{item}</span>
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
                          <div>{eligibleLoans.length} loan(s) found.</div>
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

                <Separator className="my-6" />
                
                <Label className="text-lg font-semibold text-primary mb-2 block">Batch Payment Details</Label>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="batchDetails.date">Payment Date <span className="text-destructive">*</span></Label>
                        <Input id="batchDetails.date" name="date" type="date" value={batchDetails.date || ''} onChange={handleBatchDetailChange} required disabled={!canCreate} />
                    </div>
                    <div>
                        <Label htmlFor="depositModeBatch">Payment Mode</Label>
                        <RadioGroup id="depositModeBatch" value={batchDetails.depositMode || 'Cash'} onValueChange={handleDepositModeChange} className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="cashBatch" disabled={!canCreate} /><Label htmlFor="cashBatch">Cash</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="bankBatch" disabled={!canCreate} /><Label htmlFor="bankBatch">Bank</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Wallet" id="walletBatch" disabled={!canCreate} /><Label htmlFor="walletBatch">Wallet</Label></div>
                        </RadioGroup>
                    </div>

                    {(batchDetails.depositMode === 'Bank' || batchDetails.depositMode === 'Wallet') && (
                        <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
                                <div>
                                    <Label htmlFor="paymentDetails.sourceNameBatch">{batchDetails.depositMode} Name <span className="text-destructive">*</span></Label>
                                    <Input id="paymentDetails.sourceNameBatch" name="paymentDetails.sourceName" placeholder={`Enter ${batchDetails.depositMode} Name`} value={batchDetails.paymentDetails?.sourceName || ''} onChange={handleBatchDetailChange} disabled={!canCreate} />
                                </div>
                                <div>
                                    <Label htmlFor="paymentDetails.transactionReferenceBatch">Transaction Reference</Label>
                                    <Input id="paymentDetails.transactionReferenceBatch" name="paymentDetails.transactionReference" placeholder="e.g., TRN123XYZ" value={batchDetails.paymentDetails?.transactionReference || ''} onChange={handleBatchDetailChange} disabled={!canCreate} />
                                </div>
                            </div>
                             <div className="pl-3">
                                <FileUpload
                                    id="groupLoanRepaymentEvidence"
                                    label="Evidence Attachment"
                                    value={batchDetails.paymentDetails?.evidenceUrl || ''}
                                    onValueChange={(newValue) => {
                                        setBatchDetails(prev => ({
                                            ...prev,
                                            paymentDetails: {
                                                ...(prev.paymentDetails),
                                                evidenceUrl: newValue,
                                            }
                                        }));
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
              </CardContent>
              {canCreate && (
                <CardFooter>
                  <Button onClick={handleSubmitCollection} disabled={isPosting || totalToCollect <= 0} className="w-full md:w-auto ml-auto">
                    {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Record Repayments for {selectedLoanIds.filter(id => (repaymentAmounts[id] || 0) > 0).length} Loans
                  </Button>
                </CardFooter>
              )}
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
                                <TableHead>Loan Acct. #</TableHead>
                                <TableHead className="text-right">Amount Paid (Birr)</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Payment Mode</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {postedTransactions.map(transaction => (
                                <TableRow key={transaction.loanId}>
                                    <TableCell className="font-mono text-xs">{transaction.loanAccountNumber}</TableCell>
                                    <TableCell className="text-right">{transaction.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
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
