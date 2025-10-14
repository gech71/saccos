
import { headers } from 'next/headers';
import { validateNibToken } from './actions';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default async function MiniAppPage() {
  const headersList = headers();
  const authHeader = headersList.get('Authorization');
  let validationResult: { phoneNumber?: string; error?: string } = { error: 'Authorization token not found.' };

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    validationResult = await validateNibToken(token);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">SACCO Savings</CardTitle>
          <CardDescription>
            Seamlessly deposit funds into your SACCO savings account directly from NIBtera.
          </CardDescription>
        </CardHeader>
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
                <p className="text-sm">Welcome, Member!</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount to Deposit</Label>
            <Input id="amount" type="number" placeholder="Enter amount" disabled={!!validationResult.error} />
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" disabled={!!validationResult.error}>
            Proceed to Deposit
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
