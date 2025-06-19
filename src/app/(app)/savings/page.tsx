
'use client';

import React, { useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Search, Filter, DollarSign, Users, TrendingUp, SchoolIcon, Hash } from 'lucide-react';
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
import { mockSavings, mockMembers, mockSchools } from '@/data/mock'; 
import type { Saving, Member, School } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { StatCard } from '@/components/stat-card';
import { Banknote, Wallet } from 'lucide-react'; 

const initialSavingFormState: Partial<Saving> = {
  memberId: '',
  amount: 0,
  date: new Date().toISOString().split('T')[0], // today
  month: `${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`,
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSavingTransaction, setCurrentSavingTransaction] = useState<Partial<Saving>>(initialSavingFormState);
  const [isEditingModal, setIsEditingModal] = useState(false); 
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nameParts = name.split('.');

    if (nameParts.length > 1 && nameParts[0] === 'paymentDetails') {
        const fieldName = nameParts[1] as keyof NonNullable<Saving['paymentDetails']>;
        setCurrentSavingTransaction(prev => ({
            ...prev,
            paymentDetails: {
                ...(prev?.paymentDetails || {}),
                [fieldName]: value,
            }
        }));
    } else {
        setCurrentSavingTransaction(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
    }

    if (name === 'date') {
        const dateObj = new Date(value);
        const month = dateObj.toLocaleString('default', { month: 'long' });
        const year = dateObj.getFullYear();
        setCurrentSavingTransaction(prev => ({ ...prev, month: `${month} ${year}`}));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setCurrentSavingTransaction(prev => {
      const updatedSaving = { ...prev, [name]: value };
      if (name === 'memberId' && !isEditingModal && updatedSaving.transactionType === 'withdrawal') {
        const member = members.find(m => m.id === value);
        updatedSaving.amount = (member && typeof member.savingsBalance === 'number') ? member.savingsBalance : 0;
      }
      return updatedSaving;
    });
  };
  
  const handleTransactionTypeChange = (value: 'deposit' | 'withdrawal') => {
    setCurrentSavingTransaction(prev => {
      const updatedSaving = { ...prev, transactionType: value };

      if (value === 'withdrawal') {
        updatedSaving.depositMode = undefined;
        updatedSaving.paymentDetails = undefined;
        if (!isEditingModal && updatedSaving.memberId) {
          const member = members.find(m => m.id === updatedSaving.memberId);
          updatedSaving.amount = (member && typeof member.savingsBalance === 'number') ? member.savingsBalance : 0;
        }
      } else { 
        updatedSaving.depositMode = prev.depositMode || initialSavingFormState.depositMode;
        updatedSaving.paymentDetails = prev.paymentDetails || initialSavingFormState.paymentDetails;
        if (!isEditingModal) { 
          updatedSaving.amount = 0;
        }
      }
      return updatedSaving;
    });
  };

  const handleDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setCurrentSavingTransaction(prev => ({
        ...prev,
        depositMode: value,
        paymentDetails: value === 'Cash' ? undefined : (prev.paymentDetails || { sourceName: '', transactionReference: '', evidenceUrl: ''}),
    }));
  };

  const handleSubmitTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSavingTransaction.memberId || currentSavingTransaction.amount === undefined || currentSavingTransaction.amount < 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a member and enter a valid non-negative amount.' });
        return;
    }
    if (currentSavingTransaction.transactionType === 'deposit' && !currentSavingTransaction.depositMode) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a deposit mode.' });
        return;
    }
    if ((currentSavingTransaction.depositMode === 'Bank' || currentSavingTransaction.depositMode === 'Wallet') && !currentSavingTransaction.paymentDetails?.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter the Bank/Wallet Name for this deposit.' });
        return;
    }

    const memberName = members.find(m => m.id === currentSavingTransaction.memberId)?.fullName;
    let transactionDataToSave = { ...currentSavingTransaction, memberName };

    if (transactionDataToSave.transactionType === 'withdrawal' || transactionDataToSave.depositMode === 'Cash') {
        transactionDataToSave.paymentDetails = undefined;
    }
    if (transactionDataToSave.transactionType === 'withdrawal') {
        transactionDataToSave.depositMode = undefined;
    }

    const newTransaction: Saving = {
      id: `saving-${Date.now()}`,
      ...initialSavingFormState,
      ...transactionDataToSave,
      amount: transactionDataToSave.amount || 0,
    } as Saving;
    setSavingsTransactions(prev => [newTransaction, ...prev]);
    
    if (transactionDataToSave.memberId) {
        setMembers(prevMembers => prevMembers.map(mem => {
            if (mem.id === transactionDataToSave.memberId) {
                const newBalance = transactionDataToSave.transactionType === 'deposit' 
                    ? mem.savingsBalance + (transactionDataToSave.amount || 0)
                    : mem.savingsBalance - (transactionDataToSave.amount || 0);
                return {...mem, savingsBalance: newBalance < 0 ? 0 : newBalance }; 
            }
            return mem;
        }));
    }

    toast({ title: 'Success', description: `Savings transaction recorded for ${memberName}.` });
    setIsModalOpen(false);
    setCurrentSavingTransaction(initialSavingFormState);
    setIsEditingModal(false);
  };

  const openAddTransactionModal = () => {
    setCurrentSavingTransaction(initialSavingFormState);
    setIsEditingModal(false);
    setIsModalOpen(true);
  };

  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      const matchesSearchTerm = member.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || member.schoolId === selectedSchoolFilter;
      return matchesSearchTerm && matchesSchoolFilter;
    });
  }, [members, searchTerm, selectedSchoolFilter]);

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


  return (
    <div className="space-y-6">
      <PageTitle title="Member Savings Overview" subtitle="View member savings balances and record new transactions.">
        <Button onClick={openAddTransactionModal} className="shadow-md hover:shadow-lg transition-shadow">
          <PlusCircle className="mr-2 h-5 w-5" /> Add Transaction
        </Button>
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
            placeholder="Search by member name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
            aria-label="Search members"
          />
        </div>
        <Select value={selectedSchoolFilter} onValueChange={setSelectedSchoolFilter}>
          <SelectTrigger className="w-full sm:w-[220px]" aria-label="Filter by school">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SchoolIcon className="mr-2 h-4 w-4 text-muted-foreground sm:hidden" /> 
            <SelectValue placeholder="Filter by school" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {schools.map(school => (
              <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox aria-label="Select all members" />
              </TableHead>
              <TableHead>Member Name</TableHead>
              <TableHead>Savings Account #</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Saving Account Type</TableHead>
              <TableHead className="text-right">Current Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length > 0 ? filteredMembers.map(member => (
              <TableRow key={member.id}>
                <TableCell>
                  <Checkbox aria-label={`Select member ${member.fullName}`} />
                </TableCell>
                <TableCell className="font-medium">{member.fullName}</TableCell>
                <TableCell>{member.savingsAccountNumber || 'N/A'}</TableCell>
                <TableCell>{member.schoolName || schools.find(s => s.id === member.schoolId)?.name || 'N/A'}</TableCell>
                <TableCell>{member.savingAccountTypeName || 'N/A'}</TableCell>
                <TableCell className="text-right font-semibold">${member.savingsBalance.toFixed(2)}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No members found matching your criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
       {filteredMembers.length > 10 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline">Load More Members</Button>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditingModal ? 'Edit Savings Record' : 'Add New Savings Transaction'}</DialogTitle>
            <DialogDescription>
              {isEditingModal ? 'Update this savings transaction.' : 'Enter details for a new savings transaction.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitTransaction} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="memberIdModal">Member</Label> 
              <Select name="memberId" value={currentSavingTransaction.memberId || ''} onValueChange={(value) => handleSelectChange('memberId', value)} required>
                <SelectTrigger id="memberIdModal"><SelectValue placeholder="Select a member" /></SelectTrigger>
                <SelectContent>{members.map(member => (<SelectItem key={member.id} value={member.id}>{member.fullName} ({member.savingsAccountNumber || 'No Acct #'})</SelectItem>))}</SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="amountModal">Amount ($)</Label> 
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="amountModal" name="amount" type="number" step="0.01" placeholder="0.00" value={currentSavingTransaction.amount || ''} onChange={handleInputChange} required className="pl-8" />
                    </div>
                </div>
                <div>
                    <Label htmlFor="dateModal">Transaction Date</Label> 
                    <Input id="dateModal" name="date" type="date" value={currentSavingTransaction.date || ''} onChange={handleInputChange} required />
                </div>
            </div>

            <div>
                <Label htmlFor="transactionTypeModal">Transaction Type</Label> 
                <RadioGroup
                    id="transactionTypeModal"
                    name="transactionType"
                    value={currentSavingTransaction.transactionType}
                    onValueChange={handleTransactionTypeChange}
                    className="flex space-x-4 pt-2"
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="deposit" id="depositModal" />
                        <Label htmlFor="depositModal">Deposit</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="withdrawal" id="withdrawalModal" />
                        <Label htmlFor="withdrawalModal">Withdrawal</Label>
                    </div>
                </RadioGroup>
            </div>

            {currentSavingTransaction.transactionType === 'deposit' && (
                <>
                    <Separator className="my-3" />
                    <div>
                        <Label htmlFor="depositModeModal">Deposit Mode</Label>
                        <RadioGroup
                            id="depositModeModal"
                            name="depositMode"
                            value={currentSavingTransaction.depositMode || 'Cash'}
                            onValueChange={handleDepositModeChange}
                            className="flex space-x-4 pt-2"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Cash" id="cashModal" /><Label htmlFor="cashModal">Cash</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Bank" id="bankModal" /><Label htmlFor="bankModal">Bank</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Wallet" id="walletModal" /><Label htmlFor="walletModal">Wallet</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {(currentSavingTransaction.depositMode === 'Bank' || currentSavingTransaction.depositMode === 'Wallet') && (
                        <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                             <div className="grid grid-cols-2 gap-4 pl-3">
                                <div>
                                    <Label htmlFor="paymentDetails.sourceNameModal">{currentSavingTransaction.depositMode} Name</Label>
                                    <div className="relative">
                                     {currentSavingTransaction.depositMode === 'Bank' && <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                     {currentSavingTransaction.depositMode === 'Wallet' &&  <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                    <Input id="paymentDetails.sourceNameModal" name="paymentDetails.sourceName" placeholder={`Enter ${currentSavingTransaction.depositMode} Name`} value={currentSavingTransaction.paymentDetails?.sourceName || ''} onChange={handleInputChange} className="pl-8" />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="paymentDetails.transactionReferenceModal">Transaction Reference</Label>
                                    <Input id="paymentDetails.transactionReferenceModal" name="paymentDetails.transactionReference" placeholder="e.g., TRN123XYZ" value={currentSavingTransaction.paymentDetails?.transactionReference || ''} onChange={handleInputChange} />
                                </div>
                            </div>
                            <div className="pl-3">
                                <Label htmlFor="paymentDetails.evidenceUrlModal">Evidence Attachment (URL/Filename)</Label>
                                 <div className="relative">
                                    <Input id="paymentDetails.evidenceUrlModal" name="paymentDetails.evidenceUrl" placeholder="e.g., http://example.com/receipt.pdf" value={currentSavingTransaction.paymentDetails?.evidenceUrl || ''} onChange={handleInputChange} />
                                 </div>
                                <p className="text-xs text-muted-foreground mt-1">Enter URL or filename of the deposit evidence. Full file upload not supported in this demo.</p>
                            </div>
                        </div>
                    )}
                </>
            )}
            
            <DialogFooter className="pt-6">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">{isEditingModal ? 'Save Changes' : 'Add Transaction'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
