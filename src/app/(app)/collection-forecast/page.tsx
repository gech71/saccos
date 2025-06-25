
'use client';

import React, { useState, useMemo } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { mockSchools, mockSavingAccountTypes, mockMembers, mockShareTypes } from '@/data/mock';
import type { School, SavingAccountType, Member, ShareType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Filter, Loader2, DollarSign, Users, FileDown } from 'lucide-react';
import { exportToExcel } from '@/lib/utils';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const months = [
  { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
  { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
  { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
  { value: 9, 'label': 'October' }, { value: 10, 'label': 'November' }, { value: 11, 'label': 'December' }
];

interface ForecastResult {
    memberId: string;
    fullName: string;
    schoolName: string;
    expectedContribution: number;
}

export default function CollectionForecastPage() {
  const { toast } = useToast();
  
  const [allSchools] = useState<School[]>(mockSchools);
  const [allSavingAccountTypes] = useState<SavingAccountType[]>(mockSavingAccountTypes);
  const [allShareTypes] = useState<ShareType[]>(mockShareTypes);
  const [allMembers] = useState<Member[]>(mockMembers);

  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  
  const [collectionType, setCollectionType] = useState<'savings' | 'shares'>('savings');
  const [selectedSavingAccountType, setSelectedSavingAccountType] = useState<string>('');
  const [selectedShareType, setSelectedShareType] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [forecastData, setForecastData] = useState<ForecastResult[] | null>(null);

  const handleLoadForecast = () => {
    if (!selectedSchool) {
      toast({ variant: 'destructive', title: 'Missing Filter', description: 'Please select a school.' });
      return;
    }
    if (collectionType === 'savings' && !selectedSavingAccountType) {
        toast({ variant: 'destructive', title: 'Missing Filter', description: 'Please select a saving account type.' });
        return;
    }
    if (collectionType === 'shares' && !selectedShareType) {
        toast({ variant: 'destructive', title: 'Missing Filter', description: 'Please select a share type.' });
        return;
    }
    
    setIsLoading(true);
    setForecastData(null);
    
    setTimeout(() => {
        let results: ForecastResult[] = [];
        const filteredMembersBySchool = allMembers.filter(m => m.schoolId === selectedSchool);

        if (collectionType === 'savings') {
            results = filteredMembersBySchool
                .filter(m => m.savingAccountTypeId === selectedSavingAccountType && (m.expectedMonthlySaving || 0) > 0)
                .map(m => ({
                    memberId: m.id,
                    fullName: m.fullName,
                    schoolName: m.schoolName || '',
                    expectedContribution: m.expectedMonthlySaving || 0,
                }));
        } else { // 'shares'
            results = filteredMembersBySchool
                .map(m => {
                    const commitment = m.shareCommitments?.find(sc => sc.shareTypeId === selectedShareType);
                    if (commitment && commitment.monthlyCommittedAmount > 0) {
                        return {
                            memberId: m.id,
                            fullName: m.fullName,
                            schoolName: m.schoolName || '',
                            expectedContribution: commitment.monthlyCommittedAmount,
                        };
                    }
                    return null;
                })
                .filter((r): r is ForecastResult => r !== null);
        }

        setForecastData(results);
        setIsLoading(false);
        if (results.length > 0) {
            toast({ title: 'Forecast Generated', description: `Found ${results.length} expected collections for ${allSchools.find(s => s.id === selectedSchool)?.name}.` });
        } else {
            toast({ title: 'No Collections Found', description: 'No members match the selected criteria for the forecast.' });
        }
    }, 500);
  };
  
  const summaryStats = useMemo(() => {
    if (!forecastData) {
      return { count: 0, totalExpected: 0 };
    }
    return {
      count: forecastData.length,
      totalExpected: forecastData.reduce((sum, item) => sum + item.expectedContribution, 0),
    };
  }, [forecastData]);

  const handleExport = () => {
    if (!forecastData || forecastData.length === 0) {
        toast({ variant: 'destructive', title: 'No Data', description: 'There is no forecast data to export.' });
        return;
    }
    const dataToExport = forecastData.map(item => ({
      'Member Name': item.fullName,
      'School': item.schoolName,
      'Expected Contribution ($)': item.expectedContribution.toFixed(2),
    }));
    const collectionTypeName = collectionType === 'savings' 
        ? allSavingAccountTypes.find(s => s.id === selectedSavingAccountType)?.name 
        : allShareTypes.find(s => s.id === selectedShareType)?.name;

    exportToExcel(dataToExport, `collection_forecast_${collectionTypeName?.replace(/\s/g, '_') || ''}`);
  };

  return (
    <div className="space-y-8">
      <PageTitle title="Collection Forecast" subtitle="Predict upcoming collections based on member commitments." />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-primary">Forecast Criteria</CardTitle>
          <CardDescription>Select filters to generate the collection forecast for a specific period.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="schoolFilter">School</Label>
                  <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                    <SelectTrigger id="schoolFilter"><SelectValue placeholder="Select School" /></SelectTrigger>
                    <SelectContent>{allSchools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
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
             <div>
              <Label className="font-medium">Collection Type</Label>
              <RadioGroup value={collectionType} onValueChange={(val) => setCollectionType(val as 'savings' | 'shares')} className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
                <div className="flex items-center space-x-2"><RadioGroupItem value="savings" id="type-savings" /><Label htmlFor="type-savings">Savings</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="shares" id="type-shares" /><Label htmlFor="type-shares">Shares</Label></div>
              </RadioGroup>
            </div>
            
            <div className="animate-in fade-in duration-300">
                {collectionType === 'savings' ? (
                    <div>
                        <Label htmlFor="savingTypeFilter">Saving Account Type</Label>
                        <Select value={selectedSavingAccountType} onValueChange={setSelectedSavingAccountType}>
                            <SelectTrigger id="savingTypeFilter"><SelectValue placeholder="Select Saving Account Type" /></SelectTrigger>
                            <SelectContent>{allSavingAccountTypes.map(sat => <SelectItem key={sat.id} value={sat.id}>{sat.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                ) : (
                    <div>
                        <Label htmlFor="shareTypeFilter">Share Type</Label>
                        <Select value={selectedShareType} onValueChange={setSelectedShareType}>
                            <SelectTrigger id="shareTypeFilter"><SelectValue placeholder="Select Share Type" /></SelectTrigger>
                            <SelectContent>{allShareTypes.map(st => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                )}
            </div>

        </CardContent>
        <CardFooter>
          <Button onClick={handleLoadForecast} disabled={isLoading} className="w-full md:w-auto ml-auto">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
            Load Forecast
          </Button>
        </CardFooter>
      </Card>
      
      {forecastData && (
        <Card className="shadow-lg animate-in fade-in duration-300">
          <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="font-headline text-primary">Forecast Results</CardTitle>
                    <CardDescription>
                        Expected collections for {months.find(m => m.value.toString() === selectedMonth)?.label}, {selectedYear}.
                    </CardDescription>
                </div>
                 <Button onClick={handleExport} variant="outline" disabled={forecastData.length === 0}>
                    <FileDown className="mr-2 h-4 w-4" /> Export Results
                </Button>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Members in Forecast</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summaryStats.count}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Expected Collection</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">${summaryStats.totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member Name</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead className="text-right">Expected Contribution ($)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecastData.length > 0 ? forecastData.map(result => (
                    <TableRow key={result.memberId}>
                      <TableCell className="font-medium">{result.fullName}</TableCell>
                      <TableCell>{result.schoolName}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">${result.expectedContribution.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        No expected collections match your criteria.
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
