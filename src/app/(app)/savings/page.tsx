

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Search, Filter, DollarSign, Users, TrendingUp, SchoolIcon, WalletCards, Edit, Trash2, UploadCloud, Banknote, Wallet, ArrowUpCircle, ArrowDownCircle, Check, ChevronsUpDown, FileDown, Loader2, MoreVertical } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import type { Member, MemberSavingAccount } from '@prisma/client';
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
import { exportToExcel } from '@/lib/utils';
import { FileUpload } from '@/components/file-upload';
import { getSavingsPageData, addSavingTransaction, updateSavingTransaction, deleteSavingTransaction, type SavingInput, type SavingWithMemberName } from './actions';
import { useAuth } from '@/contexts/auth-context';

const initialTransactionFormState: Partial<SavingInput & {id?: string}> = {
  memberId: '',
  memberSavingAccountId: '',
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  month: `${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`,
  transactionType: 'deposit',
  depositMode: 'Cash',
  sourceName: '',
  transactionReference: '',
  evidenceUrl: '',
};

type MemberForSelect = (Pick<Member, 'id' | 'fullName' | 'status'> & {
    memberSavingAccounts: Pick<MemberSavingAccount, 'id' | 'accountNumber' | 'balance'>[];
});

export default function SavingsPage() {
  const [savingsTransactions, setSavingsTransactions] = useState<SavingWithMemberName[]>([]);
  const [members, setMembers] = useState<MemberForSelect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState<Partial<SavingInput & {id?: string}>>(initialTransactionFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const { toast } = useToast();
  
  const { user } = useAuth();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const canCreate = user?.permissions.includes('saving:create');
  const canEdit = user?.permissions.includes('saving:edit');
  const canDelete = user?.permissions.includes('saving:delete');

  const fetchPageData = async () => {
    setIsLoading(true);
    try {
        const data = await getSavingsPageData();
        setSavingsTransactions(data.savings);
        setMembers(data.members);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load savings data.' });
    }
    setIsLoading(false);
  }

  useEffect(() => {
    if (user) {
      fetchPageData();
    }
  }, [user, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentTransaction(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));

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
      if (name === 'memberId') {
        // Reset account when member changes
        updatedSaving.memberSavingAccountId = '';
      }
      return updatedSaving;
    });
  };
  
  const handleTransactionTypeChange = (value: 'deposit' | 'withdrawal') => {
    setCurrentTransaction(prev => {
      const updatedSaving = { ...prev, transactionType: value };
      if (value === 'withdrawal') {
        updatedSaving.depositMode = undefined;
        updatedSaving.sourceName = undefined;
        updatedSaving.transactionReference = undefined;
        updatedSaving.evidenceUrl = undefined;
      } else { 
        updatedSaving.depositMode = prev.depositMode || initialTransactionFormState.depositMode;
      }
      return updatedSaving;
    });
  };

  const handleDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setCurrentTransaction(prev => ({ ...prev, depositMode: value }));
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTransaction.memberId || !currentTransaction.memberSavingAccountId || currentTransaction.amount === undefined || currentTransaction.amount <= 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a member, their account, and enter a valid positive amount.' });
        return;
    }
    if (currentTransaction.transactionType === 'deposit' && !currentTransaction.depositMode) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a deposit mode.' });
        return;
    }
    if ((currentTransaction.depositMode === 'Bank' || currentTransaction.depositMode === 'Wallet') && !currentTransaction.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter the Bank/Wallet Name for this deposit.' });
        return;
    }

    setIsSubmitting(true);
    
    try {
        if (isEditing && currentTransaction.id) {
            await updateSavingTransaction(currentTransaction.id, currentTransaction as SavingInput);
            toast({ title: 'Success', description: `Savings transaction updated. It requires re-approval.` });
        } else {
            await addSavingTransaction(currentTransaction as SavingInput);
            toast({ title: 'Transaction Submitted', description: `Savings transaction sent for approval.` });
        }
        
        const data = await getSavingsPageData();
        setSavingsTransactions(data.savings);
        setMembers(data.members);
        setIsModalOpen(false);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
    } finally {
        setIsSubmitting(false);
    }
  };

  const openAddTransactionModal = () => {
    setCurrentTransaction(initialTransactionFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };
  
  const openEditModal = (transaction: SavingWithMemberName) => {
    setCurrentTransaction({
        ...transaction,
        date: new Date(transaction.date).toISOString().split('T')[0],
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };
  
  const openDeleteDialog = (transactionId: string) => {
    setTransactionToDelete(transactionId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete) return;
    const result = await deleteSavingTransaction(transactionToDelete);
    if (result.success) {
        toast({ title: 'Success', description: result.message });
        const data = await getSavingsPageData();
        setSavingsTransactions(data.savings);
        setMembers(data.members);
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setTransactionToDelete(null);
    setIsDeleteDialogOpen(false);
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
      const memberName = tx.memberName || '';
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearchTerm = memberName.toLowerCase().includes(searchTermLower) || (tx.memberId && tx.memberId.toLowerCase().includes(searchTermLower));
      const matchesStatus = selectedStatusFilter === 'all' || tx.status === selectedStatusFilter;
      const matchesType = selectedTypeFilter === 'all' || tx.transactionType === selectedTypeFilter;
      return matchesSearchTerm && matchesStatus && matchesType;
    });
  }, [savingsTransactions, searchTerm, selectedStatusFilter, selectedTypeFilter]);
  
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredTransactions.length / rowsPerPage);
  }, [filteredTransactions.length, rowsPerPage]);

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

  const handleExport = () => {
    const dataToExport = filteredTransactions.map(tx => ({
        'Member Name': tx.memberName,
        'Type': tx.transactionType,
        'Status': tx.status,
        'Amount (Birr)': tx.amount,
        'Date': new Date(tx.date).toLocaleDateString(),
        'Deposit Mode': tx.depositMode || 'N/A',
        'Source Name': tx.sourceName || '',
        'Transaction Reference': tx.transactionReference || '',
        'Notes': tx.notes || ''
    }));
    exportToExcel(dataToExport, 'savings_transactions_export');
  };
  
  const selectedMemberAccounts = useMemo(() => {
      if (!currentTransaction.memberId) return [];
      const member = members.find(m => m.id === currentTransaction.memberId);
      return member?.memberSavingAccounts || [];
  }, [currentTransaction.memberId, members]);

  return (
    <div className="space-y-6">
      <PageTitle title="Savings Transactions" subtitle="View and manage individual savings deposits and withdrawals.">
          {canCreate && (
            <Button onClick={handleExport} variant="outline" disabled={isLoading}>
                <FileDown className="mr-2 h-4 w-4" /> Export
            </Button>
          )}
          {canCreate && (
            <Button onClick={openAddTransactionModal} className="shadow-md hover:shadow-lg transition-shadow" disabled={isLoading}>
              <PlusCircle className="mr-2 h-5 w-5" /> Add Transaction
            </Button>
          )}
      </PageTitle>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <StatCard
          title="Total Approved Deposits (in view)"
          value={`${summaryStats.totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr`}
          icon={<ArrowUpCircle className="h-6 w-6 text-green-600" />}
          valueClassName="text-green-600"
        />
        <StatCard
          title="Total Approved Withdrawals (in view)"
          value={`${summaryStats.totalWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr`}
          icon={<ArrowDownCircle className="h-6 w-6 text-destructive" />}
          valueClassName="text-destructive"
        />
        <StatCard
          title="Net Savings (in view)"
          value={`${summaryStats.netSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr`}
          icon={<DollarSign className="h-6 w-6 text-accent" />}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by member name or ID..."
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
              <TableHead className="text-right">Amount (Birr)</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Deposit Mode</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : paginatedTransactions.length > 0 ? paginatedTransactions.map(tx => (
              <TableRow key={tx.id} className={tx.status === 'pending' ? 'bg-yellow-500/10' : tx.status === 'rejected' ? 'bg-destructive/10' : ''}>
                <TableCell className="font-medium">{tx.memberName || 'N/A'}</TableCell>
                <TableCell>
                  <span className={`flex items-center gap-1 ${tx.transactionType === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.transactionType === 'deposit' ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                    {tx.transactionType.charAt(0).toUpperCase() + tx.transactionType.slice(1)}
                  </span>
                </TableCell>
                <TableCell><Badge variant={getStatusBadgeVariant(tx.status)}>{tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}</Badge></TableCell>
                <TableCell className="text-right font-semibold">{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                <TableCell>{tx.depositMode || 'N/A'}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit && (<DropdownMenuItem onClick={() => openEditModal(tx)} disabled={tx.status === 'approved'}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>)}
                      {canDelete && (<DropdownMenuItem onClick={() => openDeleteDialog(tx.id)} disabled={tx.status === 'approved'} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No savings transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

        {filteredTransactions.length > 0 && (
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
                    <div>{filteredTransactions.length} transaction(s) found.</div>
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

    {/* Transaction Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {if (!isSubmitting) setIsModalOpen(open)}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Savings Transaction' : 'Add New Savings Transaction'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update this savings transaction.' : 'Enter details for a new savings transaction for a single member.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitTransaction} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="memberId">Member <span className="text-destructive">*</span></Label>
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
                    <CommandInput placeholder="Search by name or ID..." />
                    <CommandList>
                      <CommandEmpty>No member found.</CommandEmpty>
                      <CommandGroup>
                        {members.map((member) => (
                          <CommandItem
                            key={member.id}
                            value={`${member.fullName} ${member.id}`}
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
                            {member.fullName} ({member.id})
                             {member.status === 'inactive' && <Badge variant="outline" className="ml-auto text-destructive border-destructive">Closed</Badge>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
             <div>
                <Label htmlFor="memberSavingAccountId">Savings Account <span className="text-destructive">*</span></Label>
                <Select name="memberSavingAccountId" onValueChange={(val) => handleSelectChange('memberSavingAccountId', val)} value={currentTransaction.memberSavingAccountId} disabled={!currentTransaction.memberId}>
                    <SelectTrigger><SelectValue placeholder="Select member's account..." /></SelectTrigger>
                    <SelectContent>
                        {selectedMemberAccounts.map(account => (
                            <SelectItem key={account.id} value={account.id}>
                                {account.accountNumber} (Bal: {account.balance.toFixed(2)} Birr)
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
             </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="amount">Amount (Birr) <span className="text-destructive">*</span></Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" value={currentTransaction.amount || ''} onChange={handleInputChange} required className="pl-8" />
                    </div>
                </div>
                <div>
                    <Label htmlFor="date">Transaction Date <span className="text-destructive">*</span></Label>
                    <Input id="date" name="date" type="date" value={currentTransaction.date || ''} onChange={handleInputChange} required />
                </div>
            </div>
            <div>
                <Label htmlFor="transactionType">Transaction Type <span className="text-destructive">*</span></Label>
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
                                    <Label htmlFor="sourceName">{currentTransaction.depositMode} Name <span className="text-destructive">*</span></Label>
                                    <div className="relative">
                                     {currentTransaction.depositMode === 'Bank' && <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                     {currentTransaction.depositMode === 'Wallet' &&  <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                    <Input id="sourceName" name="sourceName" placeholder={`Enter ${currentTransaction.depositMode} Name`} value={currentTransaction.sourceName || ''} onChange={handleInputChange} className="pl-8" />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="transactionReference">Transaction Reference</Label>
                                    <Input id="transactionReference" name="transactionReference" placeholder="e.g., TRN123XYZ" value={currentTransaction.transactionReference || ''} onChange={handleInputChange} />
                                </div>
                            </div>
                            <div className="pl-3">
                                <FileUpload
                                    id="evidenceUrl"
                                    label="Evidence Attachment"
                                    value={currentTransaction.evidenceUrl || ''}
                                    onValueChange={(newValue) => {
                                        setCurrentTransaction(prev => ({...prev, evidenceUrl: newValue}));
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </>
            )}
            <DialogFooter className="pt-6">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Submit for Approval'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This will permanently delete this transaction record. This action cannot be undone and is only available for transactions that have not been approved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Yes, delete transaction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
