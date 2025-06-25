

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
import { mockSchools, mockSavingAccountTypes, mockMembers, mockSavings } from '@/data/mock';
import type { School, SavingAccountType, Member, Saving, MemberShareCommitment } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Filter, Users, DollarSign, Banknote, Wallet, UploadCloud, Loader2, CheckCircle, ListChecks, Trash2, RotateCcw, Shapes, Upload, FileCheck2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/file-upload';
import * as XLSX from 'xlsx';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const months = [
  { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
  { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
  { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
  { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' }
];

const initialBatchTransactionState: Partial<Omit<Saving, 'id' | 'memberId' | 'memberName' | 'month' | 'status'>> & { paymentDetails?: Saving['paymentDetails'] } = {
  date: new Date().toISOString().split('T')[0],
  transactionType: 'deposit',
  depositMode: 'Cash',
  paymentDetails: {
    sourceName: '',
    transactionReference: '',
    evidenceUrl: '',
  },
};

interface ParsedExcelData {
  'Savings Account Number': string;
  'Amount': number;
  memberName?: string;
  memberId?: string;
  status: 'Valid' | 'Invalid Account Number' | 'Duplicate';
}


export default function GroupCollectionsPage() {
  const { toast } = useToast();
  
  // SHARED STATE
  const [allSchools] = useState<School[]>(mockSchools);
  const [allMembers, setAllMembers] = useState<Member[]>(mockMembers); 
  const [allSavings, setAllSavings] = useState<Saving[]>(mockSavings);
  const [batchDetails, setBatchDetails] = useState(initialBatchTransactionState);
  const [isPosting, setIsPosting] = useState(false);
  const [postedTransactions, setPostedTransactions] = useState<Saving[] | null>(null);
  const [collectionMode, setCollectionMode] = useState<'filter' | 'excel'>('filter');

  // FILTER-BASED COLLECTION STATE
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedAccountType, setSelectedAccountType] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [eligibleMembers, setEligibleMembers] = useState<Member[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  
  // EXCEL-BASED COLLECTION STATE
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedExcelData[]>([]);

  // FILTER-BASED COLLECTION LOGIC
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
    setter(value);
    setEligibleMembers([]); 
    setSelectedMemberIds([]);
  };

  const handleLoadMembers = () => {
    if (!selectedSchool || !selectedAccountType || !selectedYear || !selectedMonth) {
      toast({ variant: 'destructive', title: 'Missing Filters', description: 'Please select school, account type, year, and month.' });
      return;
    }
    setIsLoadingMembers(true);
    setPostedTransactions(null); 
    setTimeout(() => {
      const filtered = allMembers.filter(member =>
        member.schoolId === selectedSchool &&
        member.savingAccountTypeId === selectedAccountType &&
        ((member.expectedMonthlySaving || 0) > 0 || (member.shareCommitments || []).reduce((sum, sc) => sum + sc.monthlyCommittedAmount, 0) > 0)
      );
      setEligibleMembers(filtered);
      setSelectedMemberIds(filtered.map(m => m.id)); 
      setIsLoadingMembers(false);
      if (filtered.length === 0) {
        toast({ title: 'No Members Found', description: 'No members match the selected criteria or have an expected monthly saving/share contribution for the selected account type.' });
      }
    }, 500);
  };
  
  const handleSelectAllChange = (checked: boolean) => {
    setSelectedMemberIds(checked ? eligibleMembers.map(member => member.id) : []);
  };

  const handleRowSelectChange = (memberId: string, checked: boolean) => {
    setSelectedMemberIds(prev =>
      checked ? [...prev, memberId] : prev.filter(id => id !== memberId)
    );
  };

  const isAllSelected = eligibleMembers.length > 0 && selectedMemberIds.length === eligibleMembers.length;

  const summaryForSelection = useMemo(() => {
    const membersInSelection = eligibleMembers.filter(m => selectedMemberIds.includes(m.id));
    const totalExpectedSaving = membersInSelection.reduce((sum, m) => sum + (m.expectedMonthlySaving || 0), 0);
    return {
      count: membersInSelection.length,
      totalExpectedSaving,
    };
  }, [eligibleMembers, selectedMemberIds]);


  // EXCEL-BASED COLLECTION LOGIC
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setExcelFile(file);
      setParsedData([]); // Reset previous results
    }
  };

  const handleProcessFile = () => {
    if (!excelFile) {
        toast({ variant: 'destructive', title: 'No File', description: 'Please select an Excel file to process.' });
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
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        const seenAccountNumbers = new Set<string>();
        const validatedData = jsonData.map((row): ParsedExcelData => {
            const accountNumberValue = row['Savings Account Number'] || row['Savings Account #'] || row['AccountNumber'];
            const amountValue = row['Amount'] || row['Contribution'];
            
            const accountNumber = accountNumberValue?.toString().trim();
            const amount = parseFloat(amountValue);
            
            if (!accountNumber || isNaN(amount) || amount <= 0) {
                return { 'Savings Account Number': accountNumber || 'N/A', 'Amount': amount || 0, status: 'Invalid Account Number' };
            }
            
            if (seenAccountNumbers.has(accountNumber)) {
                return { 'Savings Account Number': accountNumber, 'Amount': amount, status: 'Duplicate' };
            }
            
            const member = allMembers.find(m => m.savingsAccountNumber?.trim() === accountNumber);
            if (member) {
                seenAccountNumbers.add(accountNumber);
                return { 'Savings Account Number': accountNumber, 'Amount': amount, memberId: member.id, memberName: member.fullName, status: 'Valid' };
            } else {
                return { 'Savings Account Number': accountNumber, 'Amount': amount, status: 'Invalid Account Number' };
            }
        });

        setParsedData(validatedData);
        toast({ title: 'File Processed', description: `Found ${jsonData.length} records in the file. See validation status below.` });

      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast({ variant: 'destructive', title: 'Parsing Error', description: 'Could not process the file. Ensure it has columns for account number and amount.' });
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
     const nameParts = name.split('.');
    if (nameParts.length > 1 && nameParts[0] === 'paymentDetails') {
        const fieldName = nameParts[1] as keyof NonNullable<Saving['paymentDetails']>;
        setBatchDetails(prev => ({
            ...prev,
            paymentDetails: {
                ...(prev?.paymentDetails || {}),
                [fieldName]: value,
            }
        }));
    } else {
       setBatchDetails(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setBatchDetails(prev => ({
      ...prev,
      depositMode: value,
      paymentDetails: value === 'Cash' ? undefined : (prev.paymentDetails || { sourceName: '', transactionReference: '', evidenceUrl: '' }),
    }));
  };

  const handleSubmitCollection = () => {
    const transactionDate = batchDetails.date || new Date().toISOString().split('T')[0];
    const transactionDateObj = new Date(transactionDate);
    const transactionMonthString = `${months.find(m => m.value === transactionDateObj.getMonth())?.label} ${transactionDateObj.getFullYear()}`;
    let newTransactions: Saving[] = [];

    if (collectionMode === 'filter') {
        if (selectedMemberIds.length === 0) {
            toast({ variant: 'destructive', title: 'No Members Selected', description: 'Please select members to process collection for.' });
            return;
        }
        newTransactions = selectedMemberIds.map(memberId => {
          const member = allMembers.find(m => m.id === memberId)!;
          return {
            id: `saving-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${memberId}`,
            memberId: member.id,
            memberName: member.fullName,
            amount: member.expectedMonthlySaving || 0,
            date: transactionDate,
            month: transactionMonthString,
            transactionType: 'deposit',
            status: 'pending',
            depositMode: batchDetails.depositMode,
            paymentDetails: batchDetails.depositMode === 'Cash' ? undefined : batchDetails.paymentDetails,
          };
        }).filter(tx => tx.amount > 0);

    } else { // Excel mode
        const validRows = parsedData.filter(d => d.status === 'Valid');
        if (validRows.length === 0) {
            toast({ variant: 'destructive', title: 'No Valid Data', description: 'There are no valid transactions from the Excel file to submit.' });
            return;
        }
         newTransactions = validRows.map(row => ({
            id: `saving-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${row.memberId}`,
            memberId: row.memberId!,
            memberName: row.memberName!,
            amount: row.Amount,
            date: transactionDate,
            month: transactionMonthString,
            transactionType: 'deposit',
            status: 'pending',
            depositMode: batchDetails.depositMode,
            paymentDetails: batchDetails.depositMode === 'Cash' ? undefined : batchDetails.paymentDetails,
        }));
    }

    if ((batchDetails.depositMode === 'Bank' || batchDetails.depositMode === 'Wallet') && !batchDetails.paymentDetails?.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${batchDetails.depositMode} Name.` });
        return;
    }

    setIsPosting(true);
    setTimeout(() => {
      setAllSavings(prev => [...newTransactions, ...prev]);
      toast({ title: 'Collection Submitted', description: `Successfully submitted ${newTransactions.length} savings collections for approval.` });
      setIsPosting(false);
      setEligibleMembers([]); 
      setSelectedMemberIds([]);
      setParsedData([]);
      setExcelFile(null);
      setPostedTransactions(newTransactions);
    }, 1000);
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

  return (
    <div className="space-y-8">
      <PageTitle title="Group Monthly Collection" subtitle="Process expected monthly savings and share contributions for a group of members." />

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
                    <Label htmlFor="schoolFilter">School</Label>
                    <Select value={selectedSchool} onValueChange={handleFilterChange(setSelectedSchool)}>
                      <SelectTrigger id="schoolFilter"><SelectValue placeholder="Select School" /></SelectTrigger>
                      <SelectContent>{allSchools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="accountTypeFilter">Saving Account Type</Label>
                    <Select value={selectedAccountType} onValueChange={handleFilterChange(setSelectedAccountType)}>
                      <SelectTrigger id="accountTypeFilter"><SelectValue placeholder="Select Account Type" /></SelectTrigger>
                      <SelectContent>{mockSavingAccountTypes.map(sat => <SelectItem key={sat.id} value={sat.id}>{sat.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="yearFilter">Year</Label>
                    <Select value={selectedYear} onValueChange={handleFilterChange(setSelectedYear)}>
                      <SelectTrigger id="yearFilter"><SelectValue placeholder="Select Year" /></SelectTrigger>
                      <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="monthFilter">Month</Label>
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
                                  <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAllChange} />
                                </TableHead>
                                <TableHead>Member Name</TableHead>
                                <TableHead>Account Number</TableHead>
                                <TableHead className="text-right">Exp. Monthly Saving ($)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {eligibleMembers.map(member => (
                                <TableRow key={member.id} data-state={selectedMemberIds.includes(member.id) ? 'selected' : undefined}>
                                  <TableCell className="px-2">
                                    <Checkbox checked={selectedMemberIds.includes(member.id)} onCheckedChange={(checked) => handleRowSelectChange(member.id, !!checked)} />
                                  </TableCell>
                                  <TableCell className="font-medium">{member.fullName}</TableCell>
                                  <TableCell>{member.savingsAccountNumber || 'N/A'}</TableCell>
                                  <TableCell className="text-right">${(member.expectedMonthlySaving || 0).toFixed(2)}</TableCell>
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
                        <CardDescription>Select an Excel file (.xlsx, .xls, .csv) with columns for savings account number and amount.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-4 items-start">
                        <div className="grid w-full max-w-sm items-center gap-1.5 flex-grow">
                            <Label htmlFor="excel-upload">Excel File</Label>
                            <Input id="excel-upload" type="file" onChange={handleFileChange} accept=".xlsx, .xls, .csv" />
                        </div>
                        <Button onClick={handleProcessFile} disabled={isParsing || !excelFile} className="w-full sm:w-auto mt-4 sm:mt-6">
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
                                    <TableRow key={index}>
                                        <TableCell>{row.memberName || 'N/A'}</TableCell>
                                        <TableCell>{row['Savings Account Number']}</TableCell>
                                        <TableCell className="text-right">${row.Amount.toFixed(2)}</TableCell>
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

            {((collectionMode === 'filter' && eligibleMembers.length > 0) || (collectionMode === 'excel' && parsedData.length > 0)) && (
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
                                    <span>${collectionMode === 'filter' ? summaryForSelection.totalExpectedSaving.toFixed(2) : excelSummary.totalAmount.toFixed(2)}</span>
                                </div>
                            </CardContent>
                          </Card>
                    </CardHeader>
                    <CardContent>
                       <div className="space-y-4">
                            <div>
                                <Label htmlFor="batchDetails.date">Transaction Date</Label>
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
                                            <Label htmlFor="paymentDetails.sourceNameBatch">{batchDetails.depositMode} Name</Label>
                                            <Input id="paymentDetails.sourceNameBatch" name="paymentDetails.sourceName" placeholder={`Enter ${batchDetails.depositMode} Name`} value={batchDetails.paymentDetails?.sourceName || ''} onChange={handleBatchDetailChange} />
                                        </div>
                                        <div>
                                            <Label htmlFor="paymentDetails.transactionReferenceBatch">Transaction Reference</Label>
                                            <Input id="paymentDetails.transactionReferenceBatch" name="paymentDetails.transactionReference" placeholder="e.g., TRN123XYZ" value={batchDetails.paymentDetails?.transactionReference || ''} onChange={handleBatchDetailChange} />
                                        </div>
                                    </div>
                                    <div className="pl-3">
                                        <FileUpload
                                            id="paymentDetails.evidenceUrlBatch"
                                            label="Evidence Attachment"
                                            value={batchDetails.paymentDetails?.evidenceUrl || ''}
                                            onValueChange={(newValue) => {
                                                setBatchDetails(prev => ({
                                                    ...prev,
                                                    paymentDetails: {
                                                        ...(prev?.paymentDetails || {}),
                                                        evidenceUrl: newValue,
                                                    }
                                                }));
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
                        disabled={isPosting || (collectionMode === 'filter' && selectedMemberIds.length === 0) || (collectionMode === 'excel' && excelSummary.count === 0)} 
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
                                <TableHead className="text-right">Amount ($)</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Month</TableHead>
                                <TableHead>Deposit Mode</TableHead>
                                <TableHead>Source/Reference</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {postedTransactions.length > 0 ? postedTransactions.map(transaction => (
                                <TableRow key={transaction.id}>
                                    <TableCell className="font-medium">{transaction.memberName}</TableCell>
                                    <TableCell className="text-right">${transaction.amount.toFixed(2)}</TableCell>
                                    <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                                    <TableCell>{transaction.month}</TableCell>
                                    <TableCell><Badge variant={transaction.depositMode === 'Cash' ? 'secondary' : 'outline'}>{transaction.depositMode}</Badge></TableCell>
                                    <TableCell className="text-xs">
                                        {transaction.paymentDetails?.sourceName && <div><strong>Source:</strong> {transaction.paymentDetails.sourceName}</div>}
                                        {transaction.paymentDetails?.transactionReference && <div><strong>Ref:</strong> {transaction.paymentDetails.transactionReference}</div>}
                                        {transaction.paymentDetails?.evidenceUrl && <div><strong>Evidence:</strong> {transaction.paymentDetails.evidenceUrl}</div>}
                                        {!transaction.paymentDetails && transaction.depositMode !== 'Cash' && <span className="text-muted-foreground">N/A</span>}
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

    
