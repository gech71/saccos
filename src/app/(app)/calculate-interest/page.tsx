
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
import { getCalculationPageData, calculateInterest, postInterestTransactions, type CalculationPageData, type InterestCalculationResult } from './actions';
import { useAuth } from '@/contexts/auth-context';
import { DateRangePicker } from '@/components/date-range-picker';
import { DateRange } from 'react-day-picker';
import { startOfYear, endOfYear } from 'date-fns';

export default function CalculateInterestPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [pageData, setPageData] = useState<CalculationPageData>({ members: [], schools: [], savingAccountTypes: [] });
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfYear(new Date()),
    to: endOfYear(new Date()),
  });

  const [calculationScope, setCalculationScope] = useState<'all' | 'school' | 'member' | 'accountType'>('all');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [selectedAccountTypeId, setSelectedAccountTypeId] = useState<string>('');
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);


  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [calculationResults, setCalculationResults] = useState<InterestCalculationResult[] | null>(null);

  const canCreate = useMemo(() => user?.permissions.includes('savingsInterestCalculation:create'), [user]);

  useEffect(() => {
    async function fetchData() {
        setIsPageLoading(true);
        try {
            const data = await getCalculationPageData();
            setPageData(data);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load page data.' });
        }
        setIsPageLoading(false);
    }
    fetchData();
  }, [toast]);

  const handleCalculateInterest = async () => {
    // Validation
     if (!dateRange?.from) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a valid date range.' });
      return;
    }
    if (calculationScope === 'school' && !selectedSchoolId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a school to calculate for.' });
      return;
    }
    if (calculationScope === 'member' && !selectedMemberId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a member to calculate for.' });
      return;
    }
    if (calculationScope === 'accountType' && !selectedAccountTypeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a saving account type to calculate for.' });
      return;
    }

    setIsLoading(true);
    setCalculationResults(null);
    try {
        const results = await calculateInterest({
            scope: calculationScope,
            schoolId: selectedSchoolId,
            memberId: selectedMemberId,
            accountTypeId: selectedAccountTypeId,
        }, dateRange);

        setCalculationResults(results);
        if (results.length > 0) {
            toast({ title: 'Calculation Complete', description: `Interest calculated for ${results.length} members based on your criteria.` });
        } else {
            toast({ title: 'Calculation Complete', description: 'No members were eligible for interest calculation for the selected criteria.' });
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
     if (!dateRange) {
        toast({ variant: 'destructive', title: 'Error', description: 'A date range must be selected to post interest.' });
        return;
    }
    setIsPosting(true);
    
    try {
        const result = await postInterestTransactions(calculationResults, dateRange);
        if (result.success) {
            toast({ title: 'Interest Posted', description: result.message });
            setCalculationResults(null); // Clear results after posting
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred while posting interest.' });
    } finally {
        setIsPosting(false);
    }
  };
  
  const totalCalculatedInterest = useMemo(() => {
    if (!calculationResults) return 0;
    return calculationResults.reduce((sum, res) => sum + res.calculatedInterest, 0);
  }, [calculationResults]);

  const handleScopeChange = (value: 'all' | 'school' | 'member' | 'accountType') => {
    setCalculationScope(value);
    // Reset selections when scope changes
    setSelectedSchoolId('');
    setSelectedMemberId('');
    setSelectedAccountTypeId('');
  };

  if (isPageLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <PageTitle title="Calculate Savings Interest" subtitle="Calculate and post monthly interest based on various criteria." />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-primary">Interest Calculation Criteria</CardTitle>
          <CardDescription>Select the period and scope for which you want to calculate interest.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
              <Label>Date Range</Label>
              <DateRangePicker dateRange={dateRange} onDateChange={setDateRange} />
          </div>

          <Separator />
          
          <div>
            <Label className="font-medium">Calculation Scope</Label>
            <RadioGroup value={calculationScope} onValueChange={handleScopeChange} className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
              <div className="flex items-center space-x-2"><RadioGroupItem value="all" id="scope-all" /><Label htmlFor="scope-all">All Members</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="school" id="scope-school" /><Label htmlFor="scope-school">By School</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="member" id="scope-member" /><Label htmlFor="scope-member">By Member</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="accountType" id="scope-accountType" /><Label htmlFor="scope-accountType">By Account Type</Label></div>
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
                              value={`${member.fullName} ${member.id}`}
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
                              {member.fullName} ({member.id})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            {calculationScope === 'accountType' && (
              <div>
                <Label htmlFor="accountTypeSelect">Saving Account Type</Label>
                <Select value={selectedAccountTypeId} onValueChange={setSelectedAccountTypeId}>
                  <SelectTrigger id="accountTypeSelect"><SelectValue placeholder="Select an account type..." /></SelectTrigger>
                  <SelectContent>{pageData.savingAccountTypes.map(sat => <SelectItem key={sat.id} value={sat.id}>{sat.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          
        </CardContent>
        {canCreate && (
          <CardFooter>
              <Button onClick={handleCalculateInterest} disabled={isLoading || !dateRange?.from} className="w-full md:w-auto ml-auto">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                  Calculate Interest
              </Button>
          </CardFooter>
        )}
      </Card>
      
      {calculationResults && (
        <Card className="shadow-lg animate-in fade-in duration-300">
            <CardHeader>
                <CardTitle className="font-headline text-primary">Calculation Results</CardTitle>
                <CardDescription>
                    Interest calculation for the period.
                    Total calculated interest: <span className="font-bold text-primary">{totalCalculatedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-lg border shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Member Name</TableHead>
                                <TableHead>Account Number</TableHead>
                                <TableHead className="text-right">Current Balance (Birr)</TableHead>
                                <TableHead className="text-center">Interest Rate (Annual)</TableHead>
                                <TableHead className="text-right">Calculated Interest (Birr)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {calculationResults.length > 0 ? calculationResults.map(result => (
                                <TableRow key={result.memberSavingAccountId}>
                                    <TableCell className="font-medium">{result.fullName}</TableCell>
                                    <TableCell>{result.savingsAccountNumber || 'N/A'}</TableCell>
                                    <TableCell className="text-right">{result.savingsBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary">
                                            <Percent className="mr-1.5 h-3 w-3"/>
                                            {(result.interestRate * 100).toFixed(2)}%
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-green-600">{result.calculatedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</TableCell>
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
            {canCreate && (
              <CardFooter>
                  <Button onClick={handlePostInterest} disabled={isPosting || calculationResults.length === 0} className="ml-auto">
                      {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                      Post Interest for Approval
                  </Button>
              </CardFooter>
            )}
        </Card>
      )}

    </div>
  );
}
