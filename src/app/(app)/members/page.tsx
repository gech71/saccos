
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter, MinusCircle, DollarSign, Hash, PieChart as LucidePieChart, FileText, FileDown, Loader2, UploadCloud, UserRound, ArrowUpDown, ArrowRightLeft, ReceiptText, SchoolIcon, ChevronsUpDown, Check } from 'lucide-react';
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
import type { SavingAccountType, ServiceChargeType, ShareType as PrismaShareType } from '@/types';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { exportToExcel } from '@/lib/utils';
import { getMembersPageData, addMember, updateMember, deleteMember, transferMember, type MemberWithDetails, type MemberInput, type MembersPageData } from './actions';
import { useAuth } from '@/contexts/auth-context';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const subcities = [
  "Arada", "Akaky Kaliti", "Bole", "Gullele", "Kirkos", "Kolfe Keranio", "Lideta", "Nifas Silk", "Yeka", "Lemi Kura", "Addis Ketema"
].sort();

const initialMemberFormState: Partial<MemberWithDetails & { serviceChargeIds?: string[], shareCommitmentIds?: string[] }> = {
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
  memberShareCommitments: [],
  serviceChargeIds: [],
  shareCommitmentIds: [],
};

export default function MembersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [members, setMembers] = useState<MemberWithDetails[]>([]);
  const [schools, setSchools] = useState<MembersPageData['schools']>([]);
  const [shareTypes, setShareTypes] = useState<MembersPageData['shareTypes']>([]);
  const [savingAccountTypes, setSavingAccountTypes] = useState<MembersPageData['savingAccountTypes']>([]);
  const [serviceChargeTypes, setServiceChargeTypes] = useState<MembersPageData['serviceChargeTypes']>([]);
  
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);

  const [currentMember, setCurrentMember] = useState<Partial<MemberWithDetails & { serviceChargeIds?: string[], shareCommitmentIds?: string[] }>>(initialMemberFormState);
  const [isEditingMember, setIsEditingMember] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const [openSchoolFilterCombobox, setOpenSchoolFilterCombobox] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof MemberWithDetails; direction: 'ascending' | 'descending' } | null>({ key: 'id', direction: 'ascending' });
  
  // Transfer state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [memberToTransfer, setMemberToTransfer] = useState<MemberWithDetails | null>(null);
  const [newSchoolId, setNewSchoolId] = useState<string>('');
  const [openSchoolModalCombobox, setOpenSchoolModalCombobox] = useState(false);
  const [transferReason, setTransferReason] = useState('');

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
      setServiceChargeTypes(data.serviceChargeTypes);
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
        const [parentKey, childKey] = nameParts as [keyof typeof currentMember, string];
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
        const val = name === 'salary' ? parseFloat(value) || 0 : value;
        setCurrentMember(prev => ({ ...prev, [name]: val }));
    }
  };

  const handleNestedSelectChange = (name: string, value: string) => {
    const nameParts = name.split('.');
    if (nameParts.length > 1) {
        const [parentKey, childKey] = nameParts as [keyof typeof currentMember, string];
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

  const handleMemberSelectChange = (name: keyof MemberInput, value: string) => {
    setCurrentMember(prev => ({ ...prev, [name]: value }));
  };

  const handleShareCommitmentChange = (shareTypeId: string, checked: boolean) => {
    setCurrentMember(prev => {
      const newSet = new Set(prev.shareCommitmentIds || []);
      if (checked) newSet.add(shareTypeId);
      else newSet.delete(shareTypeId);
      return { ...prev, shareCommitmentIds: Array.from(newSet) };
    });
  };
  
  const handleServiceChargeChange = (chargeId: string, checked: boolean) => {
      setCurrentMember(prev => {
        const newSet = new Set(prev.serviceChargeIds || []);
        if (checked) newSet.add(chargeId);
        else newSet.delete(chargeId);
        return { ...prev, serviceChargeIds: Array.from(newSet) };
      })
  }

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
            sex: currentMember.sex as 'Male' | 'Female',
            phoneNumber: currentMember.phoneNumber!,
            address: currentMember.address,
            emergencyContact: currentMember.emergencyContact,
            schoolId: currentMember.schoolId!,
            joinDate: currentMember.joinDate!,
            salary: currentMember.salary,
            shareCommitmentIds: currentMember.shareCommitmentIds,
            serviceChargeIds: currentMember.serviceChargeIds || [],
        };

        if (isEditingMember && currentMember.id) {
          await updateMember(currentMember.id, memberInputData);
          toast({ title: 'Success', description: 'Member updated successfully.' });
        } else {
          await addMember(memberInputData);
          toast({ title: 'Success', description: 'Member added successfully.' });
        }

        setIsMemberModalOpen(false);
        await fetchPageData();

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
      shareCommitmentIds: (member.memberShareCommitments || []).map(c => c.shareTypeId),
      serviceChargeIds: [], 
    });
    setIsMemberModalOpen(true);
  };

  const openAddMemberModal = () => {
    setCurrentMember(initialMemberFormState);
    setIsEditingMember(false);
    setIsMemberModalOpen(true);
  };

  const openEditMemberModal = (member: MemberWithDetails) => {
    prepMemberForModal(member);
    setIsEditingMember(true);
  };

  const handleDeleteConfirm = async () => {
    if (!memberToDelete) return;
    const result = await deleteMember(memberToDelete);
    if (result.success) {
      toast({ title: 'Success', description: result.message });
      await fetchPageData();
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

  const requestSort = (key: keyof MemberWithDetails) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedMembers = useMemo(() => {
    let sortableMembers = [...members];
    if (sortConfig !== null) {
      sortableMembers.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableMembers;
  }, [members, sortConfig]);

  const filteredMembers = useMemo(() => {
    return sortedMembers.filter(member => {
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearchTerm = member.fullName.toLowerCase().includes(searchTermLower) ||
                                member.id.toLowerCase().includes(searchTermLower);
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || member.schoolId === selectedSchoolFilter;
      return matchesSearchTerm && matchesSchoolFilter;
    });
  }, [sortedMembers, searchTerm, selectedSchoolFilter]);

  const handleExport = () => {
    const dataToExport = filteredMembers.map(member => ({
        'Member ID': member.id,
        'Full Name': member.fullName,
        'Email': member.email,
        'Phone': member.phoneNumber,
        'School': member.school?.name,
        'Total Savings Balance (Birr)': member.totalSavingsBalance,
        'Join Date': new Date(member.joinDate).toLocaleDateString(),
    }));
    exportToExcel(dataToExport, 'members_export');
  };
  
  const paginatedMembers = useMemo(() => {
    return filteredMembers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  }, [filteredMembers, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => Math.ceil(filteredMembers.length / rowsPerPage), [filteredMembers.length, rowsPerPage]);

  const paginationItems = useMemo(() => {
    if (totalPages <= 1) return [];
    const delta = 1;
    const left = currentPage - delta;
    const right = currentPage + delta + 1;
    const range: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= left && i < right)) {
            range.push(i);
        }
    }
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;
    for (const i of range) {
        if (l) {
            if (i - l === 2) rangeWithDots.push(l + 1);
            else if (i - l !== 1) rangeWithDots.push('...');
        }
        rangeWithDots.push(i);
        l = i;
    }
    return rangeWithDots;
  }, [totalPages, currentPage]);

  const openTransferModal = (member: MemberWithDetails) => {
    setMemberToTransfer(member);
    setNewSchoolId('');
    setTransferReason('');
    setIsTransferModalOpen(true);
  };

  const handleTransferSubmit = async () => {
    if (!memberToTransfer || !newSchoolId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a new school for the transfer.' });
      return;
    }
    setIsSubmitting(true);
    const result = await transferMember(memberToTransfer.id, newSchoolId, transferReason);
    if (result.success) {
      toast({ title: 'Transfer Successful', description: result.message });
      await fetchPageData();
      setIsTransferModalOpen(false);
    } else {
      toast({ variant: 'destructive', title: 'Transfer Failed', description: result.message });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Member Management" subtitle="Manage all members of your association.">
        <Button onClick={handleExport} variant="outline" disabled={isLoading || members.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Export
        </Button>
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
            placeholder="Search by member name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
            aria-label="Search members"
          />
        </div>
        <Popover open={openSchoolFilterCombobox} onOpenChange={setOpenSchoolFilterCombobox}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openSchoolFilterCombobox}
              className="w-full sm:w-[220px] justify-between"
              disabled={isLoading}
            >
              <Filter className="mr-2 h-4 w-4 text-muted-foreground md:hidden" />
              <SchoolIcon className="mr-2 h-4 w-4 text-muted-foreground hidden md:inline" />
              {selectedSchoolFilter === 'all'
                ? "All Schools"
                : schools.find((school) => school.id === selectedSchoolFilter)?.name}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
              <CommandInput placeholder="Search school..." />
              <CommandList>
                <CommandEmpty>No school found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    key="all-schools"
                    value="all"
                    onSelect={() => {
                      setSelectedSchoolFilter("all");
                      setOpenSchoolFilterCombobox(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selectedSchoolFilter === "all" ? "opacity-100" : "opacity-0")} />
                    All Schools
                  </CommandItem>
                  {schools.map((school) => (
                    <CommandItem key={school.id} value={`${school.name} ${school.id}`} onSelect={() => { setSelectedSchoolFilter(school.id); setOpenSchoolFilterCombobox(false); }}>
                      <Check className={cn("mr-2 h-4 w-4", selectedSchoolFilter === school.id ? "opacity-100" : "opacity-0")} />
                      {school.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                 <Button variant="ghost" onClick={() => requestSort('id')} className="px-0">
                    Member ID <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>School</TableHead>
              <TableHead className="text-right">Total Savings</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
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
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                       <DropdownMenuItem asChild><Link href={`/member-profile/${member.id}`}><UserRound className="mr-2 h-4 w-4" /> View Profile</Link></DropdownMenuItem>
                      {canEdit && <DropdownMenuItem onClick={() => openEditMemberModal(member)}><Edit className="mr-2 h-4 w-4" /> Edit Member</DropdownMenuItem>}
                      {canEdit && <DropdownMenuItem onClick={() => openTransferModal(member)}><ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer School</DropdownMenuItem>}
                      <Separator />
                      {canDelete && <DropdownMenuItem onClick={() => openDeleteDialog(member.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Delete Member</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">No members found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

       {filteredMembers.length > 0 && (
            <div className="flex flex-col items-center gap-4 pt-4">
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                    <div className="flex items-center gap-1">
                        {paginationItems.map((item, index) => typeof item === 'number' ? (<Button key={index} variant={currentPage === item ? 'default' : 'outline'} size="sm" className="h-9 w-9 p-0" onClick={() => setCurrentPage(item)}>{item}</Button>) : (<span key={index} className="px-2">{item}</span>))}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next</Button>
                </div>
                <div className="flex items-center space-x-6 lg:space-x-8 text-sm text-muted-foreground">
                    <div>Page {currentPage} of {totalPages || 1}</div>
                    <div>{filteredMembers.length} member(s) found.</div>
                    <div className="flex items-center space-x-2">
                        <p className="font-medium">Rows:</p>
                        <Select value={`${rowsPerPage}`} onValueChange={(value) => { setRowsPerPage(Number(value)); setCurrentPage(1); }}>
                            <SelectTrigger className="h-8 w-[70px]"><SelectValue placeholder={`${rowsPerPage}`} /></SelectTrigger>
                            <SelectContent side="top"> {[10, 15, 20, 25, 50].map((pageSize) => (<SelectItem key={pageSize} value={`${pageSize}`}>{pageSize}</SelectItem>))} </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
      )}

      <Dialog open={isMemberModalOpen} onOpenChange={setIsMemberModalOpen}>
        <DialogContent className="sm:max-w-3xl"> 
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditingMember ? 'Edit Member' : 'Add New Member'}</DialogTitle>
            <DialogDescription>{isEditingMember ? 'Update the details for this member.' : 'Enter the details for the new member.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMemberSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="id">Member ID <span className="text-destructive">*</span></Label><Input id="id" name="id" value={currentMember.id || ''} onChange={handleMemberInputChange} required readOnly={isEditingMember} /></div>
                <div><Label htmlFor="fullName">Full Name <span className="text-destructive">*</span></Label><Input id="fullName" name="fullName" value={currentMember.fullName || ''} onChange={handleMemberInputChange} required /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label htmlFor="email">Email <span className="text-destructive">*</span></Label><Input id="email" name="email" type="email" value={currentMember.email || ''} onChange={handleMemberInputChange} required /></div>
               <div><Label htmlFor="sex">Sex <span className="text-destructive">*</span></Label><Select name="sex" value={currentMember.sex || 'Male'} onValueChange={(value) => handleMemberSelectChange('sex' as any, value as 'Male' | 'Female')} required><SelectTrigger><SelectValue placeholder="Select sex" /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent></Select></div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><Label htmlFor="phoneNumber">Phone Number <span className="text-destructive">*</span></Label><Input id="phoneNumber" name="phoneNumber" type="tel" value={currentMember.phoneNumber || ''} onChange={handleMemberInputChange} required /></div></div>
            <Separator className="my-4" />
            <Label className="font-semibold text-base text-primary">Address</Label>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label htmlFor="address.city">City</Label><Input id="address.city" name="address.city" value={currentMember.address?.city || ''} onChange={handleMemberInputChange} /></div>
                <div><Label htmlFor="address.subCity">Sub City</Label><Select value={currentMember.address?.subCity || undefined} onValueChange={(value) => handleNestedSelectChange('address.subCity', value)}><SelectTrigger id="address.subCity"><SelectValue placeholder="Select a subcity" /></SelectTrigger><SelectContent>{subcities.map(sc => (<SelectItem key={sc} value={sc}>{sc}</SelectItem>))}</SelectContent></Select></div>
                <div><Label htmlFor="address.wereda">Wereda</Label><Input id="address.wereda" name="address.wereda" value={currentMember.address?.wereda || ''} onChange={handleMemberInputChange} /></div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div><Label htmlFor="address.kebele">Kebele</Label><Input id="address.kebele" name="address.kebele" value={currentMember.address?.kebele || ''} onChange={handleMemberInputChange} /></div>
                <div><Label htmlFor="address.houseNumber">House Number</Label><Input id="address.houseNumber" name="address.houseNumber" value={currentMember.address?.houseNumber || ''} onChange={handleMemberInputChange} /></div>
            </div>
            <Separator className="my-4" />
            <Label className="font-semibold text-base text-primary">Emergency Contact</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="emergencyContact.name">Rep Name</Label><Input id="emergencyContact.name" name="emergencyContact.name" value={currentMember.emergencyContact?.name || ''} onChange={handleMemberInputChange} /></div>
                <div><Label htmlFor="emergencyContact.phone">Rep Phone</Label><Input id="emergencyContact.phone" name="emergencyContact.phone" type="tel" value={currentMember.emergencyContact?.phone || ''} onChange={handleMemberInputChange} /></div>
            </div>
            <Separator className="my-4" />
             <Label className="font-semibold text-base text-primary">School & Financial Information</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div><Label htmlFor="schoolId">School <span className="text-destructive">*</span></Label><Popover open={openSchoolModalCombobox} onOpenChange={setOpenSchoolModalCombobox}><PopoverTrigger asChild><Button id="schoolId" variant="outline" role="combobox" className="w-full justify-between">{currentMember.schoolId ? schools.find((s) => s.id === currentMember.schoolId)?.name : "Select school..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search school..." /><CommandList><CommandEmpty>No school found.</CommandEmpty><CommandGroup>{schools.map((s) => (<CommandItem key={s.id} value={`${s.name} ${s.id}`} onSelect={() => { handleMemberSelectChange('schoolId' as any, s.id); setOpenSchoolModalCombobox(false); }}><Check className={cn("mr-2 h-4 w-4", currentMember.schoolId === s.id ? "opacity-100" : "opacity-0")} />{s.name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover></div>
              <div><Label htmlFor="joinDate">Join Date <span className="text-destructive">*</span></Label><Input id="joinDate" name="joinDate" type="date" value={currentMember.joinDate || ''} onChange={handleMemberInputChange} required /></div>
               <div><Label htmlFor="salary">Salary</Label><Input id="salary" name="salary" type="number" step="0.01" value={currentMember.salary || ''} onChange={handleMemberInputChange} /></div>
            </div>
            <Separator className="my-4" />
            <Label className="font-semibold text-base text-primary">Share Subscriptions</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 p-2 rounded-md border">
              {shareTypes.map(st => (
                <div key={st.id} className="flex items-center space-x-3">
                  <Checkbox 
                    id={`share-type-${st.id}`}
                    checked={(currentMember.shareCommitmentIds || []).includes(st.id)}
                    onCheckedChange={(checked) => handleShareCommitmentChange(st.id, !!checked)}
                  />
                  <Label htmlFor={`share-type-${st.id}`} className="font-normal flex justify-between w-full">
                    <span>{st.name}</span>
                    <span className="font-semibold text-muted-foreground">{st.totalAmount.toLocaleString()} Birr</span>
                  </Label>
                </div>
              ))}
            </div>
            
            {!isEditingMember && (
                <>
                    <Separator className="my-4" />
                    <Label className="font-semibold text-base text-primary">Service Charges on Registration</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {serviceChargeTypes.filter(sc => sc.frequency === 'once').map(charge => (
                            <div key={charge.id} className="flex items-center space-x-3">
                                <Checkbox 
                                    id={`service-charge-${charge.id}`}
                                    onCheckedChange={(checked) => handleServiceChargeChange(charge.id, !!checked)}
                                    checked={(currentMember.serviceChargeIds || []).includes(charge.id)}
                                />
                                <Label htmlFor={`service-charge-${charge.id}`} className="font-normal flex justify-between w-full">
                                    <span>{charge.name}</span>
                                    <span className="font-semibold">{charge.amount.toLocaleString(undefined, {minimumFractionDigits:2})} Birr</span>
                                </Label>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isEditingMember ? 'Save Changes' : 'Add Member'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer {memberToTransfer?.fullName}</DialogTitle><DialogDescription>Select a new school. Their history at the current school will be preserved.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Current School</Label><Input value={memberToTransfer?.school?.name} readOnly disabled className="bg-muted" /></div>
            <div><Label htmlFor="newSchoolId">New School <span className="text-destructive">*</span></Label><Select value={newSchoolId} onValueChange={setNewSchoolId}><SelectTrigger id="newSchoolId"><SelectValue placeholder="Select new school" /></SelectTrigger><SelectContent>{schools.filter(s => s.id !== memberToTransfer?.schoolId).map(school => (<SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>))}</SelectContent></Select></div>
            <div><Label htmlFor="transferReason">Reason for Transfer (Optional)</Label><Textarea id="transferReason" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} /></div>
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleTransferSubmit} disabled={isSubmitting || !newSchoolId}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm Transfer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action is irreversible and will delete the member and all associated data. This will fail if the member has active loans.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Yes, delete member</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
