
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

  // State for Calculator Tab
  const [calculatorPrincipal, setCalculatorPrincipal] = useState<number | undefined>();
  const [calculatorInterest, setCalculatorInterest] = useState<number | undefined>();
  const [calculatorTerm, setCalculatorTerm] = useState<number | undefined>();
  const [amortizationSchedule, setAmortizationSchedule] = useState<AmortizationRow[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const canCreate = useMemo(() => user?.permissions.includes('loanInterestCalculation:create'), [user]);

  useEffect(() => {
    async function fetchData() {
        setIsPageLoading(true);
        const data = await getCalculationPageData();
        setPageData(data);
        setIsPageLoading(false);
    }
    fetchData();
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
    
    // const result = await postInterestCharges(calculationResults, { 
    //     month: selectedMonth, 
    //     year: selectedYear 
    // }, selectedServiceChargeTypeId);

    // if (result.success) {
    //     toast({ title: 'Loan Interest Posted', description: result.message });
    //     setCalculationResults(null); 
    // } else {
    //     toast({ variant: 'destructive', title: 'Error', description: result.message });
    // }
    
    setIsPosting(false);
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
    setIsCalculating(false);
  };

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
        const imgWidth = pdfWidth - 40;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let position = 20;

        pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
        
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
                        <div ref={printRef} className="printable-report p-6 bg-white text-black">
                            <div className="print-header flex justify-between items-center mb-6 pb-4 border-b">
                                <Logo logo={content?.logo} saccoName={content?.saccoName} />
                                <div className="text-right">
                                    <h2 className="text-xl font-bold text-primary">Loan Amortization Schedule</h2>
                                    <p className="text-sm text-muted-foreground">Generated on: {new Date().toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 border-y py-4">
                                <div className="space-y-1"><p className="text-sm text-gray-500">Loan Amount</p><p className="font-semibold">{calculatorPrincipal?.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr</p></div>
                                <div className="space-y-1"><p className="text-sm text-gray-500">Annual Rate</p><p className="font-semibold">{calculatorInterest}%</p></div>
                                <div className="space-y-1"><p className="text-sm text-gray-500">Term</p><p className="font-semibold">{calculatorTerm} Months</p></div>
                                <div className="space-y-1"><p className="text-sm text-gray-500">Monthly Payment</p><p className="font-semibold text-primary">{amortizationSchedule[0]?.payment.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr</p></div>
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
                                                <TableCell className="text-right font-semibold">{row.payment.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                                <TableCell className="text-right text-green-600">{row.principal.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                                <TableCell className="text-right text-orange-600">{row.interest.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                                <TableCell className="text-right font-bold">{row.remainingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                     <TableFooter>
                                        <TableRow className="font-bold text-base bg-gray-100">
                                            <TableCell colSpan={2}>Totals</TableCell>
                                            <TableCell className="text-right">{amortizationSchedule.reduce((sum, row) => sum + row.principal, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                            <TableCell className="text-right">{amortizationSchedule.reduce((sum, row) => sum + row.interest, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

        </TabsContent>
      </Tabs>
    </div>
  );
}
