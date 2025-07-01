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

type SchoolForSelect = {
    id: string;
    name: string;
}

const reportTypes: { value: ReportType, label: string }[] = [
  { value: 'savings', label: 'Savings Transactions' },
  { value: 'share-allocations', label: 'Share Allocations' },
  { value: 'dividend-distributions', label: 'Dividend Distributions' },
];

export default function ReportsPage() {
  const [schools, setSchools] = useState<SchoolForSelect[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('savings');
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
    if (!selectedSchoolId || !selectedReportType) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a school and report type.' });
      return;
    }
    setIsLoading(true);
    setReportOutput(null);

    try {
      const output = await generateSimpleReport(selectedSchoolId, selectedReportType);
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
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading || isFetchingSchools} className="w-full md:w-auto shadow-md hover:shadow-lg transition-shadow">
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
