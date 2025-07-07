
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Percent, Calculator, CheckCircle, Check, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getCalculationPageData, calculateInterest, postInterestCharges, type CalculationPageData, type InterestCalculationResult } from './actions';
import { useAuth } from '@/contexts/auth-context';

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
  const { user } = useAuth();
  
  const [pageData, setPageData] = useState<CalculationPageData>({ members: [], schools: [], loanTypes: [] });
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() - 1).toString()); // Default to last month

  const [calculationScope, setCalculationScope] = useState<'all' | 'school' | 'member' | 'loanType'>('all');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [selectedLoanTypeId, setSelectedLoanTypeId] = useState<string>('');
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [calculationResults, setCalculationResults] = useState<InterestCalculationResult[] | null>(null);

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
        });

        setCalculationResults(results);
        if (results.length > 0) {
            toast({ title: 'Calculation Complete', description: `Interest calculated for ${results.length} active loans based on your criteria.` });
        } else {
            toast({ title: 'Calculation Complete', description: 'No loans were eligible for interest calculation for the selected criteria.' });
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
    
    setIsPosting(true);
    
    const result = await postInterestCharges(calculationResults, { 
        month: selectedMonth, 
        year: selectedYear 
    });

    if (result.success) {
        toast({ title: 'Loan Interest Posted', description: result.message });
        setCalculationResults(null); 
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    
    setIsPosting(false);
  };
  
  const totalCalculatedInterest = useMemo(() => {
    if (!calculationResults) return 0;
    return calculationResults.reduce((sum, res) => sum + res.calculatedInterest, 0);
  }, [calculationResults]);

  const handleScopeChange = (value: 'all' | 'school' | 'member' | 'loanType') => {
    setCalculationScope(value);
    setSelectedSchoolId('');
    setSelectedMemberId('');
    setSelectedLoanTypeId('');
  };

  if (isPageLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <PageTitle title="Calculate Loan Interest" subtitle="Calculate and post monthly interest charges for active loans." />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-primary">Interest Calculation Criteria</CardTitle>
          <CardDescription>Select the period and scope for which you want to calculate loan interest.</CardDescription>
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
            <Label className="font-medium">Calculation Scope</Label>
            <RadioGroup value={calculationScope} onValueChange={handleScopeChange} className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
              <div className="flex items-center space-x-2"><RadioGroupItem value="all" id="scope-all" /><Label htmlFor="scope-all">All Active Loans</Label></div>
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
                      <CommandInput placeholder="Search member..." />
                      <CommandList>
                        <CommandEmpty>No member found.</CommandEmpty>
                        <CommandGroup>
                          {pageData.members.map((member) => (
                            <CommandItem
                              key={member.id}
                              value={`${member.fullName} ${member.savingsAccountNumber}`}
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
                              {member.fullName} ({member.savingsAccountNumber || 'No Acct #'})
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
        {canCreate && (
          <CardFooter>
              <Button onClick={handleCalculateInterest} disabled={isLoading} className="w-full md:w-auto ml-auto">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                  Calculate Loan Interest
              </Button>
          </CardFooter>
        )}
      </Card>
      
      {calculationResults && (
        <Card className="shadow-lg animate-in fade-in duration-300">
            <CardHeader>
                <CardTitle className="font-headline text-primary">Calculation Results</CardTitle>
                <CardDescription>
                    Loan interest calculation for {months.find(m => m.value === selectedMonth)?.label}, {selectedYear}.
                    Total calculated interest: <span className="font-bold text-primary">Birr {totalCalculatedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-lg border shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Member Name</TableHead>
                                <TableHead>Loan Acct. #</TableHead>
                                <TableHead className="text-right">Balance Before Interest (Birr)</TableHead>
                                <TableHead className="text-center">Interest Rate (Annual)</TableHead>
                                <TableHead className="text-right">Calculated Interest (Birr)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {calculationResults.length > 0 ? calculationResults.map(result => (
                                <TableRow key={result.loanId}>
                                    <TableCell className="font-medium">{result.fullName}</TableCell>
                                    <TableCell className="font-mono text-xs">{result.loanAccountNumber || 'N/A'}</TableCell>
                                    <TableCell className="text-right">Birr {result.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary">
                                            <Percent className="mr-1.5 h-3 w-3"/>
                                            {(result.interestRate * 100).toFixed(2)}%
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-destructive">Birr {result.calculatedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No active loans were eligible for interest in this period.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            {canCreate && (
              <CardFooter>
                  <Button onClick={handlePostInterest} disabled={isPosting || calculationResults.length === 0} className="ml-auto">
                      {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                      Post Interest Charges
                  </Button>
              </CardFooter>
            )}
        </Card>
      )}

    </div>
  );
}
