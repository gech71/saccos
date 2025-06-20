
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
import { mockSchools, mockSavingAccountTypes, mockMembers, mockSavings } from '@/data/mock'; // Assuming mockSavings is where you'd push new records
import type { School, SavingAccountType, Member, Saving } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Filter, Users, DollarSign, Banknote, Wallet, UploadCloud, Loader2, CheckCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const months = [
  { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
  { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
  { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
  { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' }
];

const initialBatchTransactionState: Partial<Omit<Saving, 'id' | 'memberId' | 'memberName' | 'amount' | 'month'>> & { paymentDetails?: Saving['paymentDetails'] } = {
  date: '', // Will be set based on year/month selection
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
  
  // Data states
  const [allSchools] = useState<School[]>(mockSchools);
  const [allSavingAccountTypes] = useState<SavingAccountType[]>(mockSavingAccountTypes);
  const [allMembers, setAllMembers] = useState<Member[]>(mockMembers); // To update balances
  const [allSavings, setAllSavings] = useState<Saving[]>(mockSavings); // To add new transactions

  // Filter states
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedAccountType, setSelectedAccountType] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());

  // Member list states
  const [eligibleMembers, setEligibleMembers] = useState<Member[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Batch transaction states
  const [batchDetails, setBatchDetails] = useState(initialBatchTransactionState);
  const [isPosting, setIsPosting] = useState(false);

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
    setter(value);
    setEligibleMembers([]); // Reset list when filters change
    setSelectedMemberIds([]);
  };

  const handleLoadMembers = () => {
    if (!selectedSchool || !selectedAccountType || !selectedYear || !selectedMonth) {
      toast({ variant: 'destructive', title: 'Missing Filters', description: 'Please select school, account type, year, and month.' });
      return;
    }
    setIsLoadingMembers(true);
    // Simulate API call
    setTimeout(() => {
      const filtered = allMembers.filter(member =>
        member.schoolId === selectedSchool &&
        member.savingAccountTypeId === selectedAccountType &&
        (member.expectedMonthlySaving || 0) > 0
      );
      setEligibleMembers(filtered);
      setSelectedMemberIds(filtered.map(m => m.id)); // Auto-select all loaded members
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
    const transactionDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1).toISOString();
    const transactionMonthString = `${months.find(m => m.value.toString() === selectedMonth)?.label} ${selectedYear}`;
    
    const newTransactions: Saving[] = [];
    const updatedMembersList = [...allMembers];

    selectedMemberIds.forEach(memberId => {
      const member = updatedMembersList.find(m => m.id === memberId);
      if (!member || (member.expectedMonthlySaving || 0) <= 0) return;

      const newTransaction: Saving = {
        id: `saving-${Date.now()}-${memberId}`,
        memberId: member.id,
        memberName: member.fullName,
        amount: member.expectedMonthlySaving || 0,
        date: transactionDate,
        month: transactionMonthString,
        transactionType: 'deposit', // Collections are always deposits
        depositMode: batchDetails.depositMode,
        paymentDetails: batchDetails.depositMode === 'Cash' ? undefined : batchDetails.paymentDetails,
      };
      newTransactions.push(newTransaction);

      const memberIndex = updatedMembersList.findIndex(m => m.id === memberId);
      updatedMembersList[memberIndex].savingsBalance += (member.expectedMonthlySaving || 0);
    });

    // Simulate API call
    setTimeout(() => {
      setAllSavings(prev => [...newTransactions, ...prev]);
      setAllMembers(updatedMembersList); // Persist balance updates
      toast({ title: 'Collection Posted', description: `Successfully posted monthly collection for ${newTransactions.length} members.` });
      setIsPosting(false);
      setEligibleMembers([]); // Clear list after posting
      setSelectedMemberIds([]);
      // Optionally reset batchDetails, or keep for next batch
    }, 1000);
  };


  return (
    <div className="space-y-8">
      <PageTitle title="Group Monthly Collection" subtitle="Process expected monthly savings contributions for a group of members." />

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
    </div>
  );
}

