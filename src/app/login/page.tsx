
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import React, { useState, FormEvent } from 'react';
import { Logo } from '@/components/logo';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      await login({ phoneNumber, password });
      // Redirect is handled by the auth context's success handler
    } catch (error) {
      // Error toast is handled by the auth context
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="absolute top-8 left-8">
        <Logo />
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl text-primary">Admin Sign In</CardTitle>
          <CardDescription>Sign in to manage your NIB Saccos system.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="0911223344"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-label="Password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Signing In...</> : 'Sign In'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-2">
            <Link href="/forgot-password" passHref>
                <Button variant="link" className="text-sm font-normal text-muted-foreground">Forgot password?</Button>
            </Link>
            <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link href="/signup" passHref>
                <Button variant="link" className="text-primary p-0 h-auto">Sign Up</Button>
                </Link>
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
