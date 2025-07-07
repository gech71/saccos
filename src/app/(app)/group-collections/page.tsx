
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { School, SavingAccountType, Member, Saving } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { Filter, Users, DollarSign, Banknote, Wallet, Loader2, CheckCircle, RotateCcw, FileCheck2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/file-upload';
import * as XLSX from 'xlsx';
import { getGroupCollectionsPageData, recordBatchSavings, type GroupCollectionsPageData } from './actions';
import { useAuth } from '@/contexts/auth-context';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const months = [
  { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
  { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
  { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
  { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' }
];

type BatchSavingDetails = {
  date: string;
  depositMode: 'Cash' | 'Bank' | 'Wallet';
  sourceName?: string;
  transactionReference?: string;
  evidenceUrl?: string;
};

const initialBatchTransactionState: BatchSavingDetails = {
  date: new Date().toISOString().split('T')[0],
  depositMode: 'Cash',
};

interface ParsedExcelData {
  'Member Name'?: string;
  'Savings Account Number': string;
  'Amount': number;
  memberName?: string;
  memberId?: string;
  status: 'Valid' | 'Invalid Account Number' | 'Duplicate';
}

export default function GroupCollectionsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [pageData, setPageData] = useState<GroupCollectionsPageData | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  const [batchDetails, setBatchDetails] = useState<BatchSavingDetails>(initialBatchTransactionState);
  const [isPosting, setIsPosting] = useState(false);
  const [postedTransactions, setPostedTransactions] = useState<Saving[] | null>(null);
  const [collectionMode, setCollectionMode] = useState<'filter' | 'excel'>('filter');

  // FILTER-BASED COLLECTION STATE
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedAccountType, setSelectedAccountType] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [eligibleMembers, setEligibleMembers] = useState<GroupCollectionsPageData['members']>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [collectionAmounts, setCollectionAmounts] = useState<Record<string, number>>({});
  
  // EXCEL-BASED COLLECTION STATE
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedExcelData[]>([]);

  const canCreate = useMemo(() => user?.permissions.includes('groupCollection:create'), [user]);

  useEffect(() => {
    async function fetchData() {
        setIsLoadingPage(true);
        try {
            const data = await getGroupCollectionsPageData();
            setPageData(data);
        } catch(e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load page data.' });
        }
        setIsLoadingPage(false);
    }
    fetchData();
  }, [toast]);

  // FILTER-BASED COLLECTION LOGIC
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
    setter(value);
    setEligibleMembers([]); 
    setSelectedMemberIds([]);
  };

  const handleLoadMembers = () => {
    if (!selectedSchool || !selectedAccountType || !selectedYear || !selectedMonth || !pageData) {
      toast({ variant: 'destructive', title: 'Missing Filters', description: 'Please select school, account type, year, and month.' });
      return;
    }
    setIsLoadingMembers(true);
    setPostedTransactions(null); 
    
    setTimeout(() => {
      const filtered = pageData.members.filter(member =>
        member.schoolId === selectedSchool &&
        member.savingAccountTypeId === selectedAccountType &&
        (member.expectedMonthlySaving ?? 0) > 0
      );
      setEligibleMembers(filtered);
      setSelectedMemberIds(filtered.map(m => m.id)); 
      
      const initialAmounts: Record<string, number> = {};
      filtered.forEach(m => {
          initialAmounts[m.id] = m.expectedMonthlySaving || 0;
      });
      setCollectionAmounts(initialAmounts);

      setIsLoadingMembers(false);
      if (filtered.length === 0) {
        toast({ title: 'No Members Found', description: 'No members match the selected criteria or have an expected monthly saving for the selected account type.' });
      }
    }, 300);
  };
  
  const handleSelectAllChange = (checked: boolean) => {
    setSelectedMemberIds(checked ? eligibleMembers.map(member => member.id) : []);
  };

  const handleRowSelectChange = (memberId: string, checked: boolean) => {
    setSelectedMemberIds(prev =>
      checked ? [...prev, memberId] : prev.filter(id => id !== memberId)
    );
  };
  
  const handleCollectionAmountChange = (memberId: string, amount: string) => {
    setCollectionAmounts(prev => ({ ...prev, [memberId]: parseFloat(amount) || 0 }));
  };

  const isAllSelected = eligibleMembers.length > 0 && selectedMemberIds.length === eligibleMembers.length;

  const summaryForSelection = useMemo(() => {
    const membersInSelection = selectedMemberIds.length;
    const totalAmountToCollect = selectedMemberIds.reduce((sum, memberId) => {
        return sum + (collectionAmounts[memberId] || 0);
    }, 0);
    return {
      count: membersInSelection,
      totalExpectedSaving: totalAmountToCollect,
    };
  }, [selectedMemberIds, collectionAmounts]);


  // EXCEL-BASED COLLECTION LOGIC
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setExcelFile(file);
      setParsedData([]); // Reset previous results
    }
  };

  const handleProcessFile = () => {
    if (!excelFile || !pageData) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select an Excel file and wait for page data to load.' });
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
        const dataRows = XLSX.utils.sheet_to_json<any>(worksheet);

        const seenAccountNumbers = new Set<string>();
        const validatedData = dataRows.map((row): ParsedExcelData => {
            const providedMemberName = row['Member Name']?.toString().trim();
            const accountNumber = row['Savings Account Number']?.toString().trim();
            const amount = parseFloat(row['Amount']);
            
            if (!accountNumber || isNaN(amount) || amount <= 0) {
                return { 'Savings Account Number': accountNumber || 'N/A', 'Amount': amount || 0, 'Member Name': providedMemberName, status: 'Invalid Account Number' };
            }
            
            if (seenAccountNumbers.has(accountNumber)) {
                return { 'Savings Account Number': accountNumber, 'Amount': amount, 'Member Name': providedMemberName, status: 'Duplicate' };
            }
            
            const member = pageData.members.find(m => m.savingsAccountNumber?.trim() === accountNumber);
            if (member) {
                seenAccountNumbers.add(accountNumber);
                return { 'Savings Account Number': accountNumber, 'Amount': amount, memberId: member.id, memberName: member.fullName, status: 'Valid' };
            } else {
                return { 'Savings Account Number': accountNumber, 'Amount': amount, 'Member Name': providedMemberName, status: 'Invalid Account Number' };
            }
        });

        setParsedData(validatedData);
        toast({ title: 'File Processed', description: `Found ${dataRows.length} records in the file. See validation status below.` });

      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast({ variant: 'destructive', title: 'Parsing Error', description: 'Could not process the file. Ensure it has columns: "Member Name", "Savings Account Number", and "Amount".' });
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsBinaryString(excelFile);
  };
  
  const excelSummary = useMemo(() => {
    const validRows = parsedData.filter(d => d.status === 'Valid');
    return {
      count: validRows.length,
      totalAmount: validRows.reduce((sum, row) => sum + row.Amount, 0),
    };
  }, [parsedData]);


  // SHARED LOGIC
  const handleBatchDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBatchDetails(prev => ({ ...prev, [name]: value }));
  };
  
  const handleDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setBatchDetails(prev => ({...prev, depositMode: value}));
  };

  const handleSubmitCollection = async () => {
    const transactionDateObj = new Date(batchDetails.date);
    const transactionMonthString = `${months.find(m => m.value === transactionDateObj.getMonth())?.label} ${transactionDateObj.getFullYear()}`;
    let newTransactions: Omit<Saving, 'id'>[] = [];

    if (collectionMode === 'filter') {
        const membersToProcess = selectedMemberIds
            .map(memberId => {
                const member = pageData?.members.find(m => m.id === memberId);
                return {
                    member: member!,
                    amount: collectionAmounts[memberId] || 0,
                }
            })
            .filter(({ amount }) => amount > 0);

        if (membersToProcess.length === 0) {
            toast({ variant: 'destructive', title: 'No Valid Amounts', description: 'Please select members and ensure their collection amounts are greater than zero.' });
            return;
        }

        newTransactions = membersToProcess.map(({member, amount}) => ({
            memberId: member.id,
            memberName: member.fullName,
            amount: amount,
            date: transactionDateObj,
            month: transactionMonthString,
            transactionType: 'deposit',
            status: 'pending',
            depositMode: batchDetails.depositMode,
            sourceName: batchDetails.sourceName,
            transactionReference: batchDetails.transactionReference,
            evidenceUrl: batchDetails.evidenceUrl,
        }));

    } else { // Excel mode
        const validRows = parsedData.filter(d => d.status === 'Valid');
        if (validRows.length === 0) {
            toast({ variant: 'destructive', title: 'No Valid Data', description: 'There are no valid transactions from the Excel file to submit.' });
            return;
        }
         newTransactions = validRows.map(row => ({
            memberId: row.memberId!,
            memberName: row.memberName!,
            amount: row.Amount,
            date: transactionDateObj,
            month: transactionMonthString,
            transactionType: 'deposit',
            status: 'pending',
            depositMode: batchDetails.depositMode,
            sourceName: batchDetails.sourceName,
            transactionReference: batchDetails.transactionReference,
            evidenceUrl: batchDetails.evidenceUrl,
        }));
    }

    if ((batchDetails.depositMode === 'Bank' || batchDetails.depositMode === 'Wallet') && !batchDetails.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${batchDetails.depositMode} Name.` });
        return;
    }

    setIsPosting(true);
    const result = await recordBatchSavings(newTransactions as Saving[]);
    if (result.success) {
        toast({ title: 'Collection Submitted', description: result.message });
        setPostedTransactions(newTransactions as Saving[]);
        setEligibleMembers([]); 
        setSelectedMemberIds([]);
        setParsedData([]);
        setExcelFile(null);
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsPosting(false);
  };
  
  const startNewGroupCollection = () => {
    setPostedTransactions(null);
    setCollectionMode('filter');
    setSelectedSchool('');
    setSelectedAccountType('');
    setEligibleMembers([]);
    setSelectedMemberIds([]);
    setExcelFile(null);
    setParsedData([]);
    setBatchDetails(initialBatchTransactionState);
  };

  const getValidationBadge = (status: ParsedExcelData['status']) => {
    switch (status) {
      case 'Valid': return <Badge variant="default">Valid</Badge>;
      case 'Invalid Account Number': return <Badge variant="destructive">Invalid Acct #</Badge>;
      case 'Duplicate': return <Badge variant="secondary">Duplicate</Badge>;
    }
  };
  
  if (isLoadingPage || !pageData) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
  }

  return (
    <div className="space-y-8">
      <PageTitle title="Group Monthly Collection" subtitle="Process expected monthly savings for a group of members." />

      {!postedTransactions && (
        <>
            <Card className="shadow-md">
                <CardHeader><CardTitle className="font-headline text-primary">1. Select Collection Method</CardTitle></CardHeader>
                <CardContent>
                    <RadioGroup value={collectionMode} onValueChange={(val) => setCollectionMode(val as 'filter' | 'excel')} className="flex flex-wrap gap-x-6 gap-y-4">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="filter" id="mode-filter" />
                            <Label htmlFor="mode-filter" className="font-medium">Filter Members</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="excel" id="mode-excel" />
                            <Label htmlFor="mode-excel" className="font-medium">Upload Excel File</Label>
                        </div>
                    </RadioGroup>
                </CardContent>
            </Card>

          {collectionMode === 'filter' ? (
              <Card className="shadow-lg animate-in fade-in-50 duration-300">
                <CardHeader>
                  <CardTitle className="font-headline text-primary">2. Load Members by Filter</CardTitle>
                  <CardDescription>Select school, account type, year, and month to load eligible members.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                  <div>
                    <Label htmlFor="schoolFilter">School <span className="text-destructive">*</span></Label>
                    <Select value={selectedSchool} onValueChange={handleFilterChange(setSelectedSchool)}>
                      <SelectTrigger id="schoolFilter"><SelectValue placeholder="Select School" /></SelectTrigger>
                      <SelectContent>{pageData.schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="accountTypeFilter">Saving Account Type <span className="text-destructive">*</span></Label>
                    <Select value={selectedAccountType} onValueChange={handleFilterChange(setSelectedAccountType)}>
                      <SelectTrigger id="accountTypeFilter"><SelectValue placeholder="Select Account Type" /></SelectTrigger>
                      <SelectContent>{pageData.savingAccountTypes.map(sat => <SelectItem key={sat.id} value={sat.id}>{sat.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="yearFilter">Year <span className="text-destructive">*</span></Label>
                    <Select value={selectedYear} onValueChange={handleFilterChange(setSelectedYear)}>
                      <SelectTrigger id="yearFilter"><SelectValue placeholder="Select Year" /></SelectTrigger>
                      <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="monthFilter">Month <span className="text-destructive">*</span></Label>
                    <Select value={selectedMonth} onValueChange={handleFilterChange(setSelectedMonth)}>
                      <SelectTrigger id="monthFilter"><SelectValue placeholder="Select Month" /></SelectTrigger>
                      <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleLoadMembers} disabled={isLoadingMembers || !selectedSchool || !selectedAccountType || !selectedYear || !selectedMonth} className="w-full lg:w-auto">
                    {isLoadingMembers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                    Load Members
                  </Button>
                </CardContent>
                 {eligibleMembers.length > 0 && (
                    <CardContent>
                      <div className="overflow-x-auto rounded-lg border shadow-sm">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[60px] px-2">
                                  <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAllChange} disabled={!canCreate} />
                                </TableHead>
                                <TableHead>Member Name</TableHead>
                                <TableHead>Account Number</TableHead>
                                <TableHead className="text-right">Exp. Monthly Saving (Birr)</TableHead>
                                <TableHead className="w-[200px] text-right">Amount to Collect (Birr)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {eligibleMembers.map(member => (
                                <TableRow key={member.id} data-state={selectedMemberIds.includes(member.id) ? 'selected' : undefined}>
                                  <TableCell className="px-2">
                                    <Checkbox checked={selectedMemberIds.includes(member.id)} onCheckedChange={(checked) => handleRowSelectChange(member.id, !!checked)} disabled={!canCreate} />
                                  </TableCell>
                                  <TableCell className="font-medium">{member.fullName}</TableCell>
                                  <TableCell>{member.savingsAccountNumber || 'N/A'}</TableCell>
                                  <TableCell className="text-right">{(member.expectedMonthlySaving || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      value={collectionAmounts[member.id] || ''}
                                      onChange={(e) => handleCollectionAmountChange(member.id, e.target.value)}
                                      className="text-right"
                                      disabled={!selectedMemberIds.includes(member.id) || !canCreate}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                      </div>
                    </CardContent>
                 )}
              </Card>
            ) : (
                <Card className="shadow-lg animate-in fade-in-50 duration-300">
                    <CardHeader>
                        <CardTitle className="font-headline text-primary">2. Upload Collection File</CardTitle>
                        <CardDescription>Upload an Excel file (.xlsx, .xls, .csv). Format: "Member Name", "Savings Account Number", "Amount".</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-4 items-start">
                        <div className="grid w-full max-w-sm items-center gap-1.5 flex-grow">
                            <Label htmlFor="excel-upload">Excel File <span className="text-destructive">*</span></Label>
                            <Input id="excel-upload" type="file" onChange={handleFileChange} accept=".xlsx, .xls, .csv" disabled={!canCreate} />
                        </div>
                        <Button onClick={handleProcessFile} disabled={isParsing || !excelFile || !canCreate} className="w-full sm:w-auto mt-4 sm:mt-6">
                            {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
                            Process File
                        </Button>
                    </CardContent>
                    {parsedData.length > 0 && (
                        <CardContent>
                           <div className="overflow-x-auto rounded-lg border shadow-sm">
                             <Table>
                               <TableHeader>
                                 <TableRow>
                                   <TableHead>Member Name</TableHead>
                                   <TableHead>Savings Account #</TableHead>
                                   <TableHead className="text-right">Amount</TableHead>
                                   <TableHead>Status</TableHead>
                                 </TableRow>
                               </TableHeader>
                               <TableBody>
                                {parsedData.map((row, index) => (
                                    <TableRow key={index} data-state={row.status !== 'Valid' ? 'error' : undefined} className={row.status === 'Invalid Account Number' ? 'bg-destructive/10' : row.status === 'Duplicate' ? 'bg-amber-500/10' : ''}>
                                        <TableCell>{row.memberName || row['Member Name'] || 'N/A'}</TableCell>
                                        <TableCell>{row['Savings Account Number']}</TableCell>
                                        <TableCell className="text-right">{row.Amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                                        <TableCell>{getValidationBadge(row.status)}</TableCell>
                                    </TableRow>
                                ))}
                               </TableBody>
                             </Table>
                           </div>
                        </CardContent>
                    )}
                </Card>
            )}

            {((collectionMode === 'filter' && eligibleMembers.length > 0) || (collectionMode === 'excel' && parsedData.length > 0)) && canCreate && (
                <Card className="shadow-lg animate-in fade-in duration-300">
                    <CardHeader>
                        <CardTitle className="font-headline text-primary">3. Batch Transaction Details</CardTitle>
                         <p className="text-sm text-muted-foreground">This information will be applied to all submitted savings transactions in this batch.</p>
                          <Card className="bg-muted/50 p-4">
                            <CardTitle className="text-base flex justify-between items-center">
                                <span>Summary for Submission</span>
                                {collectionMode === 'filter' && <Badge>{summaryForSelection.count} Members</Badge>}
                                {collectionMode === 'excel' && <Badge>{excelSummary.count} Transactions</Badge>}
                            </CardTitle>
                            <CardContent className="p-0 pt-2">
                                <div className="text-lg font-bold text-primary flex justify-between items-center">
                                    <span>Total Collection Amount:</span>
                                    <span>{collectionMode === 'filter' ? summaryForSelection.totalExpectedSaving.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : excelSummary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</span>
                                </div>
                            </CardContent>
                          </Card>
                    </CardHeader>
                    <CardContent>
                       <div className="space-y-4">
                            <div>
                                <Label htmlFor="batchDetails.date">Transaction Date <span className="text-destructive">*</span></Label>
                                <Input id="batchDetails.date" name="date" type="date" value={batchDetails.date || ''} onChange={handleBatchDetailChange} required />
                            </div>
                            <div>
                                <Label htmlFor="depositModeBatch">Deposit Mode</Label>
                                <RadioGroup id="depositModeBatch" value={batchDetails.depositMode || 'Cash'} onValueChange={handleDepositModeChange} className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2">
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="cashBatch" /><Label htmlFor="cashBatch">Cash</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="bankBatch" /><Label htmlFor="bankBatch">Bank</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="Wallet" id="walletBatch" /><Label htmlFor="walletBatch">Wallet</Label></div>
                                </RadioGroup>
                            </div>

                            {(batchDetails.depositMode === 'Bank' || batchDetails.depositMode === 'Wallet') && (
                                <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
                                        <div>
                                            <Label htmlFor="sourceName">{batchDetails.depositMode} Name <span className="text-destructive">*</span></Label>
                                            <Input id="sourceName" name="sourceName" placeholder={`Enter ${batchDetails.depositMode} Name`} value={batchDetails.sourceName || ''} onChange={handleBatchDetailChange} />
                                        </div>
                                        <div>
                                            <Label htmlFor="transactionReference">Transaction Reference</Label>
                                            <Input id="transactionReference" name="transactionReference" placeholder="e.g., TRN123XYZ" value={batchDetails.transactionReference || ''} onChange={handleBatchDetailChange} />
                                        </div>
                                    </div>
                                    <div className="pl-3">
                                        <FileUpload
                                            id="evidenceUrl"
                                            label="Evidence Attachment"
                                            value={batchDetails.evidenceUrl || ''}
                                            onValueChange={(newValue) => {
                                                setBatchDetails(prev => ({...prev, evidenceUrl: newValue,}));
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter>
                       <Button 
                        onClick={handleSubmitCollection} 
                        disabled={isPosting || (collectionMode === 'filter' && summaryForSelection.totalExpectedSaving <= 0) || (collectionMode === 'excel' && excelSummary.count === 0)} 
                        className="w-full md:w-auto ml-auto"
                       >
                          {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                          Submit Savings Collection
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </>
      )}

      {postedTransactions && (
        <Card className="shadow-lg animate-in fade-in duration-300">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="font-headline text-primary">Collection Submitted for Approval</CardTitle>
                        <CardDescription>The following SAVINGS transactions were submitted for approval. They will not reflect on member balances until approved.</CardDescription>
                    </div>
                    <Button onClick={startNewGroupCollection} variant="outline">
                        <RotateCcw className="mr-2 h-4 w-4" /> Start New Group Collection
                    </Button>
                </div>
                 <p className="text-sm text-muted-foreground mt-2">
                    Total Savings Transactions Submitted: {postedTransactions.length}
                </p>
            </CardHeader>
            <CardContent>
                 <div className="overflow-x-auto rounded-lg border shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Member Name</TableHead>
                                <TableHead className="text-right">Amount (Birr)</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Month</TableHead>
                                <TableHead>Deposit Mode</TableHead>
                                <TableHead>Source/Reference</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {postedTransactions.length > 0 ? postedTransactions.map((transaction, i) => (
                                <TableRow key={`${transaction.memberId}-${i}`}>
                                    <TableCell className="font-medium">{transaction.memberName}</TableCell>
                                    <TableCell className="text-right">{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                                    <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                                    <TableCell>{transaction.month}</TableCell>
                                    <TableCell><Badge variant={transaction.depositMode === 'Cash' ? 'secondary' : 'outline'}>{transaction.depositMode}</Badge></TableCell>
                                    <TableCell className="text-xs">
                                        {transaction.sourceName && <div><strong>Source:</strong> {transaction.sourceName}</div>}
                                        {transaction.transactionReference && <div><strong>Ref:</strong> {transaction.transactionReference}</div>}
                                        {transaction.evidenceUrl && <div><strong>Evidence:</strong> {transaction.evidenceUrl}</div>}
                                        {transaction.depositMode !== 'Cash' && !transaction.sourceName && !transaction.transactionReference && !transaction.evidenceUrl && <span className="text-muted-foreground">N/A</span>}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                 <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                    No transactions in this batch or all have been cleared.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                 </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
