'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import React, { useState, FormEvent } from 'react';
import { Logo } from '@/components/logo';
import { Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulate successful submission
    toast({
      title: 'Password Reset Email Sent',
      description: `If an account exists for ${email}, you will receive an email with password reset instructions.`,
    });
    setIsSubmitted(true);
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="absolute top-8 left-8">
        <Logo />
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl text-primary">Forgot Password?</CardTitle>
          <CardDescription>
            {isSubmitted 
              ? "Check your email for the reset link." 
              : "Enter your email address and we'll send you a link to reset your password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSubmitted ? (
            <div className="text-center py-4">
              <Mail className="mx-auto h-16 w-16 text-accent mb-4" />
              <p className="text-muted-foreground">
                Didn&apos;t receive an email? Check your spam folder or try again later.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-label="Email address"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Sending Link...' : 'Send Reset Link'}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/login" passHref>
            <Button variant="link" className="text-primary">Back to Sign In</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
