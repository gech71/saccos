'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter, Landmark as LucideLandmark, TrendingUp, Check, ChevronsUpDown, FileDown, Loader2 } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle as ShadcnCardTitle } from '@/components/ui/card'; // Renamed to avoid conflict
import { cn } from '@/lib/utils';
import { exportToExcel } from '@/lib/utils';
import { StatCard } from '@/components/stat-card';
import { getDividendsPageData, addDividend, updateDividend, deleteDividend, type DividendsPageData, type DividendInput } from './actions';
import type { Dividend, Member } from '@prisma/client';

const initialDividendFormState: Partial<DividendInput> = {
  memberId: '',
  amount: 0,
  distributionDate: new Date().toISOString().split('T')[0],
  shareCountAtDistribution: 0,
};

export default function DividendsPage() {
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [members, setMembers] = useState<Pick<Member, 'id' | 'fullName' | 'sharesCount'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDividend, setCurrentDividend] = useState<Partial<DividendInput & { id?: string }>>(initialDividendFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);
  const { toast } = useToast();

  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null);
  const [loggedInMemberId, setLoggedInMemberId] = useState<string | null>(null);

  const fetchPageData = async () => {
    setIsLoading(true);
    try {
        const data = await getDividendsPageData();
        setDividends(data.dividends);
        setMembers(data.members);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load page data.' });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem('userRole') as 'admin' | 'member' | null;
    const memberId = localStorage.getItem('loggedInMemberId');
    setUserRole(role);
    setLoggedInMemberId(memberId);
    fetchPageData();
  }, [toast]);

  const memberTotalDividends = useMemo(() => {
    if (userRole === 'member' && loggedInMemberId) {
        return dividends
            .filter(d => d.memberId === loggedInMemberId && d.status === 'approved')
            .reduce((sum, d) => sum + d.amount, 0);
    }
    return 0;
  }, [userRole, loggedInMemberId, dividends]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentDividend(prev => ({ ...prev, [name]: name === 'amount' || name === 'shareCountAtDistribution' ? parseFloat(value) : value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setCurrentDividend(prev => ({ ...prev, [name]: value }));
    if (name === 'memberId') {
      const memberShares = members.find(m => m.id === value)?.sharesCount || 0;
      setCurrentDividend(prev => ({ ...prev, shareCountAtDistribution: memberShares }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDividend.memberId || !currentDividend.amount || currentDividend.amount <= 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a member and enter a valid dividend amount.' });
        return;
    }

    setIsSubmitting(true);
    try {
        if (isEditing && currentDividend.id) {
            await updateDividend(currentDividend.id, currentDividend as DividendInput);
            toast({ title: 'Dividend Updated', description: 'Dividend record updated and sent for re-approval.' });
        } else {
            await addDividend(currentDividend as DividendInput);
            toast({ title: 'Dividend Submitted', description: 'Dividend distribution sent for approval.' });
        }
        await fetchPageData();
        setIsModalOpen(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'An error occurred while saving the dividend.' });
    } finally {
        setIsSubmitting(false);
    }
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

  const handleDelete = async (dividendId: string) => {
     if (window.confirm('Are you sure you want to delete this dividend record?')) {
        const result = await deleteDividend(dividendId);
        if (result.success) {
            toast({ title: 'Success', description: result.message });
            await fetchPageData();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
    }
  };

  const filteredDividends = useMemo(() => {
    return dividends.filter(dividend => {
      if (userRole === 'member' && dividend.memberId !== loggedInMemberId) {
        return false;
      }
      const member = members.find(m => m.id === dividend.memberId);
      const matchesSearchTerm = userRole === 'admin' ? (member ? member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) : false) : true;
      const matchesMemberFilter = userRole === 'admin' ? (selectedMemberFilter === 'all' || dividend.memberId === selectedMemberFilter) : true;
      return matchesSearchTerm && matchesMemberFilter;
    });
  }, [dividends, members, searchTerm, selectedMemberFilter, userRole, loggedInMemberId]);

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

  const handleExport = () => {
    const dataToExport = filteredDividends.map(d => ({
        'Member Name': d.memberName || members.find(m => m.id === d.memberId)?.fullName || 'N/A',
        'Status': d.status,
        'Dividend Amount ($)': d.amount,
        'Shares Held': d.shareCountAtDistribution,
        'Distribution Date': new Date(d.distributionDate).toLocaleDateString(),
        'Notes': d.notes || '',
    }));
    exportToExcel(dataToExport, 'dividends_export');
  };

  return (
    <div className="space-y-6">
      <PageTitle title={userRole === 'member' ? 'My Dividends' : "Dividend Distribution"} subtitle={userRole === 'member' ? "View your dividend payout history" : "Manage and record dividend payouts to members."}>
        {userRole === 'admin' && (
          <>
            <Button onClick={handleExport} variant="outline" disabled={isLoading}>
                <FileDown className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow" disabled={isLoading}>
              <PlusCircle className="mr-2 h-5 w-5" /> Distribute Dividends
            </Button>
          </>
        )}
      </PageTitle>

      {userRole === 'member' && (
        <div className="mb-6">
            <StatCard
              title="My Total Dividends Received"
              value={`$${memberTotalDividends.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon={<TrendingUp className="h-6 w-6 text-accent" />}
              description="Sum of all approved dividend payouts."
            />
        </div>
      )}

      {userRole === 'admin' && (
        <>
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
        </>
      )}
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              {userRole === 'admin' && <TableHead>Member Name</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Dividend Amount</TableHead>
              <TableHead className="text-right">Shares Held</TableHead>
              <TableHead>Distribution Date</TableHead>
              {userRole === 'admin' && <TableHead className="text-right w-[120px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={userRole === 'admin' ? 6 : 5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredDividends.length > 0 ? filteredDividends.map(dividend => (
               <TableRow key={dividend.id} className={dividend.status === 'pending' ? 'bg-yellow-500/10' : dividend.status === 'rejected' ? 'bg-red-500/10' : ''}>
                {userRole === 'admin' && <TableCell className="font-medium">{dividend.memberName || members.find(m => m.id === dividend.memberId)?.fullName}</TableCell>}
                <TableCell><Badge variant={getStatusBadgeVariant(dividend.status)}>{dividend.status.charAt(0).toUpperCase() + dividend.status.slice(1)}</Badge></TableCell>
                <TableCell className="text-right font-semibold">${dividend.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right">{dividend.shareCountAtDistribution}</TableCell>
                <TableCell>{new Date(dividend.distributionDate).toLocaleDateString()}</TableCell>
                {userRole === 'admin' && <TableCell className="text-right">
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
                      <DropdownMenuItem onClick={() => handleDelete(dividend.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={dividend.status === 'approved'}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>}
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={userRole === 'admin' ? 6 : 5} className="h-24 text-center">
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
              <Popover open={openMemberCombobox} onOpenChange={setOpenMemberCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    id="memberId"
                    variant="outline"
                    role="combobox"
                    aria-expanded={openMemberCombobox}
                    className="w-full justify-between"
                  >
                    {currentDividend.memberId
                      ? members.find((member) => member.id === currentDividend.memberId)?.fullName
                      : "Select member..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search member..." />
                    <CommandList>
                      <CommandEmpty>No member found.</CommandEmpty>
                      <CommandGroup>
                        {members.map((member) => (
                          <CommandItem
                            key={member.id}
                            value={`${member.fullName} ${member.id}`}
                            onSelect={() => {
                              handleSelectChange('memberId', member.id);
                              setOpenMemberCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                currentDividend.memberId === member.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {member.fullName} (Shares: {member.sharesCount})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="shareCountAtDistribution">Shares Held at Distribution</Label>
              <Input id="shareCountAtDistribution" name="shareCountAtDistribution" type="number" step="1" placeholder="0" value={currentDividend.shareCountAtDistribution || ''} onChange={handleInputChange} required readOnly className="bg-muted/50" />
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
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Submit for Approval'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
