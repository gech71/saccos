

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DollarSign, UserPlus, Check, ChevronsUpDown, Hash, CalendarPlus, AlertCircle } from 'lucide-react';
import type { Member, SavingAccountType } from '@prisma/client';
import { getAccountCreationData, createSavingAccount } from './actions';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AccountFormState {
  memberId: string;
  savingAccountTypeId: string;
  initialBalance: number;
  expectedMonthlySaving: number;
  accountNumber: string;
}

const initialFormState: AccountFormState = {
  memberId: '',
  savingAccountTypeId: '',
  initialBalance: 0,
  expectedMonthlySaving: 0,
  accountNumber: '',
};

export default function AddSavingAccountPage() {
  const [members, setMembers] = useState<Pick<Member, 'id' | 'fullName' | 'salary'>[]>([]);
  const [savingAccountTypes, setSavingAccountTypes] = useState<SavingAccountType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formState, setFormState] = useState(initialFormState);
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const data = await getAccountCreationData();
        setMembers(data.members);
        setSavingAccountTypes(data.savingAccountTypes);
      } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load necessary data.' });
      }
      setIsLoading(false);
    }
    fetchData();
  }, [toast]);
  
  const selectedMember = useMemo(() => {
    return members.find(m => m.id === formState.memberId);
  }, [formState.memberId, members]);

  const selectedAccountType = useMemo(() => {
    return savingAccountTypes.find(sat => sat.id === formState.savingAccountTypeId);
  }, [formState.savingAccountTypeId, savingAccountTypes]);

  useEffect(() => {
    if (selectedMember && selectedAccountType) {
      let expectedSaving = 0;
      if (selectedAccountType.contributionType === 'FIXED') {
        expectedSaving = selectedAccountType.contributionValue;
      } else if (selectedAccountType.contributionType === 'PERCENTAGE' && selectedMember.salary) {
        expectedSaving = selectedMember.salary * selectedAccountType.contributionValue;
      }
      setFormState(prev => ({
        ...prev,
        expectedMonthlySaving: expectedSaving,
      }));
    } else {
      setFormState(prev => ({ ...prev, expectedMonthlySaving: 0 }));
    }
  }, [selectedMember, selectedAccountType]);
  
  const handleSelectChange = (name: keyof AccountFormState, value: string) => {
    setFormState(prev => ({ ...prev, [name]: value }));
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'initialBalance' || name === 'expectedMonthlySaving') {
      const parsedValue = value === '' ? 0 : parseFloat(value);
      setFormState(prev => ({ ...prev, [name]: isNaN(parsedValue) ? 0 : parsedValue }));
    } else {
      setFormState(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.memberId || !formState.savingAccountTypeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a member and an account type.' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await createSavingAccount(formState);
      toast({ title: 'Success', description: 'Saving account created successfully.' });
      router.push('/savings-accounts');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const expectedMonthlySavingText = useMemo(() => {
    if (!selectedAccountType) return "This value is used for collection forecasting and fulfillment calculation.";
    if (selectedAccountType.contributionType === 'PERCENTAGE') {
        return `Calculated as ${selectedAccountType.contributionValue * 100}% of the member's salary.`;
    }
    return `Fixed amount based on the selected account type.`;
  }, [selectedAccountType]);

  return (
    <div className="space-y-8">
      <PageTitle title="Add Saving Account" subtitle="Create and map a new saving account to a member." />
      
      <Card className="max-w-2xl mx-auto shadow-lg">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="font-headline text-primary">New Account Details</CardTitle>
            <CardDescription>Select a member and the type of saving account to create.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="memberId">Member <span className="text-destructive">*</span></Label>
              <Popover open={openMemberCombobox} onOpenChange={setOpenMemberCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    id="memberId"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    disabled={isLoading}
                  >
                    {formState.memberId
                      ? members.find((member) => member.id === formState.memberId)?.fullName
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
                        {members.map((member) => (
                          <CommandItem
                            key={member.id}
                            value={`${member.fullName} ${member.id}`}
                            onSelect={() => {
                              handleSelectChange('memberId', member.id);
                              setOpenMemberCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formState.memberId === member.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {member.fullName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="savingAccountTypeId">Saving Account Type <span className="text-destructive">*</span></Label>
              <Select
                name="savingAccountTypeId"
                value={formState.savingAccountTypeId}
                onValueChange={(value) => handleSelectChange('savingAccountTypeId', value)}
                required
                disabled={isLoading}
              >
                <SelectTrigger><SelectValue placeholder="Select an account type" /></SelectTrigger>
                <SelectContent>
                  {savingAccountTypes.map(sat => (
                    <SelectItem key={sat.id} value={sat.id}>
                      {sat.name} ({(sat.interestRate * 100).toFixed(2)}% Interest)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
             <div>
                <Label htmlFor="expectedMonthlySaving">Expected Monthly Saving (Birr)</Label>
                 <div className="relative">
                    <CalendarPlus className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="expectedMonthlySaving" name="expectedMonthlySaving" type="number" step="0.01" value={formState.expectedMonthlySaving || ''} readOnly className="pl-7 bg-muted/50" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{expectedMonthlySavingText}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="accountNumber">Savings Account Number (Optional)</Label>
                <div className="relative">
                    <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="accountNumber" name="accountNumber" value={formState.accountNumber} onChange={handleInputChange} placeholder="Auto-generated if blank" className="pl-7" />
                </div>
              </div>
              <div>
                <Label htmlFor="initialBalance">Initial Savings Balance (Birr)</Label>
                <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="initialBalance" name="initialBalance" type="number" step="0.01" value={formState.initialBalance || ''} onChange={handleInputChange} className="pl-7" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">This amount will be the opening balance.</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting || isLoading} className="w-full md:w-auto ml-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <UserPlus className="mr-2 h-4 w-4" />
              Create Account
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
