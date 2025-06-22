

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Search, Filter, PieChart as LucidePieChart, DollarSign, Banknote, Wallet, UploadCloud } from 'lucide-react';
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
import { mockShares, mockMembers, mockShareTypes } from '@/data/mock';
import type { Share, Member, ShareType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle as ShadcnCardTitle } from '@/components/ui/card';
import { differenceInMonths } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';

// Adjusted initial state: remove count, add contributionAmount
const initialShareFormState: Partial<Omit<Share, 'id' | 'count'>> & { contributionAmount?: number } = {
  memberId: '',
  shareTypeId: '',
  contributionAmount: 0,
  allocationDate: new Date().toISOString().split('T')[0],
  valuePerShare: 0, // This will be derived from shareTypeId
  depositMode: 'Cash',
  paymentDetails: {
    sourceName: '',
    transactionReference: '',
    evidenceUrl: '',
  }
};

export default function SharesPage() {
  const [shares, setShares] = useState<Share[]>(mockShares);
  const [members, setMembersState] = useState<Member[]>(mockMembers);
  const [shareTypes, setShareTypesState] = useState<ShareType[]>(mockShareTypes);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentShare, setCurrentShare] = useState<Partial<Omit<Share, 'id' | 'count' | 'paymentDetails' | 'status'>> & { contributionAmount?: number, paymentDetails?: Share['paymentDetails'] }>(initialShareFormState);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const { toast } = useToast();
  const [calculatedShares, setCalculatedShares] = useState(0);

  useEffect(() => {
    const { contributionAmount, valuePerShare } = currentShare;
    const newCalculatedShares = (valuePerShare && valuePerShare > 0 && contributionAmount && contributionAmount > 0)
        ? Math.floor(contributionAmount / valuePerShare)
        : 0;
    setCalculatedShares(newCalculatedShares);
  }, [currentShare.contributionAmount, currentShare.valuePerShare]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nameParts = name.split('.');

    if (nameParts.length > 1 && nameParts[0] === 'paymentDetails') {
        const fieldName = nameParts[1] as keyof NonNullable<Share['paymentDetails']>;
        setCurrentShare(prev => ({
            ...prev,
            paymentDetails: {
                ...(prev?.paymentDetails || { sourceName: '', transactionReference: '', evidenceUrl: ''}),
                [fieldName]: value,
            }
        }));
    } else if (name === 'contributionAmount') {
        setCurrentShare(prev => ({ ...prev, contributionAmount: parseFloat(value) || 0 }));
    } else {
        setCurrentShare(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name: keyof (Omit<Share, 'id' | 'count'> & { contributionAmount?: number }), value: string) => {
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
    setCurrentShare(prev => ({
      ...prev,
      depositMode: value,
      paymentDetails: value === 'Cash' ? undefined : (prev.paymentDetails || { sourceName: '', transactionReference: '', evidenceUrl: '' }),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShare.memberId || !currentShare.shareTypeId || !currentShare.contributionAmount || currentShare.contributionAmount <= 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a member, share type, and enter a valid contribution amount.' });
        return;
    }
    if (calculatedShares <= 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Contribution amount is not enough to allocate any shares.' });
        return;
    }
    if ((currentShare.depositMode === 'Bank' || currentShare.depositMode === 'Wallet') && !currentShare.paymentDetails?.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${currentShare.depositMode} Name.` });
        return;
    }
    
    const selectedType = shareTypes.find(st => st.id === currentShare.shareTypeId);
    if (!selectedType) {
        toast({ variant: 'destructive', title: 'Error', description: 'Invalid share type selected.'});
        return;
    }

    const memberName = members.find(m => m.id === currentShare.memberId)?.fullName;
    const totalValueForAllocation = calculatedShares * selectedType.valuePerShare;

    let shareDataToSave: Omit<Share, 'id'> & { id?: string } = {
        memberId: currentShare.memberId!,
        memberName,
        shareTypeId: currentShare.shareTypeId!,
        shareTypeName: selectedType.name,
        count: calculatedShares,
        status: 'pending',
        allocationDate: currentShare.allocationDate || new Date().toISOString().split('T')[0],
        valuePerShare: selectedType.valuePerShare,
        contributionAmount: currentShare.contributionAmount,
        totalValueForAllocation: totalValueForAllocation,
        depositMode: currentShare.depositMode,
        paymentDetails: currentShare.depositMode === 'Cash' ? undefined : currentShare.paymentDetails,
    };


    if (isEditing && currentShare.id) {
      shareDataToSave.id = currentShare.id;
      setShares(prev => prev.map(s => s.id === shareDataToSave.id ? shareDataToSave as Share : s));
      toast({ title: 'Success', description: `Share record for ${memberName} updated and is pending re-approval.` });
    } else {
      shareDataToSave.id = `share-${Date.now()}`;
      setShares(prev => [shareDataToSave as Share, ...prev]);
      toast({ title: 'Submitted for Approval', description: `${calculatedShares} share(s) allocation for ${memberName} submitted.` });
    }
    
    setIsModalOpen(false);
    setCurrentShare(initialShareFormState);
    setCalculatedShares(0);
    setIsEditing(false);
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
      paymentDetails: share.paymentDetails || initialShareFormState.paymentDetails,
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = (shareId: string) => {
     if (window.confirm('Are you sure you want to delete this share record? This also adjusts member total shares.')) {
        const shareToDelete = shares.find(s => s.id === shareId);
        setShares(prev => prev.filter(s => s.id !== shareId));
        
        if (shareToDelete && shareToDelete.status === 'approved') {
            setMembersState(prevMembers => prevMembers.map(mem => {
                if (mem.id === shareToDelete.memberId) {
                    return { ...mem, sharesCount: Math.max(0, mem.sharesCount - shareToDelete.count) };
                }
                return mem;
            }));
        }
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


  return (
    <div className="space-y-6">
      <PageTitle title="Share Contribution & Allocation" subtitle="Record member share contributions and manage allocations.">
        <Button onClick={openAddModal} className="shadow-md hover:shadow-lg transition-shadow">
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
              <TableHead>Member Name</TableHead>
              <TableHead>Share Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Share Count</TableHead>
              <TableHead className="text-right">Value per Share</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
              <TableHead className="text-right">Monthly Committed ($)</TableHead>
              <TableHead className="text-right">Total Exp. Contrib. ($)</TableHead>
              <TableHead className="text-center w-[150px]">Fulfillment %</TableHead>
              <TableHead>Allocation Date</TableHead>
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredShares.length > 0 ? filteredShares.map(share => {
              const member = members.find(m => m.id === share.memberId);
              const commitment = member?.shareCommitments?.find(sc => sc.shareTypeId === share.shareTypeId);
              const monthlyCommittedAmount = commitment?.monthlyCommittedAmount || 0;
              
              let totalExpectedContribution = 0;
              let fulfillmentPercentage = 0;
              const currentAllocationValue = share.totalValueForAllocation || (share.count * share.valuePerShare);

              if (member && monthlyCommittedAmount > 0) {
                const joinDate = new Date(member.joinDate);
                const currentDate = new Date();
                let contributionPeriods = 0;
                if (joinDate <= currentDate) {
                    contributionPeriods = differenceInMonths(currentDate, joinDate) + 1;
                }
                contributionPeriods = Math.max(0, contributionPeriods);
                totalExpectedContribution = monthlyCommittedAmount * contributionPeriods;
                
                if (totalExpectedContribution > 0) {
                    fulfillmentPercentage = (currentAllocationValue / totalExpectedContribution) * 100;
                }
              }

              return (
                <TableRow key={share.id} className={share.status === 'pending' ? 'bg-yellow-500/10' : share.status === 'rejected' ? 'bg-red-500/10' : ''}>
                  <TableCell className="font-medium">{share.memberName || member?.fullName}</TableCell>
                  <TableCell><Badge variant="outline">{share.shareTypeName || shareTypes.find(st => st.id === share.shareTypeId)?.name}</Badge></TableCell>
                  <TableCell><Badge variant={getStatusBadgeVariant(share.status)}>{share.status.charAt(0).toUpperCase() + share.status.slice(1)}</Badge></TableCell>
                  <TableCell className="text-right">{share.count}</TableCell>
                  <TableCell className="text-right">${share.valuePerShare.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-semibold">${currentAllocationValue.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${monthlyCommittedAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${totalExpectedContribution.toFixed(2)}</TableCell>
                   <TableCell className="text-center">
                    {totalExpectedContribution > 0 && monthlyCommittedAmount > 0 ? (
                        <div className="flex flex-col items-center">
                            <Progress value={Math.min(100, fulfillmentPercentage)} className="h-2 w-full" />
                            <span className="text-xs mt-1">{Math.min(100, Math.max(0, fulfillmentPercentage)).toFixed(1)}%</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                    )}
                  </TableCell>
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
                        <DropdownMenuItem onClick={() => openEditModal(share)} disabled={share.status === 'approved'}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(share.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center">
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
              <Select name="memberId" value={currentShare.memberId || ''} onValueChange={(value) => handleSelectChange('memberId', value)} required>
                <SelectTrigger id="memberIdShare"><SelectValue placeholder="Select a member" /></SelectTrigger>
                <SelectContent>{members.map(member => (<SelectItem key={member.id} value={member.id}>{member.fullName}</SelectItem>))}</SelectContent>
              </Select>
            </div>
             <div>
              <Label htmlFor="shareTypeIdShare">Share Type</Label>
              <Select name="shareTypeId" value={currentShare.shareTypeId || ''} onValueChange={(value) => handleSelectChange('shareTypeId', value)} required>
                <SelectTrigger id="shareTypeIdShare"><SelectValue placeholder="Select share type" /></SelectTrigger>
                <SelectContent>{shareTypes.map(st => (<SelectItem key={st.id} value={st.id}>{st.name} (${st.valuePerShare.toFixed(2)}/share)</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="valuePerShareShare">Value per Share ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="valuePerShareShare" name="valuePerShare" type="number" value={currentShare.valuePerShare || ''} readOnly className="pl-7 bg-muted/50" />
              </div>
            </div>
            <div>
              <Label htmlFor="contributionAmountShare">Contribution Amount ($)</Label>
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
                    <p>Total value of allocated shares: <strong className="text-primary">${(calculatedShares * (currentShare.valuePerShare || 0)).toFixed(2)}</strong></p>
                    {currentShare.contributionAmount! > (calculatedShares * (currentShare.valuePerShare || 0)) && calculatedShares > 0 &&
                        <p className="text-xs text-orange-600">Note: Remaining ${ (currentShare.contributionAmount! - (calculatedShares * (currentShare.valuePerShare || 0))).toFixed(2) } is not allocated as it's less than one share value.</p>
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
                            <Label htmlFor="paymentDetails.sourceNameShare">{currentShare.depositMode} Name</Label>
                            <div className="relative">
                                {currentShare.depositMode === 'Bank' && <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                {currentShare.depositMode === 'Wallet' && <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                <Input id="paymentDetails.sourceNameShare" name="paymentDetails.sourceName" placeholder={`Enter ${currentShare.depositMode} Name`} value={currentShare.paymentDetails?.sourceName || ''} onChange={handleInputChange} className="pl-8" />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="paymentDetails.transactionReferenceShare">Transaction Reference</Label>
                            <Input id="paymentDetails.transactionReferenceShare" name="paymentDetails.transactionReference" placeholder="e.g., TRN123XYZ" value={currentShare.paymentDetails?.transactionReference || ''} onChange={handleInputChange} />
                        </div>
                    </div>
                    <div className="pl-3">
                        <Label htmlFor="paymentDetails.evidenceUrlShare">Evidence Attachment</Label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md border-border hover:border-primary transition-colors">
                            <div className="space-y-1 text-center">
                                <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                                <div className="flex text-sm text-muted-foreground">
                                   <p className="pl-1">Upload a file or drag and drop</p>
                                </div>
                                <p className="text-xs text-muted-foreground">PNG, JPG, PDF up to 10MB (mock)</p>
                            </div>
                        </div>
                        <Input
                            id="paymentDetails.evidenceUrlShare"
                            name="paymentDetails.evidenceUrl"
                            placeholder="Enter URL or filename for reference"
                            value={currentShare.paymentDetails?.evidenceUrl || ''}
                            onChange={handleInputChange}
                            className="mt-2"
                        />
                         <p className="text-xs text-muted-foreground mt-1">Actual file upload is not functional. Enter a reference URL or filename above.</p>
                    </div>
                </div>
            )}

            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={calculatedShares <= 0 && (currentShare.contributionAmount || 0) > 0}>{isEditing ? 'Save Changes' : 'Submit for Approval'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
