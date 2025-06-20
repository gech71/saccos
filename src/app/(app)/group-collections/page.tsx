
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
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { mockSchools, mockSavingAccountTypes, mockMembers, mockSavings } from '@/data/mock';
import type { School, SavingAccountType, Member, Saving } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Filter, Users, DollarSign, Banknote, Wallet, UploadCloud, Loader2, CheckCircle, ListChecks, Trash2, RotateCcw } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const months = [
  { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
  { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
  { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
  { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' }
];

const initialBatchTransactionState: Partial<Omit<Saving, 'id' | 'memberId' | 'memberName' | 'month'>> & { paymentDetails?: Saving['paymentDetails'] } = {
  date: new Date().toISOString().split('T')[0],
  transactionType: 'deposit',
  depositMode: 'Cash',
  paymentDetails: {
    sourceName: '',
    transactionReference: '',
    evidenceUrl: '',
  },
};


export default function GroupCollectionsPage() {
  const { toast } = useToast();
  
  const [allSchools] = useState<School[]>(mockSchools);
  const [allSavingAccountTypes] = useState<SavingAccountType[]>(mockSavingAccountTypes);
  const [allMembers, setAllMembers] = useState<Member[]>(mockMembers); 
  const [allSavings, setAllSavings] = useState<Saving[]>(mockSavings);

  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedAccountType, setSelectedAccountType] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());

  const [eligibleMembers, setEligibleMembers] = useState<Member[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const [batchDetails, setBatchDetails] = useState(initialBatchTransactionState);
  const [isPosting, setIsPosting] = useState(false);
  
  const [postedTransactions, setPostedTransactions] = useState<Saving[] | null>(null);


  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
    setter(value);
    setEligibleMembers([]); 
    setSelectedMemberIds([]);
  };

  const handleLoadMembers = () => {
    if (!selectedSchool || !selectedAccountType || !selectedYear || !selectedMonth) {
      toast({ variant: 'destructive', title: 'Missing Filters', description: 'Please select school, account type, year, and month.' });
      return;
    }
    setIsLoadingMembers(true);
    setPostedTransactions(null); // Clear any previously posted transactions view
    setTimeout(() => {
      const filtered = allMembers.filter(member =>
        member.schoolId === selectedSchool &&
        member.savingAccountTypeId === selectedAccountType &&
        (member.expectedMonthlySaving || 0) > 0
      );
      setEligibleMembers(filtered);
      setSelectedMemberIds(filtered.map(m => m.id)); 
      setIsLoadingMembers(false);
      if (filtered.length === 0) {
        toast({ title: 'No Members Found', description: 'No members match the selected criteria or have an expected monthly saving.' });
      }
    }, 500);
  };
  
  const handleSelectAllChange = (checked: boolean) => {
    setSelectedMemberIds(checked ? eligibleMembers.map(member => member.id) : []);
  };

  const handleRowSelectChange = (memberId: string, checked: boolean) => {
    setSelectedMemberIds(prev =>
      checked ? [...prev, memberId] : prev.filter(id => id !== memberId)
    );
  };

  const isAllSelected = eligibleMembers.length > 0 && selectedMemberIds.length === eligibleMembers.length;

  const summaryForSelection = useMemo(() => {
    const membersInSelection = eligibleMembers.filter(m => selectedMemberIds.includes(m.id));
    return {
      count: membersInSelection.length,
      totalExpected: membersInSelection.reduce((sum, m) => sum + (m.expectedMonthlySaving || 0), 0),
    };
  }, [eligibleMembers, selectedMemberIds]);

  const handleBatchDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
     const nameParts = name.split('.');
    if (nameParts.length > 1 && nameParts[0] === 'paymentDetails') {
        const fieldName = nameParts[1] as keyof NonNullable<Saving['paymentDetails']>;
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
    if (selectedMemberIds.length === 0) {
      toast({ variant: 'destructive', title: 'No Members Selected', description: 'Please select members to process collection for.' });
      return;
    }
    if (batchDetails.transactionType === 'deposit' && !batchDetails.depositMode) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a deposit mode.' });
        return;
    }
     if ((batchDetails.depositMode === 'Bank' || batchDetails.depositMode === 'Wallet') && !batchDetails.paymentDetails?.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${batchDetails.depositMode} Name.` });
        return;
    }

    setIsPosting(true);
    const transactionDate = batchDetails.date || new Date(parseInt(selectedYear), parseInt(selectedMonth), new Date().getDate()).toISOString().split('T')[0];
    const transactionDateObj = new Date(transactionDate);
    const transactionMonthString = `${months.find(m => m.value === transactionDateObj.getMonth())?.label} ${transactionDateObj.getFullYear()}`;
    
    const newTransactions: Saving[] = [];
    const updatedMembersList = [...allMembers];

    selectedMemberIds.forEach(memberId => {
      const member = updatedMembersList.find(m => m.id === memberId);
      if (!member || (member.expectedMonthlySaving || 0) <= 0) return;

      const newTransaction: Saving = {
        id: `saving-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${memberId}`, // Ensure unique ID
        memberId: member.id,
        memberName: member.fullName,
        amount: member.expectedMonthlySaving || 0,
        date: transactionDate,
        month: transactionMonthString,
        transactionType: 'deposit',
        depositMode: batchDetails.depositMode,
        paymentDetails: batchDetails.depositMode === 'Cash' ? undefined : batchDetails.paymentDetails,
      };
      newTransactions.push(newTransaction);

      const memberIndex = updatedMembersList.findIndex(m => m.id === memberId);
      updatedMembersList[memberIndex].savingsBalance += (member.expectedMonthlySaving || 0);
    });

    setTimeout(() => {
      setAllSavings(prev => [...newTransactions, ...prev]);
      setAllMembers(updatedMembersList); 
      toast({ title: 'Collection Posted', description: `Successfully posted monthly collection for ${newTransactions.length} members.` });
      setIsPosting(false);
      setEligibleMembers([]); 
      setSelectedMemberIds([]);
      setPostedTransactions(newTransactions); // Show posted transactions
      // setBatchDetails(initialBatchTransactionState); // Reset batch details for next run if desired
    }, 1000);
  };
  
  const handleDeletePostedTransaction = (transactionId: string) => {
    if (!postedTransactions) return;

    const transactionToDelete = postedTransactions.find(t => t.id === transactionId);
    if (!transactionToDelete) return;

    if (window.confirm(`Are you sure you want to delete the transaction for ${transactionToDelete.memberName} of $${transactionToDelete.amount.toFixed(2)}? This will also revert their savings balance.`)) {
        // Revert member balance
        setAllMembers(prevMembers => prevMembers.map(member => {
            if (member.id === transactionToDelete.memberId) {
                return {
                    ...member,
                    savingsBalance: member.savingsBalance - transactionToDelete.amount,
                };
            }
            return member;
        }));

        // Remove from allSavings
        setAllSavings(prevSavings => prevSavings.filter(s => s.id !== transactionId));

        // Remove from currently displayed postedTransactions
        setPostedTransactions(prevPosted => (prevPosted ? prevPosted.filter(t => t.id !== transactionId) : null));
        
        toast({ title: 'Transaction Deleted', description: `Transaction for ${transactionToDelete.memberName} was deleted and balance reverted.` });
    }
  };

  const startNewGroupCollection = () => {
    setPostedTransactions(null);
    setSelectedSchool('');
    setSelectedAccountType('');
    setSelectedYear(currentYear.toString());
    setSelectedMonth(new Date().getMonth().toString());
    setEligibleMembers([]);
    setSelectedMemberIds([]);
    setBatchDetails(initialBatchTransactionState);
  };


  return (
    <div className="space-y-8">
      <PageTitle title="Group Monthly Collection" subtitle="Process expected monthly savings contributions for a group of members." />

      {!postedTransactions && (
        <>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-primary">Selection Criteria</CardTitle>
              <CardDescription>Select school, account type, year, and month to load eligible members.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div>
                <Label htmlFor="schoolFilter">School</Label>
                <Select value={selectedSchool} onValueChange={handleFilterChange(setSelectedSchool)}>
                  <SelectTrigger id="schoolFilter"><SelectValue placeholder="Select School" /></SelectTrigger>
                  <SelectContent>{allSchools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="accountTypeFilter">Saving Account Type</Label>
                <Select value={selectedAccountType} onValueChange={handleFilterChange(setSelectedAccountType)}>
                  <SelectTrigger id="accountTypeFilter"><SelectValue placeholder="Select Account Type" /></SelectTrigger>
                  <SelectContent>{allSavingAccountTypes.map(sat => <SelectItem key={sat.id} value={sat.id}>{sat.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="yearFilter">Year</Label>
                <Select value={selectedYear} onValueChange={handleFilterChange(setSelectedYear)}>
                  <SelectTrigger id="yearFilter"><SelectValue placeholder="Select Year" /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="monthFilter">Month</Label>
                <Select value={selectedMonth} onValueChange={handleFilterChange(setSelectedMonth)}>
                  <SelectTrigger id="monthFilter"><SelectValue placeholder="Select Month" /></SelectTrigger>
                  <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={handleLoadMembers} disabled={isLoadingMembers || !selectedSchool || !selectedAccountType || !selectedYear || !selectedMonth} className="w-full lg:w-auto">
                {isLoadingMembers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                Load Members
              </Button>
            </CardContent>
          </Card>

          {eligibleMembers.length > 0 && (
            <Card className="shadow-lg animate-in fade-in duration-300">
              <CardHeader>
                <CardTitle className="font-headline text-primary">Eligible Members for Collection</CardTitle>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Selected: {summaryForSelection.count} members</span>
                  <span>Total Expected from Selection: ${summaryForSelection.totalExpected.toFixed(2)}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border shadow-sm mb-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px] px-2">
                          <Checkbox
                            aria-label="Select all eligible members"
                            checked={isAllSelected}
                            onCheckedChange={handleSelectAllChange}
                          />
                        </TableHead>
                        <TableHead>Member Name</TableHead>
                        <TableHead>Account Number</TableHead>
                        <TableHead className="text-right">Expected Monthly Saving</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eligibleMembers.map(member => (
                        <TableRow key={member.id} data-state={selectedMemberIds.includes(member.id) ? 'selected' : undefined}>
                          <TableCell className="px-2">
                            <Checkbox
                              aria-label={`Select member ${member.fullName}`}
                              checked={selectedMemberIds.includes(member.id)}
                              onCheckedChange={(checked) => handleRowSelectChange(member.id, !!checked)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{member.fullName}</TableCell>
                          <TableCell>{member.savingsAccountNumber || 'N/A'}</TableCell>
                          <TableCell className="text-right">${(member.expectedMonthlySaving || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Separator className="my-6" />
                
                <Label className="text-lg font-semibold text-primary mb-2 block">Batch Transaction Details</Label>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="batchDetails.date">Transaction Date</Label>
                        <Input id="batchDetails.date" name="date" type="date" value={batchDetails.date || ''} onChange={handleBatchDetailChange} required />
                    </div>
                    <div>
                        <Label htmlFor="depositModeBatch">Deposit Mode</Label>
                        <RadioGroup id="depositModeBatch" value={batchDetails.depositMode || 'Cash'} onValueChange={handleDepositModeChange} className="flex space-x-4 pt-2">
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
                                    <div className="relative">
                                        {batchDetails.depositMode === 'Bank' && <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                        {batchDetails.depositMode === 'Wallet' && <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                        <Input id="paymentDetails.sourceNameBatch" name="paymentDetails.sourceName" placeholder={`Enter ${batchDetails.depositMode} Name`} value={batchDetails.paymentDetails?.sourceName || ''} onChange={handleBatchDetailChange} className="pl-8" />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="paymentDetails.transactionReferenceBatch">Transaction Reference</Label>
                                    <Input id="paymentDetails.transactionReferenceBatch" name="paymentDetails.transactionReference" placeholder="e.g., TRN123XYZ" value={batchDetails.paymentDetails?.transactionReference || ''} onChange={handleBatchDetailChange} />
                                </div>
                            </div>
                            <div className="pl-3">
                                <Label htmlFor="paymentDetails.evidenceUrlBatch">Evidence Attachment (URL/Filename)</Label>
                                <div className="relative">
                                    <UploadCloud className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input id="paymentDetails.evidenceUrlBatch" name="paymentDetails.evidenceUrl" placeholder="Optional: http://example.com/receipt.pdf" value={batchDetails.paymentDetails?.evidenceUrl || ''} onChange={handleBatchDetailChange} className="pl-8" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSubmitCollection} disabled={isPosting || selectedMemberIds.length === 0} className="w-full md:w-auto ml-auto">
                  {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Post Collection for {summaryForSelection.count} Members
                </Button>
              </CardFooter>
            </Card>
          )}
          {eligibleMembers.length === 0 && !isLoadingMembers && selectedSchool && selectedAccountType && (
            <Card className="shadow-md">
                <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">No eligible members found for the selected criteria, or click "Load Members" if you've changed filters.</p>
                </CardContent>
            </Card>
          )}
        </>
      )}

      {postedTransactions && (
        <Card className="shadow-lg animate-in fade-in duration-300">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="font-headline text-primary">Posted Collection Transactions</CardTitle>
                        <CardDescription>Review the transactions that were just processed. You can delete individual transactions if needed.</CardDescription>
                    </div>
                    <Button onClick={startNewGroupCollection} variant="outline">
                        <RotateCcw className="mr-2 h-4 w-4" /> Start New Group Collection
                    </Button>
                </div>
                 <p className="text-sm text-muted-foreground mt-2">
                    Total Transactions Posted: {postedTransactions.length}
                </p>
            </CardHeader>
            <CardContent>
                 <div className="overflow-x-auto rounded-lg border shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Member Name</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Month</TableHead>
                                <TableHead>Deposit Mode</TableHead>
                                <TableHead>Source/Reference</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {postedTransactions.length > 0 ? postedTransactions.map(transaction => (
                                <TableRow key={transaction.id}>
                                    <TableCell className="font-medium">{transaction.memberName}</TableCell>
                                    <TableCell className="text-right">${transaction.amount.toFixed(2)}</TableCell>
                                    <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                                    <TableCell>{transaction.month}</TableCell>
                                    <TableCell><Badge variant={transaction.depositMode === 'Cash' ? 'secondary' : 'outline'}>{transaction.depositMode}</Badge></TableCell>
                                    <TableCell className="text-xs">
                                        {transaction.paymentDetails?.sourceName && <div><strong>Source:</strong> {transaction.paymentDetails.sourceName}</div>}
                                        {transaction.paymentDetails?.transactionReference && <div><strong>Ref:</strong> {transaction.paymentDetails.transactionReference}</div>}
                                        {transaction.paymentDetails?.evidenceUrl && <div><strong>Evidence:</strong> {transaction.paymentDetails.evidenceUrl}</div>}
                                        {!transaction.paymentDetails && transaction.depositMode !== 'Cash' && <span className="text-muted-foreground">N/A</span>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDeletePostedTransaction(transaction.id)} className="text-destructive hover:bg-destructive/10 h-8 w-8">
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Delete Transaction</span>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                 <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                    No transactions in this batch or all have been deleted.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                 </div>
            </CardContent>
             {postedTransactions.length === 0 && (
                <CardFooter>
                    <p className="text-sm text-muted-foreground">All transactions from this batch have been cleared or deleted.</p>
                </CardFooter>
            )}
        </Card>
      )}
    </div>
  );
}

