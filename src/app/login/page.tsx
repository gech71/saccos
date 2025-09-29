
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
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import React, { useState, FormEvent, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getWebsiteContent } from '@/lib/website-actions';
import type { WebsiteContent } from '@prisma/client';
import Image from 'next/image';

export default function LoginPage() {
  const { unifiedLogin } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [content, setContent] = useState<WebsiteContent | null>(null);

  useEffect(() => {
    getWebsiteContent().then(setContent);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      await unifiedLogin({ phoneNumber, password });
      // Redirect is handled by the auth context
    } catch (error) {
      // Error toast is handled by the auth context
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4 pt-8">
          <div className="flex flex-col items-center justify-center gap-4">
             <Image
              src={
                content?.logo ||
                'https://play-lh.googleusercontent.com/bXqMt9ROsGd0H9vPhib5hG-0NB-EJcAwZy6UUDhvlP-ykE595IMQtzr14R6IRWtJiGTh'
              }
              alt={`${content?.saccoName || 'Sacco'} Logo`}
              width={80}
              height={80}
              className="h-20 w-20 rounded-full object-cover"
              onClick={() => router.push('/')}
              style={{ cursor: 'pointer' }}
              unoptimized={content?.logo?.startsWith('data:image')}
            />
             <span className="text-2xl font-bold text-primary font-headline">
              {content?.saccoName || 'AcademInvest Saccos'}
            </span>
          </div>
          <CardDescription>
            {`Sign in to the ${
              content?.saccoName || 'AcademInvest'
            } system.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pt-6">
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
