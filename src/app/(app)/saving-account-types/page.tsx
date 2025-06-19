
'use client';

import React, { useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Percent } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { mockSavingAccountTypes } from '@/data/mock';
import type { SavingAccountType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const initialFormState: Omit<SavingAccountType, 'id'> = {
  name: '',
  description: '',
  interestRate: 0,
};

export default function SavingAccountTypesPage() {
  const [accountTypes, setAccountTypes] = useState<SavingAccountType[]>(mockSavingAccountTypes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAccountType, setCurrentAccountType] = useState<Partial<SavingAccountType>>(initialFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentAccountType(prev => ({
      ...prev,
      [name]: name === 'interestRate' ? parseFloat(value) / 100 : value // Convert percentage to decimal
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccountType.name || currentAccountType.interestRate === undefined || currentAccountType.interestRate < 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Account type name and a valid non-negative interest rate are required.' });
      return;
    }

    if (isEditing && currentAccountType.id) {
      setAccountTypes(prev => prev.map(st => st.id === currentAccountType.id ? { ...st, ...currentAccountType } as SavingAccountType : st));
      toast({ title: 'Success', description: 'Saving account type updated successfully.' });
    } else {
      const newAccountType: SavingAccountType = {
        id: `satype-${Date.now()}`,
        ...initialFormState,
        ...currentAccountType,
      } as SavingAccountType;
      setAccountTypes(prev => [newAccountType, ...prev]);
      toast({ title: 'Success', description: 'Saving account type added successfully.' });
    }
    setIsModalOpen(false);
    setCurrentAccountType(initialFormState);
    setIsEditing(false);
  };

  const openAddModal = () => {
    setCurrentAccountType(initialFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (accountType: SavingAccountType) => {
    setCurrentAccountType({...accountType, interestRate: accountType.interestRate * 100}); // Display rate as percentage
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = (accountTypeId: string) => {
    // TODO: Add check if account type is in use by members
    if (window.confirm('Are you sure you want to delete this saving account type? This action cannot be undone.')) {
      setAccountTypes(prev => prev.filter(st => st.id !== accountTypeId));
      toast({ title: 'Success', description: 'Saving account type deleted successfully.' });
    }
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
              <TableHead className="w-[50px]">
                <Checkbox aria-label="Select all saving account types" />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Interest Rate</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAccountTypes.length > 0 ? filteredAccountTypes.map(accountType => (
              <TableRow key={accountType.id}>
                <TableCell>
                  <Checkbox aria-label={`Select account type ${accountType.name}`} />
                </TableCell>
                <TableCell className="font-medium">{accountType.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{accountType.description || 'N/A'}</TableCell>
                <TableCell className="text-right font-semibold">{(accountType.interestRate * 100).toFixed(2)}%</TableCell>
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
                      <DropdownMenuItem onClick={() => handleDelete(accountType.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
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
      {filteredAccountTypes.length > 10 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline">Load More</Button>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
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
                    value={currentAccountType.interestRate !== undefined ? (typeof currentAccountType.interestRate === 'string' ? currentAccountType.interestRate : (currentAccountType.interestRate * 100).toFixed(2)) : ''}
                    onChange={handleInputChange} 
                    required 
                    className="pr-7"
                    placeholder="e.g., 2.5 for 2.5%"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" name="description" value={currentAccountType.description || ''} onChange={handleInputChange} placeholder="E.g., Standard savings, high-yield, student account" />
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add Account Type'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
