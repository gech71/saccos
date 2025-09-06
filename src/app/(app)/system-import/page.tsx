

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
import { Filter, DollarSign, Loader2, UploadCloud, FileCheck2, FileDown, Download, CheckCircle, XCircle, ReceiptText } from 'lucide-react';
import { exportToExcel } from '@/lib/utils';
import { getImportPageData, processImport, type ImportPageData, type MemberDataForImport, type ImportPayload } from './actions';
import * as XLSX from 'xlsx';
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

type CollectionInputValues = Record<string, number | { principal: number; term: number } | { principalRepaid: number; interestRepaid: number }>;


type ValidatedRow = {
  memberId: string;
  fullName: string;
  status: 'Valid' | 'Invalid Member ID' | 'No Data to Import';
  data: CollectionInputValues;
  originalRow: any;
};

export default function SystemImportPage() {
  const { toast } = useToast();
  
  const [pageData, setPageData] = useState<ImportPageData | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [membersData, setMembersData] = useState<MemberDataForImport[]>([]);
  
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [validationSummary, setValidationSummary] = useState<{valid: number, invalid: number, total: number} | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);


  useEffect(() => {
    async function fetchData() {
        setIsPageLoading(true);
        const data = await getImportPageData();
        setPageData(data);
        setMembersData(data.members);
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

  const handleSubmit = async () => {
    const validRowsToSubmit = validatedRows.filter(row => row.status === 'Valid');
    if (validRowsToSubmit.length === 0) {
        toast({ variant: 'destructive', title: 'No Valid Data', description: 'There is no valid data to submit for approval.' });
        return;
    }
    
    const payload: ImportPayload = {
      collectionMonth: months[parseInt(selectedMonth)].label,
      collectionYear: selectedYear,
      collections: validRowsToSubmit.map(row => ({ memberId: row.memberId, values: row.data }))
    };
    
    setIsSubmitting(true);
    try {
        await processImport(payload);
        toast({ title: 'Success', description: 'Imported data has been submitted for approval.' });
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
        ...dynamicColumns.savings.flatMap(s => [s.name, `${s.name} Interest`]),
        ...dynamicColumns.shares.map(s => s.name),
        ...dynamicColumns.loans.flatMap(l => [l.name, `${l.name} Repayment Period (Months)`, `${l.name} Principal Repaid`, `${l.name} Interest Repaid`]),
        ...dynamicColumns.serviceCharges.map(sc => sc.name),
    ];
  }
  
  const handleDownloadTemplate = () => {
    if (membersData.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Data is still loading, please wait to generate a template.' });
      return;
    }
    
    const headers = getHeaders();
    const templateData = membersData.map(member => {
        const rowObject: Record<string, any> = { 'Member ID': member.id, 'Full Name': member.fullName };
        dynamicColumns.savings.forEach(s => { 
            rowObject[s.name] = 0;
            rowObject[`${s.name} Interest`] = 0;
        });
        dynamicColumns.shares.forEach(s => { rowObject[s.name] = 0; });
        dynamicColumns.loans.forEach(l => { 
            rowObject[l.name] = 0; 
            rowObject[`${l.name} Repayment Period (Months)`] = l.maxRepaymentPeriod; 
            rowObject[`${l.name} Principal Repaid`] = 0;
            rowObject[`${l.name} Interest Repaid`] = 0;
        });
        dynamicColumns.serviceCharges.forEach(sc => { rowObject[sc.name] = 0; });
        return rowObject;
    });
    
    exportToExcel(templateData, 'system_import_template');
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
    if (membersData.length === 0 || !pageData) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please wait for system data to load before processing a file.' });
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

            const savingTypesMap = new Map(pageData.savingTypes.map(t => [t.name, `saving_${t.id}`]));
            const interestTypesMap = new Map(pageData.savingTypes.map(t => [`${t.name} Interest`, `interest_${t.id}`]));
            const shareTypesMap = new Map(pageData.shareTypes.map(t => [t.name, `share_${t.id}`]));
            const serviceChargeTypesMap = new Map(pageData.serviceChargeTypes.map(t => [t.name, `service_${t.id}`]));
            const loanTypesMap = new Map(pageData.loanTypes.map(t => [t.name, `loan_${t.id}`]));
            const loanRepaymentPrincipalMap = new Map(pageData.loanTypes.map(t => [`${t.name} Principal Repaid`, `loanrepay_${t.id}_principal`]));
            const loanRepaymentInterestMap = new Map(pageData.loanTypes.map(t => [`${t.name} Interest Repaid`, `loanrepay_${t.id}_interest`]));

            const validatedData: ValidatedRow[] = dataRows.map(row => {
                const memberIdFromFile = row['Member ID'];
                const memberId = memberIdFromFile?.toString().trim(); // Convert to string and trim
                const member = membersData.find(m => m.id === memberId);
                const fullName = member?.fullName || row['Full Name'] || 'Unknown Member';
                
                if (!member) {
                    return { memberId, fullName, status: 'Invalid Member ID', data: {}, originalRow: row };
                }

                const collectionValues: CollectionInputValues = {};
                for(const header of headerRow) {
                  if(header === 'Member ID' || header === 'Full Name') continue;
                  
                  const value = parseFloat(row[header]);
                  if(isNaN(value) || value < 0) continue; // Allow 0 for repayments

                  if (value === 0 && !header.includes('Repaid')) continue;

                  if(savingTypesMap.has(header)) {
                      collectionValues[savingTypesMap.get(header)!] = value;
                  } else if (interestTypesMap.has(header)) {
                      collectionValues[interestTypesMap.get(header)!] = value;
                  } else if (shareTypesMap.has(header)) {
                      collectionValues[shareTypesMap.get(header)!] = value;
                  } else if (serviceChargeTypesMap.has(header)) {
                      collectionValues[serviceChargeTypesMap.get(header)!] = value;
                  } else if (loanTypesMap.has(header)) {
                      if (value > 0) {
                        const termHeader = `${header} Repayment Period (Months)`;
                        const term = parseInt(row[termHeader], 10);
                        const loanKey = loanTypesMap.get(header)!;
                        collectionValues[loanKey] = { principal: value, term: term };
                      }
                  } else if (loanRepaymentPrincipalMap.has(header)) {
                      const loanType = pageData.loanTypes.find(lt => header.startsWith(lt.name));
                      if (loanType) {
                        const key = `loanrepay_${loanType.id}`;
                        const interestHeader = `${loanType.name} Interest Repaid`;
                        const interestRepaid = parseFloat(row[interestHeader]) || 0;
                        if (value > 0 || interestRepaid > 0) {
                          collectionValues[key] = { principalRepaid: value, interestRepaid: interestRepaid };
                        }
                      }
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
      <PageTitle title="System Data Import" subtitle="Import initial savings, loan, and share data for all members from a single file." />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Import Period</CardTitle>
          <CardDescription>Select the month and year this bulk import should be recorded under.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
        </CardContent>
      </Card>

      {membersData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Import from Excel</CardTitle>
              <CardDescription>Upload an Excel file to populate the data automatically. The file must match the template format, which includes all configured financial types as columns.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleDownloadTemplate} variant="secondary" size="sm">
                <Download className="mr-2 h-4 w-4"/>
                Download Template for All Members
              </Button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div className="flex-grow">
                      <Label htmlFor="excel-file">Upload File</Label>
                      <Input id="excel-file" type="file" onChange={handleFileChange} accept=".xlsx, .xls" className="max-w-sm"/>
                  </div>
                  <Button onClick={handleProcessFile} disabled={isParsing || !excelFile} className="w-full md:w-auto">
                      {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
                      Process & Validate File
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

            <CardFooter>
                <Button onClick={handleSubmit} disabled={isSubmitting || !validationSummary || validationSummary.valid === 0}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit ({validationSummary?.valid || 0}) Valid Records for Approval
                </Button>
            </CardFooter>
          </Card>
      )}
    </div>
  );
}
