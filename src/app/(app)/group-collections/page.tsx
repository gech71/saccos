

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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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
import type { Saving, SavingAccountType, ServiceChargeType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { Filter, Users, DollarSign, Banknote, Wallet, Loader2, CheckCircle, RotateCcw, FileCheck2, FileDown, Check, ChevronsUpDown, AlertCircle, Download, ReceiptText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/file-upload';
import * as XLSX from 'xlsx';
import { getGroupCollectionsPageData, recordBatchSavings, type GroupCollectionsPageData, type MemberWithSavingAccounts } from './actions';
import { useAuth } from '@/contexts/auth-context';
import { exportToExcel } from '@/lib/utils';
import { cn } from '@/lib/utils';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 11 }, (_, i) => currentYear - 10 + i).reverse();
const months = [
  { value: '0', label: 'January' }, { value: '1', label: 'February' }, { value: '2', label: 'March' },
  { value: '3', label: 'April' }, { value: '4', label: 'May' }, { value: '5', label: 'June' },
  { value: '6', label: 'July' }, { value: '7', label: 'August' }, { value: '8', label: 'September' },
  { value: '9', label: 'October' }, { value: '10', label: 'November' }, { value: '11', label: 'December' }
];

type BatchDetails = {
  date: string;
  depositMode: 'Cash' | 'Bank' | 'Wallet';
  sourceName?: string;
  transactionReference?: string;
  evidenceUrl?: string;
};

const initialBatchTransactionState: BatchDetails = {
  date: new Date().toISOString().split('T')[0],
  depositMode: 'Cash',
};

type EligibleAccount = {
    memberId: string;
    fullName: string;
    accountId: string;
    accountNumber: string;
    expectedMonthlySaving: number;
    monthlyServiceCharges: number;
    schoolName: string;
}

interface ParsedExcelData {
  'MemberID'?: string;
  'SavingCollected'?: number;
  memberName?: string;
  memberId?: string;
  accountId?: string;
  status: 'Valid' | 'Invalid MemberID' | 'Duplicate' | 'Invalid Data';
}

