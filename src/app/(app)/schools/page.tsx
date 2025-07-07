
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, School as SchoolIcon, Users, FileDown, Loader2 } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import type { School } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle as ShadcnCardTitle } from '@/components/ui/card';
import { exportToExcel } from '@/lib/utils';
import { getSchoolsWithMemberCount, addSchool, updateSchool, deleteSchool, type SchoolWithMemberCount } from './actions';
import { useAuth } from '@/contexts/auth-context';


const initialSchoolFormState: Partial<School> = {
  name: '',
  address: '',
  contactPerson: '',
};

export default function SchoolsPage() {
  const [schools, setSchools] = useState<SchoolWithMemberCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState<string | null>(null);

  const [currentSchool, setCurrentSchool] = useState<Partial<School>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  
  const canCreate = useMemo(() => user?.permissions.includes('school:create'), [user]);
  const canEdit = useMemo(() => user?.permissions.includes('school:edit'), [user]);
  const canDelete = useMemo(() => user?.permissions.includes('school:delete'), [user]);

  const fetchSchools = async () => {
    setIsLoading(true);
    const fetchedSchools = await getSchoolsWithMemberCount();
    setSchools(fetchedSchools);
    setIsLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchSchools();
    }
  }, [user]);
  
  useEffect(() => {
    setCurrentSchool(initialSchoolFormState);
  }, [isModalOpen])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentSchool(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSchool.name) {
        toast({ variant: 'destructive', title: 'Error', description: 'School name is required.' });
        return;
    }
    
    setIsSubmitting(true);
    try {
      if (isEditing && currentSchool.id) {
        await updateSchool(currentSchool.id, {
          name: currentSchool.name,
          address: currentSchool.address,
          contactPerson: currentSchool.contactPerson,
        });
        toast({ title: 'Success', description: 'School updated successfully.' });
      } else {
        await addSchool({
          name: currentSchool.name,
          address: currentSchool.address,
          contactPerson: currentSchool.contactPerson,
        } as School);
        toast({ title: 'Success', description: 'School added successfully.' });
      }
      await fetchSchools(); // Refresh data
      setIsModalOpen(false);
      setCurrentSchool(initialSchoolFormState);
      setIsEditing(false);
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setCurrentSchool(initialSchoolFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (school: School) => {
    setCurrentSchool(school);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!schoolToDelete) return;
    const result = await deleteSchool(schoolToDelete);
    if (result.success) {
      toast({ title: 'Success', description: result.message });
      await fetchSchools(); // Refresh data
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setSchoolToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const openDeleteDialog = (schoolId: string) => {
    setSchoolToDelete(schoolId);
    setIsDeleteDialogOpen(true);
  };

  const filteredSchools = useMemo(() => {
    return schools.filter(school => 
      school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (school.address && school.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (school.contactPerson && school.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [schools, searchTerm]);
  
  const totalMembersAcrossSchools = useMemo(() => {
    return schools.reduce((total, school) => total + school._count.members, 0);
  }, [schools]);

  const handleExport = () => {
    const dataToExport = filteredSchools.map(s => ({
        'School Name': s.name,
        'Address': s.address || 'N/A',
        'Contact Person': s.contactPerson || 'N/A',
        'Member Count': s._count.members,
    }));
    exportToExcel(dataToExport, 'schools_export');
  };

  return (
    <div className="space-y-6">
      <PageTitle title="School Management" subtitle="Manage participating schools in the association.">
        <Button onClick={handleExport} variant="outline" disabled={isLoading || schools.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Export
        </Button>
        {canCreate && (
          <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
            <PlusCircle className="mr-2 h-5 w-5" /> Add School
          </Button>
        )}
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Schools</ShadcnCardTitle>
                <SchoolIcon className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">{schools.length}</div>
            </CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Members (Across All Schools)</ShadcnCardTitle>
                <Users className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">{totalMembersAcrossSchools}</div>
            </CardContent>
        </Card>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search schools by name, address, or contact..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full"
          aria-label="Search schools"
        />
      </div>
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox aria-label="Select all schools" />
              </TableHead>
              <TableHead>School Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead className="text-center">Members</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
               <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredSchools.length > 0 ? filteredSchools.map(school => (
              <TableRow key={school.id}>
                <TableCell>
                  <Checkbox aria-label={`Select school ${school.name}`} />
                </TableCell>
                <TableCell className="font-medium">{school.name}</TableCell>
                <TableCell>{school.address || 'N/A'}</TableCell>
                <TableCell>{school.contactPerson || 'N/A'}</TableCell>
                <TableCell className="text-center">{school._count.members}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit && <DropdownMenuItem onClick={() => openEditModal(school)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>}
                      {canDelete && <DropdownMenuItem onClick={() => openDeleteDialog(school.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No schools found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
       {filteredSchools.length > 10 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline">Load More</Button>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit School' : 'Add New School'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the details for this school.' : 'Enter the details for the new school.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">School Name <span className="text-destructive">*</span></Label>
              <Input id="name" name="name" value={currentSchool.name || ''} onChange={handleInputChange} required />
            </div>
            <div>
              <Label htmlFor="address">Address (Optional)</Label>
              <Input id="address" name="address" value={currentSchool.address || ''} onChange={handleInputChange} />
            </div>
            <div>
              <Label htmlFor="contactPerson">Contact Person (Optional)</Label>
              <Input id="contactPerson" name="contactPerson" value={currentSchool.contactPerson || ''} onChange={handleInputChange} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Add School'}
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
              This action cannot be undone. This will permanently delete the school.
              This will fail if the school has any members assigned to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Yes, delete school
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
