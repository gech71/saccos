
'use client';

import React, { useState, useMemo } from 'react';
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
import { mockMembers, mockSchools, mockAppliedServiceCharges, mockServiceChargeTypes } from '@/data/mock';
import type { Member, School, AppliedServiceCharge, ServiceChargeType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Search, Filter, PlusCircle, DollarSign, SchoolIcon, Edit, BarChartHorizontalBig, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle as ShadcnCardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';

interface MemberServiceChargeSummary {
  memberId: string;
  fullName: string;
  schoolName?: string;
  schoolId: string;
  totalApplied: number;
  totalPaid: number;
  totalPending: number;
  fulfillmentPercentage: number;
}

const initialApplyChargeFormState: Partial<Omit<AppliedServiceCharge, 'id' | 'memberName' | 'serviceChargeTypeName' | 'status'>> = {
    memberId: '',
    serviceChargeTypeId: '',
    amountCharged: 0,
    dateApplied: new Date().toISOString().split('T')[0],
    notes: '',
};

export default function AppliedServiceChargesPage() {
  const [allMembers, setAllMembers] = useState<Member[]>(mockMembers);
  const [allSchools] = useState<School[]>(mockSchools);
  const [appliedServiceCharges, setAppliedServiceCharges] = useState<AppliedServiceCharge[]>(mockAppliedServiceCharges);
  const [serviceChargeTypes] = useState<ServiceChargeType[]>(mockServiceChargeTypes);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const { toast } = useToast();

  const [isApplyChargeModalOpen, setIsApplyChargeModalOpen] = useState(false);
  const [applyChargeForm, setApplyChargeForm] = useState(initialApplyChargeFormState);


  const memberChargeSummaries = useMemo((): MemberServiceChargeSummary[] => {
    return allMembers.map(member => {
      const memberCharges = appliedServiceCharges.filter(asc => asc.memberId === member.id);
      const totalApplied = memberCharges.reduce((sum, asc) => sum + asc.amountCharged, 0);
      const totalPaid = memberCharges
        .filter(asc => asc.status === 'paid')
        .reduce((sum, asc) => sum + asc.amountCharged, 0);
      const totalPending = totalApplied - totalPaid; // Can also sum 'pending' status charges
      const fulfillmentPercentage = totalApplied > 0 ? (totalPaid / totalApplied) * 100 : 0;

      return {
        memberId: member.id,
        fullName: member.fullName,
        schoolName: member.schoolName || allSchools.find(s => s.id === member.schoolId)?.name,
        schoolId: member.schoolId,
        totalApplied,
        totalPaid,
        totalPending,
        fulfillmentPercentage,
      };
    });
  }, [allMembers, appliedServiceCharges, allSchools]);

  const filteredMemberSummaries = useMemo(() => {
    return memberChargeSummaries.filter(summary => {
      const matchesSearchTerm = summary.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || summary.schoolId === selectedSchoolFilter;
      return matchesSearchTerm && matchesSchoolFilter;
    });
  }, [memberChargeSummaries, searchTerm, selectedSchoolFilter]);

  const globalSummaryStats = useMemo(() => {
    const totalAppliedGlobal = filteredMemberSummaries.reduce((sum, m) => sum + m.totalApplied, 0);
    const totalPaidGlobal = filteredMemberSummaries.reduce((sum, m) => sum + m.totalPaid, 0);
    const totalPendingGlobal = filteredMemberSummaries.reduce((sum, m) => sum + m.totalPending, 0);
    return { totalAppliedGlobal, totalPaidGlobal, totalPendingGlobal };
  }, [filteredMemberSummaries]);


  const openApplyNewChargeModal = () => {
    setApplyChargeForm(initialApplyChargeFormState);
    setIsApplyChargeModalOpen(true);
  };

  const handleApplyChargeFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setApplyChargeForm(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyChargeSelectChange = (name: keyof typeof applyChargeForm, value: string) => {
     if (name === 'serviceChargeTypeId') {
        const selectedType = serviceChargeTypes.find(sct => sct.id === value);
        setApplyChargeForm(prev => ({ ...prev, serviceChargeTypeId: value, amountCharged: selectedType?.amount || 0 }));
    } else {
        setApplyChargeForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleApplyChargeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyChargeForm.memberId || !applyChargeForm.serviceChargeTypeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a member and a service charge type.' });
      return;
    }
    const selectedChargeType = serviceChargeTypes.find(sct => sct.id === applyChargeForm.serviceChargeTypeId);
    const member = allMembers.find(m => m.id === applyChargeForm.memberId);

    if (!selectedChargeType || !member) {
        toast({ variant: 'destructive', title: 'Error', description: 'Invalid member or service charge type selected.'});
        return;
    }

    const newAppliedCharge: AppliedServiceCharge = {
      id: `asc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      memberId: member.id,
      memberName: member.fullName,
      serviceChargeTypeId: selectedChargeType.id,
      serviceChargeTypeName: selectedChargeType.name,
      amountCharged: selectedChargeType.amount, // Amount is from the type definition
      dateApplied: applyChargeForm.dateApplied || new Date().toISOString().split('T')[0],
      status: 'pending',
      notes: applyChargeForm.notes,
    };
    setAppliedServiceCharges(prev => [newAppliedCharge, ...prev]);
    toast({ title: 'Service Charge Applied', description: `${selectedChargeType.name} for $${selectedChargeType.amount.toFixed(2)} applied to ${member.fullName}.` });
    setIsApplyChargeModalOpen(false);
    setApplyChargeForm(initialApplyChargeFormState);
  };

  // Placeholder for Record Payment Modal (to be implemented in next step)
  const handleOpenRecordPaymentModal = (memberSummary: MemberServiceChargeSummary) => {
    toast({title: "Not Implemented", description: `Record payment for ${memberSummary.fullName} is not yet implemented.`});
  };


  return (
    <div className="space-y-6">
      <PageTitle title="Applied Service Charges" subtitle="View, apply, and manage service charges for members.">
        <Button onClick={openApplyNewChargeModal} className="shadow-md hover:shadow-lg transition-shadow">
            <PlusCircle className="mr-2 h-5 w-5" /> Apply New Charge
        </Button>
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Applied Charges</ShadcnCardTitle>
                <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">${globalSummaryStats.totalAppliedGlobal.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Paid Charges</ShadcnCardTitle>
                <DollarSign className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">${globalSummaryStats.totalPaidGlobal.toFixed(2)}</div></CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Pending Charges</ShadcnCardTitle>
                <DollarSign className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-destructive">${globalSummaryStats.totalPendingGlobal.toFixed(2)}</div></CardContent>
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
            aria-label="Search members"
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
              <TableHead className="text-right">Total Applied ($)</TableHead>
              <TableHead className="text-right">Total Paid ($)</TableHead>
              <TableHead className="text-right text-destructive">Total Pending ($)</TableHead>
              <TableHead className="text-center w-[150px]">Fulfillment</TableHead>
              <TableHead className="text-center w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMemberSummaries.length > 0 ? filteredMemberSummaries.map(summary => (
              <TableRow key={summary.memberId} className={summary.totalPending > 0 ? 'bg-destructive/5 hover:bg-destructive/10' : ''}>
                <TableCell className="font-medium">{summary.fullName}</TableCell>
                <TableCell>{summary.schoolName}</TableCell>
                <TableCell className="text-right">${summary.totalApplied.toFixed(2)}</TableCell>
                <TableCell className="text-right text-green-600 font-semibold">${summary.totalPaid.toFixed(2)}</TableCell>
                <TableCell className="text-right text-destructive font-semibold">
                  {summary.totalPending > 0 ? `$${summary.totalPending.toFixed(2)}` : <span className="text-muted-foreground/70">-</span>}
                </TableCell>
                <TableCell className="text-center">
                    {summary.totalApplied > 0 ? (
                      <div className="flex flex-col items-center">
                        <Progress value={summary.fulfillmentPercentage} className="h-2 w-full" />
                        <span className="text-xs mt-1">{Math.min(100, Math.max(0, summary.fulfillmentPercentage)).toFixed(1)}%</span>
                      </div>
                    ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                    )}
                </TableCell>
                <TableCell className="text-center">
                  {summary.totalPending > 0 && (
                     <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenRecordPaymentModal(summary)}
                      className="border-primary text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <DollarSign className="mr-1.5 h-3.5 w-3.5" />
                      Record Payment
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No members found or no service charges applied yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
       {filteredMemberSummaries.length > 10 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline">Load More Members</Button>
        </div>
      )}

      {/* Apply New Charge Modal */}
      <Dialog open={isApplyChargeModalOpen} onOpenChange={setIsApplyChargeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline">Apply New Service Charge</DialogTitle>
            <DialogDescription>
              Select a member and a service charge type to apply.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApplyChargeSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="applyChargeMemberId">Member</Label>
              <Select name="memberId" value={applyChargeForm.memberId || ''} onValueChange={(value) => handleApplyChargeSelectChange('memberId', value)} required>
                <SelectTrigger id="applyChargeMemberId"><SelectValue placeholder="Select member" /></SelectTrigger>
                <SelectContent>{allMembers.map(m => (<SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="applyChargeServiceChargeTypeId">Service Charge Type</Label>
              <Select name="serviceChargeTypeId" value={applyChargeForm.serviceChargeTypeId || ''} onValueChange={(value) => handleApplyChargeSelectChange('serviceChargeTypeId', value)} required>
                <SelectTrigger id="applyChargeServiceChargeTypeId"><SelectValue placeholder="Select charge type" /></SelectTrigger>
                <SelectContent>
                  {serviceChargeTypes.map(sct => (
                    <SelectItem key={sct.id} value={sct.id}>{sct.name} (${sct.amount.toFixed(2)}, {sct.frequency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             <div>
                <Label htmlFor="applyChargeAmount">Amount ($) <span className="text-xs text-muted-foreground">(from selected type)</span></Label>
                <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="applyChargeAmount" name="amountCharged" type="number" value={applyChargeForm.amountCharged || ''} readOnly className="pl-7 bg-muted/50" />
                </div>
            </div>
            <div>
                <Label htmlFor="applyChargeDateApplied">Date Applied</Label>
                <Input id="applyChargeDateApplied" name="dateApplied" type="date" value={applyChargeForm.dateApplied || ''} onChange={handleApplyChargeFormChange} required />
            </div>
            <div>
                <Label htmlFor="applyChargeNotes">Notes (Optional)</Label>
                <Textarea id="applyChargeNotes" name="notes" value={applyChargeForm.notes || ''} onChange={handleApplyChargeFormChange} placeholder="E.g., Reason for charge application"/>
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit">Apply Charge</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
