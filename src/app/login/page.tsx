
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import React, { useState, FormEvent, useEffect } from 'react';
import { Logo } from '@/components/logo';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getWebsiteContent } from '@/lib/website-actions';
import type { WebsiteContent } from '@prisma/client';

export default function LoginPage() {
  const { login, memberLogin } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [authMode, setAuthMode] = useState<'admin' | 'member'>('admin');
  
  const [adminPhoneNumber, setAdminPhoneNumber] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  
  const [memberPhoneNumber, setMemberPhoneNumber] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [isMemberLoading, setIsMemberLoading] = useState(false);

  const [content, setContent] = useState<WebsiteContent | null>(null);

  useEffect(() => {
    getWebsiteContent().then(setContent);
  }, []);

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
      await memberLogin({ phoneNumber: memberPhoneNumber, password: memberPassword });
      // Redirect is handled by the auth context
    } catch (error) {
      // Error is handled in auth context
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
          placeholder="Enter your Password"
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
      <div className="space-y-2">
        <Label htmlFor="memberPassword">Password</Label>
        <Input
          id="memberPassword"
          type="password"
          placeholder="Enter your Password"
          value={memberPassword}
          onChange={(e) => setMemberPassword(e.target.value)}
          required
          aria-label="Member Password"
        />
      </div>
       <Button type="submit" variant="default" className="w-full" disabled={isMemberLoading}>
          {isMemberLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Signing In...</> : 'Sign In as Member'}
       </Button>
    </form>
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="absolute top-8 left-8">
        <Logo logoUrl={content?.logoUrl} saccoName={content?.saccoName} />
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl text-primary">Sign In</CardTitle>
          <CardDescription>
            {authMode === 'admin' ? `Sign in to manage your ${content?.saccoName || 'AcademInvest'} system.` : 'Sign in to view your member profile.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {authMode === 'admin' ? renderAdminForm() : renderMemberForm()}
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <div className="text-sm">
            <Link href="/forgot-password" passHref className="text-primary underline-offset-4 hover:underline">
              Forgot your password?
            </Link>
          </div>
          <div className="text-sm text-muted-foreground">
              {authMode === 'admin' ? (
                <span>Are you a member?{' '}
                  <Button variant="link" className="text-primary p-0 h-auto" onClick={() => setAuthMode('member')}>Sign in here</Button>
                </span>
              ) : (
                <span>Are you an admin?{' '}
                  <Button variant="link" className="text-primary p-0 h-auto" onClick={() => setAuthMode('admin')}>Sign in here</Button>
                </span>
              )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
