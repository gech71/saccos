
'use client';

import React, { useState, FormEvent, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Loader2, KeyRound, AlertTriangle } from 'lucide-react';
import { getWebsiteContent } from '@/lib/website-actions';
import type { WebsiteContent } from '@prisma/client';
import { validateResetToken, resetPassword } from './actions';

function ResetPasswordComponent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const [token, setToken] = useState<string | null>(null);
    const [tokenState, setTokenState] = useState<'validating' | 'valid' | 'invalid'>('validating');
    const [errorMessage, setErrorMessage] = useState('');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [content, setContent] = useState<WebsiteContent | null>(null);

    useEffect(() => {
        getWebsiteContent().then(setContent);
        const tokenFromUrl = searchParams.get('token');
        
        if (!tokenFromUrl) {
            setTokenState('invalid');
            setErrorMessage('No reset token found in the URL. Please request a new link.');
            return;
        }

        setToken(tokenFromUrl);

        async function checkToken() {
            const result = await validateResetToken(tokenFromUrl);
            if (result.success) {
                setTokenState('valid');
            } else {
                setTokenState('invalid');
                setErrorMessage(result.message);
            }
        }
        checkToken();
    }, [searchParams]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (tokenState !== 'valid' || !token) {
            toast({ variant: 'destructive', title: 'Error', description: 'The password reset link is invalid or has expired.' });
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
        const result = await resetPassword(token, newPassword);

        if (result.success) {
            toast({ title: 'Success', description: 'Your password has been changed successfully. Please log in.' });
            router.push('/login');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
            setIsLoading(false);
        }
    };
    
    const renderContent = () => {
        switch (tokenState) {
            case 'validating':
                return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
            case 'invalid':
                return (
                    <div className="text-center py-4 text-destructive space-y-4">
                        <AlertTriangle className="mx-auto h-12 w-12" />
                        <p className="font-semibold">{errorMessage}</p>
                    </div>
                );
            case 'valid':
                return (
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
                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...</> : <><KeyRound className="mr-2 h-4 w-4" />Set New Password</>}
                        </Button>
                    </form>
                );
        }
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
            <div className="absolute top-8 left-8">
                <Logo logo={content?.logo} saccoName={content?.saccoName} />
            </div>
            <Card className="w-full max-w-md shadow-2xl">
                <CardHeader className="text-center">
                    <CardTitle className="font-headline text-3xl text-primary">Set a New Password</CardTitle>
                    <CardDescription>
                        {tokenState === 'valid' ? 'Please enter and confirm your new password below.' : 'Validating your reset link...'}
                    </Description>
                </CardHeader>
                <CardContent>
                    {renderContent()}
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Button variant="link" asChild>
                        <Link href="/login">Back to Sign In</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}


export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ResetPasswordComponent />
        </Suspense>
    )
}
