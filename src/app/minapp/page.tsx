
import { headers } from 'next/headers';
import { validateNibToken } from './actions';
import { Logo } from '@/components/logo';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MiniAppClient } from './client';
import { getWebsiteContent } from '@/lib/website-actions';

export default async function MiniAppPage() {
  const headersList = headers();
  const authHeader = headersList.get('Authorization');
  let validationResult: { phoneNumber?: string; error?: string } = { error: 'Authorization token not found.' };
  let token: string | null = null;
  const content = await getWebsiteContent();

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    validationResult = await validateNibToken(token);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo logo={content?.logo} saccoName={content?.saccoName} />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">{content?.saccoName || "SACCO"} Savings</CardTitle>
          <CardDescription>
            Seamlessly deposit funds into your SACCO savings account directly from NIBtera.
          </CardDescription>
        </CardHeader>
        <MiniAppClient validationResult={validationResult} token={token} />
      </Card>
    </div>
  );
}
