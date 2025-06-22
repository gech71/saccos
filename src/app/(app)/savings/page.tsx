

'use client';

import React, { useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Search, Filter, DollarSign, Users, TrendingUp, SchoolIcon, Hash, WalletCards, Edit, Trash2, UploadCloud, Banknote, Wallet, BarChartHorizontalBig } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { mockSavings, mockMembers, mockSchools, mockSavingAccountTypes } from '@/data/mock';
import type { Saving, Member, School, SavingAccountType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { StatCard } from '@/components/stat-card';
import { differenceInMonths } from 'date-fns';
import { Progress } from '@/components/ui/progress';


const initialIndividualTransactionFormState: Partial<Saving> = {
  memberId: '',
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  month: `${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`,
  transactionType: 'deposit',
  depositMode: 'Cash',
  paymentDetails: {
    sourceName: '',
    transactionReference: '',
    evidenceUrl: '',
  },
};

const initialGroupTransactionFormState: Omit<Saving, 'id' | 'memberId' | 'memberName' | 'month' | 'status'> & { memberIds?: string[] } = {
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  transactionType: 'deposit',
  depositMode: 'Cash',
  paymentDetails: {
    sourceName: '',
    transactionReference: '',
    evidenceUrl: '',
  },
};


export default function SavingsPage() {
  const [savingsTransactions, setSavingsTransactions] = useState<Saving[]>(mockSavings);
  const [members, setMembers] = useState<Member[]>(mockMembers);
  const [schools] = useState<School[]>(mockSchools);
  const [savingAccountTypes] = useState<SavingAccountType[]>(mockSavingAccountTypes);
  
  const [isIndividualModalOpen, setIsIndividualModalOpen] = useState(false);
  const [currentIndividualTransaction, setCurrentIndividualTransaction] = useState<Partial<Saving>>(initialIndividualTransactionFormState);
  const [isEditingIndividualTransaction, setIsEditingIndividualTransaction] = useState(false);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [currentGroupTransactionData, setCurrentGroupTransactionData] = useState<Omit<Saving, 'id' | 'memberId' | 'memberName' | 'month' | 'status'>>(initialGroupTransactionFormState);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);


  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const [selectedAccountTypeFilter, setSelectedAccountTypeFilter] = useState<string>('all');
  const { toast } = useToast();

  // --- Handlers for Individual Transaction Modal ---
  const handleIndividualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nameParts = name.split('.');

    if (nameParts.length > 1 && nameParts[0] === 'paymentDetails') {
        const fieldName = nameParts[1] as keyof NonNullable<Saving['paymentDetails']>;
        setCurrentIndividualTransaction(prev => ({
            ...prev,
            paymentDetails: {
                ...(prev?.paymentDetails || {}),
                [fieldName]: value,
            }
        }));
    } else {
        setCurrentIndividualTransaction(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
    }

    if (name === 'date') {
        const dateObj = new Date(value);
        const month = dateObj.toLocaleString('default', { month: 'long' });
        const year = dateObj.getFullYear();
        setCurrentIndividualTransaction(prev => ({ ...prev, month: `${month} ${year}`}));
    }
  };

  const handleIndividualSelectChange = (name: string, value: string) => {
    setCurrentIndividualTransaction(prev => {
      const updatedSaving = { ...prev, [name]: value };
      if (name === 'memberId' && !isEditingIndividualTransaction && updatedSaving.transactionType === 'withdrawal') {
        const member = members.find(m => m.id === value);
        updatedSaving.amount = (member && typeof member.savingsBalance === 'number') ? member.savingsBalance : 0;
      }
      return updatedSaving;
    });
  };
  
  const handleIndividualTransactionTypeChange = (value: 'deposit' | 'withdrawal') => {
    setCurrentIndividualTransaction(prev => {
      const updatedSaving = { ...prev, transactionType: value };
      if (value === 'withdrawal') {
        updatedSaving.depositMode = undefined;
        updatedSaving.paymentDetails = undefined;
        if (!isEditingIndividualTransaction && updatedSaving.memberId) {
          const member = members.find(m => m.id === updatedSaving.memberId);
          updatedSaving.amount = (member && typeof member.savingsBalance === 'number') ? member.savingsBalance : 0;
        }
      } else { 
        updatedSaving.depositMode = prev.depositMode || initialIndividualTransactionFormState.depositMode;
        updatedSaving.paymentDetails = prev.paymentDetails || initialIndividualTransactionFormState.paymentDetails;
        if (!isEditingIndividualTransaction) { 
          updatedSaving.amount = 0;
        }
      }
      return updatedSaving;
    });
  };

  const handleIndividualDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setCurrentIndividualTransaction(prev => ({
        ...prev,
        depositMode: value,
        paymentDetails: value === 'Cash' ? undefined : (prev.paymentDetails || { sourceName: '', transactionReference: '', evidenceUrl: ''}),
    }));
  };

  const handleSubmitIndividualTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentIndividualTransaction.memberId || currentIndividualTransaction.amount === undefined || currentIndividualTransaction.amount < 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a member and enter a valid non-negative amount.' });
        return;
    }
    if (currentIndividualTransaction.transactionType === 'deposit' && !currentIndividualTransaction.depositMode) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a deposit mode.' });
        return;
    }
    if ((currentIndividualTransaction.depositMode === 'Bank' || currentIndividualTransaction.depositMode === 'Wallet') && !currentIndividualTransaction.paymentDetails?.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter the Bank/Wallet Name for this deposit.' });
        return;
    }

    const memberName = members.find(m => m.id === currentIndividualTransaction.memberId)?.fullName;
    let transactionDataToSave = { ...currentIndividualTransaction, memberName, status: 'pending' as const };

    if (transactionDataToSave.transactionType === 'withdrawal' || transactionDataToSave.depositMode === 'Cash') {
        transactionDataToSave.paymentDetails = undefined;
    }
    if (transactionDataToSave.transactionType === 'withdrawal') {
        transactionDataToSave.depositMode = undefined;
    }
    
    // For editing, we will just update the existing record. The approval status must be handled on the approval page.
    if (isEditingIndividualTransaction && transactionDataToSave.id) {
        setSavingsTransactions(prev => prev.map(st => st.id === transactionDataToSave.id ? {...st, ...transactionDataToSave} as Saving : st));
        toast({ title: 'Success', description: `Savings transaction for ${memberName} updated. It may require re-approval.` });

    } else {
        const newTransaction: Saving = {
          id: `saving-${Date.now()}`,
          ...initialIndividualTransactionFormState, 
          ...transactionDataToSave,
          amount: transactionDataToSave.amount || 0,
          status: 'pending',
        } as Saving;
        setSavingsTransactions(prev => [newTransaction, ...prev]);
        
        toast({ title: 'Transaction Submitted', description: `Savings transaction for ${memberName} sent for approval.` });
    }
    
    setIsIndividualModalOpen(false);
    setCurrentIndividualTransaction(initialIndividualTransactionFormState);
    setIsEditingIndividualTransaction(false);
  };

  const openAddIndividualTransactionModal = () => {
    setCurrentIndividualTransaction(initialIndividualTransactionFormState);
    setIsEditingIndividualTransaction(false);
    setIsIndividualModalOpen(true);
  };
  // --- End Handlers for Individual Transaction Modal ---


  // --- Handlers for Group Transaction Modal ---
  const handleGroupInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nameParts = name.split('.');

    if (nameParts.length > 1 && nameParts[0] === 'paymentDetails') {
        const fieldName = nameParts[1] as keyof NonNullable<Saving['paymentDetails']>;
        setCurrentGroupTransactionData(prev => ({
            ...prev,
            paymentDetails: {
                ...(prev?.paymentDetails || {}),
                [fieldName]: value,
            }
        }));
    } else {
        setCurrentGroupTransactionData(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
    }
  };

  const handleGroupTransactionTypeChange = (value: 'deposit' | 'withdrawal') => {
    setCurrentGroupTransactionData(prev => {
      const updatedData = { ...prev, transactionType: value };
      if (value === 'withdrawal') {
        updatedData.depositMode = undefined;
        updatedData.paymentDetails = undefined;
      } else {
        updatedData.depositMode = prev.depositMode || initialGroupTransactionFormState.depositMode;
        updatedData.paymentDetails = prev.paymentDetails || initialGroupTransactionFormState.paymentDetails;
      }
      return updatedData;
    });
  };

  const handleGroupDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setCurrentGroupTransactionData(prev => ({
        ...prev,
        depositMode: value,
        paymentDetails: value === 'Cash' ? undefined : (prev.paymentDetails || { sourceName: '', transactionReference: '', evidenceUrl: ''}),
    }));
  };

  const handleSubmitGroupTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMemberIds.length === 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'No members selected for group transaction.' });
        return;
    }
    if (currentGroupTransactionData.amount === undefined || currentGroupTransactionData.amount <= 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter a valid positive amount for the group transaction.' });
        return;
    }
    if (currentGroupTransactionData.transactionType === 'deposit' && !currentGroupTransactionData.depositMode) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a deposit mode for the group transaction.' });
        return;
    }
    if ((currentGroupTransactionData.depositMode === 'Bank' || currentGroupTransactionData.depositMode === 'Wallet') && !currentGroupTransactionData.paymentDetails?.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter the Bank/Wallet Name for this group deposit.' });
        return;
    }

    const newTransactions: Saving[] = [];

    selectedMemberIds.forEach(memberId => {
        const member = members.find(m => m.id === memberId);
        if (!member) return;

        const transactionDataForMember = { ...currentGroupTransactionData };
        if (transactionDataForMember.transactionType === 'withdrawal' || transactionDataForMember.depositMode === 'Cash') {
            transactionDataForMember.paymentDetails = undefined;
        }
        if (transactionDataForMember.transactionType === 'withdrawal') {
            transactionDataForMember.depositMode = undefined;
        }
        
        const dateObj = new Date(transactionDataForMember.date);
        const month = dateObj.toLocaleString('default', { month: 'long' });
        const year = dateObj.getFullYear();

        const newTransaction: Saving = {
            id: `saving-${Date.now()}-${memberId}`,
            memberId: member.id,
            memberName: member.fullName,
            amount: transactionDataForMember.amount,
            date: transactionDataForMember.date,
            month: `${month} ${year}`,
            transactionType: transactionDataForMember.transactionType,
            depositMode: transactionDataForMember.depositMode,
            paymentDetails: transactionDataForMember.paymentDetails,
            status: 'pending',
        };
        newTransactions.push(newTransaction);
    });

    setSavingsTransactions(prev => [...newTransactions, ...prev]);

    toast({ title: 'Success', description: `Group transaction for ${selectedMemberIds.length} members submitted for approval.` });
    setIsGroupModalOpen(false);
    setCurrentGroupTransactionData(initialGroupTransactionFormState);
    setSelectedMemberIds([]);
  };
  
  const openAddGroupTransactionModal = () => {
    if (selectedMemberIds.length === 0) {
        toast({ variant: 'destructive', title: 'No Members Selected', description: 'Please select members from the table to include in the group transaction.' });
        return;
    }
    setCurrentGroupTransactionData(initialGroupTransactionFormState);
    setIsGroupModalOpen(true);
  };
  // --- End Handlers for Group Transaction Modal ---


  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      const matchesSearchTerm = member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || (member.savingsAccountNumber && member.savingsAccountNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || member.schoolId === selectedSchoolFilter;
      const matchesAccountTypeFilter = selectedAccountTypeFilter === 'all' || member.savingAccountTypeId === selectedAccountTypeFilter;
      return matchesSearchTerm && matchesSchoolFilter && matchesAccountTypeFilter;
    });
  }, [members, searchTerm, selectedSchoolFilter, selectedAccountTypeFilter]);

  const summaryStats = useMemo(() => {
    const membersInView = filteredMembers.length;
    const totalBalanceInView = filteredMembers.reduce((acc, member) => acc + member.savingsBalance, 0);
    const averageBalance = membersInView > 0 ? totalBalanceInView / membersInView : 0;
    return {
      membersInView,
      totalBalanceInView,
      averageBalance,
    };
  }, [filteredMembers]);

  const handleSelectAllChange = (checked: boolean) => {
    if (checked) {
      setSelectedMemberIds(filteredMembers.map(member => member.id));
    } else {
      setSelectedMemberIds([]);
    }
  };

  const handleRowSelectChange = (memberId: string, checked: boolean) => {
    if (checked) {
      setSelectedMemberIds(prev => [...prev, memberId]);
    } else {
      setSelectedMemberIds(prev => prev.filter(id => id !== memberId));
    }
  };

  const isAllSelected = filteredMembers.length > 0 && selectedMemberIds.length === filteredMembers.length;


  return (
    <div className="space-y-6">
      <PageTitle title="Member Savings Overview" subtitle="View member savings balances, expected contributions, and record new transactions.">
        <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={openAddIndividualTransactionModal} className="shadow-md hover:shadow-lg transition-shadow">
              <PlusCircle className="mr-2 h-5 w-5" /> Add Individual Transaction
            </Button>
            <Button 
                onClick={openAddGroupTransactionModal} 
                className="shadow-md hover:shadow-lg transition-shadow"
                disabled={selectedMemberIds.length === 0}
            >
              <Users className="mr-2 h-5 w-5" /> Add Group Transaction
            </Button>
        </div>
      </PageTitle>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <StatCard
          title="Total Members (in view)"
          value={summaryStats.membersInView}
          icon={<Users className="h-6 w-6 text-accent" />}
          description="Number of members matching filters."
        />
        <StatCard
          title="Total Savings Balance (in view)"
          value={`$${summaryStats.totalBalanceInView.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-6 w-6 text-accent" />}
          description="Combined savings of members shown below."
        />
        <StatCard
          title="Average Savings (in view)"
          value={`$${summaryStats.averageBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<TrendingUp className="h-6 w-6 text-accent" />}
          description="Average savings per member shown below."
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by member name or account #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
            aria-label="Search members"
          />
        </div>
        <Select value={selectedSchoolFilter} onValueChange={setSelectedSchoolFilter}>
          <SelectTrigger className="w-full sm:w-[220px]" aria-label="Filter by school">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground md:hidden" />
            <SchoolIcon className="mr-2 h-4 w-4 text-muted-foreground hidden md:inline" />
            <SelectValue placeholder="Filter by school" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {schools.map(school => (
              <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedAccountTypeFilter} onValueChange={setSelectedAccountTypeFilter}>
          <SelectTrigger className="w-full sm:w-[240px]" aria-label="Filter by saving account type">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground md:hidden" />
            <WalletCards className="mr-2 h-4 w-4 text-muted-foreground hidden md:inline" />
            <SelectValue placeholder="Filter by account type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Account Types</SelectItem>
            {savingAccountTypes.map(accountType => (
              <SelectItem key={accountType.id} value={accountType.id}>{accountType.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] px-2">
                <Checkbox 
                  aria-label="Select all members in view"
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAllChange}
                  disabled={filteredMembers.length === 0}
                />
              </TableHead>
              <TableHead>Member Name</TableHead>
              <TableHead>Savings Account #</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Saving Account Type</TableHead>
              <TableHead className="text-right">Current Balance ($)</TableHead>
              <TableHead className="text-right">Exp. Monthly Saving ($)</TableHead>
              <TableHead className="text-right">Total Exp. Saving ($)</TableHead>
              <TableHead className="text-center w-[150px]">Saving Collection %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length > 0 ? filteredMembers.map(member => {
              const joinDate = new Date(member.joinDate);
              const currentDate = new Date();
              let contributionPeriods = 0;
              if (joinDate <= currentDate && (member.expectedMonthlySaving || 0) > 0) {
                contributionPeriods = differenceInMonths(currentDate, joinDate) + 1;
              }
              contributionPeriods = Math.max(0, contributionPeriods);

              const totalExpectedSavings = (member.expectedMonthlySaving || 0) * contributionPeriods;
              const percentageCollected = totalExpectedSavings > 0 ? (member.savingsBalance / totalExpectedSavings) * 100 : 0;

              return (
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
                  <TableCell>{member.schoolName || schools.find(s => s.id === member.schoolId)?.name || 'N/A'}</TableCell>
                  <TableCell>{member.savingAccountTypeName || (member.savingAccountTypeId && savingAccountTypes.find(sat => sat.id === member.savingAccountTypeId)?.name) || 'N/A'}</TableCell>
                  <TableCell className="text-right font-semibold">${member.savingsBalance.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${(member.expectedMonthlySaving || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">${totalExpectedSavings.toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    {totalExpectedSavings > 0 ? (
                      <div className="flex flex-col items-center">
                        <Progress value={percentageCollected} className="h-2 w-full" />
                        <span className="text-xs mt-1">{Math.min(100, Math.max(0, percentageCollected)).toFixed(1)}%</span>
                      </div>
                    ) : (member.expectedMonthlySaving || 0) > 0 ? (
                      <div className="flex flex-col items-center">
                        <Progress value={0} className="h-2 w-full" />
                        <span className="text-xs mt-1">0.0%</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  No members found matching your criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {filteredMembers.length > 0 && (
        <div className="mt-4 p-4 border-t bg-muted/50 rounded-b-lg flex flex-col sm:flex-row justify-between items-center text-sm font-medium">
         <span>Total Members: {summaryStats.membersInView}</span>
         <span>Total Combined Balance: ${summaryStats.totalBalanceInView.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      )}
       {filteredMembers.length > 10 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline">Load More Members</Button>
        </div>
      )}

    {/* Individual Transaction Modal */}
      <Dialog open={isIndividualModalOpen} onOpenChange={setIsIndividualModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditingIndividualTransaction ? 'Edit Savings Transaction' : 'Add New Individual Savings Transaction'}</DialogTitle>
            <DialogDescription>
              {isEditingIndividualTransaction ? 'Update this savings transaction.' : 'Enter details for a new savings transaction for a single member.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitIndividualTransaction} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="memberIdInd">Member</Label>
              <Select name="memberId" value={currentIndividualTransaction.memberId || ''} onValueChange={(value) => handleIndividualSelectChange('memberId', value)} required>
                <SelectTrigger id="memberIdInd"><SelectValue placeholder="Select a member" /></SelectTrigger>
                <SelectContent>{members.map(member => (<SelectItem key={member.id} value={member.id}>{member.fullName} ({member.savingsAccountNumber || 'No Acct #'})</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="amountInd">Amount ($)</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="amountInd" name="amount" type="number" step="0.01" placeholder="0.00" value={currentIndividualTransaction.amount || ''} onChange={handleIndividualInputChange} required className="pl-8" />
                    </div>
                </div>
                <div>
                    <Label htmlFor="dateInd">Transaction Date</Label>
                    <Input id="dateInd" name="date" type="date" value={currentIndividualTransaction.date || ''} onChange={handleIndividualInputChange} required />
                </div>
            </div>
            <div>
                <Label htmlFor="transactionTypeInd">Transaction Type</Label>
                <RadioGroup id="transactionTypeInd" name="transactionType" value={currentIndividualTransaction.transactionType} onValueChange={handleIndividualTransactionTypeChange} className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="deposit" id="depositInd" /><Label htmlFor="depositInd">Deposit</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="withdrawal" id="withdrawalInd" /><Label htmlFor="withdrawalInd">Withdrawal</Label></div>
                </RadioGroup>
            </div>
            {currentIndividualTransaction.transactionType === 'deposit' && (
                <>
                    <Separator className="my-3" />
                    <div>
                        <Label htmlFor="depositModeInd">Deposit Mode</Label>
                        <RadioGroup id="depositModeInd" name="depositMode" value={currentIndividualTransaction.depositMode || 'Cash'} onValueChange={handleIndividualDepositModeChange} className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="cashInd" /><Label htmlFor="cashInd">Cash</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="bankInd" /><Label htmlFor="bankInd">Bank</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Wallet" id="walletInd" /><Label htmlFor="walletInd">Wallet</Label></div>
                        </RadioGroup>
                    </div>
                    {(currentIndividualTransaction.depositMode === 'Bank' || currentIndividualTransaction.depositMode === 'Wallet') && (
                        <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
                                <div>
                                    <Label htmlFor="paymentDetails.sourceNameInd">{currentIndividualTransaction.depositMode} Name</Label>
                                    <div className="relative">
                                     {currentIndividualTransaction.depositMode === 'Bank' && <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                     {currentIndividualTransaction.depositMode === 'Wallet' &&  <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                    <Input id="paymentDetails.sourceNameInd" name="paymentDetails.sourceName" placeholder={`Enter ${currentIndividualTransaction.depositMode} Name`} value={currentIndividualTransaction.paymentDetails?.sourceName || ''} onChange={handleIndividualInputChange} className="pl-8" />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="paymentDetails.transactionReferenceInd">Transaction Reference</Label>
                                    <Input id="paymentDetails.transactionReferenceInd" name="paymentDetails.transactionReference" placeholder="e.g., TRN123XYZ" value={currentIndividualTransaction.paymentDetails?.transactionReference || ''} onChange={handleIndividualInputChange} />
                                </div>
                            </div>
                            <div className="pl-3">
                                <Label htmlFor="paymentDetails.evidenceUrlInd">Evidence Attachment</Label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md border-border hover:border-primary transition-colors">
                                    <div className="space-y-1 text-center">
                                        <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                                        <div className="flex text-sm text-muted-foreground">
                                            <p className="pl-1">Upload a file or drag and drop</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">PNG, JPG, PDF up to 10MB (mock)</p>
                                    </div>
                                </div>
                                <Input
                                    id="paymentDetails.evidenceUrlInd"
                                    name="paymentDetails.evidenceUrl"
                                    placeholder="Enter URL or filename for reference"
                                    value={currentIndividualTransaction.paymentDetails?.evidenceUrl || ''}
                                    onChange={handleIndividualInputChange}
                                    className="mt-2"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Actual file upload is not functional. Enter a reference URL or filename above.</p>
                            </div>
                        </div>
                    )}
                </>
            )}
            <DialogFooter className="pt-6">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">{isEditingIndividualTransaction ? 'Save Changes' : 'Submit for Approval'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    {/* Group Transaction Modal */}
      <Dialog open={isGroupModalOpen} onOpenChange={setIsGroupModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">Add New Group Savings Transaction</DialogTitle>
            <DialogDescription>
              Enter details for a new savings transaction. This will be applied to all ({selectedMemberIds.length}) selected members.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitGroupTransaction} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="amountGrp">Amount (per member) ($)</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="amountGrp" name="amount" type="number" step="0.01" placeholder="0.00" value={currentGroupTransactionData.amount || ''} onChange={handleGroupInputChange} required className="pl-8" />
                    </div>
                </div>
                <div>
                    <Label htmlFor="dateGrp">Transaction Date</Label>
                    <Input id="dateGrp" name="date" type="date" value={currentGroupTransactionData.date || ''} onChange={handleGroupInputChange} required />
                </div>
            </div>
            <div>
                <Label htmlFor="transactionTypeGrp">Transaction Type</Label>
                <RadioGroup id="transactionTypeGrp" name="transactionType" value={currentGroupTransactionData.transactionType} onValueChange={handleGroupTransactionTypeChange} className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="deposit" id="depositGrp" /><Label htmlFor="depositGrp">Deposit</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="withdrawal" id="withdrawalGrp" /><Label htmlFor="withdrawalGrp">Withdrawal</Label></div>
                </RadioGroup>
            </div>
            {currentGroupTransactionData.transactionType === 'deposit' && (
                <>
                    <Separator className="my-3" />
                    <div>
                        <Label htmlFor="depositModeGrp">Deposit Mode</Label>
                        <RadioGroup id="depositModeGrp" name="depositMode" value={currentGroupTransactionData.depositMode || 'Cash'} onValueChange={handleGroupDepositModeChange} className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="cashGrp" /><Label htmlFor="cashGrp">Cash</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="bankGrp" /><Label htmlFor="bankGrp">Bank</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Wallet" id="walletGrp" /><Label htmlFor="walletGrp">Wallet</Label></div>
                        </RadioGroup>
                    </div>
                    {(currentGroupTransactionData.depositMode === 'Bank' || currentGroupTransactionData.depositMode === 'Wallet') && (
                        <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
                                <div>
                                    <Label htmlFor="paymentDetails.sourceNameGrp">{currentGroupTransactionData.depositMode} Name</Label>
                                    <div className="relative">
                                     {currentGroupTransactionData.depositMode === 'Bank' && <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                     {currentGroupTransactionData.depositMode === 'Wallet' &&  <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                    <Input id="paymentDetails.sourceNameGrp" name="paymentDetails.sourceName" placeholder={`Enter ${currentGroupTransactionData.depositMode} Name`} value={currentGroupTransactionData.paymentDetails?.sourceName || ''} onChange={handleGroupInputChange} className="pl-8" />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="paymentDetails.transactionReferenceGrp">Transaction Reference</Label>
                                    <Input id="paymentDetails.transactionReferenceGrp" name="paymentDetails.transactionReference" placeholder="e.g., TRN123XYZ" value={currentGroupTransactionData.paymentDetails?.transactionReference || ''} onChange={handleGroupInputChange} />
                                </div>
                            </div>
                            <div className="pl-3">
                                <Label htmlFor="paymentDetails.evidenceUrlGrp">Evidence Attachment</Label>
                                 <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md border-border hover:border-primary transition-colors">
                                    <div className="space-y-1 text-center">
                                        <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                                        <div className="flex text-sm text-muted-foreground">
                                            <p className="pl-1">Upload a file or drag and drop</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">PNG, JPG, PDF up to 10MB (mock)</p>
                                    </div>
                                </div>
                                <Input
                                    id="paymentDetails.evidenceUrlGrp"
                                    name="paymentDetails.evidenceUrl"
                                    placeholder="Enter URL or filename for reference"
                                    value={currentGroupTransactionData.paymentDetails?.evidenceUrl || ''}
                                    onChange={handleGroupInputChange}
                                    className="mt-2"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Actual file upload is not functional. Enter a reference URL or filename above.</p>
                            </div>
                        </div>
                    )}
                </>
            )}
            <DialogFooter className="pt-6">
              <DialogClose asChild><Button type="button" variant="outline" onClick={() => setSelectedMemberIds([])}>Cancel</Button></DialogClose>
              <Button type="submit">Submit Group Transaction</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
