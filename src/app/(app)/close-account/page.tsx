
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, ChevronsUpDown, Calculator, UserX, Banknote, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileUpload } from '@/components/file-upload';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getActiveMembersForClosure, calculateFinalPayout, confirmAccountClosure } from './actions';

type ActiveMember = {
    id: string;
    fullName: string | null;
    savingsAccountNumber: string | null;
    savingsBalance: number;
}

interface CalculationResult {
  currentBalance: number;
  accruedInterest: number;
  totalPayout: number;
}

const initialPayoutDetails = {
  depositMode: 'Cash' as 'Cash' | 'Bank' | 'Wallet',
  sourceName: '',
  transactionReference: '',
  evidenceUrl: '',
};

export default function CloseAccountPage() {
  const { toast } = useToast();

  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [payoutDetails, setPayoutDetails] = useState(initialPayoutDetails);

  useEffect(() => {
    async function fetchMembers() {
        setIsLoading(true);
        const members = await getActiveMembersForClosure();
        setActiveMembers(members);
        setIsLoading(false);
    }
    fetchMembers();
  }, []);

  const selectedMember = useMemo(() => {
    return activeMembers.find(m => m.id === selectedMemberId);
  }, [selectedMemberId, activeMembers]);

  const handleCalculate = async () => {
    if (!selectedMember) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a member.' });
      return;
    }
    setIsCalculating(true);
    setCalculationResult(null);

    const result = await calculateFinalPayout(selectedMember.id);
    if (result) {
        setCalculationResult(result);
        toast({ title: 'Calculation Complete', description: 'Final payout amount has been calculated.' });
    } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not calculate payout for this member.' });
    }
    setIsCalculating(false);
  };

  const handlePayoutDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPayoutDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setPayoutDetails(prev => ({ ...prev, depositMode: value }));
  };
  
  const handleConfirmClosure = async () => {
    if (!selectedMember || !calculationResult) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please calculate payout before closing.' });
        return;
    }
     if ((payoutDetails.depositMode === 'Bank' || payoutDetails.depositMode === 'Wallet') && !payoutDetails.sourceName) {
      toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${payoutDetails.depositMode} Name.` });
      return;
    }
    
    setIsClosing(true);
    
    try {
        await confirmAccountClosure(selectedMember.id, {
            totalPayout: calculationResult.totalPayout,
            accruedInterest: calculationResult.accruedInterest,
            depositMode: payoutDetails.depositMode,
            sourceName: payoutDetails.sourceName,
            transactionReference: payoutDetails.transactionReference,
            evidenceUrl: payoutDetails.evidenceUrl,
        });

        toast({ title: 'Account Closed', description: `${selectedMember.fullName}'s account has been successfully closed and payout processed.` });
        
        // Refresh active members list
        const members = await getActiveMembersForClosure();
        setActiveMembers(members);

        setSelectedMemberId('');
        setCalculationResult(null);
        setPayoutDetails(initialPayoutDetails);
    } catch (error) {
        console.error("Closure error:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'An error occurred while closing the account.' });
    } finally {
        setIsClosing(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageTitle title="Close Member Account" subtitle="Calculate final interest and process the full payout to close a savings account." />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-primary">1. Select Member</CardTitle>
          <CardDescription>Choose the member whose account you wish to close.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
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
                    disabled={isCalculating || isClosing || isLoading}
                    >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : (selectedMemberId
                        ? activeMembers.find((member) => member.id === selectedMemberId)?.fullName
                        : "Select member...")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                    <CommandInput placeholder="Search member..." />
                    <CommandList>
                        <CommandEmpty>No active members found.</CommandEmpty>
                        <CommandGroup>
                        {activeMembers.map((member) => (
                            <CommandItem
                            key={member.id}
                            value={`${member.fullName} ${member.savingsAccountNumber}`}
                            onSelect={() => {
                                setSelectedMemberId(member.id === selectedMemberId ? "" : member.id);
                                setOpenMemberCombobox(false);
                                setCalculationResult(null);
                            }}
                            >
                            <Check
                                className={cn(
                                "mr-2 h-4 w-4",
                                selectedMemberId === member.id ? "opacity-100" : "opacity-0"
                                )}
                            />
                            {member.fullName} (Acct: {member.savingsAccountNumber || 'N/A'}, Bal: ${member.savingsBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                            </CommandItem>
                        ))}
                        </CommandGroup>
                    </CommandList>
                    </Command>
                </PopoverContent>
                </Popover>
            </div>
            <Button onClick={handleCalculate} disabled={isCalculating || !selectedMemberId}>
                {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                Calculate Final Payout
            </Button>
        </CardContent>
      </Card>
      
      {calculationResult && selectedMember && (
          <Card className="shadow-lg animate-in fade-in duration-300">
            <CardHeader>
                <CardTitle className="font-headline text-primary">2. Confirm Payout and Close Account</CardTitle>
                <CardDescription>Review the final amounts and specify the payout method.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Alert>
                    <AlertTitle className="font-bold">Final Payout Summary for {selectedMember.fullName}</AlertTitle>
                    <AlertDescription>
                        <div className="flex justify-between py-1"><span>Current Savings Balance:</span> <span className="font-medium">${calculationResult.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between py-1"><span>Accrued Interest (Calculated):</span> <span className="font-medium text-green-600">+ ${calculationResult.accruedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        <Separator className="my-1"/>
                        <div className="flex justify-between py-1 text-lg"><strong>Total Payout Amount:</strong> <strong className="text-primary">${calculationResult.totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                    </AlertDescription>
                </Alert>
                
                <Separator />

                <div>
                    <Label className="font-semibold text-base">Payout Method</Label>
                    <RadioGroup value={payoutDetails.depositMode} onValueChange={handleDepositModeChange} className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="payout-cash" /><Label htmlFor="payout-cash">Cash</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="payout-bank" /><Label htmlFor="payout-bank">Bank Transfer</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="Wallet" id="payout-wallet" /><Label htmlFor="payout-wallet">Wallet Transfer</Label></div>
                    </RadioGroup>
                </div>

                {payoutDetails.depositMode !== 'Cash' && (
                    <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
                            <div>
                                <Label htmlFor="sourceName">{payoutDetails.depositMode} Name / Details</Label>
                                <div className="relative">
                                    {payoutDetails.depositMode === 'Bank' && <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                    {payoutDetails.depositMode === 'Wallet' && <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                                    <Input id="sourceName" name="sourceName" placeholder={`Enter ${payoutDetails.depositMode} Name`} value={payoutDetails.sourceName} onChange={handlePayoutDetailChange} className="pl-8" />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="transactionReference">Transaction Reference</Label>
                                <Input id="transactionReference" name="transactionReference" placeholder="e.g., TRN123XYZ, Confirmation #" value={payoutDetails.transactionReference} onChange={handlePayoutDetailChange} />
                            </div>
                        </div>
                        <div className="pl-3">
                           <FileUpload
                            id="payoutEvidence"
                            label="Evidence of Payout"
                            value={payoutDetails.evidenceUrl}
                            onValueChange={(newValue) => setPayoutDetails(prev => ({...prev, evidenceUrl: newValue}))}
                           />
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <Button variant="destructive" onClick={handleConfirmClosure} disabled={isClosing} className="w-full md:w-auto ml-auto">
                    {isClosing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                    Confirm Account Closure and Payout
                </Button>
            </CardFooter>
          </Card>
      )}
    </div>
  );
}
