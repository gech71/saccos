'use client';

import React, { useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter } from 'lucide-react';
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
import { mockMembers, mockSchools } from '@/data/mock';
import type { Member, School } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const initialMemberFormState: Partial<Member> = {
  fullName: '',
  email: '',
  schoolId: '',
  joinDate: new Date().toISOString().split('T')[0], // today
  savingsBalance: 0,
  sharesCount: 0,
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>(mockMembers);
  const [schools] = useState<School[]>(mockSchools);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMember, setCurrentMember] = useState<Partial<Member>>(initialMemberFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentMember(prev => ({ ...prev, [name]: name === 'savingsBalance' || name === 'sharesCount' ? parseFloat(value) : value }));
  };

  const handleSchoolChange = (value: string) => {
    setCurrentMember(prev => ({ ...prev, schoolId: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember.fullName || !currentMember.email || !currentMember.schoolId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please fill in all required fields.' });
        return;
    }

    const schoolName = schools.find(s => s.id === currentMember.schoolId)?.name;

    if (isEditing && currentMember.id) {
      setMembers(prev => prev.map(m => m.id === currentMember.id ? { ...m, ...currentMember, schoolName } as Member : m));
      toast({ title: 'Success', description: 'Member updated successfully.' });
    } else {
      const newMember: Member = {
        id: `member-${Date.now()}`,
        ...currentMember,
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
                <TableCell colSpan={8} className="h-24 text-center">
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
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Member' : 'Add New Member'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the details for this member.' : 'Enter the details for the new member.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" name="fullName" value={currentMember.fullName || ''} onChange={handleInputChange} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={currentMember.email || ''} onChange={handleInputChange} required />
            </div>
            <div>
              <Label htmlFor="schoolId">School</Label>
              <Select name="schoolId" value={currentMember.schoolId || ''} onValueChange={handleSchoolChange} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a school" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map(school => (
                    <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="joinDate">Join Date</Label>
              <Input id="joinDate" name="joinDate" type="date" value={currentMember.joinDate || ''} onChange={handleInputChange} required />
            </div>
             <div>
              <Label htmlFor="savingsBalance">Initial Savings Balance ($)</Label>
              <Input id="savingsBalance" name="savingsBalance" type="number" step="0.01" value={currentMember.savingsBalance || 0} onChange={handleInputChange} />
            </div>
             <div>
              <Label htmlFor="sharesCount">Initial Shares Count</Label>
              <Input id="sharesCount" name="sharesCount" type="number" step="1" value={currentMember.sharesCount || 0} onChange={handleInputChange} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add Member'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
