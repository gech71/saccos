
'use client';

import React, { useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, DollarSign } from 'lucide-react';
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
import { mockShareTypes } from '@/data/mock'; // Ensure mockShareTypes is exported from mock.ts
import type { ShareType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const initialShareTypeFormState: Omit<ShareType, 'id'> = {
  name: '',
  description: '',
  valuePerShare: 0,
};

export default function ShareTypesPage() {
  const [shareTypesList, setShareTypesList] = useState<ShareType[]>(mockShareTypes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentShareType, setCurrentShareType] = useState<Partial<ShareType>>(initialShareTypeFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentShareType(prev => ({ ...prev, [name]: name === 'valuePerShare' ? parseFloat(value) : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShareType.name || !currentShareType.valuePerShare || currentShareType.valuePerShare <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Share type name and a valid positive value per share are required.' });
      return;
    }

    if (isEditing && currentShareType.id) {
      setShareTypesList(prev => prev.map(st => st.id === currentShareType.id ? { ...st, ...currentShareType } as ShareType : st));
      toast({ title: 'Success', description: 'Share type updated successfully.' });
    } else {
      const newShareType: ShareType = {
        id: `stype-${Date.now()}`,
        ...initialShareTypeFormState,
        ...currentShareType,
      } as ShareType;
      setShareTypesList(prev => [newShareType, ...prev]);
      toast({ title: 'Success', description: 'Share type added successfully.' });
    }
    setIsModalOpen(false);
    setCurrentShareType(initialShareTypeFormState);
    setIsEditing(false);
  };

  const openAddModal = () => {
    setCurrentShareType(initialShareTypeFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (shareType: ShareType) => {
    setCurrentShareType(shareType);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = (shareTypeId: string) => {
    // TODO: Add check if share type is in use by members or allocated shares
    if (window.confirm('Are you sure you want to delete this share type? This action cannot be undone.')) {
      setShareTypesList(prev => prev.filter(st => st.id !== shareTypeId));
      toast({ title: 'Success', description: 'Share type deleted successfully.' });
    }
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
        <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
          <PlusCircle className="mr-2 h-5 w-5" /> Add Share Type
        </Button>
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
              <TableHead className="w-[50px]">
                <Checkbox aria-label="Select all share types" />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Value per Share</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredShareTypes.length > 0 ? filteredShareTypes.map(shareType => (
              <TableRow key={shareType.id}>
                <TableCell>
                  <Checkbox aria-label={`Select share type ${shareType.name}`} />
                </TableCell>
                <TableCell className="font-medium">{shareType.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{shareType.description || 'N/A'}</TableCell>
                <TableCell className="text-right font-semibold">${shareType.valuePerShare.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(shareType)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(shareType.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
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
      {filteredShareTypes.length > 10 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline">Load More</Button>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
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
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add Share Type'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
