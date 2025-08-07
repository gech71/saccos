

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter, PieChart as LucidePieChart, DollarSign, Banknote, Wallet, Check, ChevronsUpDown, FileDown, Loader2 } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle as ShadcnCardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { exportToExcel } from '@/lib/utils';
import { StatCard } from '@/components/stat-card';
import { FileUpload } from '@/components/file-upload';
import { getSharesPageData, addShare, updateShare, deleteShare, type ShareInput } from './actions';
import type { Share, Member, ShareType } from '@prisma/client';

const initialShareFormState: Partial<ShareInput & {id?: string}> = {
  memberId: undefined,
  shareTypeId: undefined,
  contributionAmount: 0,
  allocationDate: new Date().toISOString().split('T')[0],
  depositMode: 'Cash',
  sourceName: '',
  transactionReference: '',
  evidenceUrl: '',
};

export default function SharesPage() {
  const [shares, setShares] = useState<Share[]>([]);
  const [members, setMembersState] = useState<Pick<Member, 'id' | 'fullName'>[]>([]);
  const [shareTypes, setShareTypesState] = useState<ShareType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [shareToDelete, setShareToDelete] = useState<string | null>(null);

  const [currentShare, setCurrentShare] = useState<Partial<ShareInput & { id?: string, valuePerShare?: number, shareTypeName?: string }>>(initialShareFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);
  const { toast } = useToast();
  const [calculatedShares, setCalculatedShares] = useState(0);
  
  const fetchPageData = async () => {
    setIsLoading(true);
    try {
        const data = await getSharesPageData();
        setShares(data.shares);
        setMembersState(data.members);
        setShareTypesState(data.shareTypes);
    } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load page data.' });
    } finally {
        setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchPageData();
  }, []);

  useEffect(() => {
    const { contributionAmount, valuePerShare } = currentShare;
    const newCalculatedShares = (valuePerShare && valuePerShare > 0 && contributionAmount && contributionAmount > 0)
        ? Math.floor(contributionAmount / valuePerShare)
        : 0;
    setCalculatedShares(newCalculatedShares);
  }, [currentShare.contributionAmount, currentShare.valuePerShare]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'contributionAmount') {
        setCurrentShare(prev => ({ ...prev, contributionAmount: parseFloat(value) || 0 }));
    } else {
        setCurrentShare(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name: keyof Share, value: string) => {
    const selectedType = shareTypes.find(st => st.id === value);
    const newValuePerShare = selectedType?.valuePerShare || 0;
    const shareTypeName = selectedType?.name || '';
    
    if (name === 'shareTypeId') {
        setCurrentShare(prev => ({ ...prev, shareTypeId: value, valuePerShare: newValuePerShare, shareTypeName }));
    } else {
        setCurrentShare(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleShareDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setCurrentShare(prev => ({ ...prev, depositMode: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShare.memberId || !currentShare.shareTypeId || !currentShare.contributionAmount || currentShare.contributionAmount <= 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a member, share type, and enter a valid contribution amount.' });
        return;
    }
    if (calculatedShares <= 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Contribution amount is not enough to allocate any shares.' });
        return;
    }
    if ((currentShare.depositMode === 'Bank' || currentShare.depositMode === 'Wallet') && !currentShare.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${currentShare.depositMode} Name.` });
        return;
    }
    
    setIsSubmitting(true);
    try {
        if (isEditing && currentShare.id) {
            await updateShare(currentShare.id, currentShare as ShareInput);
            toast({ title: 'Success', description: 'Share record updated and is pending re-approval.' });
        } else {
            await addShare(currentShare as ShareInput);
            toast({ title: 'Submitted for Approval', description: `${calculatedShares} share(s) allocation submitted.` });
        }
        await fetchPageData();
        setIsModalOpen(false);
    } catch(error) {
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
    } finally {
        setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setCurrentShare(initialShareFormState);
    setCalculatedShares(0);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (share: Share) => {
    setCurrentShare({
      ...share,
      contributionAmount: share.contributionAmount || (share.count * share.valuePerShare),
      allocationDate: share.allocationDate ? new Date(share.allocationDate).toISOString().split('T')[0] : '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!shareToDelete) return;
    const result = await deleteShare(shareToDelete);
    if (result.success) {
        toast({ title: 'Success', description: result.message });
        await fetchPageData();
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setShareToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const openDeleteDialog = (shareId: string) => {
    setShareToDelete(shareId);
    setIsDeleteDialogOpen(true);
  };

  const filteredShares = useMemo(() => {
    return shares.filter(share => {
      const member = members.find(m => m.id === share.memberId);
      if (!member) return false;
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearchTerm = (member.fullName.toLowerCase().includes(searchTermLower));
      const matchesMemberFilter = selectedMemberFilter === 'all' || share.memberId === selectedMemberFilter;
      return matchesSearchTerm && matchesMemberFilter;
    });
  }, [shares, members, searchTerm, selectedMemberFilter]);

  const totalSharesAllocated = useMemo(() => filteredShares.filter(s => s.status === 'approved').reduce((sum, s) => sum + s.count, 0), [filteredShares]);
  const totalSharesValue = useMemo(() => filteredShares.filter(s => s.status === 'approved').reduce((sum, s) => sum + (s.totalValueForAllocation || (s.count * s.valuePerShare)), 0), [filteredShares]);
  
  const getStatusBadgeVariant = (status: 'pending' | 'approved' | 'rejected') => {
    switch (status) {
        case 'pending': return 'secondary';
        case 'approved': return 'default';
        case 'rejected': return 'destructive';
        default: return 'outline';
    }
  };

  const handleExport = () => {
    const dataToExport = filteredShares.map(share => {
      const member = members.find(m => m.id === share.memberId);
      return {
        'Member Name': (share as any).memberName || member?.fullName || 'N/A',
        'Share Type': (share as any).shareTypeName || shareTypes.find(st => st.id === share.shareTypeId)?.name || 'N/A',
        'Status': share.status,
        'Share Count': share.count,
        'Value per Share (Birr)': share.valuePerShare,
        'Total Value (Birr)': share.totalValueForAllocation || (share.count * share.valuePerShare),
        'Contribution Amount (Birr)': share.contributionAmount,
        'Allocation Date': new Date(share.allocationDate).toLocaleDateString(),
        'Deposit Mode': share.depositMode || 'N/A',
      };
    });
    exportToExcel(dataToExport, 'shares_export');
  };

  return (
    <div className="space-y-6">
      <PageTitle title={"Share Contribution & Allocation"} subtitle={"Record member share contributions and manage allocations."}>
        <Button onClick={handleExport} variant="outline" disabled={isLoading}>
            <FileDown className="mr-2 h-4 w-4" /> Export
        </Button>
        <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow" disabled={isLoading}>
          <PlusCircle className="mr-2 h-5 w-5" /> Record Share Contribution
        </Button>
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Approved Shares (in view)</ShadcnCardTitle>
                <LucidePieChart className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">{totalSharesAllocated.toLocaleString()}</div>
            </CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Value of Approved Shares (in view)</ShadcnCardTitle>
                <DollarSign className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">{totalSharesValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</div>
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
              <TableHead>Member Name</TableHead>
              <TableHead>Share Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Share Count</TableHead>
              <TableHead className="text-right">Value per Share</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
              <TableHead>Allocation Date</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredShares.length > 0 ? filteredShares.map(share => {
              const currentAllocationValue = share.totalValueForAllocation || (share.count * share.valuePerShare);
              const shareWithDetails = share as any;
              return (
                <TableRow key={share.id} className={share.status === 'pending' ? 'bg-yellow-500/10' : share.status === 'rejected' ? 'bg-red-500/10' : ''}>
                  <TableCell className="font-medium">{shareWithDetails.memberName}</TableCell>
                  <TableCell><Badge variant="outline">{shareWithDetails.shareTypeName}</Badge></TableCell>
                  <TableCell><Badge variant={getStatusBadgeVariant(share.status)}>{share.status.charAt(0).toUpperCase() + share.status.slice(1)}</Badge></TableCell>
                  <TableCell className="text-right">{share.count}</TableCell>
                  <TableCell className="text-right">{share.valuePerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                  <TableCell className="text-right font-semibold">{currentAllocationValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                  <TableCell>{new Date(share.allocationDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <span className="sr-only">Open menu</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditModal(share)} disabled={share.status === 'approved'}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDeleteDialog(share.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10" disabled={share.status === 'approved'}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline">{isEditing ? 'Edit Share Record' : 'Record Share Contribution & Allocation'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update this share allocation.' : 'Enter monetary contribution to allocate shares. This will be sent for approval.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
            <div>
              <Label htmlFor="memberIdShare">Member</Label>
              <Popover open={openMemberCombobox} onOpenChange={setOpenMemberCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    id="memberIdShare"
                    variant="outline"
                    role="combobox"
                    aria-expanded={openMemberCombobox}
                    className="w-full justify-between"
                  >
                    {currentShare.memberId
                      ? members.find((member) => member.id === currentShare.memberId)?.fullName
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
                            value={`${member.fullName}`}
                            onSelect={() => {
                              handleSelectChange('memberId' as any, member.id);
                              setOpenMemberCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                currentShare.memberId === member.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {member.fullName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
             <div>
              <Label htmlFor="shareTypeIdShare">Share Type</Label>
              <Select name="shareTypeId" value={currentShare.shareTypeId} onValueChange={(value) => handleSelectChange('shareTypeId', value)} required>
                <SelectTrigger id="shareTypeIdShare"><SelectValue placeholder="Select share type" /></SelectTrigger>
                <SelectContent>{shareTypes.map(st => (<SelectItem key={st.id} value={st.id}>{st.name} ({st.valuePerShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr/share)</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="valuePerShareShare">Value per Share (Birr)</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="valuePerShareShare" name="valuePerShare" type="number" value={currentShare.valuePerShare || ''} readOnly className="pl-7 bg-muted/50" />
              </div>
            </div>
            <div>
              <Label htmlFor="contributionAmountShare">Contribution Amount (Birr)</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    id="contributionAmountShare" 
                    name="contributionAmount" 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    value={currentShare.contributionAmount || ''} 
                    onChange={handleInputChange} 
                    required 
                    className="pl-7"
                />
              </div>
            </div>
             {currentShare.contributionAmount! > 0 && currentShare.valuePerShare! > 0 && (
                <div className="text-sm text-muted-foreground p-2 border rounded-md bg-accent/10">
                    <p>This contribution will allocate approximately <strong className="text-primary">{calculatedShares}</strong> share(s).</p>
                    <p>Total value of allocated shares: <strong className="text-primary">{(calculatedShares * (currentShare.valuePerShare || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</strong></p>
                    {currentShare.contributionAmount! > (calculatedShares * (currentShare.valuePerShare || 0)) && calculatedShares > 0 &&
                        <p className="text-xs text-orange-600">Note: Remaining {(currentShare.contributionAmount! - (calculatedShares * (currentShare.valuePerShare || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr is not allocated as it's less than one share value.</p>
                    }
                </div>
            )}
            <div>
              <Label htmlFor="allocationDateShare">Allocation Date</Label>
              <Input id="allocationDateShare" name="allocationDate" type="date" value={currentShare.allocationDate || ''} onChange={handleInputChange} required />
            </div>

            <Separator />
            <div>
              <Label htmlFor="depositModeShare">Deposit Mode</Label>
              <RadioGroup id="depositModeShare" value={currentShare.depositMode || 'Cash'} onValueChange={handleShareDepositModeChange} className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="cashShare" /><Label htmlFor="cashShare">Cash</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="bankShare" /><Label htmlFor="bankShare">Bank</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="Wallet" id="walletShare" /><Label htmlFor="walletShare">Wallet</Label></div>
              </RadioGroup>
            </div>

            {(currentShare.depositMode === 'Bank' || currentShare.depositMode === 'Wallet') && (
                <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
                        <div>
                            <Label htmlFor="sourceName">Name</Label>
                            <Input id="sourceName" name="sourceName" placeholder={`Enter ${currentShare.depositMode} Name`} value={currentShare.sourceName || ''} onChange={handleInputChange} />
                        </div>
                        <div>
                            <Label htmlFor="transactionReference">Ref #</Label>
                            <Input id="transactionReference" name="transactionReference" placeholder="e.g., TRN123XYZ" value={currentShare.transactionReference || ''} onChange={handleInputChange} />
                        </div>
                    </div>
                    <div className="pl-3">
                         <FileUpload
                            id="evidenceUrl"
                            label="Evidence Attachment"
                            value={currentShare.evidenceUrl || ''}
                            onValueChange={(newValue) => {
                                setCurrentShare(prev => ({ ...prev, evidenceUrl: newValue }));
                            }}
                        />
                    </div>
                </div>
            )}

            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting || (calculatedShares <= 0 && (currentShare.contributionAmount || 0) > 0)}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Submit for Approval'}
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
              This action cannot be undone. This will permanently delete the share record.
              This is only possible for records that have not yet been approved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Yes, delete record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
