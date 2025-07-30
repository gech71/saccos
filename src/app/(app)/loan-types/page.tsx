
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Percent, CalendarClock, AlertTriangle, ShieldQuestion, CalendarDays, Loader2 } from 'lucide-react';
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
import type { LoanType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getLoanTypes, addLoanType, updateLoanType, deleteLoanType } from './actions';
import { useAuth } from '@/contexts/auth-context';

const initialFormState: Partial<Omit<LoanType, 'id'>> = {
  name: '',
  interestRate: undefined,
  minLoanAmount: 1000,
  maxLoanAmount: 5000,
  minRepaymentPeriod: 1,
  maxRepaymentPeriod: 12,
  repaymentFrequency: 'monthly',
  nplInterestRate: undefined,
  nplGracePeriodDays: 30,
  allowConcurrent: false,
};

export default function LoanTypesPage() {
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [loanTypeToDelete, setLoanTypeToDelete] = useState<string | null>(null);
  
  const [currentLoanType, setCurrentLoanType] = useState<Partial<LoanType>>(initialFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);


  const canCreate = useMemo(() => user?.permissions.includes('configuration:create'), [user]);
  const canEdit = useMemo(() => user?.permissions.includes('configuration:edit'), [user]);
  const canDelete = useMemo(() => user?.permissions.includes('configuration:delete'), [user]);
  
  const fetchLoanTypes = async () => {
      setIsLoading(true);
      try {
          const data = await getLoanTypes();
          setLoanTypes(data);
      } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to load loan types.' });
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    if (user) {
      fetchLoanTypes();
    }
  }, [user, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentLoanType(prev => ({
      ...prev,
      [name]: (name.includes('Amount') || name.includes('Rate') || name.includes('Period')) ? parseFloat(value) : value
    }));
  };
  
   const handleSelectChange = (name: keyof LoanType, value: string) => {
    setCurrentLoanType(prev => ({ ...prev, [name]: value as LoanType['repaymentFrequency'] }));
  };

  const handleCheckboxChange = (name: keyof LoanType, checked: boolean) => {
    setCurrentLoanType(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const {name, interestRate, minLoanAmount, maxLoanAmount, minRepaymentPeriod, maxRepaymentPeriod, nplInterestRate} = currentLoanType;

    if (!name || interestRate === undefined || interestRate < 0 ) {
      toast({ variant: 'destructive', title: 'Error', description: 'Loan type name and a valid interest rate are required.' });
      return;
    }
    if (minLoanAmount === undefined || maxLoanAmount === undefined || minLoanAmount <= 0 || maxLoanAmount <= minLoanAmount) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please provide a valid loan amount range.' });
        return;
    }
    if (minRepaymentPeriod === undefined || maxRepaymentPeriod === undefined || minRepaymentPeriod <= 0 || maxRepaymentPeriod < minRepaymentPeriod) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please provide a valid repayment period range.' });
        return;
    }
    if (nplInterestRate === undefined || nplInterestRate < 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'NPL Interest Rate must be a non-negative number.' });
        return;
    }
    
    setIsSubmitting(true);
    const dataToSave = {
        name: currentLoanType.name!,
        interestRate: (currentLoanType.interestRate || 0) / 100,
        minLoanAmount: currentLoanType.minLoanAmount,
        maxLoanAmount: currentLoanType.maxLoanAmount,
        minRepaymentPeriod: currentLoanType.minRepaymentPeriod,
        maxRepaymentPeriod: currentLoanType.maxRepaymentPeriod,
        repaymentFrequency: currentLoanType.repaymentFrequency!,
        nplInterestRate: (currentLoanType.nplInterestRate || 0) / 100,
        nplGracePeriodDays: currentLoanType.nplGracePeriodDays,
        allowConcurrent: currentLoanType.allowConcurrent || false,
    };

    try {
        if (isEditing && currentLoanType.id) {
            await updateLoanType(currentLoanType.id, dataToSave);
            toast({ title: 'Success', description: 'Loan type updated successfully.' });
        } else {
            await addLoanType(dataToSave as Omit<LoanType, 'id'>);
            toast({ title: 'Success', description: 'Loan type added successfully.' });
        }
        await fetchLoanTypes();
        setIsModalOpen(false);
    } catch(error) {
        toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    } finally {
        setIsSubmitting(false);
    }
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

  const handleDeleteConfirm = async () => {
    if (!loanTypeToDelete) return;
    const result = await deleteLoanType(loanTypeToDelete);
    if (result.success) {
        toast({ title: 'Success', description: result.message });
        await fetchLoanTypes();
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setLoanTypeToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const openDeleteDialog = (loanTypeId: string) => {
    setLoanTypeToDelete(loanTypeId);
    setIsDeleteDialogOpen(true);
  };

  const filteredLoanTypes = useMemo(() => {
    return loanTypes.filter(lt =>
      lt.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [loanTypes, searchTerm]);

  const paginatedLoanTypes = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredLoanTypes.slice(startIndex, endIndex);
  }, [filteredLoanTypes, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredLoanTypes.length / rowsPerPage);
  }, [filteredLoanTypes.length, rowsPerPage]);

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
        {canCreate && (
          <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
            <PlusCircle className="mr-2 h-5 w-5" /> Add Loan Type
          </Button>
        )}
      </PageTitle>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search loan types by name..."
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
              <TableHead>Loan Range (ETB)</TableHead>
              <TableHead>Repayment Period (Months)</TableHead>
              <TableHead className="text-right">Interest Rate (Annual)</TableHead>
              <TableHead className="text-right">NPL Rate (Annual)</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin" /></TableCell></TableRow>
            ) : paginatedLoanTypes.length > 0 ? paginatedLoanTypes.map(loanType => (
              <TableRow key={loanType.id}>
                <TableCell className="font-medium">{loanType.name}</TableCell>
                <TableCell>{loanType.minLoanAmount.toLocaleString()} - {loanType.maxLoanAmount.toLocaleString()}</TableCell>
                <TableCell>{loanType.minRepaymentPeriod} - {loanType.maxRepaymentPeriod}</TableCell>
                <TableCell className="text-right font-semibold text-green-600">{(loanType.interestRate * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-right font-semibold text-destructive">{(loanType.nplInterestRate * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit && <DropdownMenuItem onClick={() => openEditModal(loanType)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>}
                      {canDelete && <DropdownMenuItem onClick={() => openDeleteDialog(loanType.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No loan types found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!isSubmitting) setIsModalOpen(open); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Loan Type' : 'Add New Loan Type'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the details for this loan type.' : 'Enter the details for the new loan type.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Loan Type Name <span className="text-destructive">*</span></Label>
              <Input id="name" name="name" value={currentLoanType.name || ''} onChange={handleInputChange} required />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="minLoanAmount">Min Loan Amount (ETB)</Label>
                    <Input id="minLoanAmount" name="minLoanAmount" type="number" step="100" min="0" value={currentLoanType.minLoanAmount ?? ''} onChange={handleInputChange} />
                </div>
                <div>
                    <Label htmlFor="maxLoanAmount">Max Loan Amount (ETB)</Label>
                    <Input id="maxLoanAmount" name="maxLoanAmount" type="number" step="100" min="0" value={currentLoanType.maxLoanAmount ?? ''} onChange={handleInputChange} />
                </div>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="minRepaymentPeriod">Min Repayment Period (Months)</Label>
                    <Input id="minRepaymentPeriod" name="minRepaymentPeriod" type="number" step="1" min="1" value={currentLoanType.minRepaymentPeriod ?? ''} onChange={handleInputChange} />
                </div>
                <div>
                    <Label htmlFor="maxRepaymentPeriod">Max Repayment Period (Months)</Label>
                    <Input id="maxRepaymentPeriod" name="maxRepaymentPeriod" type="number" step="1" min="1" value={currentLoanType.maxRepaymentPeriod ?? ''} onChange={handleInputChange} />
                </div>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="interestRate">Interest Rate (Annual %) <span className="text-destructive">*</span></Label>
                    <div className="relative">
                        <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="interestRate" name="interestRate" type="number" step="0.01" min="0" value={currentLoanType.interestRate || ''} onChange={handleInputChange} required className="pr-7" placeholder="e.g., 8.5" />
                    </div>
                </div>
                <div>
                    <Label htmlFor="nplInterestRate">NPL Interest Rate (Annual %)</Label>
                     <div className="relative">
                        <AlertTriangle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive/70" />
                        <Input id="nplInterestRate" name="nplInterestRate" type="number" step="0.01" min="0" value={currentLoanType.nplInterestRate || ''} onChange={handleInputChange} className="pr-7" placeholder="e.g., 15" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor="nplGracePeriodDays">NPL Grace Period (Days)</Label>
                    <div className="relative">
                        <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="nplGracePeriodDays" name="nplGracePeriodDays" type="number" step="1" min="0" value={currentLoanType.nplGracePeriodDays || ''} onChange={handleInputChange} className="pl-8" placeholder="e.g., 30" />
                    </div>
                </div>
                <div>
                    <Label htmlFor="repaymentFrequency">Repayment Frequency <span className="text-destructive">*</span></Label>
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
            <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                    id="allowConcurrent"
                    name="allowConcurrent"
                    checked={currentLoanType.allowConcurrent || false}
                    onCheckedChange={(checked) => handleCheckboxChange('allowConcurrent', !!checked)}
                />
                <Label htmlFor="allowConcurrent" className="font-normal text-sm text-muted-foreground">
                    Allow this loan to be taken with other active loans
                </Label>
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Add Loan Type'}
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
              This action cannot be undone. This will permanently delete the loan type.
              This will fail if the loan type is currently in use by any loans.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Yes, delete loan type
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
