
'use client';

import React, { useState, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { generateSavingsReport, type GenerateSavingsReportInput, type GenerateSavingsReportOutput } from '@/ai/flows/generate-savings-report';
import type { ReportType, VisualizationType } from '@/types';
import { Loader2, Download, FileText, BarChart2, PieChart, LineChart } from 'lucide-react';
import Image from 'next/image';
import { getSchoolsForReport } from './actions';

type SchoolForSelect = {
    id: string;
    name: string;
}

const reportTypes: { value: ReportType, label: string }[] = [
  { value: 'savings', label: 'Savings Report' },
  { value: 'share allocations', label: 'Share Allocations Report' },
  { value: 'dividend distributions', label: 'Dividend Distributions Report' },
];

const visualizationTypes: { value: VisualizationType, label: string, icon: React.ElementType }[] = [
  { value: 'bar', label: 'Bar Chart', icon: BarChart2 },
  { value: 'pie', label: 'Pie Chart', icon: PieChart },
  { value: 'line', label: 'Line Chart', icon: LineChart },
  { value: 'table', label: 'Table', icon: FileText },
];

export default function ReportsPage() {
  const [schools, setSchools] = useState<SchoolForSelect[]>([]);
  const [selectedSchoolName, setSelectedSchoolName] = useState<string>('');
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('savings');
  const [selectedVizType, setSelectedVizType] = useState<VisualizationType>('bar');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSchools, setIsFetchingSchools] = useState(true);
  const [reportOutput, setReportOutput] = useState<GenerateSavingsReportOutput | null>(null);
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
    if (!selectedSchoolName || !selectedReportType || !selectedVizType) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill in all fields.' });
      return;
    }
    setIsLoading(true);
    setReportOutput(null);

    try {
      const input: GenerateSavingsReportInput = {
        schoolName: selectedSchoolName,
        reportType: selectedReportType,
        visualizationType: selectedVizType,
      };
      const output = await generateSavingsReport(input);
      setReportOutput(output);
      toast({ title: 'Report Generated', description: 'Your report is ready.' });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate report. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageTitle title="AI Reporting & Analytics" subtitle="Generate insightful reports and visualizations using AI." />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-primary">Generate New Report</CardTitle>
          <CardDescription>Select parameters to generate your financial report.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="schoolName">School Name</Label>
                <Select value={selectedSchoolName} onValueChange={(value) => setSelectedSchoolName(value)} required disabled={isFetchingSchools}>
                  <SelectTrigger id="schoolName" aria-label="Select school">
                    <SelectValue placeholder={isFetchingSchools ? "Loading schools..." : "Select a school"} />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map(school => (
                      <SelectItem key={school.id} value={school.name}>{school.name}</SelectItem>
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
                <Label htmlFor="visualizationType">Visualization Type</Label>
                <Select value={selectedVizType} onValueChange={(value) => setSelectedVizType(value as VisualizationType)} required>
                  <SelectTrigger id="visualizationType" aria-label="Select visualization type">
                    <SelectValue placeholder="Select visualization type" />
                  </SelectTrigger>
                  <SelectContent>
                    {visualizationTypes.map(vt => {
                      const Icon = vt.icon;
                      return (
                        <SelectItem key={vt.value} value={vt.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            {vt.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
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
            <CardTitle className="font-headline text-primary">Generated Report</CardTitle>
            <div className="flex justify-between items-center">
                <CardDescription>
                    Report for {selectedSchoolName} - {reportTypes.find(rt => rt.value === selectedReportType)?.label}
                </CardDescription>
                <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" /> Download Report
                </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-primary">Summary</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{reportOutput.report}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-primary">Visualization</h3>
              {reportOutput.visualization.startsWith('https://placehold.co') ? (
                 <div className="border rounded-md p-4 bg-muted/50 text-center">
                    <p className="text-muted-foreground mb-2">A placeholder image was returned. AI image generation may be busy or unavailable.</p>
                    <Image 
                        src={reportOutput.visualization}
                        alt={`${selectedVizType} chart placeholder`}
                        data-ai-hint={`${selectedVizType} chart`}
                        width={600} 
                        height={400} 
                        className="rounded-md shadow-md mx-auto" 
                    />
                 </div>
              ) : (
                 <Image 
                    src={reportOutput.visualization} 
                    alt={`${selectedVizType} visualization`}
                    data-ai-hint={`${selectedVizType} data chart`}
                    width={600} 
                    height={400} 
                    className="rounded-md shadow-md border" 
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
