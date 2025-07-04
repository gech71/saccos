
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, DollarSign, Loader2 } from 'lucide-react';
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
import type { ShareType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getShareTypes, addShareType, updateShareType, deleteShareType } from './actions';
import { useAuth } from '@/contexts/auth-context';

const initialShareTypeFormState: Partial<Omit<ShareType, 'id'>> = {
  name: '',
  description: '',
  valuePerShare: 0,
  expectedMonthlyContribution: 0,
};

export default function ShareTypesPage() {
  const [shareTypesList, setShareTypesList] = useState<ShareType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [shareTypeToDelete, setShareTypeToDelete] = useState<string | null>(null);
  
  const [currentShareType, setCurrentShareType] = useState<Partial<ShareType>>(initialShareTypeFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  const canCreate = useMemo(() => user?.permissions.includes('configuration:create'), [user]);
  const canEdit = useMemo(() => user?.permissions.includes('configuration:edit'), [user]);
  const canDelete = useMemo(() => user?.permissions.includes('configuration:delete'), [user]);

  const fetchShareTypes = async () => {
      setIsLoading(true);
      try {
          const data = await getShareTypes();
          setShareTypesList(data);
      } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to load share types.' });
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    fetchShareTypes();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentShareType(prev => ({ 
        ...prev, 
        [name]: (name === 'valuePerShare' || name === 'expectedMonthlyContribution') ? parseFloat(value) : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShareType.name || currentShareType.valuePerShare === undefined || currentShareType.valuePerShare <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Share type name and a valid positive value per share are required.' });
      return;
    }
    if (currentShareType.expectedMonthlyContribution !== undefined && currentShareType.expectedMonthlyContribution < 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Expected monthly contribution cannot be negative.' });
        return;
    }
    
    setIsSubmitting(true);
    const dataToSave = {
        name: currentShareType.name!,
        valuePerShare: currentShareType.valuePerShare!,
        description: currentShareType.description,
        expectedMonthlyContribution: currentShareType.expectedMonthlyContribution,
    };

    try {
        if (isEditing && currentShareType.id) {
            await updateShareType(currentShareType.id, dataToSave);
            toast({ title: 'Success', description: 'Share type updated successfully.' });
        } else {
            await addShareType(dataToSave as Omit<ShareType, 'id'>);
            toast({ title: 'Success', description: 'Share type added successfully.' });
        }
        await fetchShareTypes();
        setIsModalOpen(false);
    } catch(error) {
        toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setCurrentShareType(initialShareTypeFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (shareType: ShareType) => {
    setCurrentShareType({...shareType, expectedMonthlyContribution: shareType.expectedMonthlyContribution || 0});
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!shareTypeToDelete) return;
    const result = await deleteShareType(shareTypeToDelete);
    if (result.success) {
        toast({ title: 'Success', description: result.message });
        await fetchShareTypes();
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setShareTypeToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const openDeleteDialog = (shareTypeId: string) => {
    setShareTypeToDelete(shareTypeId);
    setIsDeleteDialogOpen(true);
  };

  const filteredShareTypes = useMemo(() => {
    return shareTypesList.filter(st =>
      st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (st.description && st.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [shareTypesList, searchTerm]);

  return (
    <div className="space-y-6">
      <PageTitle title="Manage Share Types" subtitle="Define the types of shares available in your association.">
        {canCreate && (
          <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
            <PlusCircle className="mr-2 h-5 w-5" /> Add Share Type
          </Button>
        )}
      </PageTitle>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search share types by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full"
          aria-label="Search share types"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Value per Share ($)</TableHead>
              <TableHead className="text-right">Exp. Monthly Contrib. ($)</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin" /></TableCell></TableRow>
            ) : filteredShareTypes.length > 0 ? filteredShareTypes.map(shareType => (
              <TableRow key={shareType.id}>
                <TableCell className="font-medium">{shareType.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{shareType.description || 'N/A'}</TableCell>
                <TableCell className="text-right font-semibold">${shareType.valuePerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right font-semibold">${(shareType.expectedMonthlyContribution || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit && <DropdownMenuItem onClick={() => openEditModal(shareType)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>}
                      {canDelete && <DropdownMenuItem onClick={() => openDeleteDialog(shareType.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No share types found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!isSubmitting) setIsModalOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Share Type' : 'Add New Share Type'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the details for this share type.' : 'Enter the details for the new share type.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Share Type Name</Label>
              <Input id="name" name="name" value={currentShareType.name || ''} onChange={handleInputChange} required />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" name="description" value={currentShareType.description || ''} onChange={handleInputChange} placeholder="E.g., Standard membership share, Educational fund share" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="valuePerShare">Value per Share ($)</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="valuePerShare" 
                            name="valuePerShare" 
                            type="number" 
                            step="0.01" 
                            min="0.01"
                            value={currentShareType.valuePerShare || ''} 
                            onChange={handleInputChange} 
                            required 
                            className="pl-7"
                            placeholder="0.00"
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
                            value={currentShareType.expectedMonthlyContribution || ''} 
                            onChange={handleInputChange}
                            className="pl-7"
                            placeholder="0.00 (Optional)"
                        />
                    </div>
                </div>
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Add Share Type'}
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
              This action cannot be undone. This will permanently delete the share type.
              This will fail if the share type is already in use.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Yes, delete share type
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
