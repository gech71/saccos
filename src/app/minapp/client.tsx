
'use client';

import { useState } from 'react';
import { requestMoney } from './actions';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';

interface MiniAppClientProps {
  validationResult: { phoneNumber?: string; error?: string };
  token: string | null;
}

export function MiniAppClient({ validationResult, token }: MiniAppClientProps) {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { content } = useAuth();

  const handleDeposit = async () => {
    if (!token) {
        toast({ variant: 'destructive', title: 'Error', description: 'Authentication token is missing.' });
        return;
    }
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter a valid amount.' });
        return;
    }

    setIsLoading(true);
    
    // These values would typically come from your system's configuration
    const params = {
        token,
        amount: depositAmount.toString(),
        accountNo: "7000", // Example merchant account
        companyName: content?.saccoName || "AcademInvest",
        transactionId: `TXN-${Date.now()}`,
        transactionTime: new Date().getTime().toString(),
    };

    const result = await requestMoney(params);

    if (result.success && result.data?.token) {
        toast({ title: 'Success', description: 'Transaction initiated. Please check your NIBtera app to complete the payment.' });
        
        // STEP 04: Send message back to NIBtera Super App
        if ((window as any).myJsChannel) {
            (window as any).myJsChannel.postMessage(result.data.token);
        } else {
            console.warn('window.myJsChannel is not available. This will only work inside the NIBtera Super App.');
        }

    } else {
        toast({ variant: 'destructive', title: 'Transaction Failed', description: result.error || 'An unknown error occurred.' });
    }

    setIsLoading(false);
  };

  return (
    <>
      <CardContent className="space-y-4">
        {validationResult.error ? (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-semibold">Authentication Failed</p>
              <p className="text-sm">{validationResult.error}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <div>
              <p className="font-semibold">Authenticated</p>
              <p className="text-sm">Welcome, Member ({validationResult.phoneNumber})!</p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="amount">Amount to Deposit</Label>
          <Input
            id="amount"
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!!validationResult.error || isLoading}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" disabled={!!validationResult.error || isLoading} onClick={handleDeposit}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Proceed to Deposit
        </Button>
      </CardFooter>
    </>
  );
}
