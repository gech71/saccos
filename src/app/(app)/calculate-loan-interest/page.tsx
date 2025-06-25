
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
import { mockMembers, mockLoans, mockSchools, mockLoanTypes, mockAppliedServiceCharges, mockServiceChargeTypes } from '@/data/mock';
import type { Member, Loan, School, LoanType, AppliedServiceCharge, ServiceChargeType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Percent, Calculator, CheckCircle, Check, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
const months = [
  { value: '0', label: 'January' }, { value: '1', label: 'February' }, { value: '2', label: 'March' },
  { value: '3', label: 'April' }, { value: '4', label: 'May' }, { value: '5', label: 'June' },
  { value: '6', label: 'July' }, { value: '7', label: 'August' }, { value: '8', label: 'September' },
  { value: '9', label: 'October' }, { value: '10', label: 'November' }, { value: '11', label: 'December' }
];

interface InterestCalculationResult {
  loanId: string;
  memberId: string;
  fullName: string;
  loanAccountNumber?: string;
  remainingBalance: number;
  interestRate: number;
  calculatedInterest: number;
}

export default function CalculateLoanInterestPage() {
  const { toast } = useToast();
  
  const [allMembers] = useState<Member[]>(mockMembers);
  const [allLoans] = useState<Loan[]>(mockLoans);
  const [allSchools] = useState<School[]>(mockSchools);
  const [allLoanTypes] = useState<LoanType[]>(mockLoanTypes);
  const [appliedCharges, setAppliedCharges] = useState<AppliedServiceCharge[]>(mockAppliedServiceCharges);
  const [serviceChargeTypes] = useState<ServiceChargeType[]>(mockServiceChargeTypes);

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

  const handleCalculateInterest = () => {
    // Validation
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

    // Filtering logic
    let loansToProcess = allLoans.filter(loan => loan.status === 'active' || loan.status === 'overdue');

    if (calculationScope === 'school' && selectedSchoolId) {
        const memberIdsInSchool = allMembers.filter(m => m.schoolId === selectedSchoolId).map(m => m.id);
        loansToProcess = loansToProcess.filter(l => memberIdsInSchool.includes(l.memberId));
    } else if (calculationScope === 'member' && selectedMemberId) {
        loansToProcess = loansToProcess.filter(l => l.memberId === selectedMemberId);
    } else if (calculationScope === 'loanType' && selectedLoanTypeId) {
        loansToProcess = loansToProcess.filter(l => l.loanTypeId === selectedLoanTypeId);
    }

    setTimeout(() => {
      const results: InterestCalculationResult[] = loansToProcess.map(loan => {
        if (!loan.interestRate || loan.interestRate <= 0 || !loan.remainingBalance || loan.remainingBalance <= 0) {
          return null; // Skip loans with no interest or no balance
        }

        // Simple interest calculation for the month
        const monthlyRate = loan.interestRate / 12;
        const calculatedInterest = loan.remainingBalance * monthlyRate;

        return {
          loanId: loan.id,
          memberId: loan.memberId,
          fullName: loan.memberName || allMembers.find(m => m.id === loan.memberId)?.fullName || 'Unknown Member',
          loanAccountNumber: loan.loanAccountNumber,
          remainingBalance: loan.remainingBalance,
          interestRate: loan.interestRate,
          calculatedInterest,
        };
      }).filter((res): res is InterestCalculationResult => res !== null && res.calculatedInterest > 0);

      setCalculationResults(results);
      setIsLoading(false);
      if (results.length > 0) {
        toast({ title: 'Calculation Complete', description: `Interest calculated for ${results.length} active loans based on your criteria.` });
      } else {
        toast({ title: 'Calculation Complete', description: 'No loans were eligible for interest calculation for the selected criteria.' });
      }
    }, 500);
  };

  const handlePostInterest = () => {
    if (!calculationResults || calculationResults.length === 0) {
      toast({ variant: 'destructive', title: 'No Results', description: 'There are no calculation results to post.' });
      return;
    }
    const loanInterestChargeType = serviceChargeTypes.find(sct => sct.name === 'Monthly Loan Interest');
    if (!loanInterestChargeType) {
        toast({ variant: 'destructive', title: 'Configuration Error', description: 'A service charge type named "Monthly Loan Interest" must exist to post charges.' });
        return;
    }
    
    setIsPosting(true);
    
    const newInterestCharges: AppliedServiceCharge[] = calculationResults.map(result => ({
      id: `asc-interest-${Date.now()}-${result.memberId}`,
      memberId: result.memberId,
      memberName: result.fullName,
      serviceChargeTypeId: loanInterestChargeType.id,
      serviceChargeTypeName: loanInterestChargeType.name,
      amountCharged: result.calculatedInterest,
      dateApplied: new Date(parseInt(selectedYear), parseInt(selectedMonth) + 1, 0).toISOString(), // End of selected month
      status: 'pending',
      notes: `Monthly loan interest for ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear} on Loan ${result.loanAccountNumber}`,
    }));
    
    setTimeout(() => {
        setAppliedCharges(prev => [...prev, ...newInterestCharges]);
        toast({ title: 'Loan Interest Posted', description: `${newInterestCharges.length} loan interest charges have been submitted for approval.` });
        setCalculationResults(null); // Clear results after posting
        setIsPosting(false);
    }, 1000);
  };
  
  const totalCalculatedInterest = useMemo(() => {
    if (!calculationResults) return 0;
    return calculationResults.reduce((sum, res) => sum + res.calculatedInterest, 0);
  }, [calculationResults]);

  const handleScopeChange = (value: 'all' | 'school' | 'member' | 'loanType') => {
    setCalculationScope(value);
    // Reset selections when scope changes
    setSelectedSchoolId('');
    setSelectedMemberId('');
    setSelectedLoanTypeId('');
  };

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
                  <SelectContent>{allSchools.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
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
                        ? allMembers.find((member) => member.id === selectedMemberId)?.fullName
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
                          {allMembers.map((member) => (
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
                  <SelectContent>{allLoanTypes.map(lt => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          
        </CardContent>
        <CardFooter>
            <Button onClick={handleCalculateInterest} disabled={isLoading} className="w-full md:w-auto ml-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                Calculate Loan Interest
            </Button>
        </CardFooter>
      </Card>
      
      {calculationResults && (
        <Card className="shadow-lg animate-in fade-in duration-300">
            <CardHeader>
                <CardTitle className="font-headline text-primary">Calculation Results</CardTitle>
                <CardDescription>
                    Loan interest calculation for {months.find(m => m.value === selectedMonth)?.label}, {selectedYear}.
                    Total calculated interest: <span className="font-bold text-primary">${totalCalculatedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto rounded-lg border shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Member Name</TableHead>
                                <TableHead>Loan Acct. #</TableHead>
                                <TableHead className="text-right">Balance Before Interest ($)</TableHead>
                                <TableHead className="text-center">Interest Rate (Annual)</TableHead>
                                <TableHead className="text-right">Calculated Interest ($)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {calculationResults.length > 0 ? calculationResults.map(result => (
                                <TableRow key={result.loanId}>
                                    <TableCell className="font-medium">{result.fullName}</TableCell>
                                    <TableCell className="font-mono text-xs">{result.loanAccountNumber || 'N/A'}</TableCell>
                                    <TableCell className="text-right">${result.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary">
                                            <Percent className="mr-1.5 h-3 w-3"/>
                                            {(result.interestRate * 100).toFixed(2)}%
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-destructive">${result.calculatedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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
            <CardFooter>
                <Button onClick={handlePostInterest} disabled={isPosting || calculationResults.length === 0} className="ml-auto">
                    {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Post Interest Charges for Approval
                </Button>
            </CardFooter>
        </Card>
      )}

    </div>
  );
}
