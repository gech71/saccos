
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
import { Filter, DollarSign, Loader2, UploadCloud, FileCheck2, FileDown, Download, ChevronsUpDown, Check, CheckCircle, XCircle } from 'lucide-react';
import { exportToExcel } from '@/lib/utils';
import { getAggregateData, processAggregateCollection, type AggregatePageData, type MemberDataForAggregate, type CollectionPayload } from './actions';
import { useAuth } from '@/contexts/auth-context';
import * as XLSX from 'xlsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

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

type ValidatedRow = {
  memberId: string;
  fullName: string;
  status: 'Valid' | 'Invalid Member ID' | 'No Data to Import';
  data: CollectionInputValues;
  originalRow: any;
};

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
  
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [validationSummary, setValidationSummary] = useState<{valid: number, invalid: number, total: number} | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);


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
    setExcelFile(null); // Reset file on new load
    setValidatedRows([]);
    setValidationSummary(null);

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

                // Ensure loanTerm is positive to avoid division by zero
                const principalPortion = loan.loanTerm > 0 
                    ? roundToTwo(loan.principalAmount / loan.loanTerm)
                    : 0;

                // The principal portion cannot be more than the remaining balance
                const finalPrincipalPortion = Math.min(principalPortion, loan.remainingBalance);
                
                initialData[member.id][`loan_${loan.loanTypeId}-principal`] = Math.max(0, finalPrincipalPortion);
                initialData[member.id][`loan_${loan.loanTypeId}-interest`] = interestForMonth;
            });
            // Share Contributions
            member.memberShareCommitments.forEach(sc => {
                // Safely check if shareType exists before accessing properties
                if (sc.shareType) {
                  if (sc.shareType.paymentType === 'ONCE') {
                     initialData[member.id][`share_${sc.shareTypeId}`] = 0; // Default one-time shares to 0
                  } else {
                     initialData[member.id][`share_${sc.shareTypeId}`] = sc.shareType.monthlyPayment || 0;
                  }
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
        const error = e as Error;
        toast({ variant: 'destructive', title: 'Error Loading Data', description: error.message || 'An unexpected error occurred.' });
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

  const handleImportedDataSubmit = async () => {
      const validRowsToSubmit = validatedRows.filter(row => row.status === 'Valid');
      if (validRowsToSubmit.length === 0) {
          toast({ variant: 'destructive', title: 'No Valid Data', description: 'There is no valid data to submit for approval.' });
          return;
      }
      
      const payload: CollectionPayload = {
        schoolId: selectedSchool,
        collectionMonth: months[parseInt(selectedMonth)].label,
        collectionYear: selectedYear,
        collections: validRowsToSubmit.map(row => ({ memberId: row.memberId, values: row.data }))
      };

      setIsSubmitting(true);
      try {
          await processAggregateCollection(payload);
          toast({ title: 'Success', description: 'Imported collection data has been submitted for approval.' });
          setExcelFile(null);
          setValidatedRows([]);
          setValidationSummary(null);
      } catch(e) {
          const error = e as Error;
          toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
      setIsSubmitting(false);
  };

  const getHeaders = (includeFullName = true) => {
    if (!dynamicColumns) return [];
    const headers = ['Member ID'];
    if (includeFullName) headers.push('Full Name');
    return [
        ...headers,
        ...dynamicColumns.savings.map(s => s.name),
        ...dynamicColumns.loans.flatMap(l => [`${l.name} Principal`, `${l.name} Interest`]),
        ...dynamicColumns.shares.map(s => s.name),
        ...dynamicColumns.serviceCharges.map(sc => sc.name),
        'Total Collected'
    ];
  }

  const handleExport = () => {
    if (membersData.length === 0) {
        toast({ variant: 'destructive', title: 'No Data', description: 'Load data before exporting.' });
        return;
    }

    const headers = getHeaders();

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

  const handleDownloadTemplate = () => {
    if (membersData.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please load members for the school first to generate a template.' });
      return;
    }
    
    const headers = getHeaders().filter(h => h !== 'Total Collected');
    const templateData = membersData.map(member => {
        const rowObject: Record<string, any> = { 'Member ID': member.id, 'Full Name': member.fullName };
        headers.slice(2).forEach(header => {
            rowObject[header] = 0; // Default to 0
        });
        return rowObject;
    });
    
    exportToExcel(templateData, 'aggregate_collection_template');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
      setValidatedRows([]);
      setValidationSummary(null);
      setFileHeaders([]);
    }
  };

  const handleProcessFile = () => {
    if (!excelFile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select an Excel file.' });
      return;
    }
    if (membersData.length === 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please load members for the school before processing a file.' });
        return;
    }

    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const headerRow: string[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
            setFileHeaders(headerRow);
            const dataRows = XLSX.utils.sheet_to_json<any>(worksheet);

            const savingTypesMap = new Map(pageData!.savingTypes.map(t => [t.name, `saving_${t.id}`]));
            const shareTypesMap = new Map(pageData!.shareTypes.map(t => [t.name, `share_${t.id}`]));
            const loanPrincipalMap = new Map(pageData!.loanTypes.map(t => [`${t.name} Principal`, `loan_${t.id}-principal`]));
            const loanInterestMap = new Map(pageData!.loanTypes.map(t => [`${t.name} Interest`, `loan_${t.id}-interest`]));
            const serviceChargeTypesMap = new Map(pageData!.serviceChargeTypes.map(t => [t.name, `service_${t.id}`]));
            
            const validatedData: ValidatedRow[] = dataRows.map(row => {
                const memberId = row['Member ID']?.toString().trim();
                const member = membersData.find(m => m.id === memberId);
                const fullName = member?.fullName || row['Full Name'] || 'Unknown Member';
                
                if (!member) {
                    return { memberId, fullName, status: 'Invalid Member ID', data: {}, originalRow: row };
                }

                const collectionValues: CollectionInputValues = {};
                for(const header of headerRow) {
                  if(header === 'Member ID' || header === 'Full Name' || header === 'Total Collected') continue;
                  
                  const value = parseFloat(row[header]);
                  if(isNaN(value) || value <= 0) continue;

                  if(savingTypesMap.has(header)) {
                      collectionValues[savingTypesMap.get(header)!] = value;
                  } else if (shareTypesMap.has(header)) {
                      collectionValues[shareTypesMap.get(header)!] = value;
                  } else if (loanPrincipalMap.has(header)) {
                      collectionValues[loanPrincipalMap.get(header)!] = value;
                  } else if (loanInterestMap.has(header)) {
                      collectionValues[loanInterestMap.get(header)!] = value;
                  } else if (serviceChargeTypesMap.has(header)) {
                      collectionValues[serviceChargeTypesMap.get(header)!] = value;
                  }
                }
                
                const hasData = Object.keys(collectionValues).length > 0;

                return {
                    memberId,
                    fullName,
                    status: hasData ? 'Valid' : 'No Data to Import',
                    data: collectionValues,
                    originalRow: row,
                };
            });
            
            setValidatedRows(validatedData);
            const valid = validatedData.filter(v => v.status === 'Valid').length;
            const invalid = validatedData.filter(v => v.status === 'Invalid Member ID').length;
            setValidationSummary({ valid, invalid, total: dataRows.length });
            toast({ title: "File Processed", description: `Found ${valid} valid record(s) and ${invalid} invalid record(s).` });

        } catch (error) {
             toast({ variant: 'destructive', title: 'File Read Error', description: 'There was an issue reading the Excel file. Please check its format.' });
        } finally {
            setIsParsing(false);
        }
    };
    reader.readAsBinaryString(excelFile);
  }

  const getValidationBadge = (status: ValidatedRow['status']) => {
    switch (status) {
      case 'Valid': return <Badge variant="default">Valid</Badge>;
      case 'Invalid Member ID': return <Badge variant="destructive">Invalid Member ID</Badge>;
      case 'No Data to Import': return <Badge variant="secondary">No Data</Badge>;
    }
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
        <Tabs defaultValue="manual">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Enter Manually</TabsTrigger>
                <TabsTrigger value="import">Import from Excel</TabsTrigger>
            </TabsList>
            <TabsContent value="manual">
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
                            <TableHead className="w-[200px]">Full Name</TableHead>
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
                                <TableCell className="font-medium w-[200px]">
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
            </TabsContent>
            <TabsContent value="import">
                 <Card>
                    <CardHeader>
                        <CardTitle>Import from Excel</CardTitle>
                        <CardDescription>Upload an Excel file to populate the collection data automatically. The file must match the template format.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={handleDownloadTemplate} variant="secondary" size="sm">
                            <Download className="mr-2 h-4 w-4"/>
                            Download Template for Loaded Members
                        </Button>
                        <div className="flex items-center gap-4">
                            <Input id="excel-file" type="file" onChange={handleFileChange} accept=".xlsx, .xls" className="max-w-sm"/>
                             <Button onClick={handleProcessFile} disabled={isParsing || !excelFile}>
                                {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
                                Process File
                            </Button>
                        </div>
                    </CardContent>

                    {validationSummary && (
                        <CardContent>
                            <CardTitle className="text-lg font-medium mb-2">Validation Summary</CardTitle>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 p-3 border rounded-md bg-green-50 text-green-800">
                                   <CheckCircle className="h-5 w-5" />
                                   <span className="font-semibold">{validationSummary.valid} Valid Rows</span>
                                </div>
                                 <div className="flex items-center gap-2 p-3 border rounded-md bg-red-50 text-red-800">
                                   <XCircle className="h-5 w-5" />
                                   <span className="font-semibold">{validationSummary.invalid} Invalid Rows</span>
                                </div>
                            </div>
                        </CardContent>
                    )}

                    {validatedRows.length > 0 && (
                        <CardContent>
                            <CardTitle className="text-lg font-medium mb-2">Validation Details</CardTitle>
                            <div className="overflow-x-auto rounded-lg border shadow-sm max-h-96">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-muted z-10">
                                        <TableRow>
                                            <TableHead>Status</TableHead>
                                            {fileHeaders.map(header => <TableHead key={header}>{header}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {validatedRows.map((row, index) => (
                                            <TableRow key={index} className={row.status !== 'Valid' ? 'bg-destructive/10' : ''}>
                                                <TableCell>{getValidationBadge(row.status)}</TableCell>
                                                {fileHeaders.map(header => (
                                                    <TableCell key={`${row.memberId}-${header}`}>{row.originalRow[header]}</TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    )}
                    
                    {validationSummary && validationSummary.valid > 0 && (
                        <CardFooter>
                            <Button onClick={handleImportedDataSubmit} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Submit ({validationSummary.valid}) Valid Records for Approval
                            </Button>
                        </CardFooter>
                    )}
                </Card>
            </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
