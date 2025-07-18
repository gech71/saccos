import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function MemberProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
            <Logo />
            <Button asChild variant="outline">
                <Link href="/login">Admin/Member Login</Link>
            </Button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 md:py-8">
        <div className="container text-center text-muted-foreground">
            © {new Date().getFullYear()} AcademInvest. All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}
