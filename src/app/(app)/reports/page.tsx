
'use client';

import React, { useState, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileDown, FileText, ChevronsUpDown, Check } from 'lucide-react';
import { getReportPageData, generateSimpleReport, generateFinancialReport, type ReportData, type FinancialReportData, type ReportType } from './actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/stat-card';
import { exportToExcel } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { SavingAccountType, LoanType, WebsiteContent } from '@prisma/client';
import { DateRangePicker } from '@/components/date-range-picker';
import { DateRange } from 'react-day-picker';
import { startOfYear, endOfYear, format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Script from 'next/script';
import { Logo } from '@/components/logo';
import { getWebsiteContent } from '@/lib/website-actions';

type SchoolForSelect = {
    id: string;
    name: string;
}

const simpleReportTypes: { value: ReportType, label: string }[] = [
  { value: 'savings', label: 'Saving Report' },
  { value: 'savings-no-interest', label: 'Saving Report (w/o Interest)' },
  { value: 'saving-interest', label: 'Saving Interest Report' },
  { value: 'loans', label: 'Loan Report' },
  { value: 'loans-no-interest', label: 'Loan Report (w/o Interest)' },
  { value: 'loan-repayment', label: 'Loan Repayment Report' },
  { value: 'loan-interest', label: 'Loan Interest Report' },
  { value: 'share-allocations', label: 'Share Allocations' },
  { value: 'dividend-distributions', label: 'Dividend Distributions' },
  { value: 'service-charges', label: 'Paid Service Charges' },
];

const PIE_CHART_COLORS = ['#3F51B5', '#009688', '#FFC107', '#FF5722', '#607D8B', '#9C27B0'];

const reportYears = Array.from({length: 10}, (_, i) => new Date().getFullYear() - i);


export default function ReportsPage() {
  const [schools, setSchools] = useState<SchoolForSelect[]>([]);
  const [savingAccountTypes, setSavingAccountTypes] = useState<SavingAccountType[]>([]);
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [websiteContent, setWebsiteContent] = useState<WebsiteContent | null>(null);
  
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [openSchoolCombobox, setOpenSchoolCombobox] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('savings');
  const [selectedSavingAccountTypeId, setSelectedSavingAccountTypeId] = useState<string>('');
  const [selectedLoanTypeId, setSelectedLoanTypeId] = useState<string>('all');

  const defaultDateRange: DateRange = {
    from: startOfYear(new Date()),
    to: endOfYear(new Date()),
  }
  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultDateRange);
  
  const [year1, setYear1] = useState(new Date().getFullYear().toString());
  const [year2, setYear2] = useState((new Date().getFullYear() - 1).toString());

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [reportOutput, setReportOutput] = useState<ReportData | null>(null);
  const [financialReportOutput, setFinancialReportOutput] = useState<FinancialReportData | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    async function fetchData() {
        setIsFetchingData(true);
        try {
            const [data, content] = await Promise.all([
              getReportPageData(),
              getWebsiteContent()
            ]);
            setSchools(data.schools);
            setSavingAccountTypes(data.savingAccountTypes);
            setLoanTypes(data.loanTypes);
            setWebsiteContent(content);

            if (data.schools.length > 0) {
              setSelectedSchoolId(data.schools[0].id);
            }
            if (data.savingAccountTypes.length > 0) {
              setSelectedSavingAccountTypeId(data.savingAccountTypes[0].id);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load page data.' });
        }
        setIsFetchingData(false);
    }
    fetchData();
  }, [toast]);
  
  useEffect(() => {
    if (selectedReportType !== 'savings' && selectedReportType !== 'saving-interest' && selectedReportType !== 'savings-no-interest') {
      setSelectedSavingAccountTypeId('');
    } else {
        if (savingAccountTypes.length > 0 && !selectedSavingAccountTypeId) {
            setSelectedSavingAccountTypeId(savingAccountTypes[0].id);
        }
    }
    if (selectedReportType !== 'loans' && selectedReportType !== 'loan-interest' && selectedReportType !== 'loan-repayment' && selectedReportType !== 'loans-no-interest') {
      setSelectedLoanTypeId('all');
    }
  }, [selectedReportType, savingAccountTypes, selectedSavingAccountTypeId]);

  const handleSimpleSubmit = async () => {
    if (!selectedSchoolId || !selectedReportType || !dateRange?.from || !dateRange?.to) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a school, report type, and a valid date range.' });
      return;
    }
    if ((selectedReportType === 'savings' || selectedReportType === 'saving-interest' || selectedReportType === 'savings-no-interest') && !selectedSavingAccountTypeId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a Saving Account Type for this report.' });
        return;
    }

    setIsLoading(true);
    setReportOutput(null);

    try {
      const output = await generateSimpleReport(selectedSchoolId, selectedReportType, dateRange, selectedSavingAccountTypeId, selectedLoanTypeId === 'all' ? undefined : selectedLoanTypeId);
      if (output) {
        setReportOutput(output);
        toast({ title: 'Report Generated', description: 'Your report is ready.' });
      } else {
         toast({ variant: 'destructive', title: 'Error', description: 'Could not generate the report.' });
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate report. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };
  
   const handleFinancialSubmit = async () => {
    if (!year1 || !year2 || year1 === year2) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select two different years for comparison.' });
      return;
    }

    setIsLoading(true);
    setFinancialReportOutput(null);

    try {
      const output = await generateFinancialReport(parseInt(year1), parseInt(year2));
      setFinancialReportOutput(output);
      toast({ title: 'Financial Report Generated', description: 'Your comparative financial report is ready.' });
    } catch (error) {
      console.error('Error generating financial report:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate financial report. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleExport = () => {
    if (!reportOutput) {
        toast({ variant: 'destructive', title: 'Error', description: 'No data to export.' });
        return;
    }

    const dataToExport = reportOutput.rows.map(row => {
        let obj: Record<string, any> = {};
        reportOutput.columns.forEach((col, index) => {
            obj[col] = row[index];
        });
        return obj;
    });

    const fileName = `${reportOutput.title.replace(/\s+/g, '_')}_${reportOutput.schoolName.replace(/\s+/g, '_')}`;
    exportToExcel(dataToExport, fileName);
  };
  
  const handleFinancialExport = () => {
    if (!financialReportOutput) {
        toast({ variant: 'destructive', title: 'Error', description: 'No financial data to export.' });
        return;
    }
    const dataToExport = financialReportOutput.rows.map(row => {
        return {
            'Metric': row.metric,
            [`${financialReportOutput.year1}`]: row.year1Value,
            [`${financialReportOutput.year2}`]: row.year2Value,
            'Change (%)': row.changePercentage,
        }
    });
     const fileName = `${financialReportOutput.title.replace(/\s+/g, '_')}`;
    exportToExcel(dataToExport, fileName);
  };
  
  const handleFinancialPdfExport = async () => {
    const reportElement = document.getElementById('printable-financial-report');
    if (!financialReportOutput || !reportElement) {
        toast({ variant: 'destructive', title: 'Error', description: 'Report data is not available to download.' });
        return;
    }

    setIsLoading(true);

    try {
        const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pdfWidth - 40; // with margin
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 20; // top margin

        pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - 40);

        while (heightLeft > 0) {
            position = heightLeft - imgHeight + 20; // reset top position for new page
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
            heightLeft -= (pdfHeight - 40);
        }

        const fileName = `${financialReportOutput.title.replace(/\s+/g, '_')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        pdf.save(fileName);
        
        toast({ title: 'Download Started', description: 'Your PDF report is being downloaded.' });
    } catch (error) {
        console.error('Error generating PDF:', error);
        toast({ variant: 'destructive', title: 'Download Failed', description: 'An error occurred while generating the PDF.' });
    } finally {
        setIsLoading(false);
    }
};



  return (
    <div className="space-y-8">
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
        strategy="lazyOnload"
      />
      <PageTitle title="Reports" subtitle="Generate and export detailed reports for various operations." />

      <Tabs defaultValue="simple-reports">
        <TabsList>
            <TabsTrigger value="simple-reports">Simple Reports</TabsTrigger>
            <TabsTrigger value="financial-report">Financial Report</TabsTrigger>
        </TabsList>
        <TabsContent value="simple-reports">
             <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="font-headline text-primary">Generate New Report</CardTitle>
                  <CardDescription>Select parameters to generate your financial report.</CardDescription>
                </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                    <div>
                      <Label htmlFor="schoolId">School Name</Label>
                      <Popover open={openSchoolCombobox} onOpenChange={setOpenSchoolCombobox}>
                        <PopoverTrigger asChild>
                          <Button
                            id="schoolId"
                            variant="outline"
                            role="combobox"
                            aria-expanded={openSchoolCombobox}
                            className="w-full justify-between"
                            disabled={isFetchingData}
                          >
                            {selectedSchoolId
                              ? schools.find((s) => s.id === selectedSchoolId)?.name
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
                                {schools.map((school) => (
                                  <CommandItem
                                    key={school.id}
                                    value={`${school.name} ${school.id}`}
                                    onSelect={() => {
                                      setSelectedSchoolId(school.id);
                                      setOpenSchoolCombobox(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedSchoolId === school.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {school.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label htmlFor="reportType">Report Type</Label>
                      <Select value={selectedReportType} onValueChange={(value) => setSelectedReportType(value as ReportType)} required>
                        <SelectTrigger id="reportType" aria-label="Select report type">
                          <SelectValue placeholder="Select report type" />
                        </SelectTrigger>
                        <SelectContent>
                          {simpleReportTypes.map(rt => (
                            <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {(selectedReportType === 'savings' || selectedReportType === 'saving-interest' || selectedReportType === 'savings-no-interest') && (
                         <div>
                            <Label htmlFor="savingAccountTypeId">Saving Account Type</Label>
                            <Select value={selectedSavingAccountTypeId} onValueChange={setSelectedSavingAccountTypeId} required disabled={isFetchingData}>
                                <SelectTrigger id="savingAccountTypeId" aria-label="Select Saving Account Type">
                                <SelectValue placeholder={isFetchingData ? "Loading..." : "Select an account type"} />
                                </SelectTrigger>
                                <SelectContent>
                                {savingAccountTypes.map(sat => (
                                    <SelectItem key={sat.id} value={sat.id}>{sat.name}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                         </div>
                    )}
                    
                    {(selectedReportType === 'loans' || selectedReportType === 'loan-interest' || selectedReportType === 'loan-repayment' || selectedReportType === 'loans-no-interest') && (
                         <div>
                            <Label htmlFor="loanTypeId">Loan Type</Label>
                            <Select value={selectedLoanTypeId} onValueChange={setSelectedLoanTypeId} disabled={isFetchingData}>
                                <SelectTrigger id="loanTypeId" aria-label="Select Loan Type">
                                <SelectValue placeholder={isFetchingData ? "Loading..." : "All Loan Types"} />
                                </SelectTrigger>
                                <SelectContent>
                                   <SelectItem value="all">All Loan Types</SelectItem>
                                   {loanTypes.map(lt => (
                                       <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                                   ))}
                                </SelectContent>
                            </Select>
                         </div>
                    )}
                    
                    <div className="lg:col-span-full">
                        <Label htmlFor="dateRange">Date Range</Label>
                        <DateRangePicker dateRange={dateRange} onDateChange={setDateRange} />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={handleSimpleSubmit} disabled={isLoading || isFetchingData || !dateRange?.from || !dateRange?.to} className="w-full md:w-auto shadow-md hover:shadow-lg transition-shadow">
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                        </>
                      ) : (
                        'Generate Report'
                      )}
                    </Button>
                  </CardFooter>
            </Card>
        </TabsContent>
        <TabsContent value="financial-report">
            <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="font-headline text-primary">Generate Financial Report</CardTitle>
                  <CardDescription>Select two years to generate a comparative financial report.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                        <Label htmlFor="year1">Compare Year</Label>
                        <Select value={year1} onValueChange={setYear1} required>
                            <SelectTrigger id="year1"><SelectValue/></SelectTrigger>
                            <SelectContent>{reportYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="year2">With Year</Label>
                         <Select value={year2} onValueChange={setYear2} required>
                            <SelectTrigger id="year2"><SelectValue/></SelectTrigger>
                            <SelectContent>{reportYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                     <Button onClick={handleFinancialSubmit} disabled={isLoading || isFetchingData} className="w-full md:w-auto shadow-md hover:shadow-lg transition-shadow">
                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : 'Generate Financial Report'}
                    </Button>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      {reportOutput && (
        <Card className="shadow-lg mt-8 animate-in fade-in duration-500">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="font-headline text-primary">{reportOutput.title}</CardTitle>
                    <CardDescription>
                        For {reportOutput.schoolName} as of {reportOutput.reportDate}
                    </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} disabled={reportOutput.rows.length === 0}>
                    <FileDown className="mr-2 h-4 w-4" /> Export to Excel
                </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {reportOutput.summary.map((item, index) => (
                    <StatCard 
                        key={index}
                        title={item.label}
                        value={item.value}
                        icon={<FileText className="h-6 w-6 text-accent" />}
                        className="shadow-none border"
                    />
                ))}
            </div>

            {reportOutput.chartData && reportOutput.chartData.length > 0 && reportOutput.chartType !== 'none' && (
                <Card>
                    <CardHeader>
                    <CardTitle>Chart Visualization</CardTitle>
                    </CardHeader>
                    <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        {reportOutput.chartType === 'bar' ? (
                            <BarChart data={reportOutput.chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                {Object.keys(reportOutput.chartData[0]).includes('Amount') && <Bar dataKey="Amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />}
                            </BarChart>
                        ) : reportOutput.chartType === 'pie' ? (
                            <PieChart>
                                <Pie data={reportOutput.chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                    {reportOutput.chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        ) : null}
                    </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            <div className="overflow-x-auto rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {reportOutput.columns.map(col => <TableHead key={col}>{col}</TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportOutput.rows.length > 0 ? (
                            reportOutput.rows.map((row, rowIndex) => (
                                <TableRow key={rowIndex}>
                                    {row.map((cell, cellIndex) => (
                                        <TableCell key={cellIndex} className={typeof cell === 'number' ? 'text-right' : ''}>
                                            {typeof cell === 'number' ? cell.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : cell}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={reportOutput.columns.length} className="h-24 text-center">
                                    No data available for this report.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
          </CardContent>
        </Card>
      )}
      
      {financialReportOutput && (
         <Card className="shadow-lg mt-8 animate-in fade-in duration-500">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="font-headline text-primary">{financialReportOutput.title}</CardTitle>
                    <CardDescription>Generated on {financialReportOutput.reportDate}</CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleFinancialExport}>
                        <FileDown className="mr-2 h-4 w-4" /> Export to Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleFinancialPdfExport} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileDown className="mr-2 h-4 w-4" />}
                        Export to PDF
                    </Button>
                </div>
            </div>
          </CardHeader>
           <CardContent>
             <div id="printable-financial-report" className="p-4 bg-background">
                <div className="text-center mb-6 hidden print:block">
                    <Logo logo={websiteContent?.logo} saccoName={websiteContent?.saccoName} />
                    <h2 className="text-2xl font-bold mt-2">{financialReportOutput.title}</h2>
                    <p className="text-muted-foreground">Generated on {financialReportOutput.reportDate}</p>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {financialReportOutput.summary.map((item, index) => (
                        <StatCard 
                            key={index}
                            title={item.label}
                            value={item.value}
                            description={item.change}
                            icon={<FileText className="h-6 w-6 text-accent" />}
                            className="shadow-none border"
                            valueClassName={item.change?.includes('Increase') ? 'text-green-600' : item.change?.includes('Decrease') ? 'text-destructive' : 'text-primary'}
                        />
                    ))}
                </div>

                 <Card>
                    <CardHeader>
                    <CardTitle>Income vs. Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={financialReportOutput.chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                    </CardContent>
                </Card>

                 <div className="overflow-x-auto rounded-lg border mt-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {financialReportOutput.columns.map(col => <TableHead key={col}>{col}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {financialReportOutput.rows.map((row, rowIndex) => (
                                <TableRow key={rowIndex}>
                                    <TableCell className={`font-medium ${row.metric.startsWith('  ') ? 'pl-8' : ''}`}>{row.metric}</TableCell>
                                    <TableCell className="text-right">{typeof row.year1Value === 'number' ? row.year1Value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : row.year1Value}</TableCell>
                                    <TableCell className="text-right">{typeof row.year2Value === 'number' ? row.year2Value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : row.year2Value}</TableCell>
                                    <TableCell className="text-right font-semibold" style={{color: row.changePercentage > 0 ? 'var(--chart-1)' : row.changePercentage < 0 ? 'hsl(var(--destructive))' : 'inherit'}}>{row.changePercentage.toFixed(2)}%</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
             </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
