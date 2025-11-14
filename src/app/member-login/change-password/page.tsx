
'use client';

import React, { useState, FormEvent, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/logo';
import { Loader2, KeyRound } from 'lucide-react';
import { changeMemberPassword } from '@/app/(app)/members/actions';
import { getWebsiteContent } from '@/lib/website-actions';
import type { WebsiteContent } from '@prisma/client';

function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [memberId, setMemberId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState<WebsiteContent | null>(null);

  useEffect(() => {
    getWebsiteContent().then(setContent);
    const id = searchParams.get('memberId');
    if (!id) {
        toast({ variant: 'destructive', title: 'Error', description: 'No member specified. Redirecting to login.' });
        router.push('/login');
    }
    setMemberId(id);
  }, [searchParams, router, toast]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!memberId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Member ID is missing.' });
        return;
    }
    if (newPassword.length < 6) {
        toast({ variant: 'destructive', title: 'Error', description: 'Password must be at least 6 characters long.' });
        return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Error', description: 'Passwords do not match.' });
      return;
    }

    setIsLoading(true);
    const result = await changeMemberPassword(memberId, newPassword);
    if (result.success) {
        toast({ title: 'Password Changed Successfully', description: 'You can now log in with your new password.' });
        router.push('/login');
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
        setIsLoading(false);
    }
  };

  if (!memberId) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="absolute top-8 left-8">
        <Logo logo={content?.logo} saccoName={content?.saccoName} />
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl text-primary">Change Your Password</CardTitle>
          <CardDescription>For security, you must change your temporary password before proceeding.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter your new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                aria-label="New Password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                aria-label="Confirm New Password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Setting Password...</> : <><KeyRound className="mr-2 h-4 w-4" />Set New Password</>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


export default function ChangePasswordPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ChangePasswordForm />
        </Suspense>
    )
}
