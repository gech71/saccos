
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter, MinusCircle, DollarSign } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { mockMembers, mockSchools, mockShareTypes } from '@/data/mock';
import type { Member, School, MemberShareCommitment, ShareType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';

const initialMemberFormState: Partial<Member> = {
  fullName: '',
  email: '',
  sex: 'Male',
  phoneNumber: '',
  address: { city: '', subCity: '', wereda: '' },
  emergencyContact: { name: '', phone: '' },
  schoolId: '',
  joinDate: new Date().toISOString().split('T')[0], // today
  savingsBalance: 0,
  sharesCount: 0,
  shareCommitments: [],
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>(mockMembers);
  const [schools] = useState<School[]>(mockSchools);
  const [shareTypes] = useState<ShareType[]>(mockShareTypes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMember, setCurrentMember] = useState<Partial<Member>>(initialMemberFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
        setCurrentMember(prev => ({ ...prev, [name]: name === 'savingsBalance' || name === 'sharesCount' ? parseFloat(value) : value }));
    }
  };

  const handleSelectChange = (name: keyof Member, value: string) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember.fullName || !currentMember.email || !currentMember.schoolId || !currentMember.sex || !currentMember.phoneNumber) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please fill in all required fields (Full Name, Email, Sex, Phone, School).' });
        return;
    }

    const validCommitments = (currentMember.shareCommitments || []).filter(c => c.shareTypeId && c.monthlyCommittedAmount > 0);
    const memberDataToSave = {
        ...currentMember,
        shareCommitments: validCommitments,
    };

    const schoolName = schools.find(s => s.id === memberDataToSave.schoolId)?.name;

    if (isEditing && memberDataToSave.id) {
      setMembers(prev => prev.map(m => m.id === memberDataToSave.id ? { ...m, ...memberDataToSave, schoolName } as Member : m));
      toast({ title: 'Success', description: 'Member updated successfully.' });
    } else {
      const newMember: Member = {
        id: `member-${Date.now()}`,
        ...initialMemberFormState, 
        ...memberDataToSave,
        schoolName,
      } as Member;
      setMembers(prev => [newMember, ...prev]);
      toast({ title: 'Success', description: 'Member added successfully.' });
    }
    setIsModalOpen(false);
    setCurrentMember(initialMemberFormState);
    setIsEditing(false);
  };

  const openAddModal = () => {
    setCurrentMember(initialMemberFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (member: Member) => {
    setCurrentMember({
      ...member,
      joinDate: member.joinDate ? new Date(member.joinDate).toISOString().split('T')[0] : '',
      shareCommitments: member.shareCommitments ? [...member.shareCommitments] : [],
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = (memberId: string) => {
    if (window.confirm('Are you sure you want to delete this member?')) {
      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast({ title: 'Success', description: 'Member deleted successfully.' });
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      const matchesSearchTerm = member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                member.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || member.schoolId === selectedSchoolFilter;
      return matchesSearchTerm && matchesSchoolFilter;
    });
  }, [members, searchTerm, selectedSchoolFilter]);

  return (
    <div className="space-y-6">
      <PageTitle title="Member Management" subtitle="Manage all members of your association.">
        <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
          <PlusCircle className="mr-2 h-5 w-5" /> Add Member
        </Button>
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
        <Select value={selectedSchoolFilter} onValueChange={setSelectedSchoolFilter}>
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
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead className="text-right">Savings</TableHead>
              <TableHead className="text-right">Shares</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length > 0 ? filteredMembers.map(member => (
              <TableRow key={member.id}>
                <TableCell>
                  <Checkbox aria-label={`Select member ${member.fullName}`} />
                </TableCell>
                <TableCell className="font-medium">{member.fullName}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>{member.phoneNumber}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{member.schoolName || schools.find(s => s.id === member.schoolId)?.name}</Badge>
                </TableCell>
                <TableCell>{new Date(member.joinDate).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">${member.savingsBalance.toFixed(2)}</TableCell>
                <TableCell className="text-right">{member.sharesCount}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(member)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(member.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl"> {/* Increased width for more fields */}
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Member' : 'Add New Member'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the details for this member.' : 'Enter the details for the new member.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
            {/* Personal Info Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" name="fullName" value={currentMember.fullName || ''} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={currentMember.email || ''} onChange={handleInputChange} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sex">Sex</Label>
                <Select name="sex" value={currentMember.sex || 'Male'} onValueChange={(value) => handleSelectChange('sex', value as 'Male' | 'Female' | 'Other')} required>
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
                <Input id="phoneNumber" name="phoneNumber" type="tel" value={currentMember.phoneNumber || ''} onChange={handleInputChange} required />
              </div>
            </div>
            
            {/* Address Section */}
            <Separator className="my-4" />
            <Label className="font-semibold text-base text-primary">Address</Label>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label htmlFor="address.city">City</Label><Input id="address.city" name="address.city" value={currentMember.address?.city || ''} onChange={handleInputChange} /></div>
                <div><Label htmlFor="address.subCity">Sub City</Label><Input id="address.subCity" name="address.subCity" value={currentMember.address?.subCity || ''} onChange={handleInputChange} /></div>
                <div><Label htmlFor="address.wereda">Wereda</Label><Input id="address.wereda" name="address.wereda" value={currentMember.address?.wereda || ''} onChange={handleInputChange} /></div>
            </div>

            {/* Emergency Contact Section */}
            <Separator className="my-4" />
            <Label className="font-semibold text-base text-primary">Emergency Contact</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label htmlFor="emergencyContact.name">Representative Name</Label><Input id="emergencyContact.name" name="emergencyContact.name" value={currentMember.emergencyContact?.name || ''} onChange={handleInputChange} /></div>
                <div><Label htmlFor="emergencyContact.phone">Representative Phone</Label><Input id="emergencyContact.phone" name="emergencyContact.phone" type="tel" value={currentMember.emergencyContact?.phone || ''} onChange={handleInputChange} /></div>
            </div>
            
            {/* School & Financial Info Section */}
            <Separator className="my-4" />
             <Label className="font-semibold text-base text-primary">School &amp; Financial Information</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="schoolId">School</Label>
                <Select name="schoolId" value={currentMember.schoolId || ''} onValueChange={(value) => handleSelectChange('schoolId', value)} required>
                  <SelectTrigger><SelectValue placeholder="Select a school" /></SelectTrigger>
                  <SelectContent>{schools.map(school => (<SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="joinDate">Join Date</Label>
                <Input id="joinDate" name="joinDate" type="date" value={currentMember.joinDate || ''} onChange={handleInputChange} required />
              </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="savingsBalance">Initial Savings Balance ($)</Label>
                <Input id="savingsBalance" name="savingsBalance" type="number" step="0.01" value={currentMember.savingsBalance || 0} onChange={handleInputChange} />
              </div>
               <div>
                <Label htmlFor="sharesCount">Initial Shares Count (Overall)</Label>
                <Input id="sharesCount" name="sharesCount" type="number" step="1" value={currentMember.sharesCount || 0} onChange={handleInputChange} />
              </div>
            </div>

            {/* Share Commitments Section */}
            <Separator className="my-4" />
            <div className="flex justify-between items-center">
                <Label className="font-semibold text-base text-primary">Share Commitments</Label>
                <Button type="button" variant="outline" size="sm" onClick={addShareCommitment}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Commitment
                </Button>
            </div>
            {(currentMember.shareCommitments || []).map((commitment, index) => (
                <div key={index} className="grid grid-cols-[1fr_auto_auto] items-end gap-3 p-3 border rounded-md">
                    <div>
                        <Label htmlFor={`commitment-type-${index}`}>Share Type</Label>
                        <Select
                            value={commitment.shareTypeId}
                            onValueChange={(value) => handleShareCommitmentChange(index, 'shareTypeId', value)}
                        >
                            <SelectTrigger id={`commitment-type-${index}`}><SelectValue placeholder="Select share type" /></SelectTrigger>
                            <SelectContent>
                                {shareTypes.map(st => (
                                    <SelectItem key={st.id} value={st.id}>{st.name} (${st.valuePerShare}/share)</SelectItem>
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
                            />
                        </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeShareCommitment(index)} className="text-destructive hover:bg-destructive/10">
                        <MinusCircle className="h-5 w-5" />
                        <span className="sr-only">Remove commitment</span>
                    </Button>
                </div>
            ))}


            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add Member'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
