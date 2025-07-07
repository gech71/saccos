
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter, MinusCircle, DollarSign, Hash, PieChart as LucidePieChart, FileText, FileDown, Loader2 } from 'lucide-react';
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
import type { Member, School, MemberShareCommitment, ShareType, SavingAccountType } from '@/types';
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
import { getMembersPageData, addMember, updateMember, deleteMember, type MemberWithDetails, type MemberInput, type MembersPageData } from './actions';
import { useAuth } from '@/contexts/auth-context';


const initialMemberFormState: Partial<Member> = {
  fullName: '',
  email: '',
  sex: 'Male',
  phoneNumber: '',
  address: { city: '', subCity: '', wereda: '', kebele: '', houseNumber: '' },
  emergencyContact: { name: '', phone: '' },
  schoolId: undefined,
  joinDate: new Date().toISOString().split('T')[0],
  savingsBalance: 0,
  savingsAccountNumber: '',
  sharesCount: 0,
  shareCommitments: [],
  savingAccountTypeId: undefined,
  expectedMonthlySaving: 0,
};


export default function MembersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [members, setMembers] = useState<MemberWithDetails[]>([]);
  const [schools, setSchools] = useState<MembersPageData['schools']>([]);
  const [shareTypes, setShareTypes] = useState<MembersPageData['shareTypes']>([]);
  const [savingAccountTypes, setSavingAccountTypes] = useState<MembersPageData['savingAccountTypes']>([]);
  const [subcities, setSubcities] = useState<string[]>([]);
  
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);

  const [currentMember, setCurrentMember] = useState<Partial<Member>>(initialMemberFormState);
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [isViewingOnly, setIsViewingOnly] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const { toast } = useToast();
  const { user } = useAuth();

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
      setSubcities(data.subcities);
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
            const currentParentValue = prev[parentKey] || {};
            return {
                ...prev,
                [parentKey]: {
                    ...(currentParentValue as object),
                    [childKey]: value
                }
            };
        });
    } else {
        setCurrentMember(prev => ({ ...prev, [name]: name === 'savingsBalance' || name === 'sharesCount' || name === 'expectedMonthlySaving' ? parseFloat(value) : value }));
    }
  };

  const handleNestedSelectChange = (name: string, value: string) => {
    const nameParts = name.split('.');
    if (nameParts.length > 1) {
        const [parentKey, childKey] = nameParts as [keyof Member, string];
        setCurrentMember(prev => {
            const currentParentValue = prev[parentKey] || {};
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
    if (name === 'savingAccountTypeId') {
        const selectedAccountType = savingAccountTypes.find(sat => sat.id === value);
        setCurrentMember(prev => ({ 
            ...prev,
            savingAccountTypeName: selectedAccountType?.name || '',
            expectedMonthlySaving: selectedAccountType?.expectedMonthlyContribution || 0,
        }));
    }
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
    
    if (!currentMember.fullName || !currentMember.email || !currentMember.schoolId || !currentMember.sex || !currentMember.phoneNumber || !currentMember.savingsAccountNumber) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please fill in all required fields (Full Name, Email, Sex, Phone, School, Savings Account #).' });
        return;
    }

    setIsSubmitting(true);
    try {
        const memberInputData: MemberInput = {
            fullName: currentMember.fullName!,
            email: currentMember.email!,
            sex: currentMember.sex!,
            phoneNumber: currentMember.phoneNumber!,
            address: currentMember.address,
            emergencyContact: currentMember.emergencyContact,
            schoolId: currentMember.schoolId!,
            joinDate: currentMember.joinDate!,
            savingsBalance: currentMember.savingsBalance || 0,
            savingsAccountNumber: currentMember.savingsAccountNumber,
            sharesCount: currentMember.sharesCount || 0,
            shareCommitments: (currentMember.shareCommitments || [])
              .filter(sc => sc.shareTypeId && sc.monthlyCommittedAmount > 0)
              .map(sc => ({ shareTypeId: sc.shareTypeId, monthlyCommittedAmount: sc.monthlyCommittedAmount})),
            savingAccountTypeId: currentMember.savingAccountTypeId,
            expectedMonthlySaving: currentMember.expectedMonthlySaving
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
    const selectedAccountType = savingAccountTypes.find(sat => sat.id === member.savingAccountTypeId);
    setCurrentMember({
      ...member,
      joinDate: member.joinDate ? new Date(member.joinDate).toISOString().split('T')[0] : '',
      shareCommitments: member.shareCommitments ? [...member.shareCommitments] : [],
      expectedMonthlySaving: member.expectedMonthlySaving ?? selectedAccountType?.expectedMonthlyContribution ?? 0,
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
  
  const openViewMemberModal = (member: MemberWithDetails) => {
    prepMemberForModal(member);
    setIsEditingMember(false);
    setIsViewingOnly(true);
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
        'Saving Account #': member.savingsAccountNumber || 'N/A',
        'Saving Account Type': member.savingAccountTypeName || member.savingAccountType?.name || 'N/A',
        'Expected Monthly Saving ($)': member.expectedMonthlySaving || 0,
        'Current Savings Balance ($)': member.savingsBalance,
        'Total Shares': member.sharesCount,
        'Share Commitments': (member.shareCommitments || []).map(c => `${c.shareTypeName}: $${c.monthlyCommittedAmount.toFixed(2)}/mo`).join('; '),
        'Join Date': new Date(member.joinDate).toLocaleDateString(),
    }));
    exportToExcel(dataToExport, 'members_export');
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
              <TableHead className="w-[50px]">
                <Checkbox aria-label="Select all members" />
              </TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Saving Acct. #</TableHead>
              <TableHead>Saving Acct. Type</TableHead>
              <TableHead className="text-right">Exp. Monthly Saving</TableHead>
              <TableHead className="text-right">Current Savings</TableHead>
              <TableHead>Shares / Commitments</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredMembers.length > 0 ? filteredMembers.map(member => (
              <TableRow key={member.id}>
                <TableCell>
                  <Checkbox aria-label={`Select member ${member.fullName}`} />
                </TableCell>
                <TableCell className="font-medium">{member.fullName}</TableCell>
                <TableCell>
                    <div className="text-sm">{member.email}</div>
                    <div className="text-xs text-muted-foreground">{member.phoneNumber}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{member.school?.name}</Badge>
                </TableCell>
                <TableCell>{member.savingsAccountNumber || 'N/A'}</TableCell>
                <TableCell>{member.savingAccountTypeName || member.savingAccountType?.name || 'N/A'}</TableCell>
                <TableCell className="text-right">${(member.expectedMonthlySaving || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right">${member.savingsBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <div className="font-medium">{member.sharesCount} Shares</div>
                  {member.shareCommitments && member.shareCommitments.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {member.shareCommitments.map((commitment) => (
                        <li key={commitment.shareTypeId}>
                          <span>{commitment.shareTypeName}: </span>
                          <span className="font-semibold text-foreground">${commitment.monthlyCommittedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-muted-foreground">No monthly commitments</div>
                  )}
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
                       <DropdownMenuItem onClick={() => openViewMemberModal(member)}>
                        <FileText className="mr-2 h-4 w-4" /> View Details
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
                <TableCell colSpan={10} className="h-24 text-center">
                  No members found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {filteredMembers.length > 10 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline">Load More</Button>
        </div>
      )}

      {/* Member Add/Edit/View Modal */}
      <Dialog open={isMemberModalOpen} onOpenChange={(isOpen) => {
        setIsMemberModalOpen(isOpen);
        if (!isOpen) {
            setIsViewingOnly(false);
            setCurrentMember(initialMemberFormState);
        }
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
            {/* Personal Info Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" name="fullName" value={currentMember.fullName || ''} onChange={handleMemberInputChange} required readOnly={isViewingOnly} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={currentMember.email || ''} onChange={handleMemberInputChange} required readOnly={isViewingOnly} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sex">Sex</Label>
                <Select name="sex" value={currentMember.sex || 'Male'} onValueChange={(value) => handleMemberSelectChange('sex', value as 'Male' | 'Female' | 'Other')} required disabled={isViewingOnly}>
                  <SelectTrigger><SelectValue placeholder="Select sex" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="phoneNumber">Phone Number</Label>
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
                    value={currentMember.address?.subCity}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="schoolId">School</Label>
                <Select name="schoolId" value={currentMember.schoolId} onValueChange={(value) => handleMemberSelectChange('schoolId', value)} required disabled={isViewingOnly}>
                  <SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger>
                  <SelectContent>{schools.map(school => (<SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="joinDate">Join Date</Label>
                <Input id="joinDate" name="joinDate" type="date" value={currentMember.joinDate || ''} onChange={handleMemberInputChange} required readOnly={isViewingOnly} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor="savingsAccountNumber">Savings Account Number</Label>
                    <div className="relative">
                        <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="savingsAccountNumber" name="savingsAccountNumber" value={currentMember.savingsAccountNumber || ''} onChange={handleMemberInputChange} placeholder="e.g., SA10023" required className="pl-8" readOnly={isViewingOnly} />
                    </div>
                </div>
                <div>
                    <Label htmlFor="savingAccountTypeId">Saving Account Type</Label>
                    <Select name="savingAccountTypeId" value={currentMember.savingAccountTypeId} onValueChange={(value) => handleMemberSelectChange('savingAccountTypeId', value)} disabled={isViewingOnly}>
                        <SelectTrigger><SelectValue placeholder="Select saving account type (Optional)" /></SelectTrigger>
                        <SelectContent>{savingAccountTypes.map(sat => (<SelectItem key={sat.id} value={sat.id}>{sat.name} ({(sat.interestRate * 100).toFixed(2)}% Interest, ${sat.expectedMonthlyContribution?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} Exp. Contrib.)</SelectItem>))}</SelectContent>
                    </Select>
                </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="savingsBalance">Initial Savings Balance ($)</Label>
                <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="savingsBalance" name="savingsBalance" type="number" step="0.01" value={currentMember.savingsBalance || 0} onChange={handleMemberInputChange} className="pl-7" readOnly={isViewingOnly}/>
                </div>
              </div>
               <div>
                <Label htmlFor="sharesCount">Initial Shares Count (Overall)</Label>
                <div className="relative">
                    <LucidePieChart className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="sharesCount" name="sharesCount" type="number" step="1" value={currentMember.sharesCount || 0} onChange={handleMemberInputChange} className="pl-7" readOnly={isViewingOnly}/>
                </div>
              </div>
              <div>
                <Label htmlFor="expectedMonthlySaving">Expected Monthly Saving ($)</Label>
                <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="expectedMonthlySaving" 
                        name="expectedMonthlySaving" 
                        type="number" 
                        step="0.01" 
                        value={currentMember.expectedMonthlySaving || 0} 
                        onChange={handleMemberInputChange} 
                        className="pl-7 bg-muted/50" 
                        readOnly 
                    />
                </div>
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
                                    <SelectItem key={st.id} value={st.id}>{st.name} (${st.valuePerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/share)</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor={`commitment-amount-${index}`}>Monthly Amount ($)</Label>
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
