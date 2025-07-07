
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Banknote, Wallet, ArrowLeft, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { FileUpload } from '@/components/file-upload';
import { getPaymentFormInitialData, recordChargePayment } from './actions';

interface RecordPaymentFormState {
    amount: number;
    paymentDate: string;
    depositMode: 'Cash' | 'Bank' | 'Wallet';
    sourceName: string;
    transactionReference: string;
    evidenceUrl: string;
}

const initialRecordPaymentFormState: RecordPaymentFormState = {
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    depositMode: 'Cash',
    sourceName: '',
    transactionReference: '',
    evidenceUrl: '',
};

function RecordPaymentFormComponent() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const memberId = params.memberId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [memberName, setMemberName] = useState('Member');
  const [totalPending, setTotalPending] = useState(0);

  const [recordPaymentForm, setRecordPaymentForm] = useState<RecordPaymentFormState>(initialRecordPaymentFormState);
  
  useEffect(() => {
    async function fetchData() {
        if (!memberId) return;
        setIsLoading(true);
        try {
            const data = await getPaymentFormInitialData(memberId);
            setMemberName(data.memberName);
            setTotalPending(data.totalPending);
            setRecordPaymentForm(prev => ({ ...prev, amount: data.totalPending }));
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load payment data.' });
        }
        setIsLoading(false);
    }
    fetchData();
  }, [memberId, toast]);

  const handleRecordPaymentFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'amount') {
      setRecordPaymentForm(prev => ({ ...prev, amount: parseFloat(value) || 0 }));
    } else {
      setRecordPaymentForm(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleRecordPaymentDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setRecordPaymentForm(prev => ({ ...prev, depositMode: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recordPaymentForm.amount <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Payment amount must be positive.' });
      return;
    }
    if (recordPaymentForm.amount > totalPending) {
      toast({ variant: 'destructive', title: 'Error', description: `Payment amount cannot exceed total pending (${totalPending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr).` });
      return;
    }
    if ((recordPaymentForm.depositMode === 'Bank' || recordPaymentForm.depositMode === 'Wallet') && !recordPaymentForm.sourceName) {
      toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${recordPaymentForm.depositMode} Name.` });
      return;
    }

    setIsSubmitting(true);
    try {
        await recordChargePayment(memberId, recordPaymentForm);
        toast({ title: 'Payment Recorded', description: 'The member\'s service charges have been updated.' });
        router.push(`/applied-service-charges`);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to record payment.' });
        setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <PageTitle title={`Record Payment for ${decodeURIComponent(memberName)}`} subtitle={`Total Pending Service Charges: ${totalPending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr`} />
            <Button variant="outline" asChild>
                <Link href="/applied-service-charges">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
                </Link>
            </Button>
        </div>

      <Card className="shadow-lg">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="font-headline text-primary">Payment Details</CardTitle>
            <CardDescription>Enter the details of the payment received.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="recordPaymentAmount">Payment Amount (Birr) <span className="text-destructive">*</span></Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="recordPaymentAmount"
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={recordPaymentForm.amount || ''}
                  onChange={handleRecordPaymentFormChange}
                  max={totalPending}
                  required
                  className="pl-7"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="recordPaymentDate">Payment Date <span className="text-destructive">*</span></Label>
              <Input
                id="recordPaymentDate"
                name="paymentDate"
                type="date"
                value={recordPaymentForm.paymentDate}
                onChange={handleRecordPaymentFormChange}
                required
              />
            </div>
            <Separator />
            <div>
              <Label htmlFor="recordPaymentDepositMode">Deposit Mode</Label>
              <RadioGroup
                id="recordPaymentDepositMode"
                value={recordPaymentForm.depositMode}
                onValueChange={handleRecordPaymentDepositModeChange}
                className="flex flex-wrap gap-x-4 gap-y-2 items-center pt-2"
              >
                <div className="flex items-center space-x-2"><RadioGroupItem value="Cash" id="payCashRecord" /><Label htmlFor="payCashRecord">Cash</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="Bank" id="payBankRecord" /><Label htmlFor="payBankRecord">Bank</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="Wallet" id="payWalletRecord" /><Label htmlFor="payWalletRecord">Wallet</Label></div>
              </RadioGroup>
            </div>

            {(recordPaymentForm.depositMode === 'Bank' || recordPaymentForm.depositMode === 'Wallet') && (
              <div className="space-y-4 pt-2 pl-1 border-l-2 border-primary/50 ml-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
                  <div>
                    <Label htmlFor="paymentDetails.sourceNameRecord">{recordPaymentForm.depositMode} Name <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      {recordPaymentForm.depositMode === 'Bank' && <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                      {recordPaymentForm.depositMode === 'Wallet' && <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                      <Input id="paymentDetails.sourceNameRecord" name="sourceName" placeholder={`Enter ${recordPaymentForm.depositMode} Name`} value={recordPaymentForm.sourceName} onChange={handleRecordPaymentFormChange} className="pl-8" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="paymentDetails.transactionReferenceRecord">Transaction Reference</Label>
                    <Input id="paymentDetails.transactionReferenceRecord" name="transactionReference" placeholder="e.g., TRN123XYZ" value={recordPaymentForm.transactionReference} onChange={handleRecordPaymentFormChange} />
                  </div>
                </div>
                <div className="pl-3">
                    <FileUpload
                        id="paymentDetails.evidenceUrlRecord"
                        label="Evidence Attachment"
                        value={recordPaymentForm.evidenceUrl}
                        onValueChange={(newValue) => {
                            setRecordPaymentForm(prev => ({
                              ...prev,
                              evidenceUrl: newValue,
                            }));
                        }}
                    />
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Record Payment'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}


export default function RecordServiceChargePaymentPage() {
    return (
        <Suspense fallback={<div>Loading payment form...</div>}>
            <RecordPaymentFormComponent />
        </Suspense>
    )
}
