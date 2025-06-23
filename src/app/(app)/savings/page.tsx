
'use client';

import React, { useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Search, Filter, DollarSign, Users, TrendingUp, SchoolIcon, WalletCards, Edit, Trash2, UploadCloud, Banknote, Wallet, ArrowUpCircle, ArrowDownCircle, Check, ChevronsUpDown } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { mockSavings, mockMembers, mockSchools } from '@/data/mock';
import type { Saving, Member, School } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';


const initialTransactionFormState: Partial<Saving> = {
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


export default function SavingsPage() {
  const [savingsTransactions, setSavingsTransactions] = useState<Saving[]>(mockSavings);
  const [members] = useState<Member[]>(mockMembers);
  const [schools] = useState<School[]>(mockSchools);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState<Partial<Saving>>(initialTransactionFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nameParts = name.split('.');

    if (nameParts.length > 1 && nameParts[0] === 'paymentDetails') {
        const fieldName = nameParts[1] as keyof NonNullable<Saving['paymentDetails']>;
        setCurrentTransaction(prev => ({
            ...prev,
            paymentDetails: {
                ...(prev?.paymentDetails || {}),
                [fieldName]: value,
            }
        }));
    } else {
        setCurrentTransaction(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
    }

    if (name === 'date') {
        const dateObj = new Date(value);
        const month = dateObj.toLocaleString('default', { month: 'long' });
        const year = dateObj.getFullYear();
        setCurrentTransaction(prev => ({ ...prev, month: `${month} ${year}`}));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setCurrentTransaction(prev => {
      const updatedSaving = { ...prev, [name]: value };
      if (name === 'memberId' && !isEditing && updatedSaving.transactionType === 'withdrawal') {
        const member = members.find(m => m.id === value);
        updatedSaving.amount = (member && typeof member.savingsBalance === 'number') ? member.savingsBalance : 0;
      }
      return updatedSaving;
    });
  };
  
  const handleTransactionTypeChange = (value: 'deposit' | 'withdrawal') => {
    setCurrentTransaction(prev => {
      const updatedSaving = { ...prev, transactionType: value };
      if (value === 'withdrawal') {
        updatedSaving.depositMode = undefined;
        updatedSaving.paymentDetails = undefined;
        if (!isEditing && updatedSaving.memberId) {
          const member = members.find(m => m.id === updatedSaving.memberId);
          updatedSaving.amount = (member && typeof member.savingsBalance === 'number') ? member.savingsBalance : 0;
        }
      } else { 
        updatedSaving.depositMode = prev.depositMode || initialTransactionFormState.depositMode;
        updatedSaving.paymentDetails = prev.paymentDetails || initialTransactionFormState.paymentDetails;
        if (!isEditing) { 
          updatedSaving.amount = 0;
        }
      }
      return updatedSaving;
    });
  };

  const handleDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setCurrentTransaction(prev => ({
        ...prev,
        depositMode: value,
        paymentDetails: value === 'Cash' ? undefined : (prev.paymentDetails || { sourceName: '', transactionReference: '', evidenceUrl: ''}),
    }));
  };

  const handleSubmitTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTransaction.memberId || currentTransaction.amount === undefined || currentTransaction.amount < 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a member and enter a valid non-negative amount.' });
        return;
    }
    if (currentTransaction.transactionType === 'deposit' && !currentTransaction.depositMode) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a deposit mode.' });
        return;
    }
    if ((currentTransaction.depositMode === 'Bank' || currentTransaction.depositMode === 'Wallet') && !currentTransaction.paymentDetails?.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter the Bank/Wallet Name for this deposit.' });
        return;
    }

    const memberName = members.find(m => m.id === currentTransaction.memberId)?.fullName;
    let transactionDataToSave = { ...currentTransaction, memberName, status: 'pending' as const };

    if (transactionDataToSave.transactionType === 'withdrawal' || transactionDataToSave.depositMode === 'Cash') {
        transactionDataToSave.paymentDetails = undefined;
    }
    if (transactionDataToSave.transactionType === 'withdrawal') {
        transactionDataToSave.depositMode = undefined;
    }
    
    if (isEditing && transactionDataToSave.id) {
        setSavingsTransactions(prev => prev.map(st => st.id === transactionDataToSave.id ? {...st, ...transactionDataToSave} as Saving : st));
        toast({ title: 'Success', description: `Savings transaction for ${memberName} updated. It may require re-approval.` });
    } else {
        const newTransaction: Saving = {
          id: `saving-${Date.now()}`,
          ...initialTransactionFormState, 
          ...transactionDataToSave,
          amount: transactionDataToSave.amount || 0,
          status: 'pending',
        } as Saving;
        setSavingsTransactions(prev => [newTransaction, ...prev]);
        toast({ title: 'Transaction Submitted', description: `Savings transaction for ${memberName} sent for approval.` });
    }
    
    setIsModalOpen(false);
    setCurrentTransaction(initialTransactionFormState);
    setIsEditing(false);
  };

  const openAddTransactionModal = () => {
    setCurrentTransaction(initialTransactionFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };
  
  const openEditModal = (transaction: Saving) => {
    setCurrentTransaction(transaction);
    setIsEditing(true);
    setIsModalOpen(true);
  };
  
  const handleDelete = (transactionId: string) => {
    if (window.confirm('Are you sure you want to delete this transaction record? This cannot be undone.')) {
        setSavingsTransactions(prev => prev.filter(s => s.id !== transactionId));
        toast({ title: 'Success', description: 'Transaction record deleted.' });
    }
  };
  
  const getStatusBadgeVariant = (status: 'pending' | 'approved' | 'rejected') => {
    switch (status) {
        case 'pending': return 'secondary';
        case 'approved': return 'default';
        case 'rejected': return 'destructive';
        default: return 'outline';
    }
  };

  const filteredTransactions = useMemo(() => {
    return savingsTransactions.filter(tx => {
      const member = members.find(m => m.id === tx.memberId);
      const memberName = tx.memberName || member?.fullName || '';
      const matchesSearchTerm = memberName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatusFilter === 'all' || tx.status === selectedStatusFilter;
      const matchesType = selectedTypeFilter === 'all' || tx.transactionType === selectedTypeFilter;
      return matchesSearchTerm && matchesStatus && matchesType;
    });
  }, [savingsTransactions, members, searchTerm, selectedStatusFilter, selectedTypeFilter]);

  const summaryStats = useMemo(() => {
    const approvedTransactions = filteredTransactions.filter(tx => tx.status === 'approved');
    const totalDeposits = approvedTransactions.filter(tx => tx.transactionType === 'deposit').reduce((acc, tx) => acc + tx.amount, 0);
    const totalWithdrawals = approvedTransactions.filter(tx => tx.transactionType === 'withdrawal').reduce((acc, tx) => acc + tx.amount, 0);
    const netSavings = totalDeposits - totalWithdrawals;
    return {
      totalDeposits,
      totalWithdrawals,
      netSavings,
    };
  }, [filteredTransactions]);

  return (
    <div className="space-y-6">
      <PageTitle title="Savings Transactions" subtitle="View and manage individual savings deposits and withdrawals.">
        <Button onClick={openAddTransactionModal} className="shadow-md hover:shadow-lg transition-shadow">
          <PlusCircle className="mr-2 h-5 w-5" /> Add Transaction
        </Button>
      </PageTitle>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <StatCard
          title="Total Approved Deposits (in view)"
          value={`$${summaryStats.totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<ArrowUpCircle className="h-6 w-6 text-green-600" />}
          valueClassName="text-green-600"
        />
        <StatCard
          title="Total Approved Withdrawals (in view)"
          value={`$${summaryStats.totalWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<ArrowDownCircle className="h-6 w-6 text-destructive" />}
          valueClassName="text-destructive"
        />
        <StatCard
          title="Net Savings (in view)"
          value={`$${summaryStats.netSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-6 w-6 text-accent" />}
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
            aria-label="Search savings transactions"
          />
        </div>
        <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by transaction type">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="deposit">Deposits</SelectItem>
            <SelectItem value="withdrawal">Withdrawals</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by status">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount ($)</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Deposit Mode</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length > 0 ? filteredTransactions.map(tx => (
              <TableRow key={tx.id} className={tx.status === 'pending' ? 'bg-yellow-500/10' : tx.status === 'rejected' ? 'bg-destructive/10' : ''}>
                <TableCell className="font-medium">{tx.memberName || members.find(m => m.id === tx.memberId)?.fullName || 'N/A'}</TableCell>
                <TableCell>
                  <span className={`flex items-center gap-1 ${tx.transactionType === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.transactionType === 'deposit' ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                    {tx.transactionType.charAt(0).toUpperCase() + tx.transactionType.slice(1)}
                  </span>
                </TableCell>
                <TableCell><Badge variant={getStatusBadgeVariant(tx.status)}>{tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}</Badge></TableCell>
                <TableCell className="text-right font-semibold">${tx.amount.toFixed(2)}</TableCell>
                <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                <TableCell>{tx.depositMode || 'N/A'}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(tx)} disabled={tx.status === 'approved'}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(tx.id)} disabled={tx.status === 'approved'} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No savings transactions found matching your criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

    {/* Transaction Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Savings Transaction' : 'Add New Savings Transaction'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update this savings transaction.' : 'Enter details for a new savings transaction for a single member.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitTransaction} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="memberId">Member</Label>
              <Popover open={openMemberCombobox} onOpenChange={setOpenMemberCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    id="memberId"
                    variant="outline"
                    role="combobox"
                    aria-expanded={openMemberCombobox}
                    className="w-full justify-between"
                  >
                    {currentTransaction.memberId
                      ? members.find((member) => member.id === currentTransaction.memberId)?.fullName
                      : "Select member..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search member..." />
                    <CommandList>
                      <CommandEmpty>No member found.</CommandEmpty>
                      <CommandGroup>
                        {members.map((member) => (
                          <CommandItem
                            key={member.id}
                            value={`${member.fullName} ${member.savingsAccountNumber}`}
                            onSelect={() => {
                              handleSelectChange('memberId', member.id);
                              setOpenMemberCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                currentTransaction.memberId === member.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {member.fullName} ({member.savingsAccountNumber || 'No Acct #'})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="amount">Amount ($)</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" value={currentTransaction.amount || ''} onChange={handleInputChange} required className="pl-8" />
                    </div>
                </div>
                <div>
                    <Label htmlFor="date">Transaction Date</Label>
                    <Input id="date" name="date" type="date" value={currentTransaction.date || ''} onChange={handleInputChange} required />
                </div>
            </div>
            <div>
                <Label htmlFor="transactionType">Transaction Type</Label>
                <RadioGroup id="transactionType" name="transactionType" value={currentTransaction.transactionType} onValueChange={handleTransactionTypeChange} className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="deposit" id="deposit" /><Label htmlFor="deposit">Deposit</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="withdrawal" id="withdrawal" /><Label htmlFor="withdrawal">Withdrawal</Label></div>
                </RadioGroup>
            </div>
            {currentTransaction.transactionType === 'deposit' && (
                <>
                    <Separator className="my-3" />
                    <div>
                        <Label htmlFor="depositMode">Deposit Mode</Label>
                        <RadioGroup id="depositMode" name="depositMode" value={currentTransaction.depositMode || 'Cash'} onValueChange={handleDepositModeChange} className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="cash" /><Label htmlFor="cash">Cash</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="bank" /><Label htmlFor="bank">Bank</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="Wallet" id="wallet" /><Label htmlFor="wallet">Wallet</Label></div>
                        </RadioGroup>
                    </div>
                    {(currentTransaction.depositMode === 'Bank' || currentTransaction.depositMode === 'Wallet') && (
                        <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
                                <div>
                                    <Label htmlFor="paymentDetails.sourceName">{currentTransaction.depositMode} Name</Label>
                                    <div className="relative">
                                     {currentTransaction.depositMode === 'Bank' && <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                     {currentTransaction.depositMode === 'Wallet' &&  <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                    <Input id="paymentDetails.sourceName" name="paymentDetails.sourceName" placeholder={`Enter ${currentTransaction.depositMode} Name`} value={currentTransaction.paymentDetails?.sourceName || ''} onChange={handleInputChange} className="pl-8" />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="paymentDetails.transactionReference">Transaction Reference</Label>
                                    <Input id="paymentDetails.transactionReference" name="paymentDetails.transactionReference" placeholder="e.g., TRN123XYZ" value={currentTransaction.paymentDetails?.transactionReference || ''} onChange={handleInputChange} />
                                </div>
                            </div>
                            <div className="pl-3">
                                <Label htmlFor="paymentDetails.evidenceUrl">Evidence Attachment</Label>
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
                                    id="paymentDetails.evidenceUrl"
                                    name="paymentDetails.evidenceUrl"
                                    placeholder="Enter URL or filename for reference"
                                    value={currentTransaction.paymentDetails?.evidenceUrl || ''}
                                    onChange={handleInputChange}
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
              <Button type="submit">{isEditing ? 'Save Changes' : 'Submit for Approval'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    
