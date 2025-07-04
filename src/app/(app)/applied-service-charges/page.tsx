
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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
import type { Member, School, AppliedServiceCharge, ServiceChargeType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Filter, PlusCircle, DollarSign, SchoolIcon, Check, ChevronsUpDown, FileDown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle as ShadcnCardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { exportToExcel } from '@/lib/utils';
import { getAppliedChargesPageData, applyServiceCharge, type AppliedChargeInput, type AppliedChargesPageData, type MemberServiceChargeSummary } from './actions';
import { useAuth } from '@/contexts/auth-context';

const initialApplyChargeFormState: Partial<AppliedChargeInput> = {
    memberId: '',
    serviceChargeTypeId: '',
    amountCharged: 0,
    dateApplied: new Date().toISOString().split('T')[0],
    notes: '',
};

export default function AppliedServiceChargesPage() {
  const [pageData, setPageData] = useState<AppliedChargesPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all');
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();

  const [isApplyChargeModalOpen, setIsApplyChargeModalOpen] = useState(false);
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);
  const [applyChargeForm, setApplyChargeForm] = useState(initialApplyChargeFormState);

  const canCreate = useMemo(() => user?.permissions.includes('serviceCharge:create'), [user]);
  const canRecordPayment = useMemo(() => user?.permissions.includes('serviceCharge:edit'), [user]);
  
  const fetchPageData = async () => {
    setIsLoading(true);
    try {
        const data = await getAppliedChargesPageData();
        setPageData(data);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load page data.' });
    }
    setIsLoading(false);
  }

  useEffect(() => {
    fetchPageData();
  }, []);

  const filteredMemberSummaries = useMemo(() => {
    if (!pageData) return [];
    return pageData.summaries.filter(summary => {
      const matchesSearchTerm = summary.fullName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSchoolFilter = selectedSchoolFilter === 'all' || summary.schoolId === selectedSchoolFilter;
      return matchesSearchTerm && matchesSchoolFilter;
    });
  }, [pageData, searchTerm, selectedSchoolFilter]);

  const globalSummaryStats = useMemo(() => {
    if (!filteredMemberSummaries) return { totalAppliedGlobal: 0, totalPaidGlobal: 0, totalPendingGlobal: 0 };
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
     if (name === 'serviceChargeTypeId' && pageData?.serviceChargeTypes) {
        const selectedType = pageData.serviceChargeTypes.find(sct => sct.id === value);
        setApplyChargeForm(prev => ({ ...prev, serviceChargeTypeId: value, amountCharged: selectedType?.amount || 0 }));
    } else {
        setApplyChargeForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleApplyChargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyChargeForm.memberId || !applyChargeForm.serviceChargeTypeId || !pageData?.members) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a member and a service charge type.' });
      return;
    }
    
    setIsSubmitting(true);
    try {
        await applyServiceCharge(applyChargeForm as AppliedChargeInput);
        const memberName = pageData.members.find(m => m.id === applyChargeForm.memberId)?.fullName || '';
        toast({ title: 'Service Charge Applied', description: `Charge applied to ${memberName}.` });
        setIsApplyChargeModalOpen(false);
        await fetchPageData();
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to apply service charge.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    const dataToExport = filteredMemberSummaries.map(summary => ({
      'Member Name': summary.fullName,
      'School': summary.schoolName,
      'Total Applied ($)': summary.totalApplied.toFixed(2),
      'Total Paid ($)': summary.totalPaid.toFixed(2),
      'Total Pending ($)': summary.totalPending.toFixed(2),
      'Fulfillment (%)': summary.fulfillmentPercentage.toFixed(1),
    }));
    exportToExcel(dataToExport, 'applied_service_charges_export');
  };

  if (isLoading || !pageData) {
      return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Applied Service Charges" subtitle="View, apply, and manage service charges for members.">
        <Button onClick={handleExport} variant="outline" disabled={filteredMemberSummaries.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Export
        </Button>
        {canCreate && (
          <Button onClick={openApplyNewChargeModal} className="shadow-md hover:shadow-lg transition-shadow">
              <PlusCircle className="mr-2 h-5 w-5" /> Apply New Charge
          </Button>
        )}
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Applied Charges</ShadcnCardTitle>
                <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">${globalSummaryStats.totalAppliedGlobal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Paid Charges</ShadcnCardTitle>
                <DollarSign className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">${globalSummaryStats.totalPaidGlobal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></CardContent>
        </Card>
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <ShadcnCardTitle className="text-sm font-medium text-muted-foreground">Total Pending Charges</ShadcnCardTitle>
                <DollarSign className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-destructive">${globalSummaryStats.totalPendingGlobal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></CardContent>
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
            {pageData.schools.map(school => (
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
                <TableCell className="text-right">${summary.totalApplied.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right text-green-600 font-semibold">${summary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right text-destructive font-semibold">
                  {summary.totalPending > 0 ? `$${summary.totalPending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span className="text-muted-foreground/70">-</span>}
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
                  {summary.totalPending > 0 && canRecordPayment && (
                     <Button asChild variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/10 hover:text-primary">
                        <Link href={`/applied-service-charges/${summary.memberId}/record-payment?pending=${summary.totalPending.toFixed(2)}&name=${encodeURIComponent(summary.fullName)}`}>
                          <DollarSign className="mr-1.5 h-3.5 w-3.5" />
                          Record Payment
                        </Link>
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
              <Popover open={openMemberCombobox} onOpenChange={setOpenMemberCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    id="applyChargeMemberId"
                    variant="outline"
                    role="combobox"
                    aria-expanded={openMemberCombobox}
                    className="w-full justify-between"
                  >
                    {applyChargeForm.memberId
                      ? pageData.members.find((member) => member.id === applyChargeForm.memberId)?.fullName
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
                        {pageData.members.map((member) => (
                          <CommandItem
                            key={member.id}
                            value={`${member.fullName} ${member.savingsAccountNumber}`}
                            onSelect={() => {
                              handleApplyChargeSelectChange('memberId', member.id);
                              setOpenMemberCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                applyChargeForm.memberId === member.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {member.fullName} ({member.savingsAccountNumber || 'No Acct #'})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="applyChargeServiceChargeTypeId">Service Charge Type</Label>
              <Select name="serviceChargeTypeId" value={applyChargeForm.serviceChargeTypeId || ''} onValueChange={(value) => handleApplyChargeSelectChange('serviceChargeTypeId', value)} required>
                <SelectTrigger id="applyChargeServiceChargeTypeId"><SelectValue placeholder="Select charge type" /></SelectTrigger>
                <SelectContent>
                  {pageData.serviceChargeTypes.map(sct => (
                    <SelectItem key={sct.id} value={sct.id}>{sct.name} (${sct.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, {sct.frequency})</SelectItem>
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
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply Charge
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
