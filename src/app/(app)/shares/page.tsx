'use client';

import React, { useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter, PieChart as LucidePieChart } from 'lucide-react';
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
import { mockShares, mockMembers } from '@/data/mock';
import type { Share, Member } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const initialShareFormState: Partial<Share> = {
  memberId: '',
  count: 0,
  allocationDate: new Date().toISOString().split('T')[0], // today
  valuePerShare: 10, // Default value
};

export default function SharesPage() {
  const [shares, setShares] = useState<Share[]>(mockShares);
  const [members] = useState<Member[]>(mockMembers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentShare, setCurrentShare] = useState<Partial<Share>>(initialShareFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentShare(prev => ({ ...prev, [name]: name === 'count' || name === 'valuePerShare' ? parseFloat(value) : value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setCurrentShare(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShare.memberId || !currentShare.count || currentShare.count <= 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a member and enter a valid share count.' });
        return;
    }

    const memberName = members.find(m => m.id === currentShare.memberId)?.fullName;

    if (isEditing && currentShare.id) {
      setShares(prev => prev.map(s => s.id === currentShare.id ? { ...s, ...currentShare, memberName } as Share : s));
      toast({ title: 'Success', description: 'Share record updated.' });
    } else {
      const newShare: Share = {
        id: `share-${Date.now()}`,
        ...currentShare,
        memberName,
      } as Share;
      setShares(prev => [newShare, ...prev]);
      toast({ title: 'Success', description: 'Share record added.' });
    }
    setIsModalOpen(false);
    setCurrentShare(initialShareFormState);
    setIsEditing(false);
  };

  const openAddModal = () => {
    setCurrentShare(initialShareFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (share: Share) => {
    setCurrentShare({
      ...share,
      allocationDate: share.allocationDate ? new Date(share.allocationDate).toISOString().split('T')[0] : '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = (shareId: string) => {
     if (window.confirm('Are you sure you want to delete this share record?')) {
        setShares(prev => prev.filter(s => s.id !== shareId));
        toast({ title: 'Success', description: 'Share record deleted.' });
    }
  };

  const filteredShares = useMemo(() => {
    return shares.filter(share => {
      const member = members.find(m => m.id === share.memberId);
      const matchesSearchTerm = member ? member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const matchesMemberFilter = selectedMemberFilter === 'all' || share.memberId === selectedMemberFilter;
      return matchesSearchTerm && matchesMemberFilter;
    });
  }, [shares, members, searchTerm, selectedMemberFilter]);

  const totalSharesAllocated = useMemo(() => filteredShares.reduce((sum, s) => sum + s.count, 0), [filteredShares]);
  const totalSharesValue = useMemo(() => filteredShares.reduce((sum, s) => sum + (s.count * s.valuePerShare), 0), [filteredShares]);

  return (
    <div className="space-y-6">
      <PageTitle title="Share Allocation" subtitle="Manage member shareholdings.">
        <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
          <PlusCircle className="mr-2 h-5 w-5" /> Allocate Shares
        </Button>
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Shares Allocated</CardTitle>
                <LucidePieChart className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">{totalSharesAllocated.toLocaleString()}</div>
            </CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Value of Shares</CardTitle>
                <span className="text-accent font-bold text-lg">$</span>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">${totalSharesValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by member name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
            aria-label="Search share records"
          />
        </div>
        <Select value={selectedMemberFilter} onValueChange={setSelectedMemberFilter}>
          <SelectTrigger className="w-full sm:w-[220px]" aria-label="Filter by member">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Filter by member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            {members.map(member => (
              <SelectItem key={member.id} value={member.id}>{member.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox aria-label="Select all share records" />
              </TableHead>
              <TableHead>Member Name</TableHead>
              <TableHead className="text-right">Share Count</TableHead>
              <TableHead className="text-right">Value per Share</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
              <TableHead>Allocation Date</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredShares.length > 0 ? filteredShares.map(share => (
              <TableRow key={share.id}>
                <TableCell>
                  <Checkbox aria-label={`Select share record for ${share.memberName}`} />
                </TableCell>
                <TableCell className="font-medium">{share.memberName || members.find(m => m.id === share.memberId)?.fullName}</TableCell>
                <TableCell className="text-right">{share.count}</TableCell>
                <TableCell className="text-right">${share.valuePerShare.toFixed(2)}</TableCell>
                <TableCell className="text-right font-semibold">${(share.count * share.valuePerShare).toFixed(2)}</TableCell>
                <TableCell>{new Date(share.allocationDate).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(share)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(share.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No share records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {filteredShares.length > 10 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline">Load More</Button>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Share Record' : 'Allocate New Shares'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update this share allocation.' : 'Enter details for new share allocation.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="memberId">Member</Label>
              <Select name="memberId" value={currentShare.memberId || ''} onValueChange={(value) => handleSelectChange('memberId', value)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(member => (
                    <SelectItem key={member.id} value={member.id}>{member.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="count">Share Count</Label>
              <Input id="count" name="count" type="number" step="1" placeholder="0" value={currentShare.count || ''} onChange={handleInputChange} required />
            </div>
            <div>
              <Label htmlFor="valuePerShare">Value per Share ($)</Label>
              <Input id="valuePerShare" name="valuePerShare" type="number" step="0.01" placeholder="10.00" value={currentShare.valuePerShare || ''} onChange={handleInputChange} required />
            </div>
            <div>
              <Label htmlFor="allocationDate">Allocation Date</Label>
              <Input id="allocationDate" name="allocationDate" type="date" value={currentShare.allocationDate || ''} onChange={handleInputChange} required />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Allocate Shares'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