export default function GroupCollectionsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [pageData, setPageData] = useState<GroupCollectionsPageData | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  const [batchDetails, setBatchDetails] = useState<BatchDetails>(initialBatchTransactionState);
  const [isPosting, setIsPosting] = useState(false);
  const [postedTransactions, setPostedTransactions] = useState<any[] | null>(null);
  const [collectionMode, setCollectionMode] = useState<'filter' | 'excel'>('filter');

  // FILTER-BASED COLLECTION STATE
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [openSchoolCombobox, setOpenSchoolCombobox] = useState(false);
  const [selectedAccountType, setSelectedAccountType] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [eligibleAccounts, setEligibleAccounts] = useState<EligibleAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [collectionAmounts, setCollectionAmounts] = useState<Record<string, number>>({});
  
  // EXCEL-BASED COLLECTION STATE
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedExcelData[]>([]);

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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
  
  useEffect(() => {
      setSelectedAccountType('');
      setEligibleAccounts([]);
      setSelectedIds([]);
  }, [selectedSchool]);

  const paginatedEligibleItems = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return eligibleAccounts.slice(startIndex, endIndex);
  }, [eligibleAccounts, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(eligibleAccounts.length / rowsPerPage);
  }, [eligibleAccounts, rowsPerPage]);

  const getPaginationItems = () => {
    if (totalPages <= 1) return [];
    const delta = 1;
    const left = currentPage - delta;
    const right = currentPage + delta + 1;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= left && i < right)) {
            range.push(i);
        }
    }

    let l: number | undefined;
    for (const i of range) {
        if (l) {
            if (i - l === 2) {
                rangeWithDots.push(l + 1);
            } else if (i - l !== 1) {
                rangeWithDots.push('...');
            }
        }
        rangeWithDots.push(i);
        l = i;
    }

    return rangeWithDots;
  };
  
  const paginationItems = getPaginationItems();

  const handleLoadMembers = () => {
    if (!selectedAccountType || !selectedSchool || !selectedYear || !selectedMonth || !pageData) {
      toast({ variant: 'destructive', title: 'Missing Filters', description: 'Please select school, saving account type, year, and month.' });
      return;
    }
    setIsLoadingMembers(true);
    setPostedTransactions(null); 
    
    setTimeout(() => {
        const schoolName = pageData.schools.find(s => s.id === selectedSchool)?.name || 'N/A';
        const totalMonthlyCharges = pageData.monthlyServiceCharges.reduce((sum, charge) => sum + charge.amount, 0);
        
        const filteredAccounts: EligibleAccount[] = [];
        pageData.members.forEach(member => {
            if (member.schoolId === selectedSchool) {
                member.memberSavingAccounts.forEach(account => {
                    if (account.savingAccountType?.id === selectedAccountType && (account.expectedMonthlySaving ?? 0) > 0) {
                        filteredAccounts.push({
                            memberId: member.id,
                            fullName: member.fullName,
                            accountId: account.id,
                            accountNumber: account.accountNumber,
                            expectedMonthlySaving: account.expectedMonthlySaving,
                            monthlyServiceCharges: totalMonthlyCharges,
                            schoolName: schoolName
                        });
                    }
                });
            }
        });
        setEligibleAccounts(filteredAccounts);
        setSelectedIds(filteredAccounts.map(acc => acc.accountId)); 
        const initialAmounts: Record<string, number> = {};
        filteredAccounts.forEach(acc => {
            initialAmounts[acc.accountId] = acc.expectedMonthlySaving;
        });
        setCollectionAmounts(initialAmounts);
        if (filteredAccounts.length === 0) {
          toast({ title: 'No Eligible Savings Accounts', description: 'No member accounts match the selected criteria or have an expected monthly saving.' });
        }

      setIsLoadingMembers(false);
    }, 300);
  };
  
  const handleSelectAllChange = (checked: boolean) => {
    const allIds = eligibleAccounts.map(acc => acc.accountId);
    setSelectedIds(checked ? allIds : []);
  };

  const handleRowSelectChange = (id: string, checked: boolean) => {
    setSelectedIds(prev =>
      checked ? [...prev, id] : prev.filter(rowId => rowId !== id)
    );
  };
  
  const handleCollectionAmountChange = (id: string, amount: string) => {
    setCollectionAmounts(prev => ({ ...prev, [id]: parseFloat(amount) || 0 }));
  };

  const isAllSelected = eligibleAccounts.length > 0 && selectedIds.length === eligibleAccounts.length;

  const summaryForSelection = useMemo(() => {
    const totalAmountToCollect = selectedIds.reduce((sum, id) => {
        return sum + (collectionAmounts[id] || 0);
    }, 0);
    return {
      count: selectedIds.length,
      totalExpected: totalAmountToCollect,
    };
  }, [selectedIds, collectionAmounts]);

  const handleExport = () => {
    if (eligibleAccounts.length === 0 || !pageData) {
        toast({ variant: 'destructive', title: 'No Data', description: 'There is no data to export.' });
        return;
    }
    const dataToExport = eligibleAccounts.map(item => ({
      'Member Name': item.fullName,
      'Account Number': item.accountNumber,
      'School': item.schoolName,
      'Expected Contribution (Birr)': item.expectedMonthlySaving,
      'Monthly Service Charges (Birr)': item.monthlyServiceCharges,
    }));
    
    const schoolName = pageData?.schools.find(s => s.id === selectedSchool)?.name || 'school';
    const accountTypeName = pageData?.savingAccountTypes.find(s => s.id === selectedAccountType)?.name || 'account';

    exportToExcel(dataToExport, `group_collection_${schoolName.replace(/\s/g, '_')}_${accountTypeName.replace(/\s/g, '_')}`);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setExcelFile(file);
      setParsedData([]); // Reset previous results
    }
  };

  const handleProcessFile = () => {
    if (!excelFile || !pageData || !selectedAccountType || !selectedYear || !selectedMonth) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a Saving Account Type, a Collection Period, and an Excel file.' });
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

        const seenMemberIDs = new Set<string>();
        const validatedData = dataRows.map((row): ParsedExcelData => {
            const memberId = row['MemberID']?.toString().trim();
            const savingCollected = parseFloat(row['SavingCollected']);
            
            if (!memberId || isNaN(savingCollected) || savingCollected <= 0) {
                return { 'MemberID': memberId || 'N/A', 'SavingCollected': savingCollected || 0, status: 'Invalid Data' };
            }
            
            if (seenMemberIDs.has(memberId)) {
                return { 'MemberID': memberId, 'SavingCollected': savingCollected, status: 'Duplicate' };
            }
            
            const member = pageData.members.find(m => m.id === memberId);
            const account = member?.memberSavingAccounts.find(acc => acc.savingAccountType?.id === selectedAccountType);

            if (member && account) {
                seenMemberIDs.add(memberId);
                return { 'MemberID': memberId, 'SavingCollected': savingCollected, memberId: member.id, accountId: account.id, memberName: member.fullName, status: 'Valid' };
            }
            
            return { 'MemberID': memberId, 'SavingCollected': savingCollected, status: 'Invalid MemberID' };
        });

        setParsedData(validatedData);
        toast({ title: 'File Processed', description: `Found ${dataRows.length} records in the file. See validation status below.` });

      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast({ variant: 'destructive', title: 'Parsing Error', description: 'Could not process the file. Ensure it has columns: "MemberID" and "SavingCollected".' });
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
      totalAmount: validRows.reduce((sum, row) => sum + (row.SavingCollected || 0), 0),
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
    const transactionDateObj = new Date(); // Use current date
    const transactionMonthString = `${months[transactionDateObj.getMonth()]?.label} ${transactionDateObj.getFullYear()}`;

    if ((batchDetails.depositMode === 'Bank' || batchDetails.depositMode === 'Wallet') && !batchDetails.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${batchDetails.depositMode} Name.` });
        return;
    }
    
    setIsPosting(true);
    let result;

    const newTransactions: any[] = [];
    if (collectionMode === 'filter') {
        const accountsToProcess = selectedIds
            .map(accountId => {
                const account = eligibleAccounts.find(acc => acc.accountId === accountId);
                return {
                    account: account!,
                    amount: collectionAmounts[accountId] || 0,
                }
            })
            .filter(({ amount }) => amount > 0);

        if (accountsToProcess.length === 0) {
            toast({ variant: 'destructive', title: 'No Valid Amounts', description: 'Please select accounts and ensure their collection amounts are greater than zero.' });
            setIsPosting(false);
            return;
        }
        accountsToProcess.forEach(({account, amount}) => newTransactions.push({
            memberId: account.memberId, memberSavingAccountId: account.accountId, memberName: account.fullName, amount: amount,
            date: transactionDateObj, month: transactionMonthString, transactionType: 'deposit', status: 'pending',
            depositMode: batchDetails.depositMode, sourceName: batchDetails.sourceName,
            transactionReference: batchDetails.transactionReference, evidenceUrl: batchDetails.evidenceUrl,
        }));
    } else { // Excel
         const validRows = parsedData.filter(d => d.status === 'Valid');
         if (validRows.length === 0) {
            toast({ variant: 'destructive', title: 'No Valid Data', description: 'There are no valid transactions from the Excel file to submit.' });
            setIsPosting(false);
            return;
        }
         validRows.forEach(row => newTransactions.push({
            memberId: row.memberId!, memberSavingAccountId: row.accountId!, memberName: row.memberName!, amount: row.SavingCollected!,
            date: transactionDateObj, month: transactionMonthString, transactionType: 'deposit', status: 'pending',
            depositMode: batchDetails.depositMode, sourceName: batchDetails.sourceName,
            transactionReference: batchDetails.transactionReference, evidenceUrl: batchDetails.evidenceUrl,
        }));
    }
    result = await recordBatchSavings(newTransactions);
    setPostedTransactions(newTransactions);

    
    if (result.success) {
        toast({ title: 'Collection Submitted', description: result.message });
        setEligibleAccounts([]); 
        setSelectedIds([]);
        setParsedData([]);
        setExcelFile(null);
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsPosting(false);
  };
  
  const startNewGroupCollection = () => {
    setPostedTransactions(null);
    setSelectedSchool('');
    setSelectedAccountType('');
    setEligibleAccounts([]);
    setSelectedIds([]);
    setExcelFile(null);
    setParsedData([]);
    setBatchDetails(initialBatchTransactionState);
  };

  const getValidationBadge = (status: ParsedExcelData['status']) => {
    switch (status) {
      case 'Valid': return <Badge variant="default">Valid</Badge>;
      case 'Invalid MemberID': return <Badge variant="destructive">Invalid MemberID</Badge>;
      case 'Duplicate': return <Badge variant="destructive">Duplicate</Badge>;
      case 'Invalid Data': return <Badge variant="destructive">Invalid Data</Badge>;
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [{
      MemberID: 'member-id-goes-here',
      SavingCollected: 100.50
    }];
    exportToExcel(templateData, 'savings_collection_template');
  };
  
  if (isLoadingPage || !pageData) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
  }

  const renderFilterContent = () => {
      const items = eligibleAccounts;
      return (
        <Card className="shadow-lg animate-in fade-in-50 duration-300">
            <CardHeader>
              <CardTitle className="font-headline text-primary">2. Load Members by Filter</CardTitle>
              <CardDescription>Select school, saving account type, year, and month to load eligible members.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div>
                <Label htmlFor="schoolFilter">School <span className="text-destructive">*</span></Label>
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
                                value={s.name}
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
                <Label htmlFor="accountTypeFilter">Saving Account Type <span className="text-destructive">*</span></Label>
                <Select value={selectedAccountType} onValueChange={setSelectedAccountType}>
                  <SelectTrigger id="accountTypeFilter"><SelectValue placeholder="Select Account Type" /></SelectTrigger>
                  <SelectContent>{pageData.savingAccountTypes.map(sat => <SelectItem key={sat.id} value={sat.id}>{sat.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="yearFilter">Year <span className="text-destructive">*</span></Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger id="yearFilter"><SelectValue placeholder="Select Year" /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="monthFilter">Month <span className="text-destructive">*</span></Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger id="monthFilter"><SelectValue placeholder="Select Month" /></SelectTrigger>
                  <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={handleLoadMembers} disabled={isLoadingMembers || !selectedSchool || !selectedAccountType || !selectedYear || !selectedMonth} className="w-full lg:w-auto">
                {isLoadingMembers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                Load Members
              </Button>
            </CardContent>
             {items.length > 0 && (
                <CardContent>
                  <div className="flex justify-end mb-4">
                      <Button variant="outline" onClick={handleExport} disabled={items.length === 0}>
                          <FileDown className="mr-2 h-4 w-4" /> Export Loaded Data
                      </Button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border shadow-sm">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px] px-2">
                              <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAllChange} disabled={!canCreate} />
                            </TableHead>
                            <TableHead>Member Name</TableHead>
                            <TableHead>Savings Acct #</TableHead>
                            <TableHead className="text-right">Exp. Monthly Saving</TableHead>
                             <TableHead className="text-right">Monthly Service Charges</TableHead>
                            <TableHead className="w-[200px] text-right">Amount to Collect (Birr)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedEligibleItems.map((item: any) => {
                            const id = item.accountId;
                            const name = item.fullName;
                            const accNum = item.accountNumber;
                            const amount = item.expectedMonthlySaving;
                            const serviceCharges = item.monthlyServiceCharges;
                            const currentAmountPaid = collectionAmounts[id] || 0;

                            return (
                                <TableRow key={id} data-state={selectedIds.includes(id) ? 'selected' : undefined}>
                                <TableCell className="px-2">
                                  <Checkbox checked={selectedIds.includes(id)} onCheckedChange={(checked) => handleRowSelectChange(id, !!checked)} disabled={!canCreate} />
                                </TableCell>
                                <TableCell className="font-medium">{name}</TableCell>
                                <TableCell>{accNum || 'N/A'}</TableCell>
                                <TableCell className="text-right">{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                                <TableCell className="text-right text-muted-foreground">{serviceCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                                <TableCell className="text-right">
                                  <div className='flex flex-col items-end'>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={collectionAmounts[id] || ''}
                                        onChange={(e) => handleCollectionAmountChange(id, e.target.value)}
                                        className="text-right"
                                        disabled={!selectedIds.includes(id) || !canCreate}
                                      />
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                  </div>
                   {items.length > 0 && (
                    <div className="flex flex-col items-center gap-4 pt-4">
                      <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}>Previous</Button>
                          <div className="flex items-center gap-1">
                              {paginationItems.map((item, index) =>
                                  typeof item === 'number' ? (<Button key={index} variant={currentPage === item ? 'default' : 'outline'} size="sm" className="h-9 w-9 p-0" onClick={() => setCurrentPage(item)}>{item}</Button>)
                                  : (<span key={index} className="px-2">{item}</span>)
                              )}
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage >= totalPages}>Next</Button>
                      </div>
                      <div className="flex items-center space-x-6 lg:space-x-8 text-sm text-muted-foreground">
                          <div>Page {currentPage} of {totalPages || 1}</div>
                          <div>{items.length} eligible account(s) found.</div>
                          <div className="flex items-center space-x-2">
                              <p className="font-medium">Rows:</p>
                              <Select value={`${rowsPerPage}`} onValueChange={(value) => { setRowsPerPage(Number(value)); setCurrentPage(1); }}>
                                  <SelectTrigger className="h-8 w-[70px]"><SelectValue placeholder={`${rowsPerPage}`} /></SelectTrigger>
                                  <SelectContent side="top">
                                      {[10, 15, 20, 25, 50].map((pageSize) => (<SelectItem key={pageSize} value={`${pageSize}`}>{pageSize}</SelectItem>))}
                                  </SelectContent>
                              </Select>
                          </div>
                      </div>
                    </div>
                  )}
                </CardContent>
             )}
          </Card>
      );
  }

  const renderExcelContent = () => {
    return (
        <Card className="shadow-lg animate-in fade-in-50 duration-300">
            <CardHeader>
                <CardTitle className="font-headline text-primary">2. Upload Collection File</CardTitle>
                <CardDescription>Upload an Excel file with the required columns. You can download a template to get started.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Card className="bg-muted/50 border-dashed">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">How to Use Excel Upload</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                        <p>1. Download the sample template to see the required format.</p>
                        <p>2. Fill the sheet with your collection data. The required columns are: <strong>MemberID</strong> and <strong>SavingCollected</strong>.</p>
                        <p>3. Choose a Saving Account Type below to assign all imported savings to.</p>
                        <p>4. Upload the completed file and click "Process File" to validate your data before submission.</p>
                    </CardContent>
                    <CardFooter>
                         <Button type="button" variant="secondary" onClick={handleDownloadTemplate} size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Download Template
                        </Button>
                    </CardFooter>
                </Card>
                <div>
                    <Label htmlFor="accountTypeFilterExcel">Saving Account Type <span className="text-destructive">*</span></Label>
                    <Select value={selectedAccountType} onValueChange={setSelectedAccountType}>
                        <SelectTrigger id="accountTypeFilterExcel"><SelectValue placeholder="Select Account Type" /></SelectTrigger>
                        <SelectContent>{pageData?.savingAccountTypes.map(sat => <SelectItem key={sat.id} value={sat.id}>{sat.name}</SelectItem>)}</SelectContent>
                    </Select>
                     <p className="text-xs text-muted-foreground mt-1">All imported savings will be assigned to this account type.</p>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="excelYearFilter">Collection Period <span className="text-destructive">*</span></Label>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger id="excelYearFilter"><SelectValue placeholder="Select Year" /></SelectTrigger>
                            <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="excelMonthFilter">&nbsp;</Label>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger id="excelMonthFilter"><SelectValue placeholder="Select Month" /></SelectTrigger>
                            <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                 <p className="text-xs text-muted-foreground mt-1">Savings will be recorded for the selected month.</p>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <div className="grid w-full max-w-sm items-center gap-1.5 flex-grow">
                        <Label htmlFor="excel-upload">Excel File <span className="text-destructive">*</span></Label>
                        <Input id="excel-upload" type="file" onChange={handleFileChange} accept=".xlsx, .xls, .csv" disabled={!canCreate || !selectedAccountType || !selectedYear || !selectedMonth} />
                    </div>
                    <Button onClick={handleProcessFile} disabled={isParsing || !excelFile || !canCreate} className="w-full sm:w-auto mt-4 sm:mt-6">
                        {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
                        Process File
                    </Button>
                </div>
            </CardContent>
            {parsedData.length > 0 && (
                <CardContent>
                   <div className="overflow-x-auto rounded-lg border shadow-sm">
                     <Table>
                       <TableHeader>
                         <TableRow>
                           <TableHead>Member Name</TableHead>
                           <TableHead>MemberID</TableHead>
                           <TableHead className="text-right">Amount</TableHead>
                           <TableHead>Status</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                        {parsedData.map((row, index) => (
                            <TableRow key={index} data-state={row.status !== 'Valid' ? 'error' : undefined} className={row.status === 'Invalid MemberID' ? 'bg-destructive/10' : row.status === 'Duplicate' ? 'bg-amber-500/10' : ''}>
                                <TableCell>{row.memberName || 'N/A'}</TableCell>
                                <TableCell>{row.MemberID}</TableCell>
                                <TableCell className="text-right">{row.SavingCollected?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                                <TableCell>{getValidationBadge(row.status)}</TableCell>
                            </TableRow>
                        ))}
                       </TableBody>
                     </Table>
                   </div>
                </CardContent>
            )}
        </Card>
    );
  }

  const renderSubmitCard = () => {
    const totalItems = collectionMode === 'filter' ? summaryForSelection.count : excelSummary.count;
    const totalAmount = collectionMode === 'filter' ? summaryForSelection.totalExpected : excelSummary.totalAmount;
    if ((collectionMode === 'filter' && eligibleAccounts.length > 0) || (collectionMode === 'excel' && parsedData.length > 0)) {
        return (
             <Card className="shadow-lg animate-in fade-in duration-300">
                <CardHeader>
                    <CardTitle className="font-headline text-primary">3. Batch Transaction Details</CardTitle>
                     <p className="text-sm text-muted-foreground">This information will be applied to all submitted transactions in this batch.</p>
                      <Card className="bg-muted/50 p-4">
                        <CardTitle className="text-base flex justify-between items-center">
                            <span>Summary for Submission</span>
                             <Badge>{totalItems} Accounts</Badge>
                        </CardTitle>
                        <CardContent className="p-0 pt-2">
                            <div className="text-lg font-bold text-primary flex justify-between items-center">
                                <span>Total Collection Amount:</span>
                                <span>{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</span>
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
                    disabled={isPosting || totalAmount <= 0} 
                    className="w-full md:w-auto ml-auto"
                   >
                      {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                      Submit Collection
                    </Button>
                </CardFooter>
            </Card>
        );
    }
    return null;
  }

  return (
    <div className="space-y-8">
      <PageTitle title="Group Monthly Savings" subtitle="Process expected monthly savings for a group of members." />

      {!postedTransactions && (
        <>
            <Card className="shadow-md">
                <CardHeader><CardTitle className="font-headline text-primary">1. Select Collection Method</CardTitle></CardHeader>
                <CardContent>
                    <div>
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
                    </div>
                </CardContent>
            </Card>

            {collectionMode === 'filter' ? renderFilterContent() : renderExcelContent()}
            {canCreate && renderSubmitCard()}
        </>
      )}

      {postedTransactions && (
        <Card className="shadow-lg animate-in fade-in duration-300">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="font-headline text-primary">Collection Submitted for Approval</CardTitle>
                        <CardDescription>The following savings transactions were submitted. They will not reflect on member balances until approved.</CardDescription>
                    </div>
                    <Button onClick={startNewGroupCollection} variant="outline">
                        <RotateCcw className="mr-2 h-4 w-4" /> Start New Group Collection
                    </Button>
                </div>
                 <p className="text-sm text-muted-foreground mt-2">
                    Total Transactions Submitted: {postedTransactions.length}
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
                                    <TableCell className="text-right">{(transaction.amount || transaction.amountPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                                    <TableCell>{new Date(transaction.date || transaction.paymentDate).toLocaleDateString()}</TableCell>
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
