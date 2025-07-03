
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Percent, DollarSign, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import type { SavingAccountType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getSavingAccountTypes, addSavingAccountType, updateSavingAccountType, deleteSavingAccountType } from './actions';


const initialFormState: Partial<Omit<SavingAccountType, 'id'>> = {
  name: '',
  description: '',
  interestRate: 0,
  expectedMonthlyContribution: 0,
};

export default function SavingAccountTypesPage() {
  const [accountTypes, setAccountTypes] = useState<SavingAccountType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [accountTypeToDelete, setAccountTypeToDelete] = useState<string | null>(null);
  
  const [currentAccountType, setCurrentAccountType] = useState<Partial<SavingAccountType>>(initialFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  
  const fetchAccountTypes = async () => {
    setIsLoading(true);
    try {
        const data = await getSavingAccountTypes();
        setAccountTypes(data);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load saving account types.' });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountTypes();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value);
    
    if (name === 'interestRate') {
      setCurrentAccountType(prev => ({...prev, [name]: numValue }));
    } else if (name === 'expectedMonthlyContribution') {
       setCurrentAccountType(prev => ({...prev, [name]: numValue }));
    } else {
       setCurrentAccountType(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccountType.name || currentAccountType.interestRate === undefined || currentAccountType.interestRate < 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Account type name and a valid non-negative interest rate are required.' });
      return;
    }
    if (currentAccountType.expectedMonthlyContribution !== undefined && currentAccountType.expectedMonthlyContribution < 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Expected monthly contribution cannot be negative.' });
        return;
    }

    setIsSubmitting(true);

    const dataToSave = {
        name: currentAccountType.name!,
        description: currentAccountType.description,
        interestRate: (currentAccountType.interestRate || 0) / 100, // Convert percentage to decimal
        expectedMonthlyContribution: currentAccountType.expectedMonthlyContribution,
    };

    try {
        if (isEditing && currentAccountType.id) {
            await updateSavingAccountType(currentAccountType.id, dataToSave);
            toast({ title: 'Success', description: 'Saving account type updated successfully.' });
        } else {
            await addSavingAccountType(dataToSave as Omit<SavingAccountType, 'id'>);
            toast({ title: 'Success', description: 'Saving account type added successfully.' });
        }
        await fetchAccountTypes();
        setIsModalOpen(false);
    } catch(error) {
        toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setCurrentAccountType(initialFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (accountType: SavingAccountType) => {
    setCurrentAccountType({
        ...accountType, 
        interestRate: accountType.interestRate * 100, // Convert decimal to percentage for display
        expectedMonthlyContribution: accountType.expectedMonthlyContribution || 0,
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!accountTypeToDelete) return;
    const result = await deleteSavingAccountType(accountTypeToDelete);
    if (result.success) {
        toast({ title: 'Success', description: result.message });
        await fetchAccountTypes();
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setAccountTypeToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const openDeleteDialog = (id: string) => {
    setAccountTypeToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const filteredAccountTypes = useMemo(() => {
    return accountTypes.filter(st =>
      st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (st.description && st.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [accountTypes, searchTerm]);

  return (
    <div className="space-y-6">
      <PageTitle title="Manage Saving Account Types" subtitle="Define the types of saving accounts available in your association.">
        <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
          <PlusCircle className="mr-2 h-5 w-5" /> Add Account Type
        </Button>
      </PageTitle>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search account types by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full"
          aria-label="Search saving account types"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Interest Rate</TableHead>
              <TableHead className="text-right">Expected Monthly Contrib. ($)</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin" /></TableCell></TableRow>
            ) : filteredAccountTypes.length > 0 ? filteredAccountTypes.map(accountType => (
              <TableRow key={accountType.id}>
                <TableCell className="font-medium">{accountType.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{accountType.description || 'N/A'}</TableCell>
                <TableCell className="text-right font-semibold">{(accountType.interestRate * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-right font-semibold">${(accountType.expectedMonthlyContribution || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(accountType)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openDeleteDialog(accountType.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No saving account types found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!isSubmitting) setIsModalOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Saving Account Type' : 'Add New Saving Account Type'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the details for this saving account type.' : 'Enter the details for the new saving account type.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Account Type Name</Label>
              <Input id="name" name="name" value={currentAccountType.name || ''} onChange={handleInputChange} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="interestRate">Interest Rate (%)</Label>
                    <div className="relative">
                        <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="interestRate" 
                            name="interestRate" 
                            type="number" 
                            step="0.01" 
                            min="0"
                            value={currentAccountType.interestRate || ''}
                            onChange={handleInputChange} 
                            required 
                            className="pr-7"
                            placeholder="e.g., 2.5"
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor="expectedMonthlyContribution">Expected Monthly Contribution ($)</Label>
                     <div className="relative">
                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="expectedMonthlyContribution" 
                            name="expectedMonthlyContribution" 
                            type="number" 
                            step="0.01" 
                            min="0"
                            value={currentAccountType.expectedMonthlyContribution || ''} 
                            onChange={handleInputChange}
                            className="pl-7"
                            placeholder="0.00"
                        />
                    </div>
                </div>
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" name="description" value={currentAccountType.description || ''} onChange={handleInputChange} placeholder="E.g., Standard savings, high-yield, student account" />
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Add Account Type'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action is irreversible. It will permanently delete this saving account type.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    