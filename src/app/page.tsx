import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Users, PiggyBank, PieChart, BarChart, LogIn } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '@/components/logo';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-16 md:py-24 lg:py-32 bg-gradient-to-br from-primary/10 via-background to-background">
          <div className="container text-center">
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-primary sm:text-5xl md:text-6xl lg:text-7xl">
              Empowering School Communities
            </h1>
            <p className="mt-6 max-w-3xl mx-auto text-lg text-foreground/80 sm:text-xl md:text-2xl">
              AcademInvest provides a transparent and efficient platform for managing savings, shares, and dividends within educational institutions.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button size="lg" asChild className="shadow-lg hover:shadow-primary/50 transition-shadow w-full sm:w-auto">
                <Link href="/signup">
                  Get Started Free
                  <LogIn className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="shadow-lg hover:shadow-accent/50 transition-shadow w-full sm:w-auto">
                <Link href="#features">Learn More</Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="py-16 md:py-24 bg-background">
          <div className="container">
            <h2 className="font-headline text-3xl font-bold text-center text-primary mb-12">
              Features Designed for Growth
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<Users className="h-10 w-10 text-accent" />}
                title="Member Management"
                description="Easily create and manage member profiles, linking each member to their specific school."
              />
              <FeatureCard
                icon={<PiggyBank className="h-10 w-10 text-accent" />}
                title="Savings Tracking"
                description="Record and track members' monthly savings contributions with precision and ease."
              />
              <FeatureCard
                icon={<PieChart className="h-10 w-10 text-accent" />}
                title="Share Allocation"
                description="Fairly calculate and distribute shares based on savings and school affiliations."
              />
              <FeatureCard
                icon={<BarChart className="h-10 w-10 text-accent" />}
                title="Dividend Distribution"
                description="Transparently manage and distribute dividends based on members' shareholdings."
              />
              <FeatureCard
                icon={<CheckCircle className="h-10 w-10 text-accent" />}
                title="Secure & Reliable"
                description="Built with security in mind to protect your members' sensitive financial data."
              />
               <FeatureCard
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M12 10V2L10 4"></path><path d="M14 4L12 2"></path><path d="m3 11 8-4 8 4"></path><path d="M4 20h16"></path><path d="M6 13v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2"></path></svg>
                }
                title="School Focused"
                description="Tailored specifically for the unique needs of school-based savings and credit associations."
              />
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 bg-primary/5">
            <div className="container grid md:grid-cols-2 gap-12 items-center">
                <div>
                    <h2 className="font-headline text-3xl font-bold text-primary mb-6">
                        Insightful Reporting & Analytics
                    </h2>
                    <p className="text-lg text-foreground/80 mb-4">
                        Leverage the power of AI to generate comprehensive reports and visualizations. Understand member savings trends, share allocations, dividend distributions, and overall school performance at a glance.
                    </p>
                    <ul className="space-y-3">
                        <ListItem>Customizable reports for different stakeholders.</ListItem>
                        <ListItem>Visual charts for easy data interpretation.</ListItem>
                        <ListItem>Track key performance indicators effortlessly.</ListItem>
                    </ul>
                     <Button size="lg" asChild className="mt-8 shadow-lg hover:shadow-primary/50 transition-shadow">
                        <Link href="/signup">Explore Reporting</Link>
                    </Button>
                </div>
                <div>
                    <Image 
                        src="https://placehold.co/600x400.png" 
                        alt="Reporting Analytics Visual"
                        data-ai-hint="analytics dashboard" 
                        width={600} 
                        height={400}
                        className="rounded-lg shadow-2xl w-full h-auto" 
                    />
                </div>
            </div>
        </section>

      </main>

      <footer className="py-8 border-t bg-background">
        <div className="container text-center text-foreground/60">
          <p>&copy; {new Date().getFullYear()} AcademInvest. All rights reserved.</p>
          <p className="text-sm mt-1">Empowering educational communities through financial collaboration.</p>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="items-center">
        {icon}
        <CardTitle className="mt-4 font-headline text-xl text-primary">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-center text-base">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
    return (
        <li className="flex items-start">
            <CheckCircle className="h-6 w-6 text-accent mr-3 mt-1 flex-shrink-0" />
            <span className="text-foreground/80">{children}</span>
        </li>
    );
}
