'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/logo';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the login page
    router.replace('/login');
  }, [router]);

  // Display a loading spinner while redirecting
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <Logo />
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
    </div>
  );
}
