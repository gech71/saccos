

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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { LoanType, School, Member } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { Filter, DollarSign, Banknote, Wallet, Loader2, CheckCircle, RotateCcw, UploadCloud, FileCheck2, FileDown, Download } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUpload } from '@/components/file-upload';
import { Badge } from '@/components/ui/badge';
import { getGroupLoanRepaymentsPageData, getLoansByCriteria, recordBatchRepayments, type LoanWithMemberInfo, type RepaymentBatchData } from './actions';
import { useAuth } from '@/contexts/auth-context';
import * as XLSX from 'xlsx';
import { exportToExcel } from '@/lib/utils';

const initialBatchTransactionState: {
  paymentDate: string;
  depositMode: 'Cash' | 'Bank' | 'Wallet';
  paymentDetails: {
    sourceName: string;
    transactionReference: string;
    evidenceUrl: string;
  };
} = {
  paymentDate: new Date().toISOString().split('T')[0],
  depositMode: 'Cash',
  paymentDetails: {
    sourceName: '',
    transactionReference: '',
    evidenceUrl: '',
  },
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const months = [
  { value: '0', label: 'January' }, { value: '1', label: 'February' }, { value: '2', label: 'March' },
  { value: '3', label: 'April' }, { value: '4', label: 'May' }, { value: '5', label: 'June' },
  { value: '6', label: 'July' }, { value: '7', label: 'August' }, { value: '8', label: 'September' },
  { value: '9', label: 'October' }, { value: '10', label: 'November' }, { value: '11', label: 'December' }
];

type ParsedLoanRepayment = {
  'MemberID'?: string;
  'LoanID'?: string;
  'RepaymentAmount'?: number;
  loanId?: string;
  memberName?: string;
  loanAccountNumber?: string;
  status: 'Valid' | 'Invalid MemberID' | 'Invalid LoanID' | 'Duplicate LoanID' | 'Invalid Data';
};

export default function GroupLoanRepaymentsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [allSchools, setAllSchools] = useState<Pick<School, 'id', 'name'>[]>([]);
  const [loanTypes, setLoanTypes] = useState<Pick<LoanType, 'id', 'name'>[]>([]);
  const [allMembers, setAllMembers] = useState<Pick<Member, 'id', 'fullName'>[]>([]);

  const [isLoadingLoans, setIsLoadingLoans] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [collectionMode, setCollectionMode] = useState<'filter' | 'excel'>('filter');

  // Filter-based state
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedLoanType, setSelectedLoanType] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [eligibleLoans, setEligibleLoans] = useState<LoanWithMemberInfo[]>([]);
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [repaymentAmounts, setRepaymentAmounts] = useState<Record<string, number>>({});
  
  // Excel-based state
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedLoanRepayment[]>([]);
  
  // Shared state
  const [batchDetails, setBatchDetails] = useState(initialBatchTransactionState);
  const [isPosting, setIsPosting] = useState(false);
  const [postedTransactions, setPostedTransactions] = useState<RepaymentBatchData | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const canCreate = useMemo(() => user?.permissions.includes('groupLoanRepayment:create'), [user]);

  useEffect(() => {
    async function fetchInitialData() {
        setIsPageLoading(true);
        const data = await getGroupLoanRepaymentsPageData();
        setAllSchools(data.schools);
        setLoanTypes(data.loanTypes);
        setAllMembers(data.allMembersForValidation);
        setIsPageLoading(false);
    }
    fetchInitialData();
  }, []);

  const paginatedLoans = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return eligibleLoans.slice(startIndex, endIndex);
  }, [eligibleLoans, currentPage, rowsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(eligibleLoans.length / rowsPerPage);
  }, [eligibleLoans.length, rowsPerPage]);

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

  const handleLoadLoans = async () => {
    if (!selectedSchool) {
      toast({ variant: 'destructive', title: 'Missing Filters', description: 'Please select a school.' });
      return;
    }
    setIsLoadingLoans(true);
    setPostedTransactions(null);
    setRepaymentAmounts({});
    try {
        const criteria = {
            schoolId: selectedSchool,
            loanTypeId: selectedLoanType === 'all' ? undefined : selectedLoanType,
        }
        const loans = await getLoansByCriteria(criteria);
        setEligibleLoans(loans);
        
        const initialRepayments: Record<string, number> = {};
        loans.forEach(loan => {
            const interestForMonth = loan.remainingBalance * (loan.interestRate / 12);
            const principalPortion = loan.loanTerm > 0 ? loan.principalAmount / loan.loanTerm : 0;
            const standardPayment = principalPortion + interestForMonth;
            const finalPayment = loan.remainingBalance + interestForMonth;
            initialRepayments[loan.id] = Math.min(standardPayment, finalPayment);
        });
        setRepaymentAmounts(initialRepayments);
        setSelectedLoanIds(loans.map(l => l.id));
        
        if (loans.length === 0) {
            toast({ title: 'No Active Loans Found', description: 'No active or overdue loans for the selected criteria.' });
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load loans.' });
    } finally {
        setIsLoadingLoans(false);
    }
  };
  
  const handleSelectAllChange = (checked: boolean) => {
    setSelectedLoanIds(checked ? eligibleLoans.map(loan => loan.id) : []);
  };

  const handleRowSelectChange = (loanId: string, checked: boolean) => {
    setSelectedLoanIds(prev =>
      checked ? [...prev, loanId] : prev.filter(id => id !== loanId)
    );
  };
  
  const isAllSelected = eligibleLoans.length > 0 && selectedLoanIds.length === eligibleLoans.length;

  const handleRepaymentAmountChange = (loanId: string, amount: string) => {
    setRepaymentAmounts(prev => ({ ...prev, [loanId]: parseFloat(amount) || 0 }));
  };

  const totalToCollect = useMemo(() => {
    return selectedLoanIds.reduce((sum, loanId) => {
        return sum + (repaymentAmounts[loanId] || 0);
    }, 0);
  }, [repaymentAmounts, selectedLoanIds]);

  const handleBatchDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nameParts = name.split('.');
    if (nameParts.length > 1 && nameParts[0] === 'paymentDetails') {
        const fieldName = nameParts[1] as keyof typeof initialBatchTransactionState.paymentDetails;
        setBatchDetails(prev => ({
            ...prev,
            paymentDetails: {
                ...(prev.paymentDetails),
                [fieldName]: value,
            }
        }));
    } else {
       setBatchDetails(prev => ({ ...prev, [name]: value as string }));
    }
  };
  
  const handleDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setBatchDetails(prev => ({ ...prev, depositMode: value }));
  };

  const handleSubmitCollection = async () => {
    if ((batchDetails.depositMode === 'Bank' || batchDetails.depositMode === 'Wallet') && !batchDetails.paymentDetails.sourceName) {
        toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${batchDetails.depositMode} Name.` });
        return;
    }

    let repaymentsToProcess: RepaymentBatchData = [];

    if (collectionMode === 'filter') {
        repaymentsToProcess = selectedLoanIds
            .map(loanId => {
                const loan = eligibleLoans.find(l => l.id === loanId);
                return {
                    loanId,
                    loanAccountNumber: loan?.loanAccountNumber || 'N/A',
                    amountPaid: repaymentAmounts[loanId] || 0,
                    paymentDate: batchDetails.paymentDate,
                    depositMode: batchDetails.depositMode,
                    paymentDetails: batchDetails.depositMode === 'Cash' ? undefined : batchDetails.paymentDetails,
                }
            })
            .filter(({ amountPaid }) => amountPaid > 0);
    } else { // Excel mode
        repaymentsToProcess = parsedData
            .filter(row => row.status === 'Valid' && row.loanId)
            .map(row => ({
                loanId: row.loanId!,
                loanAccountNumber: row.loanAccountNumber || 'N/A',
                amountPaid: row.RepaymentAmount || 0,
                paymentDate: batchDetails.paymentDate,
                depositMode: batchDetails.depositMode,
                paymentDetails: batchDetails.depositMode === 'Cash' ? undefined : batchDetails.paymentDetails,
            }));
    }
    
    if (repaymentsToProcess.length === 0) {
      toast({ variant: 'destructive', title: 'No Payments Entered', description: 'Please enter repayment amounts for at least one selected loan.' });
      return;
    }
    
    setIsPosting(true);
    const result = await recordBatchRepayments(repaymentsToProcess);
    if (result.success) {
        toast({ title: 'Repayments Recorded', description: result.message });
        setPostedTransactions(repaymentsToProcess);
        setEligibleLoans([]);
        setRepaymentAmounts({});
        setParsedData([]);
        setExcelFile(null);
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsPosting(false);
  };
  
  const startNewBatch = () => {
    setPostedTransactions(null);
    setSelectedSchool('');
    setSelectedLoanType('all');
    setEligibleLoans([]);
    setRepaymentAmounts({});
    setBatchDetails(initialBatchTransactionState);
  };
  
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setExcelFile(file);
            setParsedData([]);
        }
    };
    
    const handleProcessFile = async () => {
        if (!excelFile) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select an Excel file.' });
            return;
        }
        setIsParsing(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const dataRows = XLSX.utils.sheet_to_json<any>(worksheet);

                const seenLoanIDs = new Set<string>();
                
                // Fetch ALL active loans to validate against
                const allActiveLoans = await getLoansByCriteria({ schoolId: 'all', loanTypeId: 'all' });
                const loanMap = new Map(allActiveLoans.map(l => [l.id, l]));

                const validatedData = dataRows.map((row): ParsedLoanRepayment => {
                    const memberId = row['MemberID']?.toString().trim();
                    const loanId = row['LoanID']?.toString().trim();
                    const amount = parseFloat(row['RepaymentAmount']);

                    if (!memberId || !loanId || isNaN(amount) || amount <= 0) {
                        return { 'MemberID': memberId, 'LoanID': loanId, 'RepaymentAmount': amount, status: 'Invalid Data' };
                    }
                    
                    if (seenLoanIDs.has(loanId)) {
                        return { 'MemberID': memberId, 'LoanID': loanId, 'RepaymentAmount': amount, status: 'Duplicate LoanID' };
                    }
                    
                    const member = allMembers.find(m => m.id === memberId);
                    if (!member) {
                        return { 'MemberID': memberId, 'LoanID': loanId, 'RepaymentAmount': amount, status: 'Invalid MemberID' };
                    }

                    const loan = loanMap.get(loanId);
                    if (!loan || loan.memberId !== memberId) {
                         return { 'MemberID': memberId, 'LoanID': loanId, 'RepaymentAmount': amount, status: 'Invalid LoanID' };
                    }
                    
                    seenLoanIDs.add(loanId);
                    return { 'MemberID': memberId, 'LoanID': loanId, 'RepaymentAmount': amount, loanId: loan.id, memberName: member.fullName, loanAccountNumber: loan.loanAccountNumber, status: 'Valid' };
                });

                setParsedData(validatedData);
                toast({ title: 'File Processed', description: `Found ${dataRows.length} records. See validation status.` });
            } catch (error) {
                toast({ variant: 'destructive', title: 'Parsing Error', description: 'Could not process file. Ensure it has columns: "MemberID", "LoanID", "RepaymentAmount".' });
            } finally {
                setIsParsing(false);
            }
        };
        reader.readAsBinaryString(excelFile);
    };

    const getValidationBadge = (status: ParsedLoanRepayment['status']) => {
        switch (status) {
          case 'Valid': return <Badge variant="default">Valid</Badge>;
          case 'Invalid MemberID': return <Badge variant="destructive">Invalid Member</Badge>;
          case 'Invalid LoanID': return <Badge variant="destructive">Invalid Loan</Badge>;
          case 'Duplicate LoanID': return <Badge variant="destructive">Duplicate</Badge>;
          case 'Invalid Data': return <Badge variant="destructive">Invalid Data</Badge>;
        }
    };
    
    const handleDownloadTemplate = () => {
        const templateData = [{
            MemberID: 'member-id-123',
            LoanID: 'loan-id-abc',
            RepaymentAmount: 1500.50
        }];
        exportToExcel(templateData, 'loan_repayment_template');
    };


    if (isPageLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    const renderFilterContent = () => (
        <Card className="shadow-lg animate-in fade-in-50 duration-300">
            <CardHeader>
              <CardTitle className="font-headline text-primary">2. Load Members by Filter</CardTitle>
              <CardDescription>Select filters to load all active loans for its members.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <Label htmlFor="schoolFilter">School <span className="text-destructive">*</span></Label>
                <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                  <SelectTrigger id="schoolFilter"><SelectValue placeholder="Select School" /></SelectTrigger>
                  <SelectContent>{allSchools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="loanTypeFilter">Loan Type</Label>
                <Select value={selectedLoanType} onValueChange={setSelectedLoanType}>
                  <SelectTrigger id="loanTypeFilter"><SelectValue placeholder="Select Loan Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Loan Types</SelectItem>
                    {loanTypes.map(lt => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="yearFilter">Repayment for Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger id="yearFilter"><SelectValue placeholder="Select Year" /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="monthFilter">Repayment for Month</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger id="monthFilter"><SelectValue placeholder="Select Month" /></SelectTrigger>
                  <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-4 flex justify-end">
                <Button onClick={handleLoadLoans} disabled={isLoadingLoans || !selectedSchool} className="w-full md:w-auto">
                    {isLoadingLoans ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                    Load Loans
                </Button>
              </div>
            </CardContent>
            {eligibleLoans.length > 0 && renderLoadedLoansTable()}
        </Card>
    );

    const renderExcelContent = () => (
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
                        <p>2. Fill the sheet with your repayment data. The required columns are: <strong>MemberID</strong>, <strong>LoanID</strong>, and <strong>RepaymentAmount</strong>.</p>
                        <p>3. Upload the completed file below and click "Process File" to validate your data before submission.</p>
                    </CardContent>
                    <CardFooter>
                         <Button type="button" variant="secondary" onClick={handleDownloadTemplate} size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Download Template
                        </Button>
                    </CardFooter>
                </Card>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <div className="grid w-full max-w-sm items-center gap-1.5 flex-grow">
                        <Label htmlFor="excel-upload">Excel File <span className="text-destructive">*</span></Label>
                        <Input id="excel-upload" type="file" onChange={handleFileChange} accept=".xlsx, .xls, .csv" disabled={!canCreate} />
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
                           <TableHead>Loan ID</TableHead>
                           <TableHead className="text-right">Amount</TableHead>
                           <TableHead>Status</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                        {parsedData.map((row, index) => (
                            <TableRow key={index} data-state={row.status !== 'Valid' ? 'error' : undefined} className={row.status !== 'Valid' ? 'bg-destructive/10' : ''}>
                                <TableCell>{row.memberName || 'N/A'}</TableCell>
                                <TableCell>{row.LoanID}</TableCell>
                                <TableCell className="text-right">{row.RepaymentAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
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
    
    const renderSubmitCard = () => {
        const validRepayments = collectionMode === 'filter' ? selectedLoanIds.filter(id => (repaymentAmounts[id] || 0) > 0) : parsedData.filter(d => d.status === 'Valid');
        const totalAmount = collectionMode === 'filter' ? totalToCollect : parsedData.filter(d => d.status === 'Valid').reduce((sum, row) => sum + (row.RepaymentAmount || 0), 0);
        
        if (validRepayments.length === 0) return null;

        return (
            <Card className="shadow-lg animate-in fade-in duration-300">
                <CardHeader>
                    <CardTitle className="font-headline text-primary">3. Batch Payment Details</CardTitle>
                     <p className="text-sm text-muted-foreground">This information will be applied to all submitted repayments in this batch.</p>
                      <Card className="bg-muted/50 p-4">
                        <CardTitle className="text-base flex justify-between items-center">
                            <span>Summary for Submission</span>
                             <Badge>{validRepayments.length} Repayment(s)</Badge>
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
                            <Label htmlFor="batchDetails.paymentDate">Payment Date <span className="text-destructive">*</span></Label>
                            <Input id="batchDetails.paymentDate" name="paymentDate" type="date" value={batchDetails.paymentDate || ''} onChange={handleBatchDetailChange} required disabled={!canCreate} />
                        </div>
                        <div>
                            <Label htmlFor="depositModeBatch">Payment Mode</Label>
                            <RadioGroup id="depositModeBatch" value={batchDetails.depositMode || 'Cash'} onValueChange={handleDepositModeChange} className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="cashBatch" disabled={!canCreate} /><Label htmlFor="cashBatch">Cash</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="bankBatch" disabled={!canCreate} /><Label htmlFor="bankBatch">Bank</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="Wallet" id="walletBatch" disabled={!canCreate} /><Label htmlFor="walletBatch">Wallet</Label></div>
                            </RadioGroup>
                        </div>

                        {(batchDetails.depositMode === 'Bank' || batchDetails.depositMode === 'Wallet') && (
                            <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
                                    <div>
                                        <Label htmlFor="paymentDetails.sourceNameBatch">{batchDetails.depositMode} Name <span className="text-destructive">*</span></Label>
                                        <Input id="paymentDetails.sourceNameBatch" name="paymentDetails.sourceName" placeholder={`Enter ${batchDetails.depositMode} Name`} value={batchDetails.paymentDetails?.sourceName || ''} onChange={handleBatchDetailChange} disabled={!canCreate} />
                                    </div>
                                    <div>
                                        <Label htmlFor="paymentDetails.transactionReferenceBatch">Transaction Reference</Label>
                                        <Input id="paymentDetails.transactionReferenceBatch" name="paymentDetails.transactionReference" placeholder="e.g., TRN123XYZ" value={batchDetails.paymentDetails?.transactionReference || ''} onChange={handleBatchDetailChange} disabled={!canCreate} />
                                    </div>
                                </div>
                                 <div className="pl-3">
                                    <FileUpload
                                        id="groupLoanRepaymentEvidence"
                                        label="Evidence Attachment"
                                        value={batchDetails.paymentDetails?.evidenceUrl || ''}
                                        onValueChange={(newValue) => {
                                            setBatchDetails(prev => ({
                                                ...prev,
                                                paymentDetails: {
                                                    ...(prev.paymentDetails),
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
                  <Button onClick={handleSubmitCollection} disabled={isPosting || totalAmount <= 0} className="w-full md:w-auto ml-auto">
                    {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Record {validRepayments.length} Repayments
                  </Button>
                </CardFooter>
            </Card>
        )
    };

    const renderLoadedLoansTable = () => (
        <CardContent>
            <div className="overflow-x-auto rounded-lg border shadow-sm mb-6">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="w-[50px] px-2">
                        <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAllChange}
                        aria-label="Select all loans"
                        disabled={!canCreate}
                        />
                    </TableHead>
                    <TableHead>Member Name</TableHead>
                    <TableHead>Loan Acct. #</TableHead>
                    <TableHead>Remaining Balance</TableHead>
                    <TableHead>Exp. Monthly Repayment</TableHead>
                    <TableHead className="w-[200px]">Amount to be Paid (Birr)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginatedLoans.map(loan => {
                    const interestForMonth = loan.remainingBalance * (loan.interestRate / 12);
                    const principalPortion = loan.loanTerm > 0 ? loan.principalAmount / loan.loanTerm : 0;
                    const standardPayment = principalPortion + interestForMonth;
                    const finalPayment = loan.remainingBalance + interestForMonth;
                    const expectedPayment = Math.min(standardPayment, finalPayment);

                    return (
                    <TableRow key={loan.id} data-state={selectedLoanIds.includes(loan.id) ? 'selected' : undefined}>
                        <TableCell className="px-2">
                        <Checkbox
                            checked={selectedLoanIds.includes(loan.id)}
                            onCheckedChange={(checked) => handleRowSelectChange(loan.id, !!checked)}
                            aria-label={`Select loan for ${loan.member.fullName}`}
                            disabled={!canCreate}
                        />
                        </TableCell>
                        <TableCell className="font-medium">{loan.member.fullName}</TableCell>
                        <TableCell className="font-mono text-xs">{loan.loanAccountNumber}</TableCell>
                        <TableCell className="text-right">{loan.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                        <TableCell className="text-right">{expectedPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                        <TableCell>
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={repaymentAmounts[loan.id] || ''}
                            onChange={(e) => handleRepaymentAmountChange(loan.id, e.target.value)}
                            className="text-right"
                            disabled={!selectedLoanIds.includes(loan.id) || !canCreate}
                        />
                        </TableCell>
                    </TableRow>
                    )
                    })}
                </TableBody>
                </Table>
            </div>
            {eligibleLoans.length > 0 && (
                <div className="flex flex-col items-center gap-4 pt-4">
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </Button>
                        <div className="flex items-center gap-1">
                            {paginationItems.map((item, index) =>
                                typeof item === 'number' ? (
                                    <Button
                                        key={index}
                                        variant={currentPage === item ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-9 w-9 p-0"
                                        onClick={() => setCurrentPage(item)}
                                    >
                                        {item}
                                    </Button>
                                ) : (
                                    <span key={index} className="px-2">{item}</span>
                                )
                            )}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                        >
                            Next
                        </Button>
                    </div>
                    <div className="flex items-center space-x-6 lg:space-x-8 text-sm text-muted-foreground">
                        <div>Page {currentPage} of {totalPages || 1}</div>
                        <div>{eligibleLoans.length} loan(s) found.</div>
                        <div className="flex items-center space-x-2">
                            <p className="font-medium">Rows:</p>
                            <Select
                                value={`${rowsPerPage}`}
                                onValueChange={(value) => {
                                    setRowsPerPage(Number(value));
                                    setCurrentPage(1);
                                }}
                            >
                                <SelectTrigger className="h-8 w-[70px]">
                                    <SelectValue placeholder={`${rowsPerPage}`} />
                                </SelectTrigger>
                                <SelectContent side="top">
                                    {[10, 15, 20, 25, 50].map((pageSize) => (
                                        <SelectItem key={pageSize} value={`${pageSize}`}>
                                            {pageSize}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            )}
        </CardContent>
    );

  return (
    <div className="space-y-8">
      <PageTitle title="Group Loan Repayments" subtitle="Process loan repayments for a group of members." />

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
                        <CardTitle className="font-headline text-primary">Repayments Recorded Successfully</CardTitle>
                        <CardDescription>The following loan repayments have been recorded and balances have been updated.</CardDescription>
                    </div>
                    <Button onClick={startNewBatch} variant="outline">
                        <RotateCcw className="mr-2 h-4 w-4" /> Start New Batch Repayment
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                 <div className="overflow-x-auto rounded-lg border shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Loan Acct. #</TableHead>
                                <TableHead className="text-right">Amount Paid (Birr)</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Payment Mode</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {postedTransactions.map(transaction => (
                                <TableRow key={transaction.loanId}>
                                    <TableCell className="font-mono text-xs">{transaction.loanAccountNumber}</TableCell>
                                    <TableCell className="text-right">{transaction.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                                    <TableCell>{new Date(transaction.paymentDate).toLocaleDateString()}</TableCell>
                                    <TableCell><Badge variant={transaction.depositMode === 'Cash' ? 'secondary' : 'outline'}>{transaction.depositMode}</Badge></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
