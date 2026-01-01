
'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React, { useState, FormEvent, useEffect } from 'react';
import { Loader2, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';
import { useAuth } from '@/contexts/auth-context';
import { changeAdminPassword } from './actions';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdminChangePasswordPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, logout, content } = useAuth();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setIsLoading(true);

    const result = await changeAdminPassword(newPassword);

    if (result.success) {
      toast({
        title: 'Password Changed Successfully',
        description: 'Your password has been updated. Please log in again with your new password.',
      });
      // Log the user out to force re-authentication with new password
      logout();
    } else {
      setError(result.error || 'An unexpected error occurred.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="absolute top-8 left-8">
        <Logo logo={content?.logo} saccoName={content?.saccoName} />
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl text-primary">Change Your Password</CardTitle>
        </CardHeader>
        <CardContent>
           {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
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
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Updating...</> : <><KeyRound className="mr-2 h-4 w-4" />Set New Password</>}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
             <Button variant="link" onClick={() => logout()}>
                Log Out
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
