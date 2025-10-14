
import { headers } from 'next/headers';
import { validateNibToken, requestMoney } from './actions';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MiniAppClient } from './client';

export default async function MiniAppPage() {
  const headersList = headers();
  const authHeader = headersList.get('Authorization');
  let validationResult: { phoneNumber?: string; error?: string } = { error: 'Authorization token not found.' };
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
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
        <MiniAppClient validationResult={validationResult} token={token} />
      </Card>
    </div>
  );
}
