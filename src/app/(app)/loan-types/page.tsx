
'use client';

import React, { useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Percent, CalendarClock, Banknote, AlertTriangle } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { mockLoanTypes } from '@/data/mock';
import type { LoanType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const initialFormState: Partial<Omit<LoanType, 'id'>> = {
  name: '',
  description: '',
  interestRate: 0,
  loanTerm: 12,
  repaymentFrequency: 'monthly',
  nplInterestRate: 0,
};

export default function LoanTypesPage() {
  const [loanTypes, setLoanTypes] = useState<LoanType[]>(mockLoanTypes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentLoanType, setCurrentLoanType] = useState<Partial<LoanType>>(initialFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentLoanType(prev => ({
      ...prev,
      [name]: (name === 'interestRate' || name === 'nplInterestRate' || name === 'loanTerm') ? parseFloat(value) : value
    }));
  };
  
   const handleSelectChange = (name: keyof LoanType, value: string) => {
    setCurrentLoanType(prev => ({ ...prev, [name]: value as LoanType['repaymentFrequency'] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLoanType.name || currentLoanType.interestRate === undefined || currentLoanType.interestRate < 0 || currentLoanType.loanTerm === undefined || currentLoanType.loanTerm <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Loan type name, a valid interest rate, and a positive loan term are required.' });
      return;
    }
    if (currentLoanType.nplInterestRate === undefined || currentLoanType.nplInterestRate < 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'NPL Interest Rate must be a non-negative number.' });
        return;
    }
    
    // Convert percentage inputs back to decimal for storage
    const dataToSave = {
        ...currentLoanType,
        interestRate: (currentLoanType.interestRate || 0) / 100,
        nplInterestRate: (currentLoanType.nplInterestRate || 0) / 100,
    };

    if (isEditing && dataToSave.id) {
      setLoanTypes(prev => prev.map(lt => lt.id === dataToSave.id ? { ...lt, ...dataToSave } as LoanType : lt));
      toast({ title: 'Success', description: 'Loan type updated successfully.' });
    } else {
      const newLoanType: LoanType = {
        id: `ltype-${Date.now()}`,
        name: dataToSave.name || '',
        interestRate: dataToSave.interestRate || 0,
        loanTerm: dataToSave.loanTerm || 12,
        repaymentFrequency: dataToSave.repaymentFrequency || 'monthly',
        nplInterestRate: dataToSave.nplInterestRate || 0,
        description: dataToSave.description,
      };
      setLoanTypes(prev => [newLoanType, ...prev]);
      toast({ title: 'Success', description: 'Loan type added successfully.' });
    }
    setIsModalOpen(false);
    setCurrentLoanType(initialFormState);
    setIsEditing(false);
  };

  const openAddModal = () => {
    setCurrentLoanType(initialFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (loanType: LoanType) => {
    setCurrentLoanType({
        ...loanType, 
        interestRate: loanType.interestRate * 100, // Display rate as percentage
        nplInterestRate: loanType.nplInterestRate * 100,
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = (loanTypeId: string) => {
    // TODO: Add check if loan type is in use
    if (window.confirm('Are you sure you want to delete this loan type? This action cannot be undone.')) {
      setLoanTypes(prev => prev.filter(lt => lt.id !== loanTypeId));
      toast({ title: 'Success', description: 'Loan type deleted successfully.' });
    }
  };

  const filteredLoanTypes = useMemo(() => {
    return loanTypes.filter(lt =>
      lt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lt.description && lt.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [loanTypes, searchTerm]);

  const getFrequencyLabel = (frequency: LoanType['repaymentFrequency']) => {
    switch (frequency) {
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      case 'yearly': return 'Yearly';
      default: return frequency;
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Manage Loan Types" subtitle="Define the loan products offered by your association.">
        <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
          <PlusCircle className="mr-2 h-5 w-5" /> Add Loan Type
        </Button>
      </PageTitle>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search loan types by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full"
          aria-label="Search loan types"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Interest Rate (Annual)</TableHead>
              <TableHead className="text-right">Loan Term (Months)</TableHead>
              <TableHead className="text-center">Repayment</TableHead>
              <TableHead className="text-right">NPL Rate (Annual)</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLoanTypes.length > 0 ? filteredLoanTypes.map(loanType => (
              <TableRow key={loanType.id}>
                <TableCell className="font-medium">{loanType.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{loanType.description || 'N/A'}</TableCell>
                <TableCell className="text-right font-semibold text-green-600">{(loanType.interestRate * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-right">{loanType.loanTerm}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{getFrequencyLabel(loanType.repaymentFrequency)}</Badge>
                </TableCell>
                <TableCell className="text-right font-semibold text-destructive">{(loanType.nplInterestRate * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(loanType)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(loanType.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No loan types found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Loan Type' : 'Add New Loan Type'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the details for this loan type.' : 'Enter the details for the new loan type.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Loan Type Name</Label>
              <Input id="name" name="name" value={currentLoanType.name || ''} onChange={handleInputChange} required />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="interestRate">Interest Rate (Annual %)</Label>
                    <div className="relative">
                        <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="interestRate" 
                            name="interestRate" 
                            type="number" 
                            step="0.01" 
                            min="0"
                            value={currentLoanType.interestRate || ''} 
                            onChange={handleInputChange} 
                            required 
                            className="pr-7"
                            placeholder="e.g., 8.5 for 8.5%"
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor="nplInterestRate">NPL Interest Rate (Annual %)</Label>
                     <div className="relative">
                        <AlertTriangle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive/70" />
                        <Input 
                            id="nplInterestRate" 
                            name="nplInterestRate" 
                            type="number" 
                            step="0.01" 
                            min="0"
                            value={currentLoanType.nplInterestRate || ''} 
                            onChange={handleInputChange}
                            className="pr-7"
                            placeholder="e.g., 15 for 15%"
                        />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="loanTerm">Loan Term (in months)</Label>
                    <div className="relative">
                        <CalendarClock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="loanTerm" 
                            name="loanTerm" 
                            type="number" 
                            step="1" 
                            min="1"
                            value={currentLoanType.loanTerm || ''} 
                            onChange={handleInputChange} 
                            required 
                            className="pl-8"
                            placeholder="e.g., 12"
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor="repaymentFrequency">Repayment Frequency</Label>
                     <Select name="repaymentFrequency" value={currentLoanType.repaymentFrequency || 'monthly'} onValueChange={(value) => handleSelectChange('repaymentFrequency', value)} required>
                        <SelectTrigger id="repaymentFrequency"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" name="description" value={currentLoanType.description || ''} onChange={handleInputChange} placeholder="E.g., For short-term personal needs" />
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add Loan Type'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
