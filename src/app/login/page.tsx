
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
import Link from 'next/link';
import React, { useState, FormEvent, useEffect, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { getWebsiteContent } from '@/lib/website-actions';
import type { WebsiteContent } from '@prisma/client';
import Image from 'next/image';
import { Logo } from '@/components/logo';
import { signIn } from 'next-auth/react';
import { Alert, AlertDescription } from '@/components/ui/alert';

function LoginForm() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [content, setContent] = useState<WebsiteContent | null>(null);

  useEffect(() => {
    getWebsiteContent().then(setContent);
  }, []);

  useEffect(() => {
    if (error) {
      if (error === 'CredentialsSignin') {
        setAuthError('Invalid phone number or password. Please try again.');
      } else {
        setAuthError('An unexpected error occurred during login.');
      }
    } else {
      setAuthError(null);
    }
  }, [error]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setAuthError(null);
    
    try {
      const result = await signIn('credentials', {
        redirect: false,
        phoneNumber,
        password,
      });

      if (result?.error) {
        setAuthError('Invalid phone number or password. Please try again.');
        setIsLoading(false);
      } else {
        // Successful sign-in, NextAuth will handle the session and redirect
        // The middleware will automatically redirect to the intended page or dashboard
        toast({ title: 'Login Successful', description: 'Welcome back!' });
      }
    } catch (e) {
      setAuthError('An unexpected error occurred.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4 pt-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <Image
              src={content?.logo || ''}
              alt={`${content?.saccoName || 'Sacco'} Logo`}
              width={80}
              height={80}
              className="h-20 w-20 rounded-full object-cover"
              onClick={() => router.push('/')}
              style={{ cursor: 'pointer' }}
              unoptimized={content?.logo?.startsWith('data:image')}
            />
            <span className="text-2xl font-bold text-primary font-headline">
              {content?.saccoName || 'SACCO System'}
            </span>
          </div>
          <CardDescription>
            {`Sign in to the ${content?.saccoName || 'SACCO'} system.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pt-6">
          {authError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="Enter your phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                aria-label="Phone Number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-label="Password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-4">
          <div className="text-sm">
            <Link
              href="/forgot-password"
              passHref
              className="text-primary underline-offset-4 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}


export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin"/></div>}>
      <LoginForm />
    </Suspense>
  )
}
