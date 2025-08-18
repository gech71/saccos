
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Filter, DollarSign, Loader2, UploadCloud, FileCheck2, FileDown, Download, ChevronsUpDown, Check } from 'lucide-react';
import { exportToExcel } from '@/lib/utils';
import { getAggregateData, processAggregateCollection, type AggregatePageData, type MemberDataForAggregate, type CollectionPayload } from './actions';
import { useAuth } from '@/contexts/auth-context';
import * as XLSX from 'xlsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 11 }, (_, i) => currentYear - 10 + i).reverse();
const months = [
  { value: '0', label: 'January' }, { value: '1', label: 'February' }, { value: '2', label: 'March' },
  { value: '3', label: 'April' }, { value: '4', label: 'May' }, { value: '5', label: 'June' },
  { value: '6', label: 'July' }, { value: '7', label: 'August' }, { value: '8', label: 'September' },
  { value: '9', label: 'October' }, { value: '10', label: 'November' }, { value: '11', label: 'December' }
];

type CollectionInputValues = Record<string, number>; // Key: `type_id` or `type_id-principal/interest`, Value: amount
type MemberCollectionData = Record<string, CollectionInputValues>; // Key: `memberId`

function roundToTwo(num: number) {
    return Math.round(num * 100) / 100;
}

export default function AggregateCollectionsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [pageData, setPageData] = useState<AggregatePageData | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [openSchoolCombobox, setOpenSchoolCombobox] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [membersData, setMembersData] = useState<MemberDataForAggregate[]>([]);
  const [collectionData, setCollectionData] = useState<MemberCollectionData>({});

  useEffect(() => {
    async function fetchData() {
        setIsPageLoading(true);
        const data = await getAggregateData();
        setPageData(data);
        setIsPageLoading(false);
    }
    fetchData();
  }, []);

  const dynamicColumns = useMemo(() => {
    if (!pageData) return { savings: [], loans: [], shares: [], serviceCharges: [] };
    return {
      savings: pageData.savingTypes,
      loans: pageData.loanTypes,
      shares: pageData.shareTypes,
      serviceCharges: pageData.serviceChargeTypes
    }
  }, [pageData]);

  const handleLoadMembers = async () => {
    if (!selectedSchool) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a school.' });
        return;
    }
    setIsLoading(true);
    setMembersData([]);
    setCollectionData({});

    try {
        const members = pageData?.members.filter(m => m.schoolId === selectedSchool) || [];
        setMembersData(members);
        
        // Pre-fill collection data with expected amounts
        const initialData: MemberCollectionData = {};
        members.forEach(member => {
            initialData[member.id] = {};
            // Loan Repayments
            member.loans.forEach(loan => {
                const monthlyInterestRate = loan.interestRate / 12;
                const interestForMonth = roundToTwo(loan.remainingBalance * monthlyInterestRate);
                const principalPortion = loan.loanTerm > 0 ? roundToTwo(loan.principalAmount / loan.loanTerm) : 0;
                
                initialData[member.id][`loan_${loan.loanTypeId}-principal`] = Math.max(0, principalPortion);
                initialData[member.id][`loan_${loan.loanTypeId}-interest`] = interestForMonth;
            });
            // Share Contributions
            member.memberShareCommitments.forEach(sc => {
                const shareType = dynamicColumns.shares.find(s => s.id === sc.shareTypeId);
                if (shareType?.paymentType === 'ONCE') {
                   initialData[member.id][`share_${sc.shareTypeId}`] = 0; // Default one-time shares to 0
                } else {
                   initialData[member.id][`share_${sc.shareTypeId}`] = sc.shareType.monthlyPayment || 0;
                }
            });
            // Savings
             member.memberSavingAccounts.forEach(sa => {
                initialData[member.id][`saving_${sa.savingAccountTypeId}`] = sa.expectedMonthlySaving || 0;
            });
            // Service Charges
            dynamicColumns.serviceCharges.forEach(sc => {
                if (sc.frequency === 'once') {
                    initialData[member.id][`service_${sc.id}`] = 0; // Default one-time charges to 0
                } else {
                    initialData[member.id][`service_${sc.id}`] = sc.amount;
                }
            })
        });
        setCollectionData(initialData);

    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load member data.' });
    }
    setIsLoading(false);
  };
  
  const handleInputChange = (memberId: string, key: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setCollectionData(prev => ({
        ...prev,
        [memberId]: {
            ...prev[memberId],
            [key]: amount,
        }
    }));
  };

  const getRowTotal = (memberId: string) => {
      const memberCollections = collectionData[memberId] || {};
      return Object.values(memberCollections).reduce((sum, amount) => sum + amount, 0);
  };
  
  const grandTotal = useMemo(() => {
    return membersData.reduce((total, member) => total + getRowTotal(member.id), 0);
  }, [collectionData, membersData]);

  const handleSubmit = async () => {
    const payload: CollectionPayload = {
      schoolId: selectedSchool,
      collectionMonth: months[parseInt(selectedMonth)].label,
      collectionYear: selectedYear,
      collections: []
    };
    
    for (const member of membersData) {
        const memberCollections = collectionData[member.id];
        if (memberCollections && Object.values(memberCollections).some(v => v > 0)) {
            payload.collections.push({
                memberId: member.id,
                values: memberCollections
            });
        }
    }
    
    if (payload.collections.length === 0) {
        toast({ variant: 'destructive', title: 'No Data', description: 'No collection amounts were entered.' });
        return;
    }

    setIsSubmitting(true);
    try {
        await processAggregateCollection(payload);
        toast({ title: 'Success', description: 'Aggregate collection has been submitted for approval.' });
        setMembersData([]);
        setCollectionData({});
    } catch(e) {
        const error = e as Error;
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
    setIsSubmitting(false);
  };

  const handleExport = () => {
    if (membersData.length === 0) {
        toast({ variant: 'destructive', title: 'No Data', description: 'Load data before exporting.' });
        return;
    }

    const headers = [
        'Member ID',
        'Full Name',
        ...dynamicColumns.savings.map(s => s.name),
        ...dynamicColumns.loans.flatMap(l => [`${l.name} Principal`, `${l.name} Interest`]),
        ...dynamicColumns.shares.map(s => s.name),
        ...dynamicColumns.serviceCharges.map(sc => sc.name),
        'Total Collected'
    ];

    const dataToExport = membersData.map(member => {
        const row: (string | number)[] = [member.id, member.fullName];
        dynamicColumns.savings.forEach(s => row.push(collectionData[member.id]?.[`saving_${s.id}`] || 0));
        dynamicColumns.loans.forEach(l => {
            row.push(collectionData[member.id]?.[`loan_${l.id}-principal`] || 0);
            row.push(collectionData[member.id]?.[`loan_${l.id}-interest`] || 0);
        });
        dynamicColumns.shares.forEach(s => row.push(collectionData[member.id]?.[`share_${s.id}`] || 0));
        dynamicColumns.serviceCharges.forEach(sc => row.push(collectionData[member.id]?.[`service_${sc.id}`] || 0));
        row.push(getRowTotal(member.id));
        
        const rowObject: Record<string, any> = {};
        headers.forEach((header, index) => {
            rowObject[header] = row[index];
        });
        return rowObject;
    });

    exportToExcel(dataToExport, `aggregate_collection_${selectedSchool}_${months[parseInt(selectedMonth)].label}_${selectedYear}`);
  };


  if (isPageLoading || !pageData) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Aggregate Group Collection" subtitle="A comprehensive sheet for collecting all member dues at once." />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Collection Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <Label htmlFor="schoolFilter">School</Label>
             <Popover open={openSchoolCombobox} onOpenChange={setOpenSchoolCombobox}>
                <PopoverTrigger asChild>
                    <Button
                    id="schoolFilter"
                    variant="outline"
                    role="combobox"
                    aria-expanded={openSchoolCombobox}
                    className="w-full justify-between"
                    >
                    {selectedSchool
                        ? pageData.schools.find((s) => s.id === selectedSchool)?.name
                        : "Select school..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                    <CommandInput placeholder="Search school..." />
                    <CommandList>
                        <CommandEmpty>No school found.</CommandEmpty>
                        <CommandGroup>
                        {pageData.schools.map((s) => (
                            <CommandItem
                            key={s.id}
                            value={`${s.name} ${s.id}`}
                            onSelect={() => {
                                setSelectedSchool(s.id);
                                setOpenSchoolCombobox(false);
                            }}
                            >
                            <Check
                                className={cn(
                                "mr-2 h-4 w-4",
                                selectedSchool === s.id ? "opacity-100" : "opacity-0"
                                )}
                            />
                            {s.name}
                            </CommandItem>
                        ))}
                        </CommandGroup>
                    </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label htmlFor="yearFilter">Year</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger id="yearFilter"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="monthFilter">Month</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="monthFilter"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleLoadMembers} disabled={isLoading || !selectedSchool}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
            Load Data
          </Button>
        </CardContent>
      </Card>

      {membersData.length > 0 && (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Collection Sheet</CardTitle>
                        <CardDescription>Enter the collected amounts for each member. All entries will be submitted as one batch.</CardDescription>
                    </div>
                    <Button onClick={handleExport} variant="outline">
                        <FileDown className="mr-2 h-4 w-4" /> Export
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-20 w-[150px]">Member ID</TableHead>
                      <TableHead className="sticky left-[150px] bg-background z-20 w-[200px]">Full Name</TableHead>
                      {dynamicColumns.savings.map(c => <TableHead key={`saving_${c.id}`} className="text-center">{c.name}</TableHead>)}
                      {dynamicColumns.loans.map(c => <React.Fragment key={`loan_group_${c.id}`}><TableHead className="text-center">{c.name} Principal</TableHead><TableHead className="text-center">{c.name} Interest</TableHead></React.Fragment>)}
                      {dynamicColumns.shares.map(c => <TableHead key={`share_${c.id}`} className="text-center">{c.name}</TableHead>)}
                      {dynamicColumns.serviceCharges.map(c => <TableHead key={`service_${c.id}`} className="text-center">{c.name}</TableHead>)}
                      <TableHead className="text-right sticky right-0 bg-background z-20 font-bold">Total Collected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membersData.map(member => (
                      <TableRow key={member.id}>
                        <TableCell className="font-mono text-xs sticky left-0 bg-background z-10 w-[150px]">
                            {member.id}
                        </TableCell>
                         <TableCell className="font-medium sticky left-[150px] bg-background z-10 w-[200px]">
                            {member.fullName}
                        </TableCell>
                        {dynamicColumns.savings.map(c => <TableCell key={`saving_${c.id}`}><Input type="number" value={collectionData[member.id]?.[`saving_${c.id}`] || ''} onChange={e => handleInputChange(member.id, `saving_${c.id}`, e.target.value)} className="text-right min-w-[120px]" /></TableCell>)}
                        {dynamicColumns.loans.map(c => (
                            <React.Fragment key={`loan_inputs_${c.id}`}>
                                <TableCell><Input type="number" value={collectionData[member.id]?.[`loan_${c.id}-principal`] || ''} onChange={e => handleInputChange(member.id, `loan_${c.id}-principal`, e.target.value)} className="text-right min-w-[120px]" /></TableCell>
                                <TableCell><Input type="number" value={collectionData[member.id]?.[`loan_${c.id}-interest`] || ''} onChange={e => handleInputChange(member.id, `loan_${c.id}-interest`, e.target.value)} className="text-right min-w-[120px]" /></TableCell>
                            </React.Fragment>
                        ))}
                        {dynamicColumns.shares.map(c => <TableCell key={`share_${c.id}`}><Input type="number" value={collectionData[member.id]?.[`share_${c.id}`] || ''} onChange={e => handleInputChange(member.id, `share_${c.id}`, e.target.value)} className="text-right min-w-[120px]" /></TableCell>)}
                        {dynamicColumns.serviceCharges.map(c => <TableCell key={`service_${c.id}`}><Input type="number" value={collectionData[member.id]?.[`service_${c.id}`] || ''} onChange={e => handleInputChange(member.id, `service_${c.id}`, e.target.value)} className="text-right min-w-[120px]" /></TableCell>)}
                        <TableCell className="text-right font-bold sticky right-0 bg-background z-10">{getRowTotal(member.id).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted font-bold">
                      <TableCell colSpan={2 + dynamicColumns.savings.length + (dynamicColumns.loans.length*2) + dynamicColumns.shares.length + dynamicColumns.serviceCharges.length} className="text-right text-lg">Grand Total</TableCell>
                      <TableCell className="text-right text-lg sticky right-0 bg-muted z-10">{grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSubmit} disabled={isSubmitting || grandTotal <= 0}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit Collection
                </Button>
            </CardFooter>
        </Card>
      )}
    </div>
  );
}

