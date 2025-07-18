

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter, MinusCircle, DollarSign, Hash, PieChart as LucidePieChart, FileText, FileDown, Loader2, UploadCloud, UserRound } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { Member, MemberShareCommitment, ShareType, SavingAccountType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { exportToExcel } from '@/lib/utils';
import { getMembersPageData, addMember, updateMember, deleteMember, importMembers, type MemberWithDetails, type MemberInput, type MembersPageData } from './actions';
import { useAuth } from '@/contexts/auth-context';
import * as XLSX from 'xlsx';
import Link from 'next/link';

const subcities = [
  "Arada", "Akaky Kaliti", "Bole", "Gullele", "Kirkos", "Kolfe Keranio", "Lideta", "Nifas Silk", "Yeka", "Lemi Kura", "Addis Ketema"
].sort();

const initialMemberFormState: Partial<MemberWithDetails> = {
  id: '',
  fullName: '',
  email: '',
  sex: 'Male',
  phoneNumber: '',
  address: { id: '', city: '', subCity: '', wereda: '', kebele: '', houseNumber: '', memberId: null, collateralId: null },
  emergencyContact: { id: '', name: '', phone: '', memberId: null },
  schoolId: undefined,
  joinDate: new Date().toISOString().split('T')[0],
  salary: 0,
  shareCommitments: [],
};

type ParsedMember = {
  memberId: string;
  fullName: string;
  savingsBalance: number;
  schoolId: string;
  status: 'Ready to import' | 'Duplicate in file' | 'Already exists in DB' | 'Invalid Data' | 'Invalid School ID';
  originalRow: any;
};

export default function MembersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [members, setMembers] = useState<MemberWithDetails[]>([]);
  const [schools, setSchools] = useState<MembersPageData['schools']>([]);
  const [shareTypes, setShareTypes] = useState<MembersPageData['shareTypes']>([]);
  const [savingAccountTypes, setSavingAccountTypes] = useState<MembersPageData['savingAccountTypes']>([]);
  
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);

  const [currentMember, setCurrentMember] = useState<Partial<MemberWithDetails>>(initialMemberFormState);
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [isViewingOnly, setIsViewingOnly] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSavingAccountTypeId, setImportSavingAccountTypeId] = useState<string>('');
  const [parsedMembers, setParsedMembers] = useState<ParsedMember[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  const canCreate = useMemo(() => user?.permissions.includes('member:create'), [user]);
  const canEdit = useMemo(() => user?.permissions.includes('member:edit'), [user]);
  const canDelete = useMemo(() => user?.permissions.includes('member:delete'), [user]);

  const fetchPageData = async () => {
    setIsLoading(true);
    try {
      const data = await getMembersPageData();
      setMembers(data.members);
      setSchools(data.schools);
      setShareTypes(data.shareTypes);
      setSavingAccountTypes(data.savingAccountTypes);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch member data.' });
    } finally {
        setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchPageData();
  }, [toast]);

  const handleMemberInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const nameParts = name.split('.');

    if (nameParts.length > 1) {
        const [parentKey, childKey] = nameParts as [keyof Member, string];
        setCurrentMember(prev => {
            const currentParentValue = prev[parentKey as keyof typeof prev] || {};
            return {
                ...prev,
                [parentKey]: {
                    ...(currentParentValue as object),
                    [childKey]: value
                }
            };
        });
    } else {
        const val = name === 'salary' ? parseFloat(value) : value;
        setCurrentMember(prev => ({ ...prev, [name]: val }));
    }
  };

  const handleNestedSelectChange = (name: string, value: string) => {
    const nameParts = name.split('.');
    if (nameParts.length > 1) {
        const [parentKey, childKey] = nameParts as [keyof Member, string];
        setCurrentMember(prev => {
            const currentParentValue = prev[parentKey as keyof typeof prev] || {};
            return {
                ...prev,
                [parentKey]: {
                    ...(currentParentValue as object),
                    [childKey]: value
                }
            };
        });
    }
  };

  const handleMemberSelectChange = (name: keyof Member, value: string) => {
    setCurrentMember(prev => ({ ...prev, [name]: value }));
  };

  const handleShareCommitmentChange = (index: number, field: keyof MemberShareCommitment, value: string | number) => {
    const updatedCommitments = [...(currentMember.shareCommitments || [])];
    if (field === 'shareTypeId') {
      const selectedType = shareTypes.find(st => st.id === value);
      updatedCommitments[index] = {
        ...updatedCommitments[index],
        shareTypeId: value as string,
        shareTypeName: selectedType?.name || '',
        monthlyCommittedAmount: updatedCommitments[index]?.monthlyCommittedAmount || 0,
      };
    } else if (field === 'monthlyCommittedAmount') {
        updatedCommitments[index] = { ...updatedCommitments[index], monthlyCommittedAmount: parseFloat(value as string) || 0 };
    }
    setCurrentMember(prev => ({ ...prev, shareCommitments: updatedCommitments }));
  };

  const addShareCommitment = () => {
    const newCommitment: MemberShareCommitment = { shareTypeId: '', shareTypeName: '', monthlyCommittedAmount: 0 };
    setCurrentMember(prev => ({
      ...prev,
      shareCommitments: [...(prev.shareCommitments || []), newCommitment]
    }));
  };

  const removeShareCommitment = (index: number) => {
    setCurrentMember(prev => ({
      ...prev,
      shareCommitments: (prev.shareCommitments || []).filter((_, i) => i !== index)
    }));
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewingOnly) return;
    
    if (!currentMember.id || !currentMember.fullName || !currentMember.email || !currentMember.schoolId || !currentMember.sex || !currentMember.phoneNumber) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please fill in all required fields (Member ID, Full Name, Email, Sex, Phone, School).' });
        return;
    }

    setIsSubmitting(true);
    try {
        const memberInputData: MemberInput = {
            id: currentMember.id!,
            fullName: currentMember.fullName!,
            email: currentMember.email!,
            sex: currentMember.sex!,
            phoneNumber: currentMember.phoneNumber!,
            address: currentMember.address,
            emergencyContact: currentMember.emergencyContact,
            schoolId: currentMember.schoolId!,
            joinDate: currentMember.joinDate!,
            salary: currentMember.salary,
            shareCommitments: (currentMember.shareCommitments || [])
              .filter(sc => sc.shareTypeId && sc.monthlyCommittedAmount > 0)
              .map(sc => ({ shareTypeId: sc.shareTypeId, monthlyCommittedAmount: sc.monthlyCommittedAmount})),
        };

        if (isEditingMember && currentMember.id) {
          await updateMember(currentMember.id, memberInputData);
          toast({ title: 'Success', description: 'Member updated successfully.' });
        } else {
          await addMember(memberInputData);
          toast({ title: 'Success', description: 'Member added successfully.' });
        }

        setIsMemberModalOpen(false);
        await fetchPageData(); // Refresh data from server

    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`});
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const prepMemberForModal = (member: MemberWithDetails) => {
    setCurrentMember({
      ...member,
      joinDate: member.joinDate ? new Date(member.joinDate).toISOString().split('T')[0] : '',
      shareCommitments: member.shareCommitments ? [...member.shareCommitments] : [],
    });
    setIsMemberModalOpen(true);
  };

  const openAddMemberModal = () => {
    setCurrentMember(initialMemberFormState);
    setIsEditingMember(false);
    setIsViewingOnly(false);
    setIsMemberModalOpen(true);
  };

  const openEditMemberModal = (member: MemberWithDetails) => {
    prepMemberForModal(member);
    setIsEditingMember(true);
    setIsViewingOnly(false);
  };

  const handleDeleteConfirm = async () => {
    if (!memberToDelete) return;
    const result = await deleteMember(memberToDelete);
    if (result.success) {
      toast({ title: 'Success', description: result.message });
      await fetchPageData(); // Refresh data
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setMemberToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const openDeleteDialog = (memberId: string) => {
    setMemberToDelete(memberId);
    setIsDeleteDialogOpen(true);
  };

  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      const matchesSearchTerm = member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                member.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || member.schoolId === selectedSchoolFilter;
      return matchesSearchTerm && matchesSchoolFilter;
    });
  }, [members, searchTerm, selectedSchoolFilter]);

  const handleExport = () => {
    const dataToExport = filteredMembers.map(member => ({
        'Full Name': member.fullName,
        'Email': member.email,
        'Phone': member.phoneNumber,
        'School': member.school?.name,
        'Salary': member.salary,
        'Total Savings Balance (Birr)': member.totalSavingsBalance,
        'Join Date': new Date(member.joinDate).toLocaleDateString(),
    }));
    exportToExcel(dataToExport, 'members_export');
  };
  
  const paginatedMembers = useMemo(() => {
    return filteredMembers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [filteredMembers, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredMembers.length / rowsPerPage);
  }, [filteredMembers.length, rowsPerPage]);

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
  
  // --- Import Logic ---
  const openImportModal = () => {
    setImportSavingAccountTypeId('');
    setParsedMembers([]);
    setIsImportModalOpen(true);
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!importSavingAccountTypeId) {
        toast({ variant: 'destructive', title: 'Selection Required', description: 'Please select a Saving Account Type before choosing a file.' });
        event.target.value = ''; // Reset file input
        return;
      }
      setIsParsing(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const dataRows = XLSX.utils.sheet_to_json<any>(worksheet);

          const existingMemberIds = new Set(members.map(m => m.id));
          const schoolIds = new Set(schools.map(s => s.id));
          const seenInFile = new Set<string>();

          const validatedData: ParsedMember[] = dataRows.map(row => {
            const memberId = row['MemberID']?.toString().trim();
            const fullName = row['MemberFullName']?.toString().trim();
            const savingsBalance = parseFloat(row['SavingCollected']);
            const schoolId = row['SchoolID']?.toString().trim();

            if (!memberId || !fullName || isNaN(savingsBalance) || !schoolId) {
              return { memberId, fullName, savingsBalance, schoolId, status: 'Invalid Data', originalRow: row };
            }
            
            let status: ParsedMember['status'] = 'Ready to import';
            if (existingMemberIds.has(memberId)) {
              status = 'Already exists in DB';
            } else if (seenInFile.has(memberId)) {
              status = 'Duplicate in file';
            } else if (!schoolIds.has(schoolId)) {
              status = 'Invalid School ID';
            }

            seenInFile.add(memberId);

            return { memberId, fullName, savingsBalance, schoolId, status, originalRow: row };
          }).filter((r): r is ParsedMember => r !== null);
          
          setParsedMembers(validatedData);

        } catch (error) {
          toast({ variant: 'destructive', title: 'Parsing Error', description: 'Could not process file. Ensure it has columns: "MemberID", "MemberFullName", "SavingCollected", and "SchoolID".' });
        } finally {
          setIsParsing(false);
        }
      };
      reader.readAsBinaryString(file);
    }
  };
  
  const handleConfirmImport = async () => {
    const membersToCreate = parsedMembers
      .filter(m => m.status === 'Ready to import')
      .map(m => ({
        memberId: m.memberId,
        fullName: m.fullName,
        savingsBalance: m.savingsBalance,
        schoolId: m.schoolId,
      }));
      
    if (membersToCreate.length === 0) {
      toast({ title: 'No New Members', description: 'There are no new members to import.' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const result = await importMembers({
        savingAccountTypeId: importSavingAccountTypeId,
        members: membersToCreate
      });
      
      if (result.success) {
        toast({ title: 'Import Complete', description: result.message });
        await fetchPageData();
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

  const getValidationBadge = (status: ParsedMember['status']) => {
    switch (status) {
        case 'Ready to import': return <Badge variant="default">Ready</Badge>;
        case 'Already exists in DB': return <Badge variant="secondary">Exists in DB</Badge>;
        case 'Duplicate in file': return <Badge variant="secondary">Duplicate in File</Badge>;
        case 'Invalid Data': return <Badge variant="destructive">Invalid Data</Badge>;
        case 'Invalid School ID': return <Badge variant="destructive">Invalid School ID</Badge>;
        default: return <Badge variant="destructive">Error</Badge>;
    }
};

  return (
    <div className="space-y-6">
      <PageTitle title="Member Management" subtitle="Manage all members of your association.">
        <Button onClick={handleExport} variant="outline" disabled={isLoading || members.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Export
        </Button>
        {canCreate && (
          <Button onClick={openImportModal} variant="outline" disabled={isLoading}>
              <UploadCloud className="mr-2 h-4 w-4" /> Import Members
          </Button>
        )}
        {canCreate && (
          <Button onClick={openAddMemberModal} className="shadow-md hover:shadow-lg transition-shadow">
              <PlusCircle className="mr-2 h-5 w-5" /> Add Member
          </Button>
        )}
      </PageTitle>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search members by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
            aria-label="Search members"
          />
        </div>
        <Select value={selectedSchoolFilter} onValueChange={setSelectedSchoolFilter} disabled={isLoading}>
          <SelectTrigger className="w-full sm:w-[200px]" aria-label="Filter by school">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Filter by school" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {schools.map(school => (
              <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member ID</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>School</TableHead>
              <TableHead className="text-right">Total Savings</TableHead>
              <TableHead>Savings Accounts</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : paginatedMembers.length > 0 ? paginatedMembers.map(member => (
              <TableRow key={member.id}>
                <TableCell className="font-mono text-xs">{member.id}</TableCell>
                <TableCell className="font-medium">{member.fullName}</TableCell>
                <TableCell>
                    <div className="text-sm">{member.email}</div>
                    <div className="text-xs text-muted-foreground">{member.phoneNumber}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{member.school?.name}</Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">{member.totalSavingsBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                <TableCell>
                  {member.memberSavingAccounts.length > 0 ? (
                    <ul className="text-xs text-muted-foreground">
                      {member.memberSavingAccounts.map((account) => (
                        <li key={account.id}>
                          <span>{account.savingAccountType.name}: </span>
                          <span className="font-semibold text-foreground">{account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-muted-foreground">No savings accounts</div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                       <DropdownMenuItem asChild>
                        <Link href={`/members/${member.id}`}>
                            <UserRound className="mr-2 h-4 w-4" /> View Profile
                        </Link>
                      </DropdownMenuItem>
                      {canEdit && <DropdownMenuItem onClick={() => openEditMemberModal(member)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit Member
                      </DropdownMenuItem>}
                      <Separator />
                      {canDelete && <DropdownMenuItem onClick={() => openDeleteDialog(member.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Member
                      </DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No members found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

       {filteredMembers.length > 0 && (
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
                    <div>{filteredMembers.length} member(s) found.</div>
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

      {/* Member Add/Edit/View Modal */}
      <Dialog open={isMemberModalOpen} onOpenChange={(isOpen) => {
        if (!isOpen) {
            setIsViewingOnly(false);
            setCurrentMember(initialMemberFormState);
        }
        setIsMemberModalOpen(isOpen);
      }}>
        <DialogContent className="sm:max-w-3xl"> 
          <DialogHeader>
            <DialogTitle className="font-headline">
                {isViewingOnly ? 'Member Details' : isEditingMember ? 'Edit Member' : 'Add New Member'}
            </DialogTitle>
            <DialogDescription>
              {isViewingOnly ? 'Viewing member information. All fields are read-only.' : isEditingMember ? 'Update the details for this member.' : 'Enter the details for the new member.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMemberSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="id">Member ID <span className="text-destructive">*</span></Label>
                  <Input id="id" name="id" value={currentMember.id || ''} onChange={handleMemberInputChange} required readOnly={isEditingMember || isViewingOnly} />
                </div>
                <div>
                  <Label htmlFor="fullName">Full Name <span className="text-destructive">*</span></Label>
                  <Input id="fullName" name="fullName" value={currentMember.fullName || ''} onChange={handleMemberInputChange} required readOnly={isViewingOnly} />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                <Input id="email" name="email" type="email" value={currentMember.email || ''} onChange={handleMemberInputChange} required readOnly={isViewingOnly} />
              </div>
               <div>
                <Label htmlFor="sex">Sex <span className="text-destructive">*</span></Label>
                <Select name="sex" value={currentMember.sex || 'Male'} onValueChange={(value) => handleMemberSelectChange('sex', value as 'Male' | 'Female' | 'Other')} required disabled={isViewingOnly}>
                  <SelectTrigger><SelectValue placeholder="Select sex" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phoneNumber">Phone Number <span className="text-destructive">*</span></Label>
                <Input id="phoneNumber" name="phoneNumber" type="tel" value={currentMember.phoneNumber || ''} onChange={handleMemberInputChange} required readOnly={isViewingOnly} />
              </div>
            </div>
            
            <Separator className="my-4" />
            <Label className="font-semibold text-base text-primary">Address</Label>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label htmlFor="address.city">City</Label><Input id="address.city" name="address.city" value={currentMember.address?.city || ''} onChange={handleMemberInputChange} readOnly={isViewingOnly} /></div>
                <div>
                  <Label htmlFor="address.subCity">Sub City</Label>
                  <Select
                    value={currentMember.address?.subCity || undefined}
                    onValueChange={(value) => handleNestedSelectChange('address.subCity', value)}
                    disabled={isViewingOnly}
                  >
                    <SelectTrigger id="address.subCity">
                        <SelectValue placeholder="Select a subcity" />
                    </SelectTrigger>
                    <SelectContent>
                        {subcities.map(sc => (<SelectItem key={sc} value={sc}>{sc}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="address.wereda">Wereda</Label><Input id="address.wereda" name="address.wereda" value={currentMember.address?.wereda || ''} onChange={handleMemberInputChange} readOnly={isViewingOnly} /></div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div><Label htmlFor="address.kebele">Kebele</Label><Input id="address.kebele" name="address.kebele" value={currentMember.address?.kebele || ''} onChange={handleMemberInputChange} readOnly={isViewingOnly} /></div>
                <div><Label htmlFor="address.houseNumber">House Number</Label><Input id="address.houseNumber" name="address.houseNumber" value={currentMember.address?.houseNumber || ''} onChange={handleMemberInputChange} readOnly={isViewingOnly} /></div>
            </div>

            <Separator className="my-4" />
            <Label className="font-semibold text-base text-primary">Emergency Contact</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="emergencyContact.name">Representative Name</Label><Input id="emergencyContact.name" name="emergencyContact.name" value={currentMember.emergencyContact?.name || ''} onChange={handleMemberInputChange} readOnly={isViewingOnly} /></div>
                <div><Label htmlFor="emergencyContact.phone">Representative Phone</Label><Input id="emergencyContact.phone" name="emergencyContact.phone" type="tel" value={currentMember.emergencyContact?.phone || ''} onChange={handleMemberInputChange} readOnly={isViewingOnly} /></div>
            </div>
            
            <Separator className="my-4" />
             <Label className="font-semibold text-base text-primary">School &amp; Financial Information</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label htmlFor="schoolId">School <span className="text-destructive">*</span></Label>
                <Select name="schoolId" value={currentMember.schoolId} onValueChange={(value) => handleMemberSelectChange('schoolId', value)} required disabled={isViewingOnly}>
                  <SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger>
                  <SelectContent>{schools.map(school => (<SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="joinDate">Join Date <span className="text-destructive">*</span></Label>
                <Input id="joinDate" name="joinDate" type="date" value={currentMember.joinDate || ''} onChange={handleMemberInputChange} required readOnly={isViewingOnly} />
              </div>
               <div>
                <Label htmlFor="salary">Salary (Birr)</Label>
                <Input id="salary" name="salary" type="number" step="0.01" value={currentMember.salary || ''} onChange={handleMemberInputChange} readOnly={isViewingOnly} />
              </div>
            </div>

            <Separator className="my-4" />
            <div className="flex justify-between items-center">
                <Label className="font-semibold text-base text-primary">Share Commitments</Label>
                {!isViewingOnly && (
                    <Button type="button" variant="outline" size="sm" onClick={addShareCommitment} disabled={isViewingOnly}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Commitment
                    </Button>
                )}
            </div>
            {(currentMember.shareCommitments || []).map((commitment, index) => (
                <div key={index} className="grid grid-cols-1 gap-3 p-3 border rounded-md md:grid-cols-[1fr_auto_auto] md:gap-3 md:items-end">
                    <div>
                        <Label htmlFor={`commitment-type-${index}`}>Share Type</Label>
                        <Select
                            value={commitment.shareTypeId || undefined}
                            onValueChange={(value) => handleShareCommitmentChange(index, 'shareTypeId', value)}
                            disabled={isViewingOnly}
                        >
                            <SelectTrigger id={`commitment-type-${index}`}><SelectValue placeholder="Select share type" /></SelectTrigger>
                            <SelectContent>
                                {shareTypes.map(st => (
                                    <SelectItem key={st.id} value={st.id}>{st.name} ({st.valuePerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr/share)</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor={`commitment-amount-${index}`}>Monthly Amount (Birr)</Label>
                         <div className="relative">
                             <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id={`commitment-amount-${index}`}
                                type="number"
                                step="0.01"
                                value={commitment.monthlyCommittedAmount}
                                onChange={(e) => handleShareCommitmentChange(index, 'monthlyCommittedAmount', e.target.value)}
                                placeholder="0.00"
                                className="pl-7"
                                readOnly={isViewingOnly}
                            />
                        </div>
                    </div>
                     {!isViewingOnly && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeShareCommitment(index)} className="text-destructive hover:bg-destructive/10" disabled={isViewingOnly}>
                            <MinusCircle className="h-5 w-5" />
                            <span className="sr-only">Remove commitment</span>
                        </Button>
                     )}
                </div>
            ))}


            <DialogFooter className="pt-4">
              {isViewingOnly ? (
                 <DialogClose asChild><Button type="button">Close</Button></DialogClose>
              ) : (
                <>
                    <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditingMember ? 'Save Changes' : 'Add Member'}
                    </Button>
                </>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Import Members Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
          <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                  <DialogTitle className="font-headline">Import Members</DialogTitle>
                  <DialogDescription>
                      Upload an Excel file with columns: "MemberID", "MemberFullName", "SavingCollected", and "SchoolID".
                  </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div>
                      <Label htmlFor="importSavingType">Assign Savings to Account Type <span className="text-destructive">*</span></Label>
                      <Select value={importSavingAccountTypeId} onValueChange={setImportSavingAccountTypeId} required>
                          <SelectTrigger id="importSavingType"><SelectValue placeholder="Assign all to type..." /></SelectTrigger>
                          <SelectContent>{savingAccountTypes.map(sat => <SelectItem key={sat.id} value={sat.id}>{sat.name}</SelectItem>)}</SelectContent>
                      </Select>
                  </div>
                  <div>
                    <Label htmlFor="importFile">Upload File <span className="text-destructive">*</span></Label>
                    <Input id="importFile" type="file" onChange={handleFileChange} accept=".xlsx, .xls" disabled={!importSavingAccountTypeId}/>
                    <p className="text-xs text-muted-foreground mt-1">Select a file to preview the import.</p>
                  </div>
                  
                  {isParsing && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span>Parsing file...</span></div>}

                  {parsedMembers.length > 0 && (
                      <div>
                          <Label>Import Preview</Label>
                           <div className="mt-2 h-64 overflow-y-auto rounded-md border">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-muted">
                                        <TableRow>
                                            <TableHead>Member ID</TableHead>
                                            <TableHead>Full Name</TableHead>
                                            <TableHead>School ID</TableHead>
                                            <TableHead>Initial Savings Balance</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedMembers.map((member, index) => (
                                            <TableRow key={index} className={member.status !== 'Ready to import' ? 'bg-destructive/10' : ''}>
                                                <TableCell>{member.memberId}</TableCell>
                                                <TableCell>{member.fullName}</TableCell>
                                                <TableCell>{member.schoolId}</TableCell>
                                                <TableCell>{member.savingsBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                                                <TableCell>{getValidationBadge(member.status)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                           </div>
                           <p className="text-xs text-muted-foreground mt-1">
                                {parsedMembers.filter(m => m.status === 'Ready to import').length} members will be imported. Others will be skipped.
                           </p>
                      </div>
                  )}
              </div>
              <DialogFooter>
                  <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                  <Button onClick={handleConfirmImport} disabled={isSubmitting || isParsing || parsedMembers.filter(m => m.status === 'Ready to import').length === 0}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Import Members
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the member and all their associated data, like savings and shares.
              This will fail if the member has any active loans.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Yes, delete member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
