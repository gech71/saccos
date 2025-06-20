
'use client';

import React, { useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, DollarSign, CalendarDays } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockServiceChargeTypes } from '@/data/mock';
import type { ServiceChargeType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const initialFormState: Partial<Omit<ServiceChargeType, 'id'>> = {
  name: '',
  description: '',
  amount: 0,
  frequency: 'once',
};

export default function ServiceChargeTypesPage() {
  const [serviceChargeTypes, setServiceChargeTypes] = useState<ServiceChargeType[]>(mockServiceChargeTypes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentChargeType, setCurrentChargeType] = useState<Partial<ServiceChargeType>>(initialFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentChargeType.name || currentChargeType.amount === undefined || currentChargeType.amount <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Charge type name and a valid positive amount are required.' });
      return;
    }
    if (!currentChargeType.frequency) {
      toast({ variant: 'destructive', title: 'Error', description: 'Frequency is required.' });
      return;
    }

    if (isEditing && currentChargeType.id) {
      setServiceChargeTypes(prev => prev.map(sct => sct.id === currentChargeType.id ? { ...sct, ...currentChargeType } as ServiceChargeType : sct));
      toast({ title: 'Success', description: 'Service charge type updated successfully.' });
    } else {
      const newChargeType: ServiceChargeType = {
        id: `sctype-${Date.now()}`,
        name: currentChargeType.name || '',
        amount: currentChargeType.amount || 0,
        frequency: currentChargeType.frequency || 'once',
        description: currentChargeType.description,
      };
      setServiceChargeTypes(prev => [newChargeType, ...prev]);
      toast({ title: 'Success', description: 'Service charge type added successfully.' });
    }
    setIsModalOpen(false);
    setCurrentChargeType(initialFormState);
    setIsEditing(false);
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

  const handleDelete = (chargeTypeId: string) => {
    // TODO: Add check if charge type is in use by applied charges
    if (window.confirm('Are you sure you want to delete this service charge type? This action cannot be undone.')) {
      setServiceChargeTypes(prev => prev.filter(sct => sct.id !== chargeTypeId));
      toast({ title: 'Success', description: 'Service charge type deleted successfully.' });
    }
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
        <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
          <PlusCircle className="mr-2 h-5 w-5" /> Add Charge Type
        </Button>
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
              <TableHead className="w-[50px]">
                <Checkbox aria-label="Select all service charge types" />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount ($)</TableHead>
              <TableHead className="text-center">Frequency</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredChargeTypes.length > 0 ? filteredChargeTypes.map(chargeType => (
              <TableRow key={chargeType.id}>
                <TableCell>
                  <Checkbox aria-label={`Select charge type ${chargeType.name}`} />
                </TableCell>
                <TableCell className="font-medium">{chargeType.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{chargeType.description || 'N/A'}</TableCell>
                <TableCell className="text-right font-semibold">${chargeType.amount.toFixed(2)}</TableCell>
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
                      <DropdownMenuItem onClick={() => openEditModal(chargeType)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(chargeType.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No service charge types found. Add one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {filteredChargeTypes.length > 10 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline">Load More</Button>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Service Charge Type' : 'Add New Service Charge Type'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the details for this service charge type.' : 'Enter the details for the new service charge type.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Charge Type Name</Label>
              <Input id="name" name="name" value={currentChargeType.name || ''} onChange={handleInputChange} required />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="amount">Amount ($)</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="amount" 
                            name="amount" 
                            type="number" 
                            step="0.01" 
                            min="0.01"
                            value={currentChargeType.amount || ''} 
                            onChange={handleInputChange} 
                            required 
                            className="pl-7"
                            placeholder="0.00"
                        />
                    </div>
                </div>
                <div>
                    <Label htmlFor="frequency">Frequency</Label>
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
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add Charge Type'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
