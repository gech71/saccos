
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { mockMembers, mockSchools, mockShares, mockSavings, mockShareTypes } from '@/data/mock';
import type { Member, School, Share, Saving, ShareType, MemberShareCommitment } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { differenceInMonths, parseISO, format } from 'date-fns';
import { Search, Filter, SchoolIcon, Edit, ListChecks, DollarSign, UploadCloud, Banknote, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';

interface OverdueShareDetail {
  shareTypeId: string;
  shareTypeName: string;
  monthlyCommittedAmount: number;
  totalExpectedContribution: number;
  totalAllocatedValue: number;
  overdueAmount: number;
}

interface OverdueMemberInfo {
  memberId: string;
  fullName: string;
  schoolName?: string;
  schoolId: string;
  joinDate: string;
  expectedMonthlySaving: number;
  savingsBalance: number;
  overdueSavingsAmount: number;
  overdueSharesDetails: OverdueShareDetail[];
  hasAnyOverdue: boolean;
  shareCommitments?: MemberShareCommitment[];
  sharesCount: number;
}

interface PaymentFormState {
  savingsAmount: number;
  shareAmounts: Record<string, number>; // Key: shareTypeId, Value: amount for that share type
  date: string;
  depositMode: 'Cash' | 'Bank' | 'Wallet';
  paymentDetails: {
    sourceName: string;
    transactionReference: string;
    evidenceUrl: string;
  };
}

const initialPaymentFormState: PaymentFormState = {
  savingsAmount: 0,
  shareAmounts: {},
  date: new Date().toISOString().split('T')[0],
  depositMode: 'Cash',
  paymentDetails: {
    sourceName: '',
    transactionReference: '',
    evidenceUrl: '',
  },
};

export default function OverduePaymentsPage() {
  const [allMembers, setAllMembers] = useState<Member[]>(mockMembers);
  const [allSchools] = useState<School[]>(mockSchools);
  const [allShares, setAllShares] = useState<Share[]>(mockShares);
  const [allSavings, setAllSavings] = useState<Saving[]>(mockSavings);
  const [allShareTypes] = useState<ShareType[]>(mockShareTypes);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const { toast } = useToast();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedOverdueMemberForPayment, setSelectedOverdueMemberForPayment] = useState<OverdueMemberInfo | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(initialPaymentFormState);


  const overdueMembersData = useMemo((): OverdueMemberInfo[] => {
    const currentDate = new Date();
    return allMembers
      .map(member => {
        const joinDate = parseISO(member.joinDate);
        let contributionPeriods = 0;
        if (joinDate <= currentDate) {
          contributionPeriods = differenceInMonths(currentDate, joinDate) + 1;
        }
        contributionPeriods = Math.max(0, contributionPeriods);

        const expectedMonthlySaving = member.expectedMonthlySaving || 0;
        const totalExpectedSavings = expectedMonthlySaving * contributionPeriods;
        const memberSavingsBalance = member.savingsBalance;
        const overdueSavingsAmount = Math.max(0, totalExpectedSavings - memberSavingsBalance);

        const overdueSharesDetails: OverdueShareDetail[] = (member.shareCommitments || [])
          .map(commitment => {
            const shareType = allShareTypes.find(st => st.id === commitment.shareTypeId);
            if (!shareType || (commitment.monthlyCommittedAmount || 0) === 0) {
                return null;
            }

            const monthlyCommitted = commitment.monthlyCommittedAmount || 0;
            const totalExpectedShareContributionForType = monthlyCommitted * contributionPeriods;
            
            const memberSharesOfType = allShares.filter(
              s => s.memberId === member.id && s.shareTypeId === commitment.shareTypeId
            );
            const totalAllocatedValueForShareType = memberSharesOfType.reduce(
              (sum, s) => sum + (s.totalValueForAllocation || (s.count * s.valuePerShare)),
              0
            );
            
            const overdueAmount = Math.max(0, totalExpectedShareContributionForType - totalAllocatedValueForShareType);
            
            if (overdueAmount > 0) {
                return {
                  shareTypeId: commitment.shareTypeId,
                  shareTypeName: commitment.shareTypeName || shareType.name,
                  monthlyCommittedAmount: monthlyCommitted,
                  totalExpectedContribution: totalExpectedShareContributionForType,
                  totalAllocatedValue: totalAllocatedValueForShareType,
                  overdueAmount,
                };
            }
            return null;
          })
          .filter((detail): detail is OverdueShareDetail => detail !== null);
          
        const hasAnyOverdue = overdueSavingsAmount > 0 || overdueSharesDetails.some(s => s.overdueAmount > 0);

        return {
          memberId: member.id,
          fullName: member.fullName,
          schoolName: member.schoolName || allSchools.find(s => s.id === member.schoolId)?.name,
          schoolId: member.schoolId,
          joinDate: member.joinDate,
          expectedMonthlySaving: member.expectedMonthlySaving || 0,
          savingsBalance: member.savingsBalance,
          overdueSavingsAmount,
          overdueSharesDetails,
          hasAnyOverdue,
          shareCommitments: member.shareCommitments,
          sharesCount: member.sharesCount,
        };
      })
      .filter(memberInfo => memberInfo.hasAnyOverdue);
  }, [allMembers, allShares, allSavings, allShareTypes, allSchools]);


  const filteredOverdueMembers = useMemo(() => {
    return overdueMembersData.filter(member => {
      const matchesSearchTerm = member.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || member.schoolId === selectedSchoolFilter;
      return matchesSearchTerm && matchesSchoolFilter;
    });
  }, [overdueMembersData, searchTerm, selectedSchoolFilter]);
  
  
  const handleOpenPaymentModal = (member: OverdueMemberInfo) => {
    setSelectedOverdueMemberForPayment(member);
    const initialShareAmounts: Record<string, number> = {};
    member.overdueSharesDetails.forEach(detail => {
        initialShareAmounts[detail.shareTypeId] = detail.overdueAmount;
    });
    setPaymentForm({
        savingsAmount: member.overdueSavingsAmount,
        shareAmounts: initialShareAmounts,
        date: new Date().toISOString().split('T')[0],
        depositMode: 'Cash',
        paymentDetails: { sourceName: '', transactionReference: '', evidenceUrl: '' },
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentFormInputChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string, shareTypeId?: string) => {
    const { value } = e.target;

    if (fieldName === 'savingsAmount') {
      setPaymentForm(prev => ({ ...prev, savingsAmount: parseFloat(value) || 0 }));
    } else if (fieldName === 'shareAmount' && shareTypeId) {
      setPaymentForm(prev => ({
        ...prev,
        shareAmounts: { ...prev.shareAmounts, [shareTypeId]: parseFloat(value) || 0 },
      }));
    } else if (fieldName === 'date') {
      setPaymentForm(prev => ({ ...prev, date: value }));
    } else if (fieldName.startsWith('paymentDetails.')) {
      const detailKey = fieldName.split('.')[1] as keyof PaymentFormState['paymentDetails'];
      setPaymentForm(prev => ({
        ...prev,
        paymentDetails: { ...prev.paymentDetails, [detailKey]: value },
      }));
    }
  };
  
  const handlePaymentDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setPaymentForm(prev => ({
      ...prev,
      depositMode: value,
      paymentDetails: value === 'Cash' ? { sourceName: '', transactionReference: '', evidenceUrl: '' } : prev.paymentDetails,
    }));
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOverdueMemberForPayment) return;

    const { savingsAmount, shareAmounts, date, depositMode, paymentDetails } = paymentForm;
    const totalPaymentMade = savingsAmount + Object.values(shareAmounts).reduce((sum, amt) => sum + amt, 0);

    if (totalPaymentMade <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Total payment amount must be positive.' });
      return;
    }
    if ((depositMode === 'Bank' || depositMode === 'Wallet') && !paymentDetails.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${depositMode} Name.` });
        return;
    }

    const dateObj = new Date(date);
    const monthYear = format(dateObj, 'MMMM yyyy');
    let toastMessages: string[] = [];

    // Process Savings Payment
    if (savingsAmount > 0) {
      const newSaving: Saving = {
        id: `saving-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        memberId: selectedOverdueMemberForPayment.memberId,
        memberName: selectedOverdueMemberForPayment.fullName,
        amount: savingsAmount,
        date: date,
        month: monthYear,
        transactionType: 'deposit',
        depositMode: depositMode,
        paymentDetails: depositMode === 'Cash' ? undefined : paymentDetails,
      };
      setAllSavings(prev => [...prev, newSaving]);
      setAllMembers(prev => prev.map(m => 
        m.id === selectedOverdueMemberForPayment.memberId 
        ? { ...m, savingsBalance: m.savingsBalance + savingsAmount } 
        : m
      ));
      toastMessages.push(`$${savingsAmount.toFixed(2)} for savings`);
    }

    // Process Share Payments
    Object.entries(shareAmounts).forEach(([shareTypeId, amount]) => {
      if (amount > 0) {
        const shareType = allShareTypes.find(st => st.id === shareTypeId);
        if (!shareType) {
          console.error(`Share type ${shareTypeId} not found during payment processing.`);
          return; 
        }
        const sharesToAllocate = Math.floor(amount / shareType.valuePerShare);
        if (sharesToAllocate > 0) {
          const totalValueForAllocation = sharesToAllocate * shareType.valuePerShare;
          const newShare: Share = {
            id: `share-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            memberId: selectedOverdueMemberForPayment.memberId,
            memberName: selectedOverdueMemberForPayment.fullName,
            shareTypeId: shareType.id,
            shareTypeName: shareType.name,
            count: sharesToAllocate,
            allocationDate: date,
            valuePerShare: shareType.valuePerShare,
            contributionAmount: amount,
            totalValueForAllocation,
            depositMode: depositMode,
            paymentDetails: depositMode === 'Cash' ? undefined : paymentDetails,
          };
          setAllShares(prev => [...prev, newShare]);
          setAllMembers(prev => prev.map(m => 
            m.id === selectedOverdueMemberForPayment.memberId 
            ? { ...m, sharesCount: (m.sharesCount || 0) + sharesToAllocate } 
            : m
          ));
          toastMessages.push(`${sharesToAllocate} ${shareType.name}(s) (valued at $${totalValueForAllocation.toFixed(2)} from $${amount.toFixed(2)} contribution)`);
        } else {
          toastMessages.push(`$${amount.toFixed(2)} for ${shareType.name} (insufficient for one share)`);
        }
      }
    });
    
    let finalToastMessage = `Payment recorded for ${selectedOverdueMemberForPayment.fullName}.`;
    if(toastMessages.length > 0) {
        finalToastMessage += ` Details: ${toastMessages.join(', ')}.`;
    }

    toast({ title: 'Success', description: finalToastMessage });
    setIsPaymentModalOpen(false);
    setPaymentForm(initialPaymentFormState);
    setSelectedOverdueMemberForPayment(null);
  };
  
  const totalOverdueSavings = useMemo(() => {
    return filteredOverdueMembers.reduce((sum, member) => sum + member.overdueSavingsAmount, 0);
  }, [filteredOverdueMembers]);

  const totalOverdueSharesValue = useMemo(() => {
    return filteredOverdueMembers.reduce((sum, member) => {
      return sum + member.overdueSharesDetails.reduce((shareSum, detail) => shareSum + detail.overdueAmount, 0);
    }, 0);
  }, [filteredOverdueMembers]);


  return (
    <div className="space-y-6">
      <PageTitle title="Overdue Payments" subtitle="Track and manage members with outstanding savings or share contributions.">
      </PageTitle>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Members with Overdue Payments</CardTitle>
                <ListChecks className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">{filteredOverdueMembers.length}</div>
            </CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Overdue Savings (in view)</CardTitle>
                <DollarSign className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">${totalOverdueSavings.toFixed(2)}</div>
            </CardContent>
        </Card>
         <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Overdue Shares Value (in view)</CardTitle>
                <DollarSign className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-destructive">${totalOverdueSharesValue.toFixed(2)}</div>
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
            aria-label="Search overdue members"
          />
        </div>
        <Select value={selectedSchoolFilter} onValueChange={setSelectedSchoolFilter}>
          <SelectTrigger className="w-full sm:w-[220px]" aria-label="Filter by school">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground md:hidden" />
            <SchoolIcon className="mr-2 h-4 w-4 text-muted-foreground hidden md:inline" />
            <SelectValue placeholder="Filter by school" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {allSchools.map(school => (
              <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="overflow-x-auto rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member Name</TableHead>
              <TableHead>School</TableHead>
              <TableHead className="text-right text-destructive">Overdue Savings ($)</TableHead>
              <TableHead className="text-left">Overdue Shares Details</TableHead>
              <TableHead className="text-center w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOverdueMembers.length > 0 ? filteredOverdueMembers.map(member => (
              <TableRow key={member.memberId} className={member.hasAnyOverdue ? 'bg-destructive/5 hover:bg-destructive/10' : ''}>
                <TableCell className="font-medium">{member.fullName}</TableCell>
                <TableCell>{member.schoolName}</TableCell>
                <TableCell className="text-right font-semibold text-destructive">
                  {member.overdueSavingsAmount > 0 ? `$${member.overdueSavingsAmount.toFixed(2)}` : <span className="text-muted-foreground/70">-</span>}
                </TableCell>
                <TableCell>
                  {member.overdueSharesDetails.length > 0 ? (
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                      {member.overdueSharesDetails.map(detail => (
                        <li key={detail.shareTypeId}>
                          <span className="font-medium">{detail.shareTypeName}</span>: <span className="text-destructive font-semibold">${detail.overdueAmount.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <span className="text-muted-foreground/70">-</span>}
                </TableCell>
                <TableCell className="text-center">
                  {member.hasAnyOverdue && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenPaymentModal(member)}
                      className="border-primary text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <Edit className="mr-1.5 h-3.5 w-3.5" />
                      Record Payment
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No overdue payments found matching your criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
       {filteredOverdueMembers.length > 10 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline">Load More Members</Button>
        </div>
      )}

      {/* Payment Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-headline">Record Payment for {selectedOverdueMemberForPayment?.fullName}</DialogTitle>
            <DialogDescription>
              Enter payment amounts for overdue savings and/or shares.
            </DialogDescription>
          </DialogHeader>
          {selectedOverdueMemberForPayment && (
            <form onSubmit={handleSubmitPayment} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
              
              {selectedOverdueMemberForPayment.overdueSavingsAmount > 0 && (
                <div className="p-3 border rounded-md bg-background shadow-sm">
                  <Label htmlFor="savingsAmount" className="font-semibold text-primary">Savings Payment</Label>
                  <p className="text-xs text-muted-foreground mb-1">Overdue: ${selectedOverdueMemberForPayment.overdueSavingsAmount.toFixed(2)}</p>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="savingsAmount" 
                        name="savingsAmount" 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        value={paymentForm.savingsAmount || ''} 
                        onChange={(e) => handlePaymentFormInputChange(e, 'savingsAmount')} 
                        className="pl-7"
                    />
                  </div>
                </div>
              )}

              {selectedOverdueMemberForPayment.overdueSharesDetails.length > 0 && (
                <div className="space-y-3 p-3 border rounded-md bg-background shadow-sm">
                  <Label className="font-semibold text-primary">Share Payments</Label>
                  {selectedOverdueMemberForPayment.overdueSharesDetails.map(detail => (
                    <div key={detail.shareTypeId} className="ml-1 pl-2 border-l-2 border-accent/50">
                      <Label htmlFor={`shareAmount-${detail.shareTypeId}`}>{detail.shareTypeName}</Label>
                      <p className="text-xs text-muted-foreground mb-1">Overdue: ${detail.overdueAmount.toFixed(2)}</p>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={`shareAmount-${detail.shareTypeId}`}
                          name="shareAmount"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={paymentForm.shareAmounts[detail.shareTypeId] || ''}
                          onChange={(e) => handlePaymentFormInputChange(e, 'shareAmount', detail.shareTypeId)}
                          className="pl-7"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <Separator className="my-4"/>

              <div className="grid grid-cols-1 gap-4">
                 <div>
                    <Label htmlFor="date">Payment Date</Label>
                    <Input id="date" name="date" type="date" value={paymentForm.date} onChange={(e) => handlePaymentFormInputChange(e, 'date')} required />
                </div>
              </div>

              <div>
                <Label>Deposit Mode</Label>
                <RadioGroup value={paymentForm.depositMode} onValueChange={handlePaymentDepositModeChange} className="flex space-x-4 pt-2">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="payCash" /><Label htmlFor="payCash">Cash</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="payBank" /><Label htmlFor="payBank">Bank</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="Wallet" id="payWallet" /><Label htmlFor="payWallet">Wallet</Label></div>
                </RadioGroup>
              </div>

              {(paymentForm.depositMode === 'Bank' || paymentForm.depositMode === 'Wallet') && (
                <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
                    <div>
                      <Label htmlFor="paymentDetails.sourceName">{paymentForm.depositMode} Name</Label>
                       <div className="relative">
                        {paymentForm.depositMode === 'Bank' && <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                        {paymentForm.depositMode === 'Wallet' && <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                        <Input id="paymentDetails.sourceName" name="paymentDetails.sourceName" placeholder={`Enter ${paymentForm.depositMode} Name`} value={paymentForm.paymentDetails.sourceName} onChange={(e) => handlePaymentFormInputChange(e, 'paymentDetails.sourceName')} className="pl-8" />
                       </div>
                    </div>
                    <div>
                      <Label htmlFor="paymentDetails.transactionReference">Transaction Reference</Label>
                      <Input id="paymentDetails.transactionReference" name="paymentDetails.transactionReference" placeholder="e.g., TRN123XYZ" value={paymentForm.paymentDetails.transactionReference} onChange={(e) => handlePaymentFormInputChange(e, 'paymentDetails.transactionReference')} />
                    </div>
                  </div>
                  <div className="pl-3">
                    <Label htmlFor="paymentDetails.evidenceUrl">Evidence Attachment</Label>
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
                        id="paymentDetails.evidenceUrl"
                        name="paymentDetails.evidenceUrl"
                        placeholder="Enter URL or filename for reference"
                        value={paymentForm.paymentDetails.evidenceUrl}
                        onChange={(e) => handlePaymentFormInputChange(e, 'paymentDetails.evidenceUrl')}
                        className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Actual file upload is not functional. Enter a reference URL or filename above.</p>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-6">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit">Record Payment</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

