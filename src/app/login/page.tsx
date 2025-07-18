
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import React, { useState, FormEvent } from 'react';
import { Logo } from '@/components/logo';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { findMemberByPhoneNumber } from './actions';

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [authMode, setAuthMode] = useState<'admin' | 'member'>('admin');
  
  const [adminPhoneNumber, setAdminPhoneNumber] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  
  const [memberPhoneNumber, setMemberPhoneNumber] = useState('');
  const [isMemberLoading, setIsMemberLoading] = useState(false);

  const handleAdminSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsAdminLoading(true);
    try {
      await login({ phoneNumber: adminPhoneNumber, password: adminPassword });
      // Redirect is handled by the auth context
    } catch (error) {
      // Error toast is handled by the auth context
      setIsAdminLoading(false);
    }
  };
  
  const handleMemberSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsMemberLoading(true);
    try {
      const result = await findMemberByPhoneNumber(memberPhoneNumber);
      if (result.memberId) {
        toast({ title: 'Success', description: 'Member found. Redirecting to profile...' });
        router.push(`/member-profile/${result.memberId}`);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    } finally {
      setIsMemberLoading(false);
    }
  };

  const renderAdminForm = () => (
    <form onSubmit={handleAdminSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number</Label>
        <Input
          id="phoneNumber"
          type="tel"
          placeholder="0911223344"
          value={adminPhoneNumber}
          onChange={(e) => setAdminPhoneNumber(e.target.value)}
          required
          aria-label="Phone Number"
        />
      </div>
       <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          required
          aria-label="Password"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isAdminLoading}>
        {isAdminLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Signing In...</> : 'Sign In as Admin'}
      </Button>
    </form>
  );

  const renderMemberForm = () => (
     <form onSubmit={handleMemberSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="memberPhoneNumber">Member Phone Number</Label>
        <Input
          id="memberPhoneNumber"
          type="tel"
          placeholder="Enter your registered phone number"
          value={memberPhoneNumber}
          onChange={(e) => setMemberPhoneNumber(e.target.value)}
          required
          aria-label="Member Phone Number"
        />
      </div>
       <Button type="submit" variant="secondary" className="w-full" disabled={isMemberLoading}>
          {isMemberLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Finding Profile...</> : 'View My Profile'}
       </Button>
    </form>
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="absolute top-8 left-8">
        <Logo />
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl text-primary">Sign In</CardTitle>
          <CardDescription>
            {authMode === 'admin' ? 'Sign in to manage your NIB Saccos system.' : 'Enter your phone number to view your profile.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {authMode === 'admin' ? renderAdminForm() : renderMemberForm()}
        </CardContent>
        <CardFooter className="flex justify-center">
          {authMode === 'admin' ? (
            <p className="text-sm text-muted-foreground">
              Are you a member?{' '}
              <Button variant="link" className="text-primary p-0 h-auto" onClick={() => setAuthMode('member')}>Sign in here</Button>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Are you an admin?{' '}
              <Button variant="link" className="text-primary p-0 h-auto" onClick={() => setAuthMode('admin')}>Sign in here</Button>
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
