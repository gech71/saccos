
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { mockMembers, mockSavingAccountTypes, mockSavings } from '@/data/mock';
import type { Member, SavingAccountType, Saving } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Percent, Calculator, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const months = [
  { value: '0', label: 'January' }, { value: '1', label: 'February' }, { value: '2', label: 'March' },
  { value: '3', label: 'April' }, { value: '4', label: 'May' }, { value: '5', label: 'June' },
  { value: '6', label: 'July' }, { value: '7', label: 'August' }, { value: '8', label: 'September' },
  { value: '9', label: 'October' }, { value: '10', label: 'November' }, { value: '11', label: 'December' }
];

interface InterestCalculationResult {
  memberId: string;
  fullName: string;
  savingsAccountNumber?: string;
  savingsBalance: number;
  interestRate: number;
  calculatedInterest: number;
}

export default function CalculateInterestPage() {
  const { toast } = useToast();
  
  const [allMembers] = useState<Member[]>(mockMembers);
  const [allSavingAccountTypes] = useState<SavingAccountType[]>(mockSavingAccountTypes);
  const [allSavings, setAllSavings] = useState<Saving[]>(mockSavings);

  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() - 1).toString()); // Default to previous month

  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [calculationResults, setCalculationResults] = useState<InterestCalculationResult[] | null>(null);

  const handleCalculateInterest = () => {
    setIsLoading(true);
    setCalculationResults(null);

    setTimeout(() => {
      const results: InterestCalculationResult[] = allMembers.map(member => {
        const accountType = allSavingAccountTypes.find(sat => sat.id === member.savingAccountTypeId);
        if (!accountType || accountType.interestRate <= 0) {
          return null; // Skip members with no applicable interest rate
        }

        // Simplified interest calculation: (Balance * AnnualRate) / 12
        // A real-world app might use average daily balance, but this is a good starting point.
        const monthlyRate = accountType.interestRate / 12;
        const calculatedInterest = member.savingsBalance * monthlyRate;

        return {
          memberId: member.id,
          fullName: member.fullName,
          savingsAccountNumber: member.savingsAccountNumber,
          savingsBalance: member.savingsBalance,
          interestRate: accountType.interestRate,
          calculatedInterest,
        };
      }).filter((res): res is InterestCalculationResult => res !== null && res.calculatedInterest > 0);

      setCalculationResults(results);
      setIsLoading(false);
      if (results.length > 0) {
        toast({ title: 'Calculation Complete', description: `Interest calculated for ${results.length} members.` });
      } else {
        toast({ title: 'Calculation Complete', description: 'No members were eligible for interest calculation for the selected period.' });
      }
    }, 500);
  };

  const handlePostInterest = () => {
    if (!calculationResults || calculationResults.length === 0) {
      toast({ variant: 'destructive', title: 'No Results', description: 'There are no calculation results to post.' });
      return;
    }
    setIsPosting(true);
    
    const newInterestTransactions: Saving[] = calculationResults.map(result => ({
      id: `interest-${Date.now()}-${result.memberId}`,
      memberId: result.memberId,
      memberName: result.fullName,
      amount: result.calculatedInterest,
      date: new Date(parseInt(selectedYear), parseInt(selectedMonth) + 1, 0).toISOString(), // End of selected month
      month: `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`,
      transactionType: 'deposit', // Interest is treated as a deposit
      status: 'pending', // All new transactions must be approved
      notes: `Monthly interest posting for ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`,
      depositMode: 'Bank', // System-generated transactions might be categorized differently
      paymentDetails: {
        sourceName: 'Internal System Posting',
        transactionReference: `INT-${selectedYear}${parseInt(selectedMonth)+1}-${result.memberId}`
      }
    }));
    
    setTimeout(() => {
        setAllSavings(prev => [...prev, ...newInterestTransactions]);
        toast({ title: 'Interest Posted', description: `${newInterestTransactions.length} interest transactions have been submitted for approval.` });
        setCalculationResults(null); // Clear results after posting
        setIsPosting(false);
    }, 1000);
  };
  
  const totalCalculatedInterest = useMemo(() => {
    if (!calculationResults) return 0;
    return calculationResults.reduce((sum, res) => sum + res.calculatedInterest, 0);
  }, [calculationResults]);

  return (
    <div className="space-y-8">
      <PageTitle title="Calculate Savings Interest" subtitle="Calculate and post monthly interest for all eligible member savings accounts." />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-primary">Calculation Period</CardTitle>
          <CardDescription>Select the year and month for which you want to calculate interest.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
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
          <Button onClick={handleCalculateInterest} disabled={isLoading} className="w-full md:w-auto">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
            Calculate Interest
          </Button>
        </CardContent>
      </Card>
      
      {calculationResults && (
        <Card className="shadow-lg animate-in fade-in duration-300">
            <CardHeader>
                <CardTitle className="font-headline text-primary">Calculation Results</CardTitle>
                <CardDescription>
                    Interest calculation for {months.find(m => m.value === selectedMonth)?.label}, {selectedYear}.
                    Total calculated interest: <span className="font-bold text-primary">${totalCalculatedInterest.toFixed(2)}</span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-lg border shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Member Name</TableHead>
                                <TableHead>Account Number</TableHead>
                                <TableHead className="text-right">Balance Before Interest ($)</TableHead>
                                <TableHead className="text-center">Interest Rate (Annual)</TableHead>
                                <TableHead className="text-right">Calculated Interest ($)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {calculationResults.length > 0 ? calculationResults.map(result => (
                                <TableRow key={result.memberId}>
                                    <TableCell className="font-medium">{result.fullName}</TableCell>
                                    <TableCell>{result.savingsAccountNumber || 'N/A'}</TableCell>
                                    <TableCell className="text-right">${result.savingsBalance.toFixed(2)}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary">
                                            <Percent className="mr-1.5 h-3 w-3"/>
                                            {(result.interestRate * 100).toFixed(2)}%
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-green-600">${result.calculatedInterest.toFixed(2)}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No members were eligible for interest in this period.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter>
                <Button onClick={handlePostInterest} disabled={isPosting || calculationResults.length === 0} className="ml-auto">
                    {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Post Interest for Approval
                </Button>
            </CardFooter>
        </Card>
      )}

    </div>
  );
}
