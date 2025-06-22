
'use client';

import React, { useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter, Landmark as LucideLandmark, TrendingUp } from 'lucide-react';
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
import { mockDividends, mockMembers, mockShares } from '@/data/mock';
import type { Dividend, Member, Share } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle as ShadcnCardTitle } from '@/components/ui/card'; // Renamed to avoid conflict

const initialDividendFormState: Partial<Dividend> = {
  memberId: '',
  amount: 0,
  distributionDate: new Date().toISOString().split('T')[0], // today
  shareCountAtDistribution: 0,
};

export default function DividendsPage() {
  const [dividends, setDividends] = useState<Dividend[]>(mockDividends);
  const [members] = useState<Member[]>(mockMembers);
  const [shares] = useState<Share[]>(mockShares); // To fetch share count
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDividend, setCurrentDividend] = useState<Partial<Dividend>>(initialDividendFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentDividend(prev => ({ ...prev, [name]: name === 'amount' || name === 'shareCountAtDistribution' ? parseFloat(value) : value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setCurrentDividend(prev => ({ ...prev, [name]: value }));
    if (name === 'memberId') {
      const memberShares = shares.filter(s => s.memberId === value).reduce((acc, curr) => acc + curr.count, 0);
      setCurrentDividend(prev => ({ ...prev, shareCountAtDistribution: memberShares }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDividend.memberId || !currentDividend.amount || currentDividend.amount <= 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a member and enter a valid dividend amount.' });
        return;
    }

    const memberName = members.find(m => m.id === currentDividend.memberId)?.fullName;

    if (isEditing && currentDividend.id) {
      const updatedDividend = { ...currentDividend, memberName, status: 'pending' } as Dividend;
      setDividends(prev => prev.map(d => d.id === currentDividend.id ? updatedDividend : d));
      toast({ title: 'Dividend Updated', description: 'Dividend record updated and sent for re-approval.' });
    } else {
      const newDividend: Dividend = {
        id: `dividend-${Date.now()}`,
        ...currentDividend,
        memberName,
        status: 'pending',
      } as Dividend;
      setDividends(prev => [newDividend, ...prev]);
      toast({ title: 'Dividend Submitted', description: 'Dividend distribution sent for approval.' });
    }
    setIsModalOpen(false);
    setCurrentDividend(initialDividendFormState);
    setIsEditing(false);
  };

  const openAddModal = () => {
    setCurrentDividend(initialDividendFormState);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (dividend: Dividend) => {
    setCurrentDividend({
      ...dividend,
      distributionDate: dividend.distributionDate ? new Date(dividend.distributionDate).toISOString().split('T')[0] : '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = (dividendId: string) => {
     if (window.confirm('Are you sure you want to delete this dividend record?')) {
        setDividends(prev => prev.filter(d => d.id !== dividendId));
        toast({ title: 'Success', description: 'Dividend record deleted.' });
    }
  };

  const filteredDividends = useMemo(() => {
    return dividends.filter(dividend => {
      const member = members.find(m => m.id === dividend.memberId);
      const matchesSearchTerm = member ? member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const matchesMemberFilter = selectedMemberFilter === 'all' || dividend.memberId === selectedMemberFilter;
      return matchesSearchTerm && matchesMemberFilter;
    });
  }, [dividends, members, searchTerm, selectedMemberFilter]);

  const totalDividendsDistributed = useMemo(() => filteredDividends.filter(d => d.status === 'approved').reduce((sum, d) => sum + d.amount, 0), [filteredDividends]);
  const averageDividendPerShare = useMemo(() => {
    const approvedDividends = filteredDividends.filter(d => d.status === 'approved');
    const totalAmount = approvedDividends.reduce((sum, d) => sum + d.amount, 0);
    const totalShares = approvedDividends.reduce((sum, d) => sum + d.shareCountAtDistribution, 0);
    return totalShares > 0 ? totalAmount / totalShares : 0;
  }, [filteredDividends]);

  const getStatusBadgeVariant = (status: 'pending' | 'approved' | 'rejected') => {
    switch (status) {
        case 'pending': return 'secondary';
        case 'approved': return 'default';
        case 'rejected': return 'destructive';
        default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Dividend Distribution" subtitle="Manage and record dividend payouts to members.">
        <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
          <PlusCircle className="mr-2 h-5 w-5" /> Distribute Dividends
        </Button>
      </PageTitle>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Approved Dividends Distributed</ShadcnCardTitle>
                <LucideLandmark className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">${totalDividendsDistributed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Avg. Dividend Per Share (Approved)</ShadcnCardTitle>
                <TrendingUp className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">${averageDividendPerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
            aria-label="Search dividend records"
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
              <TableHead>Member Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Dividend Amount</TableHead>
              <TableHead className="text-right">Shares Held</TableHead>
              <TableHead>Distribution Date</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDividends.length > 0 ? filteredDividends.map(dividend => (
               <TableRow key={dividend.id} className={dividend.status === 'pending' ? 'bg-yellow-500/10' : dividend.status === 'rejected' ? 'bg-red-500/10' : ''}>
                <TableCell className="font-medium">{dividend.memberName || members.find(m => m.id === dividend.memberId)?.fullName}</TableCell>
                <TableCell><Badge variant={getStatusBadgeVariant(dividend.status)}>{dividend.status.charAt(0).toUpperCase() + dividend.status.slice(1)}</Badge></TableCell>
                <TableCell className="text-right font-semibold">${dividend.amount.toFixed(2)}</TableCell>
                <TableCell className="text-right">{dividend.shareCountAtDistribution}</TableCell>
                <TableCell>{new Date(dividend.distributionDate).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                   <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditModal(dividend)} disabled={dividend.status === 'approved'}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(dividend.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No dividend records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
       {filteredDividends.length > 10 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline">Load More</Button>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Dividend Record' : 'Distribute New Dividend'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update this dividend distribution. This will require re-approval.' : 'Enter details for new dividend distribution to be sent for approval.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="memberId">Member</Label>
              <Select name="memberId" value={currentDividend.memberId || ''} onValueChange={(value) => handleSelectChange('memberId', value)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(member => (
                    <SelectItem key={member.id} value={member.id}>{member.fullName} ({member.savingsAccountNumber || 'No Acct #'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="shareCountAtDistribution">Shares Held at Distribution</Label>
              <Input id="shareCountAtDistribution" name="shareCountAtDistribution" type="number" step="1" placeholder="0" value={currentDividend.shareCountAtDistribution || ''} onChange={handleInputChange} required readOnly />
            </div>
            <div>
              <Label htmlFor="amount">Dividend Amount ($)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" value={currentDividend.amount || ''} onChange={handleInputChange} required />
            </div>
            <div>
              <Label htmlFor="distributionDate">Distribution Date</Label>
              <Input id="distributionDate" name="distributionDate" type="date" value={currentDividend.distributionDate || ''} onChange={handleInputChange} required />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Submit for Approval'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    