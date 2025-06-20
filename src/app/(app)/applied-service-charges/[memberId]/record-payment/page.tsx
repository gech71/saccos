

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Banknote, Wallet, UploadCloud, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface RecordPaymentFormState {
    amount: number;
    paymentDate: string;
    depositMode: 'Cash' | 'Bank' | 'Wallet';
    paymentDetails: {
        sourceName: string;
        transactionReference: string;
        evidenceUrl: string;
    };
}

const initialRecordPaymentFormState: RecordPaymentFormState = {
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    depositMode: 'Cash',
    paymentDetails: {
        sourceName: '',
        transactionReference: '',
        evidenceUrl: '',
    },
};

function RecordPaymentFormComponent() {
  const router = useRouter();
  const params = useParams();
  const searchParamsHook = useSearchParams(); // Renamed to avoid conflict with searchParams in parent scope
  const { toast } = useToast();

  const memberId = params.memberId as string;
  const totalPendingStr = searchParamsHook.get('pending');
  const memberName = searchParamsHook.get('name') || 'Member';
  const totalPending = totalPendingStr ? parseFloat(totalPendingStr) : 0;

  const [recordPaymentForm, setRecordPaymentForm] = useState<RecordPaymentFormState>({
    ...initialRecordPaymentFormState,
    amount: totalPending, // Pre-fill with total pending
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Pre-fill amount if totalPending changes (e.g., if query param updates)
    setRecordPaymentForm(prev => ({ ...prev, amount: totalPending }));
  }, [totalPending]);

  const handleRecordPaymentFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nameParts = name.split('.');

    if (nameParts.length > 1 && nameParts[0] === 'paymentDetails') {
      const detailKey = nameParts[1] as keyof RecordPaymentFormState['paymentDetails'];
      setRecordPaymentForm(prev => ({
        ...prev,
        paymentDetails: { ...prev.paymentDetails, [detailKey]: value },
      }));
    } else if (name === 'amount') {
      setRecordPaymentForm(prev => ({ ...prev, amount: parseFloat(value) || 0 }));
    } else {
      setRecordPaymentForm(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleRecordPaymentDepositModeChange = (value: 'Cash' | 'Bank' | 'Wallet') => {
    setRecordPaymentForm(prev => ({
      ...prev,
      depositMode: value,
      paymentDetails: value === 'Cash' ? initialRecordPaymentFormState.paymentDetails : prev.paymentDetails,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (recordPaymentForm.amount <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Payment amount must be positive.' });
      return;
    }
    if (recordPaymentForm.amount > totalPending) {
      toast({ variant: 'destructive', title: 'Error', description: `Payment amount cannot exceed total pending ($${totalPending.toFixed(2)}).` });
      return;
    }
    if ((recordPaymentForm.depositMode === 'Bank' || recordPaymentForm.depositMode === 'Wallet') && !recordPaymentForm.paymentDetails.sourceName) {
      toast({ variant: 'destructive', title: 'Error', description: `Please enter the ${recordPaymentForm.depositMode} Name.` });
      return;
    }

    setIsSubmitting(true);
    // In a real app, this would be an API call. Here, we navigate back with query params.
    const queryParams = new URLSearchParams();
    queryParams.set('payment_recorded_for_member', memberId);
    queryParams.set('amount_paid', recordPaymentForm.amount.toString());
    queryParams.set('payment_date', recordPaymentForm.paymentDate);
    queryParams.set('deposit_mode', recordPaymentForm.depositMode);
    if (recordPaymentForm.depositMode !== 'Cash') {
        queryParams.set('source_name', recordPaymentForm.paymentDetails.sourceName);
        queryParams.set('transaction_ref', recordPaymentForm.paymentDetails.transactionReference);
        queryParams.set('evidence_url', recordPaymentForm.paymentDetails.evidenceUrl);
    }
    
    router.push(`/applied-service-charges?${queryParams.toString()}`);
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <PageTitle title={`Record Payment for ${decodeURIComponent(memberName)}`} subtitle={`Total Pending Service Charges: $${totalPending.toFixed(2)}`} />
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
              <Label htmlFor="recordPaymentAmount">Payment Amount ($)</Label>
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
              <Label htmlFor="recordPaymentDate">Payment Date</Label>
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
                    <Label htmlFor="paymentDetails.sourceNameRecord">{recordPaymentForm.depositMode} Name</Label>
                    <div className="relative">
                      {recordPaymentForm.depositMode === 'Bank' && <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                      {recordPaymentForm.depositMode === 'Wallet' && <Wallet className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                      <Input id="paymentDetails.sourceNameRecord" name="paymentDetails.sourceName" placeholder={`Enter ${recordPaymentForm.depositMode} Name`} value={recordPaymentForm.paymentDetails.sourceName} onChange={handleRecordPaymentFormChange} className="pl-8" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="paymentDetails.transactionReferenceRecord">Transaction Reference</Label>
                    <Input id="paymentDetails.transactionReferenceRecord" name="paymentDetails.transactionReference" placeholder="e.g., TRN123XYZ" value={recordPaymentForm.paymentDetails.transactionReference} onChange={handleRecordPaymentFormChange} />
                  </div>
                </div>
                <div className="pl-3">
                  <Label htmlFor="paymentDetails.evidenceUrlRecord">Evidence Attachment</Label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md border-border hover:border-primary transition-colors">
                    <div className="space-y-1 text-center">
                      <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                      <div className="flex text-sm text-muted-foreground">
                        <p className="pl-1">Upload a file or drag and drop</p>
                      </div>
                      <p className="text-xs text-muted-foreground">PNG, JPG, PDF up to 10MB (mock)</p>
                    </div>
                  </div>
                  <Input
                    id="paymentDetails.evidenceUrlRecord"
                    name="paymentDetails.evidenceUrl"
                    placeholder="Enter URL or filename for reference"
                    value={recordPaymentForm.paymentDetails.evidenceUrl}
                    onChange={handleRecordPaymentFormChange}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Actual file upload is not functional. Enter a reference URL or filename above.</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : 'Record Payment'}
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
