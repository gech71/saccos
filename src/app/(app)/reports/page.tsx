
'use client';

import React, { useState, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileDown, FileText } from 'lucide-react';
import { getSchoolsForReport, generateSimpleReport, type ReportData, type ReportType } from './actions';
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

type SchoolForSelect = {
    id: string;
    name: string;
}

const reportTypes: { value: ReportType, label: string }[] = [
  { value: 'savings', label: 'Saving Report' },
  { value: 'share-allocations', label: 'Share Allocations' },
  { value: 'dividend-distributions', label: 'Dividend Distributions' },
];

const PIE_CHART_COLORS = ['#3F51B5', '#009688', '#FFC107', '#FF5722', '#607D8B', '#9C27B0'];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
const months = [
  { value: '0', label: 'January' }, { value: '1', label: 'February' }, { value: '2', label: 'March' },
  { value: '3', label: 'April' }, { value: '4', label: 'May' }, { value: '5', label: 'June' },
  { value: '6', label: 'July' }, { value: '7', label: 'August' }, { value: '8', label: 'September' },
  { value: '9', 'label': 'October' }, { value: '10', 'label': 'November' }, { value: '11', 'label': 'December' }
];

export default function ReportsPage() {
  const [schools, setSchools] = useState<SchoolForSelect[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('savings');
  
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // Empty string for 'all'

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSchools, setIsFetchingSchools] = useState(true);
  const [reportOutput, setReportOutput] = useState<ReportData | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    async function fetchSchools() {
        setIsFetchingSchools(true);
        try {
            const schoolsData = await getSchoolsForReport();
            setSchools(schoolsData);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load schools.' });
        }
        setIsFetchingSchools(false);
    }
    fetchSchools();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId || !selectedReportType || !selectedYear) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a school, report type, and year.' });
      return;
    }
    setIsLoading(true);
    setReportOutput(null);

    const yearNum = parseInt(selectedYear, 10);
    const monthNum = selectedMonth ? parseInt(selectedMonth, 10) : undefined;

    try {
      const output = await generateSimpleReport(selectedSchoolId, selectedReportType, yearNum, monthNum);
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


  return (
    <div className="space-y-8">
      <PageTitle title="Reports" subtitle="Generate and export detailed reports for various operations." />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-primary">Generate New Report</CardTitle>
          <CardDescription>Select parameters to generate your financial report.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <Label htmlFor="schoolId">School Name</Label>
              <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId} required disabled={isFetchingSchools}>
                <SelectTrigger id="schoolId" aria-label="Select school">
                  <SelectValue placeholder={isFetchingSchools ? "Loading schools..." : "Select a school"} />
                </SelectTrigger>
                <SelectContent>
                  {schools.map(school => (
                    <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={selectedReportType} onValueChange={(value) => setSelectedReportType(value as ReportType)} required>
                <SelectTrigger id="reportType" aria-label="Select report type">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map(rt => (
                    <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             <div>
              <Label htmlFor="year">Year <span className="text-destructive">*</span></Label>
              <Select value={selectedYear} onValueChange={setSelectedYear} required>
                <SelectTrigger id="year"><SelectValue placeholder="Select Year" /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="month">Month (Optional)</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger id="month"><SelectValue placeholder="All Months" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Months</SelectItem>
                  {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading || isFetchingSchools || !selectedYear} className="w-full md:w-auto shadow-md hover:shadow-lg transition-shadow">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                </>
              ) : (
                'Generate Report'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

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
                                {Object.keys(reportOutput.chartData[0]).includes('month') && <XAxis dataKey="month" />}
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                {Object.keys(reportOutput.chartData[0]).includes('Deposits') && <Bar dataKey="Deposits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />}
                                {Object.keys(reportOutput.chartData[0]).includes('Withdrawals') && <Bar dataKey="Withdrawals" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />}
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
    </div>
  );
}
