
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter, DollarSign, Banknote, Wallet, FileText } from 'lucide-react';
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
import { mockSavings, mockMembers } from '@/data/mock';
import type { Saving, Member } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';

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
  const [savings, setSavings] = useState<Saving[]>(mockSavings);
  const [members] = useState<Member[]>(mockMembers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSaving, setCurrentSaving] = useState<Partial<Saving>>(initialSavingFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nameParts = name.split('.');

    if (nameParts.length > 1 && nameParts[0] === 'paymentDetails') {
        const fieldName = nameParts[1] as keyof NonNullable<Saving['paymentDetails']>;
        setCurrentSaving(prev => ({
            ...prev,
            paymentDetails: {
                ...(prev?.paymentDetails || {}),
                [fieldName]: value,
            }
        }));
    } else {
        setCurrentSaving(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
    }

    if (name === 'date') {
        const dateObj = new Date(value);
        const month = dateObj.toLocaleString('default', { month: 'long' });
        const year = dateObj.getFullYear();
        setCurrentSaving(prev => ({ ...prev, month: `${month} ${year}`}));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setCurrentSaving(prev => ({ ...prev, [name]: value }));
  };
  
  const handleTransactionTypeChange = (value: 'deposit' | 'withdrawal') => {
    setCurrentSaving(prev => ({ 
        ...prev, 
        transactionType: value,
        // Reset deposit-specific fields if switching to withdrawal
        depositMode: value === 'withdrawal' ? undefined : prev.depositMode || 'Cash',
        paymentDetails: value === 'withdrawal' ? undefined : prev.paymentDetails || { sourceName: '', transactionReference: '', evidenceUrl: ''},
    }));
  };

  const handleDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setCurrentSaving(prev => ({
        ...prev,
        depositMode: value,
        paymentDetails: value === 'Cash' ? undefined : (prev.paymentDetails || { sourceName: '', transactionReference: '', evidenceUrl: ''}),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSaving.memberId || !currentSaving.amount || currentSaving.amount <= 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a member and enter a valid amount.' });
        return;
    }
    if (currentSaving.transactionType === 'deposit' && !currentSaving.depositMode) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a deposit mode.' });
        return;
    }
    if ((currentSaving.depositMode === 'Bank' || currentSaving.depositMode === 'Wallet') && !currentSaving.paymentDetails?.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter the Bank/Wallet Name for this deposit.' });
        return;
    }


    const memberName = members.find(m => m.id === currentSaving.memberId)?.fullName;
    let savingDataToSave = { ...currentSaving, memberName };

    if (savingDataToSave.transactionType === 'withdrawal' || savingDataToSave.depositMode === 'Cash') {
        savingDataToSave.paymentDetails = undefined;
    }
    if (savingDataToSave.transactionType === 'withdrawal') {
        savingDataToSave.depositMode = undefined;
    }


    if (isEditing && savingDataToSave.id) {
      setSavings(prev => prev.map(s => s.id === savingDataToSave.id ? savingDataToSave as Saving : s));
      toast({ title: 'Success', description: 'Savings record updated.' });
    } else {
      const newSaving: Saving = {
        id: `saving-${Date.now()}`,
        ...initialSavingFormState, // provide all default fields
        ...savingDataToSave,
      } as Saving;
      setSavings(prev => [newSaving, ...prev]);
      toast({ title: 'Success', description: 'Savings record added.' });
    }
    setIsModalOpen(false);
    setCurrentSaving(initialSavingFormState);
    setIsEditing(false);
  };

  const openAddModal = () => {
    setCurrentSaving(initialSavingFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (saving: Saving) => {
    setCurrentSaving({
      ...saving,
      date: saving.date ? new Date(saving.date).toISOString().split('T')[0] : '',
      // Ensure paymentDetails is an object even if undefined in mock, for form binding
      paymentDetails: saving.paymentDetails || { sourceName: '', transactionReference: '', evidenceUrl: ''},
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = (savingId: string) => {
    if (window.confirm('Are you sure you want to delete this savings record?')) {
      setSavings(prev => prev.filter(s => s.id !== savingId));
      toast({ title: 'Success', description: 'Savings record deleted.' });
    }
  };

  const filteredSavings = useMemo(() => {
    return savings.filter(saving => {
      const member = members.find(m => m.id === saving.memberId);
      const matchesSearchTerm = member ? member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const matchesMemberFilter = selectedMemberFilter === 'all' || saving.memberId === selectedMemberFilter;
      return matchesSearchTerm && matchesMemberFilter;
    });
  }, [savings, members, searchTerm, selectedMemberFilter]);

  return (
    <div className="space-y-6">
      <PageTitle title="Savings Tracking" subtitle="Monitor and manage member savings contributions.">
        <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
          <PlusCircle className="mr-2 h-5 w-5" /> Add Record
        </Button>
      </PageTitle>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by member name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
            aria-label="Search savings records"
          />
        </div>
        <Select value={selectedMemberFilter} onValueChange={setSelectedMemberFilter}>
          <SelectTrigger className="w-full sm:w-[220px]" aria-label="Filter by member">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Filter by member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            {members.map(member => (
              <SelectItem key={member.id} value={member.id}>{member.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox aria-label="Select all savings records" />
              </TableHead>
              <TableHead>Member Name</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Deposit Mode</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSavings.length > 0 ? filteredSavings.map(saving => (
              <TableRow key={saving.id}>
                <TableCell>
                  <Checkbox aria-label={`Select saving record for ${saving.memberName}`} />
                </TableCell>
                <TableCell className="font-medium">{saving.memberName || members.find(m => m.id === saving.memberId)?.fullName}</TableCell>
                <TableCell className="text-right">${saving.amount.toFixed(2)}</TableCell>
                <TableCell>{new Date(saving.date).toLocaleDateString()}</TableCell>
                <TableCell>{saving.month}</TableCell>
                <TableCell>
                  <Badge variant={saving.transactionType === 'deposit' ? 'default' : 'destructive'} className="capitalize">
                    {saving.transactionType}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">{saving.depositMode || 'N/A'}</TableCell>
                <TableCell className="text-right">
                   <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(saving)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(saving.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No savings records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
       {filteredSavings.length > 10 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline">Load More</Button>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg"> {/* Adjusted width slightly */}
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Savings Record' : 'Add New Savings Record'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update this savings transaction.' : 'Enter details for a new savings transaction.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="memberId">Member</Label>
              <Select name="memberId" value={currentSaving.memberId || ''} onValueChange={(value) => handleSelectChange('memberId', value)} required>
                <SelectTrigger><SelectValue placeholder="Select a member" /></SelectTrigger>
                <SelectContent>{members.map(member => (<SelectItem key={member.id} value={member.id}>{member.fullName}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="amount">Amount ($)</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" value={currentSaving.amount || ''} onChange={handleInputChange} required className="pl-8" />
                    </div>
                </div>
                <div>
                    <Label htmlFor="date">Transaction Date</Label>
                    <Input id="date" name="date" type="date" value={currentSaving.date || ''} onChange={handleInputChange} required />
                </div>
            </div>

            <div>
                <Label htmlFor="transactionType">Transaction Type</Label>
                <RadioGroup
                    id="transactionType"
                    name="transactionType"
                    value={currentSaving.transactionType}
                    onValueChange={handleTransactionTypeChange}
                    className="flex space-x-4 pt-2"
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="deposit" id="deposit" />
                        <Label htmlFor="deposit">Deposit</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="withdrawal" id="withdrawal" />
                        <Label htmlFor="withdrawal">Withdrawal</Label>
                    </div>
                </RadioGroup>
            </div>

            {currentSaving.transactionType === 'deposit' && (
                <>
                    <Separator className="my-3" />
                    <div>
                        <Label htmlFor="depositMode">Deposit Mode</Label>
                        <RadioGroup
                            id="depositMode"
                            name="depositMode"
                            value={currentSaving.depositMode || 'Cash'}
                            onValueChange={handleDepositModeChange}
                            className="flex space-x-4 pt-2"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Cash" id="cash" /><Label htmlFor="cash">Cash</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Bank" id="bank" /><Label htmlFor="bank">Bank</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Wallet" id="wallet" /><Label htmlFor="wallet">Wallet</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {(currentSaving.depositMode === 'Bank' || currentSaving.depositMode === 'Wallet') && (
                        <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                             <div className="grid grid-cols-2 gap-4 pl-3">
                                <div>
                                    <Label htmlFor="paymentDetails.sourceName">{currentSaving.depositMode} Name</Label>
                                    <div className="relative">
                                     {currentSaving.depositMode === 'Bank' && <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                     {currentSaving.depositMode === 'Wallet' &&  <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                    <Input id="paymentDetails.sourceName" name="paymentDetails.sourceName" placeholder={`Enter ${currentSaving.depositMode} Name`} value={currentSaving.paymentDetails?.sourceName || ''} onChange={handleInputChange} className="pl-8" />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="paymentDetails.transactionReference">Transaction Reference</Label>
                                    <Input id="paymentDetails.transactionReference" name="paymentDetails.transactionReference" placeholder="e.g., TRN123XYZ" value={currentSaving.paymentDetails?.transactionReference || ''} onChange={handleInputChange} />
                                </div>
                            </div>
                            <div className="pl-3">
                                <Label htmlFor="paymentDetails.evidenceUrl">Evidence Attachment (URL/Filename)</Label>
                                 <div className="relative">
                                    <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input id="paymentDetails.evidenceUrl" name="paymentDetails.evidenceUrl" placeholder="e.g., http://example.com/receipt.pdf" value={currentSaving.paymentDetails?.evidenceUrl || ''} onChange={handleInputChange} className="pl-8"/>
                                 </div>
                                <p className="text-xs text-muted-foreground mt-1">Enter URL or filename of the deposit evidence. Full file upload not supported in this demo.</p>
                            </div>
                        </div>
                    )}
                </>
            )}
            
            <DialogFooter className="pt-6">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add Record'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
