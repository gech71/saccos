

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, School as SchoolIcon, Users, FileDown, Loader2, UploadCloud } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle as ShadcnCardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { exportToExcel } from '@/lib/utils';
import { getSchoolsWithMemberCount, addSchool, updateSchool, deleteSchool, importSchools, type SchoolWithMemberCount } from './actions';
import { useAuth } from '@/contexts/auth-context';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import type { School } from '@prisma/client';


const initialSchoolFormState: Partial<School> = {
  id: '',
  name: '',
  address: '',
  contactPerson: '',
};

type ParsedSchool = {
  id: string;
  name: string;
  address?: string;
  contactPerson?: string;
  status: 'Ready to import' | 'Duplicate in file' | 'Already exists in DB' | 'Invalid ID or Name';
};

export default function SchoolsPage() {
  const [schools, setSchools] = useState<SchoolWithMemberCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState<string | null>(null);

  const [currentSchool, setCurrentSchool] = useState<Partial<School>>(initialSchoolFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [parsedSchools, setParsedSchools] = useState<ParsedSchool[]>([]);
  const [isParsing, setIsParsing] = useState(false);

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
    if (!currentSchool.id || !currentSchool.name) {
        toast({ variant: 'destructive', title: 'Error', description: 'School ID and Name are required.' });
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
          id: currentSchool.id,
          name: currentSchool.name,
          address: currentSchool.address,
          contactPerson: currentSchool.contactPerson,
        });
        toast({ title: 'Success', description: 'School added successfully.' });
      }
      await fetchSchools(); // Refresh data
      setIsModalOpen(false);
      setCurrentSchool(initialSchoolFormState);
      setIsEditing(false);
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred. The School ID might already exist.' });
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
  
  const paginatedSchools = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredSchools.slice(startIndex, endIndex);
  }, [filteredSchools, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredSchools.length / rowsPerPage);
  }, [filteredSchools.length, rowsPerPage]);

  const getPaginationItems = () => {
    if (totalPages <= 1) return [];
    const delta = 1;
    const left = currentPage - delta;
    const right = currentPage + delta + 1;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= left && i < right)) {
            range.push(i);
        }
    }

    let l: number | undefined;
    for (const i of range) {
        if (l) {
            if (i - l === 2) {
                rangeWithDots.push(l + 1);
            } else if (i - l !== 1) {
                rangeWithDots.push('...');
            }
        }
        rangeWithDots.push(i);
        l = i;
    }

    return rangeWithDots;
  };
  
  const paginationItems = getPaginationItems();

  const openImportModal = () => {
    setParsedSchools([]);
    setIsImportModalOpen(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsParsing(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const dataRows = XLSX.utils.sheet_to_json<any>(worksheet);

          const existingSchoolIds = new Set(schools.map(s => s.id));
          const seenInFile = new Set<string>();

          const validatedData: ParsedSchool[] = dataRows.map(row => {
            const id = row['School ID']?.toString().trim();
            const name = row['School Name']?.toString().trim();
            const address = row['Address']?.toString().trim();
            const contactPerson = row['Contact Person']?.toString().trim();

            if (!id || !name) {
              return { id, name, status: 'Invalid ID or Name' };
            }

            let status: ParsedSchool['status'] = 'Ready to import';
            if (existingSchoolIds.has(id)) {
              status = 'Already exists in DB';
            } else if (seenInFile.has(id)) {
              status = 'Duplicate in file';
            }
            seenInFile.add(id);

            return { id, name, address, contactPerson, status };
          });
          
          setParsedSchools(validatedData);

        } catch (error) {
          toast({ variant: 'destructive', title: 'Parsing Error', description: 'Could not process file. Ensure it has columns: "School ID" and "School Name".' });
        } finally {
          setIsParsing(false);
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleConfirmImport = async () => {
    const schoolsToImport = parsedSchools
      .filter(s => s.status === 'Ready to import')
      .map(s => ({ id: s.id, name: s.name, address: s.address, contactPerson: s.contactPerson }));
      
    if (schoolsToImport.length === 0) {
      toast({ title: 'No New Schools', description: 'There are no new schools to import.' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const result = await importSchools(schoolsToImport);
      if (result.success) {
        toast({ title: 'Import Complete', description: result.message });
        await fetchSchools();
        setIsImportModalOpen(false);
      } else {
        toast({ variant: 'destructive', title: 'Import Failed', description: result.message });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred during import.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getValidationBadge = (status: ParsedSchool['status']) => {
    switch (status) {
      case 'Ready to import': return <Badge variant="default">Ready</Badge>;
      case 'Already exists in DB': return <Badge variant="secondary">Exists</Badge>;
      case 'Duplicate in file': return <Badge variant="secondary">Duplicate</Badge>;
      case 'Invalid ID or Name': return <Badge variant="destructive">Invalid</Badge>;
    }
  };


  return (
    <div className="space-y-6">
      <PageTitle title="School Management" subtitle="Manage participating schools in the association.">
        <Button onClick={handleExport} variant="outline" disabled={isLoading || schools.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Export
        </Button>
         {canCreate && (
          <Button onClick={openImportModal} variant="outline" disabled={isLoading}>
              <UploadCloud className="mr-2 h-4 w-4" /> Import Schools
          </Button>
        )}
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
              <TableHead>School ID</TableHead>
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
            ) : paginatedSchools.length > 0 ? paginatedSchools.map(school => (
              <TableRow key={school.id}>
                <TableCell className="font-mono text-xs">{school.id}</TableCell>
                <TableCell className="font-medium">{school.name}</TableCell>
                <TableCell>{school.address || 'N/A'}</TableCell>
                <TableCell>{school.contactPerson || 'N/A'}</TableCell>
                <TableCell className="text-center">{school._count.members}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
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

      {filteredSchools.length > 0 && (
        <div className="flex flex-col items-center gap-4 pt-4">
            <div className="flex items-center space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    Previous
                </Button>
                <div className="flex items-center gap-1">
                    {paginationItems.map((item, index) =>
                        typeof item === 'number' ? (
                            <Button
                                key={index}
                                variant={currentPage === item ? 'default' : 'outline'}
                                size="sm"
                                className="h-9 w-9 p-0"
                                onClick={() => setCurrentPage(item)}
                            >
                                {item}
                            </Button>
                        ) : (
                            <span key={index} className="px-2">
                                {item}
                            </span>
                        )
                    )}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                >
                    Next
                </Button>
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8 text-sm text-muted-foreground">
                <div>Page {currentPage} of {totalPages || 1}</div>
                <div>{filteredSchools.length} school(s) found.</div>
                <div className="flex items-center space-x-2">
                    <p className="font-medium">Rows:</p>
                    <Select
                        value={`${rowsPerPage}`}
                        onValueChange={(value) => {
                            setRowsPerPage(Number(value));
                            setCurrentPage(1);
                        }}
                    >
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={`${rowsPerPage}`} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[10, 15, 20, 25, 50].map((pageSize) => (
                                <SelectItem key={pageSize} value={`${pageSize}`}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
      )}

      {/* Import Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-headline">Import Schools from Excel</DialogTitle>
            <DialogDescription>
              Upload an Excel file with columns: "School ID" and "School Name". The ID must be unique.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="importFile">Upload File <span className="text-destructive">*</span></Label>
              <Input id="importFile" type="file" onChange={handleFileChange} accept=".xlsx, .xls" />
            </div>
            {isParsing && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span>Parsing file...</span></div>}
            {parsedSchools.length > 0 && (
              <div>
                <Label>Import Preview</Label>
                <div className="mt-2 h-64 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                      <TableRow>
                        <TableHead>School ID</TableHead>
                        <TableHead>School Name</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedSchools.map((school, index) => (
                        <TableRow key={index} className={school.status !== 'Ready to import' ? 'bg-destructive/10' : ''}>
                          <TableCell>{school.id}</TableCell>
                          <TableCell>{school.name}</TableCell>
                          <TableCell>{getValidationBadge(school.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {parsedSchools.filter(s => s.status === 'Ready to import').length} school(s) will be imported. Others will be skipped.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
            <Button onClick={handleConfirmImport} disabled={isSubmitting || isParsing || parsedSchools.filter(s => s.status === 'Ready to import').length === 0}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import Schools
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Label htmlFor="id">School ID <span className="text-destructive">*</span></Label>
              <Input id="id" name="id" value={currentSchool.id || ''} onChange={handleInputChange} required disabled={isEditing} />
            </div>
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
