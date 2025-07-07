
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, DollarSign, CalendarDays, Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ServiceChargeType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { getServiceChargeTypes, addServiceChargeType, updateServiceChargeType, deleteServiceChargeType } from './actions';
import { useAuth } from '@/contexts/auth-context';

const initialFormState: Partial<Omit<ServiceChargeType, 'id'>> = {
  name: '',
  description: '',
  amount: undefined,
  frequency: 'once',
};

export default function ServiceChargeTypesPage() {
  const [serviceChargeTypes, setServiceChargeTypes] = useState<ServiceChargeType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [chargeTypeToDelete, setChargeTypeToDelete] = useState<string | null>(null);

  const [currentChargeType, setCurrentChargeType] = useState<Partial<ServiceChargeType>>(initialFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  const canCreate = useMemo(() => user?.permissions.includes('configuration:create'), [user]);
  const canEdit = useMemo(() => user?.permissions.includes('configuration:edit'), [user]);
  const canDelete = useMemo(() => user?.permissions.includes('configuration:delete'), [user]);

  const fetchChargeTypes = async () => {
      setIsLoading(true);
      try {
          const data = await getServiceChargeTypes();
          setServiceChargeTypes(data);
      } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to load service charge types.' });
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    if (user) {
      fetchChargeTypes();
    }
  }, [user, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentChargeType(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) : value
    }));
  };

  const handleSelectChange = (name: keyof ServiceChargeType, value: string) => {
    setCurrentChargeType(prev => ({ ...prev, [name]: value as ServiceChargeType['frequency'] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentChargeType.name || currentChargeType.amount === undefined || currentChargeType.amount <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Charge type name and a valid positive amount are required.' });
      return;
    }
    if (!currentChargeType.frequency) {
      toast({ variant: 'destructive', title: 'Error', description: 'Frequency is required.' });
      return;
    }
    
    setIsSubmitting(true);
    const dataToSave = {
        name: currentChargeType.name!,
        amount: currentChargeType.amount!,
        frequency: currentChargeType.frequency!,
        description: currentChargeType.description,
    };

    try {
        if (isEditing && currentChargeType.id) {
            await updateServiceChargeType(currentChargeType.id, dataToSave);
            toast({ title: 'Success', description: 'Service charge type updated successfully.' });
        } else {
            await addServiceChargeType(dataToSave as Omit<ServiceChargeType, 'id'>);
            toast({ title: 'Success', description: 'Service charge type added successfully.' });
        }
        await fetchChargeTypes();
        setIsModalOpen(false);
    } catch(error) {
        toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setCurrentChargeType(initialFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (chargeType: ServiceChargeType) => {
    setCurrentChargeType(chargeType);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!chargeTypeToDelete) return;
    const result = await deleteServiceChargeType(chargeTypeToDelete);
    if (result.success) {
        toast({ title: 'Success', description: result.message });
        await fetchChargeTypes();
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setChargeTypeToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const openDeleteDialog = (chargeTypeId: string) => {
    setChargeTypeToDelete(chargeTypeId);
    setIsDeleteDialogOpen(true);
  };

  const filteredChargeTypes = useMemo(() => {
    return serviceChargeTypes.filter(sct =>
      sct.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sct.description && sct.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [serviceChargeTypes, searchTerm]);

  const getFrequencyLabel = (frequency: ServiceChargeType['frequency']) => {
    switch (frequency) {
      case 'once': return 'Once';
      case 'monthly': return 'Monthly';
      case 'yearly': return 'Yearly';
      default: return frequency;
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Manage Service Charge Types" subtitle="Define various service charges applicable to members.">
        {canCreate && (
          <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
            <PlusCircle className="mr-2 h-5 w-5" /> Add Charge Type
          </Button>
        )}
      </PageTitle>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search charge types by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full"
          aria-label="Search service charge types"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount ($)</TableHead>
              <TableHead className="text-center">Frequency</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin" /></TableCell></TableRow>
            ) : filteredChargeTypes.length > 0 ? filteredChargeTypes.map(chargeType => (
              <TableRow key={chargeType.id}>
                <TableCell className="font-medium">{chargeType.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{chargeType.description || 'N/A'}</TableCell>
                <TableCell className="text-right font-semibold">${chargeType.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={chargeType.frequency === 'once' ? 'secondary' : chargeType.frequency === 'monthly' ? 'outline' : 'default'}>
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                    {getFrequencyLabel(chargeType.frequency)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit && <DropdownMenuItem onClick={() => openEditModal(chargeType)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>}
                      {canDelete && <DropdownMenuItem onClick={() => openDeleteDialog(chargeType.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No service charge types found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!isSubmitting) setIsModalOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Service Charge Type' : 'Add New Service Charge Type'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the details for this service charge type.' : 'Enter the details for the new service charge type.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Charge Type Name <span className="text-destructive">*</span></Label>
              <Input id="name" name="name" value={currentChargeType.name || ''} onChange={handleInputChange} required />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="amount">Amount ($) <span className="text-destructive">*</span></Label>
                    <div className="relative">
                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="amount" 
                            name="amount" 
                            type="number" 
                            step="0.01" 
                            min="0.01"
                            value={currentChargeType.amount ?? ''} 
                            onChange={handleInputChange} 
                            required 
                            className="pl-7"
                            placeholder="0.00"
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor="frequency">Frequency <span className="text-destructive">*</span></Label>
                     <Select name="frequency" value={currentChargeType.frequency || 'once'} onValueChange={(value) => handleSelectChange('frequency', value)} required>
                        <SelectTrigger id="frequency"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="once">Once</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" name="description" value={currentChargeType.description || ''} onChange={handleInputChange} placeholder="E.g., Annual fee, Late payment fine" />
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Add Charge Type'}
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
              This action cannot be undone. This will permanently delete the service charge type.
              This will fail if the charge type has already been applied to any member.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Yes, delete charge type
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
