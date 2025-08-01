
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
import { useAuth } from '@/contexts/auth-context';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';


const initialFormState: Partial<SavingAccountType> = {
  name: '',
  description: '',
  interestRate: undefined,
  contributionType: 'FIXED',
  contributionValue: 0,
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
  const { user } = useAuth();

  const canCreate = useMemo(() => user?.permissions.includes('configuration:create'), [user]);
  const canEdit = useMemo(() => user?.permissions.includes('configuration:edit'), [user]);
  const canDelete = useMemo(() => user?.permissions.includes('configuration:delete'), [user]);
  
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
    if (user) {
      fetchAccountTypes();
    }
  }, [user, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'interestRate' || name === 'contributionValue') {
      const parsedValue = parseFloat(value);
      setCurrentAccountType(prev => ({...prev, [name]: isNaN(parsedValue) ? 0 : parsedValue }));
    } else {
       setCurrentAccountType(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleContributionTypeChange = (value: 'FIXED' | 'PERCENTAGE') => {
      setCurrentAccountType(prev => ({...prev, contributionType: value}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccountType.name || currentAccountType.interestRate === undefined || currentAccountType.interestRate < 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Account type name and a valid non-negative interest rate are required.' });
      return;
    }
    if (currentAccountType.contributionValue === undefined || currentAccountType.contributionValue < 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Contribution value cannot be negative.' });
        return;
    }

    setIsSubmitting(true);

    const dataToSave = {
        name: currentAccountType.name!,
        description: currentAccountType.description,
        interestRate: (currentAccountType.interestRate || 0) / 100, // Convert percentage to decimal
        contributionType: currentAccountType.contributionType!,
        contributionValue: currentAccountType.contributionType === 'PERCENTAGE' 
            ? (currentAccountType.contributionValue || 0) / 100 // Convert percentage decimal to display
            : currentAccountType.contributionValue || 0,
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
        contributionValue: accountType.contributionType === 'PERCENTAGE' 
            ? accountType.contributionValue * 100 // Convert percentage decimal to display
            : accountType.contributionValue,
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
  
  const formatContribution = (type: SavingAccountType) => {
      const value = type.contributionValue ?? 0;
      if (type.contributionType === 'PERCENTAGE') {
          return `${(value * 100).toFixed(2)}% of Salary`;
      }
      return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr`;
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Manage Saving Account Types" subtitle="Define the types of saving accounts available in your association.">
        {canCreate && (
          <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
            <PlusCircle className="mr-2 h-5 w-5" /> Add Account Type
          </Button>
        )}
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
              <TableHead className="text-right">Interest Rate (Annual)</TableHead>
              <TableHead className="text-right">Expected Monthly Contrib.</TableHead>
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
                <TableCell className="text-right font-semibold">
                    <Badge variant="secondary">{formatContribution(accountType)}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit && <DropdownMenuItem onClick={() => openEditModal(accountType)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>}
                      {canDelete && <DropdownMenuItem onClick={() => openDeleteDialog(accountType.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>}
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
              <Label htmlFor="name">Account Type Name <span className="text-destructive">*</span></Label>
              <Input id="name" name="name" value={currentAccountType.name || ''} onChange={handleInputChange} required />
            </div>
             <div>
                <Label htmlFor="interestRate">Interest Rate (%) <span className="text-destructive">*</span></Label>
                <div className="relative">
                    <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="interestRate" 
                        name="interestRate" 
                        type="number" 
                        step="0.01" 
                        min="0"
                        value={currentAccountType.interestRate ?? ''}
                        onChange={handleInputChange} 
                        required 
                        className="pr-7"
                        placeholder="e.g., 2.5"
                    />
                </div>
            </div>
            <div>
                <Label>Expected Monthly Contribution</Label>
                <RadioGroup value={currentAccountType.contributionType || 'FIXED'} onValueChange={handleContributionTypeChange} className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="FIXED" id="fixed" /><Label htmlFor="fixed">Fixed Amount</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="PERCENTAGE" id="percentage" /><Label htmlFor="percentage">Percentage of Salary</Label></div>
                </RadioGroup>
            </div>
            <div>
                <Label htmlFor="contributionValue">Value</Label>
                <div className="relative">
                    {currentAccountType.contributionType === 'FIXED' ? (
                         <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    ) : (
                        <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    )}
                    <Input 
                        id="contributionValue" 
                        name="contributionValue" 
                        type="number" 
                        step="0.01" 
                        min="0"
                        value={currentAccountType.contributionValue ?? ''} 
                        onChange={handleInputChange}
                        className={currentAccountType.contributionType === 'FIXED' ? 'pl-7' : 'pr-7'}
                        placeholder="0.00"
                    />
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
