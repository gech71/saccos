'use client';

import React, { useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, School as SchoolIcon } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { mockSchools, mockMembers } from '@/data/mock';
import type { School, Member } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader } from '@/components/ui/card'; // Renamed to avoid conflict with potential local CardTitle

const initialSchoolFormState: Partial<School> = {
  name: '',
  address: '',
  contactPerson: '',
};

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>(mockSchools);
  const [members] = useState<Member[]>(mockMembers); // For member count
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSchool, setCurrentSchool] = useState<Partial<School>>(initialSchoolFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentSchool(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSchool.name) {
        toast({ variant: 'destructive', title: 'Error', description: 'School name is required.' });
        return;
    }

    if (isEditing && currentSchool.id) {
      setSchools(prev => prev.map(s => s.id === currentSchool.id ? { ...s, ...currentSchool } as School : s));
      toast({ title: 'Success', description: 'School updated successfully.' });
    } else {
      const newSchool: School = {
        id: `school-${Date.now()}`,
        ...currentSchool,
      } as School;
      setSchools(prev => [newSchool, ...prev]);
      toast({ title: 'Success', description: 'School added successfully.' });
    }
    setIsModalOpen(false);
    setCurrentSchool(initialSchoolFormState);
    setIsEditing(false);
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

  const handleDelete = (schoolId: string) => {
    if (members.some(m => m.schoolId === schoolId)) {
        toast({ variant: 'destructive', title: 'Error', description: 'Cannot delete school with active members. Please reassign or remove members first.' });
        return;
    }
    if (window.confirm('Are you sure you want to delete this school?')) {
      setSchools(prev => prev.filter(s => s.id !== schoolId));
      toast({ title: 'Success', description: 'School deleted successfully.' });
    }
  };

  const filteredSchools = useMemo(() => {
    return schools.filter(school => 
      school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (school.address && school.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (school.contactPerson && school.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [schools, searchTerm]);

  const getMemberCount = (schoolId: string) => {
    return members.filter(m => m.schoolId === schoolId).length;
  };
  
  const totalSchools = filteredSchools.length;
  const totalMembersAcrossSchools = useMemo(() => {
    const schoolIds = new Set(filteredSchools.map(s => s.id));
    return members.filter(m => schoolIds.has(m.schoolId)).length;
  }, [filteredSchools, members]);


  return (
    <div className="space-y-6">
      <PageTitle title="School Management" subtitle="Manage participating schools in the association.">
        <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
          <PlusCircle className="mr-2 h-5 w-5" /> Add School
        </Button>
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="text-sm font-medium text-muted-foreground">Total Schools</div>
                <SchoolIcon className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">{totalSchools}</div>
            </CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="text-sm font-medium text-muted-foreground">Total Members (Across Listed Schools)</div>
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
            {filteredSchools.length > 0 ? filteredSchools.map(school => (
              <TableRow key={school.id}>
                <TableCell>
                  <Checkbox aria-label={`Select school ${school.name}`} />
                </TableCell>
                <TableCell className="font-medium">{school.name}</TableCell>
                <TableCell>{school.address || 'N/A'}</TableCell>
                <TableCell>{school.contactPerson || 'N/A'}</TableCell>
                <TableCell className="text-center">{getMemberCount(school.id)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(school)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(school.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
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
              <Label htmlFor="name">School Name</Label>
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
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add School'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
