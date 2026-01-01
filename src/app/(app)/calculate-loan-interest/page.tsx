

'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  TableFooter,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Percent, Calculator, CheckCircle, Check, ChevronsUpDown, ReceiptText, Calendar, Printer, FileDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getCalculationPageData, calculateInterest, postInterestCharges, type CalculationPageData, type InterestCalculationResult } from './actions';
import { calculateRepaymentSchedule, type AmortizationRow } from '@/lib/loan-calculations';
import { useAuth } from '@/contexts/auth-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Script from 'next/script';
import { Logo } from '@/components/logo';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const months = [
  { value: '0', label: 'January' }, { value: '1', label: 'February' }, { value: '2', label: 'March' },
  { value: '3', label: 'April' }, { value: '4', label: 'May' }, { value: '5', label: 'June' },
  { value: '6', label: 'July' }, { value: '7', label: 'August' }, { value: '8', label: 'September' },
  { value: '9', label: 'October' }, { value: '10', label: 'November' }, { value: '11', label: 'December' }
];

export default function CalculateLoanInterestPage() {
  const { toast } = useToast();
  const { user, content } = useAuth();
  
  const [pageData, setPageData] = useState<CalculationPageData>({ members: [], schools: [], loanTypes: [], serviceChargeTypes: [] });
  const [isPageLoading, setIsPageLoading] = useState(true);

  // State for Monthly Range Tab
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() - 1).toString()); // Default to last month
  const [selectedServiceChargeTypeId, setSelectedServiceChargeTypeId] = useState<string>('');
  const [calculationScope, setCalculationScope] = useState<'all' | 'school' | 'member' | 'loanType'>('all');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [selectedLoanTypeId, setSelectedLoanTypeId] = useState<string>('');
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [calculationResults, setCalculationResults] = useState<InterestCalculationResult[] | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // State for Calculator Tab
  const [calculatorPrincipal, setCalculatorPrincipal] = useState<number | undefined>();
  const [calculatorInterest, setCalculatorInterest] = useState<number | undefined>();
  const [calculatorTerm, setCalculatorTerm] = useState<number | undefined>();
  const [amortizationSchedule, setAmortizationSchedule] = useState<AmortizationRow[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const canCreate = useMemo(() => user?.permissions.includes('loanInterestCalculation:create'), [user]);

  useEffect(() => {
    async function fetchData() {
        setIsPageLoading(true);
        const data = await getCalculationPageData();
        setPageData(data);
        setIsPageLoading(false);
    }
    fetchData();

    // Fetch CSRF token for protected server actions
    (async function fetchCsrf() {
      try {
        const res = await fetch('/api/csrf');
        if (res.ok) {
          const data = await res.json();
          setCsrfToken(data.csrfToken || null);
        }
      } catch (e) {
        console.error('Failed to fetch CSRF token', e);
      }
    })();
  }, []);

  const handleCalculateInterest = async () => {
    if (calculationScope === 'school' && !selectedSchoolId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a school to calculate for.' });
      return;
    }
    if (calculationScope === 'member' && !selectedMemberId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a member to calculate for.' });
      return;
    }
    if (calculationScope === 'loanType' && !selectedLoanTypeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a loan type to calculate for.' });
      return;
    }

    setIsLoading(true);
    setCalculationResults(null);
    try {
        const results = await calculateInterest({
            scope: calculationScope,
            schoolId: selectedSchoolId,
            memberId: selectedMemberId,
            loanTypeId: selectedLoanTypeId,
        }, { month: selectedMonth, year: selectedYear });

        setCalculationResults(results);
        if (results.length > 0) {
            toast({ title: 'Calculation Complete', description: `Repayment history retrieved for ${results.length} active loans.` });
        } else {
            toast({ title: 'Calculation Complete', description: 'No loan repayments found for the selected criteria.' });
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to calculate interest.' });
    } finally {
        setIsLoading(false);
    }
  };

  const handlePostInterest = async () => {
    if (!calculationResults || calculationResults.length === 0) {
      toast({ variant: 'destructive', title: 'No Results', description: 'There are no calculation results to post.' });
      return;
    }
     if (!selectedServiceChargeTypeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a service charge type to post the interest charges to.' });
      return;
    }
    
    setIsPosting(true);

    try {
      const payload = calculationResults!.map(r => ({ loanId: r.loanId, memberId: r.memberId, calculatedInterest: r.interestPaid }));
      const result = await postInterestCharges(payload, { month: selectedMonth, year: selectedYear }, selectedServiceChargeTypeId, csrfToken || undefined);

      if (result.success) {
          toast({ title: 'Loan Interest Posted', description: result.message });
          setCalculationResults(null);
      } else {
          toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to post interest charges.' });
      console.error('Failed to post interest charges:', e);
    } finally {
      setIsPosting(false);
    }
  };
  
  const totalPrincipalPaid = useMemo(() => {
    if (!calculationResults) return 0;
    return calculationResults.reduce((sum, res) => sum + res.principalPaid, 0);
  }, [calculationResults]);

  const totalInterestPaid = useMemo(() => {
    if (!calculationResults) return 0;
    return calculationResults.reduce((sum, res) => sum + res.interestPaid, 0);
  }, [calculationResults]);


    const handleScopeChange = (value: 'all' | 'school' | 'member' | 'loanType') => {
    setCalculationScope(value);
    setSelectedSchoolId('');
    setSelectedMemberId('');
    setSelectedLoanTypeId('');
  };
  
   const handleCalculatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calculatorPrincipal || !calculatorInterest || !calculatorTerm) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all calculator fields.' });
      return;
    }
    setIsCalculating(true);
    const schedule = calculateRepaymentSchedule(calculatorPrincipal, calculatorInterest, calculatorTerm);
    setAmortizationSchedule(schedule);
    setCurrentPage(1); // Reset to first page on new calculation
    setIsCalculating(false);
  };
  
    const paginatedSchedule = useMemo(() => {
      if (!amortizationSchedule.length) return [];
      const startIndex = (currentPage - 1) * rowsPerPage;
      return amortizationSchedule.slice(startIndex, startIndex + rowsPerPage);
    }, [amortizationSchedule, currentPage, rowsPerPage]);

    const totalPages = Math.ceil(amortizationSchedule.length / rowsPerPage);

    const paginationItems = useMemo(() => {
        if (totalPages <= 1) return [];
        const items = [];
        const delta = 1;
        const left = currentPage - delta;
        const right = currentPage + delta + 1;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= left && i < right)) {
                items.push(i);
            }
        }
        const withDots: (string | number)[] = [];
        let l: number | undefined;
        for (const i of items) {
            if (l) {
                if (i - l === 2) {
                    withDots.push(l + 1);
                } else if (i - l > 2) {
                    withDots.push('...');
                }
            }
            withDots.push(i);
            l = i;
        }
        return withDots;
    }, [totalPages, currentPage]);

  const handleDownloadPdf = async () => {
    const reportElement = printRef.current;
    if (!amortizationSchedule.length || !reportElement) {
        toast({ variant: 'destructive', title: 'No Schedule', description: 'Please calculate a schedule before downloading.' });
        return;
    }

    setIsCalculating(true);

    try {
        const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 20;
        const imgWidth = pdfWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const usablePageHeight = pdfHeight - margin * 2;

        // Calculate how many canvas pixels correspond to one PDF page's usable height
        const scaleFactor = imgWidth / canvas.width; // pdf points per canvas pixel
        const sliceHeightPx = Math.floor(usablePageHeight / scaleFactor);

        let yPosPx = 0;
        let page = 0;
        while (yPosPx < canvas.height) {
            // Compute height for this slice in pixels (may be shorter on last slice)
            const thisSliceHeight = Math.min(sliceHeightPx, canvas.height - yPosPx);

            // Create a temporary canvas for the slice to avoid drawing overlapping areas
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = thisSliceHeight;
            const sliceCtx = sliceCanvas.getContext('2d');
            if (!sliceCtx) break;

            // Draw the slice from the main canvas into the slice canvas
            sliceCtx.drawImage(canvas, 0, yPosPx, canvas.width, thisSliceHeight, 0, 0, canvas.width, thisSliceHeight);

            const sliceImgData = sliceCanvas.toDataURL('image/png');
            const sliceImgHeightPdf = thisSliceHeight * scaleFactor;

            if (page > 0) pdf.addPage();
            pdf.addImage(sliceImgData, 'PNG', margin, margin, imgWidth, sliceImgHeightPdf);

            yPosPx += thisSliceHeight;
            page += 1;
        }
        
        const fileName = `Loan-Amortization-Schedule-${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);

        toast({ title: 'Download Started', description: 'Your PDF schedule is being downloaded.' });
    } catch (error) {
        console.error('Error generating PDF:', error);
        toast({ variant: 'destructive', title: 'Download Failed', description: 'An error occurred while generating the PDF.' });
    } finally {
        setIsCalculating(false);
    }
};


  if (isPageLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" strategy="lazyOnload" />
      <PageTitle title="Calculate Loan Interest" subtitle="Calculate and post monthly interest charges for active loans." />

      <Tabs defaultValue="monthly-range">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="monthly-range">Repayment History</TabsTrigger>
            <TabsTrigger value="calculator">Repayment Calculator</TabsTrigger>
        </TabsList>
        <TabsContent value="monthly-range">
            <Card className="shadow-lg">
                <CardHeader>
                <CardTitle className="font-headline text-primary">Repayment History Criteria</CardTitle>
                <CardDescription>Select the period and scope to view historical loan repayments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                    <Label htmlFor="yearFilter">Year</Label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger id="yearFilter"><SelectValue placeholder="Select Year" /></SelectTrigger>
                        <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                    </div>
                    <div>
                    <Label htmlFor="monthFilter">Month</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger id="monthFilter"><SelectValue placeholder="Select Month" /></SelectTrigger>
                        <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                    </div>
                </div>

                <Separator />
                
                <div>
                    <Label className="font-medium">Filter Scope</Label>
                    <RadioGroup value={calculationScope} onValueChange={handleScopeChange} className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="all" id="scope-all" /><Label htmlFor="scope-all">All Loans</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="school" id="scope-school" /><Label htmlFor="scope-school">By School</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="member" id="scope-member" /><Label htmlFor="scope-member">By Member</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="loanType" id="scope-loanType" /><Label htmlFor="scope-loanType">By Loan Type</Label></div>
                    </RadioGroup>
                </div>
                
                <div className="animate-in fade-in duration-300">
                    {calculationScope === 'school' && (
                    <div>
                        <Label htmlFor="schoolSelect">School</Label>
                        <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                        <SelectTrigger id="schoolSelect"><SelectValue placeholder="Select a school..." /></SelectTrigger>
                        <SelectContent>{pageData.schools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    )}
                    {calculationScope === 'member' && (
                    <div>
                        <Label htmlFor="memberSelect">Member</Label>
                        <Popover open={openMemberCombobox} onOpenChange={setOpenMemberCombobox}>
                        <PopoverTrigger asChild>
                            <Button
                            id="memberSelect"
                            variant="outline"
                            role="combobox"
                            aria-expanded={openMemberCombobox}
                            className="w-full justify-between"
                            >
                            {selectedMemberId
                                ? pageData.members.find((member) => member.id === selectedMemberId)?.fullName
                                : "Select member..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                            <CommandInput placeholder="Search by name or ID..." />
                            <CommandList>
                                <CommandEmpty>No member found.</CommandEmpty>
                                <CommandGroup>
                                {pageData.members.map((member) => (
                                    <CommandItem
                                    key={member.id}
                                    value={`${member.fullName} ${member.memberId}`}
                                    onSelect={() => {
                                        setSelectedMemberId(member.id === selectedMemberId ? "" : member.id);
                                        setOpenMemberCombobox(false);
                                    }}
                                    >
                                    <Check
                                        className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedMemberId === member.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {member.fullName} {member.memberId && `(#${member.memberId})`}
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                            </Command>
                        </PopoverContent>
                        </Popover>
                    </div>
                    )}
                    {calculationScope === 'loanType' && (
                    <div>
                        <Label htmlFor="loanTypeSelect">Loan Type</Label>
                        <Select value={selectedLoanTypeId} onValueChange={setSelectedLoanTypeId}>
                        <SelectTrigger id="loanTypeSelect"><SelectValue placeholder="Select a loan type..." /></SelectTrigger>
                        <SelectContent>{pageData.loanTypes.map(lt => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    )}
                </div>
                
                </CardContent>
                <CardFooter>
                    <Button onClick={handleCalculateInterest} disabled={isLoading} className="w-full md:w-auto ml-auto">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                        View Repayment History
                    </Button>
                </CardFooter>
            </Card>
            
            {calculationResults && (
                <Card className="shadow-lg animate-in fade-in duration-300 mt-8">
                    <CardHeader>
                        <CardTitle className="font-headline text-primary">Repayment History</CardTitle>
                        <CardDescription>
                            Actual principal and interest paid for {months.find(m => m.value === selectedMonth)?.label}, {selectedYear}.
                            Total Principal Paid: <span className="font-bold text-green-600">{totalPrincipalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} Birr</span> |
                            Total Interest Paid: <span className="font-bold text-orange-600">{totalInterestPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} Birr</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-lg border shadow-sm">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Member Name</TableHead>
                                        <TableHead>Loan Acct. #</TableHead>
                                        <TableHead className="text-right">Principal Paid</TableHead>
                                        <TableHead className="text-right">Interest Paid</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {calculationResults.length > 0 ? calculationResults.map(result => (
                                        <TableRow key={result.loanId}>
                                            <TableCell className="font-medium">{result.fullName}</TableCell>
                                            <TableCell className="font-mono text-xs">{result.loanAccountNumber || 'N/A'}</TableCell>
                                            <TableCell className="text-right text-green-600">{result.principalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                            <TableCell className="text-right text-orange-600">{result.interestPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                No repayments found for the selected criteria and period.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </TabsContent>
        <TabsContent value="calculator">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-primary">Loan Repayment Calculator</CardTitle>
                    <CardDescription>Enter loan details to generate a full amortization schedule.</CardDescription>
                </CardHeader>
                <form onSubmit={handleCalculatorSubmit}>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                        <div className="space-y-2">
                            <Label htmlFor="calcPrincipal">Loan Amount (Birr)</Label>
                            <Input id="calcPrincipal" type="number" placeholder="e.g., 50000" value={calculatorPrincipal || ''} onChange={(e) => setCalculatorPrincipal(parseFloat(e.target.value))} required />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="calcInterest">Annual Interest Rate (%)</Label>
                            <Input id="calcInterest" type="number" placeholder="e.g., 8.5" value={calculatorInterest || ''} onChange={(e) => setCalculatorInterest(parseFloat(e.target.value))} required />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="calcTerm">Term (Months)</Label>
                            <Input id="calcTerm" type="number" placeholder="e.g., 24" value={calculatorTerm || ''} onChange={(e) => setCalculatorTerm(parseInt(e.target.value))} required />
                        </div>
                        <Button type="submit" className="w-full" disabled={isCalculating}>
                            {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Calculator className="mr-2 h-4 w-4" />}
                            Calculate Schedule
                        </Button>
                    </CardContent>
                </form>
            </Card>

            {amortizationSchedule.length > 0 && (
                <Card className="shadow-lg animate-in fade-in duration-300 mt-8">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="font-headline text-primary">Amortization Schedule</CardTitle>
                                <CardDescription>A month-by-month breakdown of the loan repayment.</CardDescription>
                            </div>
                             <Button onClick={handleDownloadPdf} variant="outline" size="sm" disabled={isCalculating}>
                                {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                                Download PDF
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Hidden element for PDF generation */}
                        <div className="absolute -left-[9999px] -top-[9999px] printable-container">
                          <div ref={printRef} className="printable-report p-6 bg-white text-black w-[800px]">
                              <div className="print-header flex justify-between items-center mb-6 pb-4 border-b">
                                  <Logo logo={content?.logo} saccoName={content?.saccoName} />
                                  <div className="text-right">
                                      <h2 className="text-xl font-bold text-primary">Loan Amortization Schedule</h2>
                                      <p className="text-sm text-muted-foreground">Generated on: {new Date().toLocaleDateString()}</p>
                                  </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 border-y py-4">
                                  <div className="space-y-1"><p className="text-sm text-gray-500">Loan Amount</p><p className="font-semibold">{calculatorPrincipal?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} Birr</p></div>
                                  <div className="space-y-1"><p className="text-sm text-gray-500">Annual Rate</p><p className="font-semibold">{calculatorInterest}%</p></div>
                                  <div className="space-y-1"><p className="text-sm text-gray-500">Term</p><p className="font-semibold">{calculatorTerm} Months</p></div>
                                  <div className="space-y-1"><p className="text-sm text-gray-500">Monthly Payment</p><p className="font-semibold text-primary">{amortizationSchedule[0]?.payment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} Birr</p></div>
                              </div>
                              <div className="overflow-x-auto rounded-lg border">
                                  <Table>
                                      <TableHeader>
                                          <TableRow className="bg-gray-100">
                                              <TableHead className="w-[100px] text-center text-gray-600">Month</TableHead>
                                              <TableHead className="text-right text-gray-600">Payment</TableHead>
                                              <TableHead className="text-right text-gray-600">Principal</TableHead>
                                              <TableHead className="text-right text-gray-600">Interest</TableHead>
                                              <TableHead className="text-right text-gray-600">Remaining Balance</TableHead>
                                          </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                          {amortizationSchedule.map(row => (
                                              <TableRow key={row.month}>
                                                  <TableCell className="text-center">{row.month}</TableCell>
                                                  <TableCell className="text-right font-semibold">{row.payment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                                  <TableCell className="text-right text-green-600">{row.principal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                                  <TableCell className="text-right text-orange-600">{row.interest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                                  <TableCell className="text-right font-bold">{row.remainingBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                       <TableFooter>
                                          <TableRow className="font-bold text-base bg-gray-100">
                                              <TableCell colSpan={2}>Totals</TableCell>
                                              <TableCell className="text-right">{(amortizationSchedule.reduce((sum, row) => sum + row.principal, 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                              <TableCell className="text-right">{(amortizationSchedule.reduce((sum, row) => sum + row.interest, 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                              <TableCell></TableCell>
                                          </TableRow>
                                      </TableFooter>
                                  </Table>
                              </div>
                          </div>
                        </div>
                        {/* Visible paginated table */}
                        <div className="overflow-x-auto rounded-lg border">
                           <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px] text-center">Month</TableHead>
                                        <TableHead className="text-right">Payment</TableHead>
                                        <TableHead className="text-right">Principal</TableHead>
                                        <TableHead className="text-right">Interest</TableHead>
                                        <TableHead className="text-right">Remaining Balance</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedSchedule.map(row => (
                                        <TableRow key={row.month}>
                                            <TableCell className="text-center">{row.month}</TableCell>
                                            <TableCell className="text-right font-semibold">{row.payment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                            <TableCell className="text-right text-green-600">{row.principal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                            <TableCell className="text-right text-orange-600">{row.interest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                            <TableCell className="text-right font-bold">{row.remainingBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                 <TableFooter>
                                    <TableRow className="font-bold text-base bg-muted/50">
                                        <TableCell colSpan={2}>Totals</TableCell>
                                        <TableCell className="text-right">{(amortizationSchedule.reduce((sum, row) => sum + row.principal, 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                        <TableCell className="text-right">{(amortizationSchedule.reduce((sum, row) => sum + row.interest, 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    </CardContent>
                     {totalPages > 1 && (
                      <CardFooter className="flex-col items-center gap-4 pt-4">
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
                                        <span key={index} className="px-2">
                                            {item}
                                        </span>
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
                            <div>{amortizationSchedule.length} month(s) total.</div>
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
                      </CardFooter>
                    )}
                </Card>
            )}

        </TabsContent>
      </Tabs>
    </div>
  );
}
