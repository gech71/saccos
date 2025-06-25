
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Users, School, TrendingUp, ArrowRight, PiggyBank, PieChart as LucidePieChart, FileText } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart, 
  Pie,
  Cell,
} from 'recharts';
import { mockMembers, mockSavings, mockShares, mockDividends } from '@/data/mock';

// Data for Admin Dashboard
const savingsData = [
  { month: 'Jan', savings: 4000, members: 20 },
  { month: 'Feb', savings: 3000, members: 22 },
  { month: 'Mar', savings: 2000, members: 25 },
  { month: 'Apr', savings: 2780, members: 28 },
  { month: 'May', savings: 1890, members: 30 },
  { month: 'Jun', savings: 2390, members: 32 },
];

const schoolPerformanceData = [
  { name: 'Greenwood High', members: 120, savings: 15000 },
  { name: 'Riverside Academy', members: 90, savings: 12000 },
  { name: 'Mountain View', members: 75, savings: 9000 },
];

const assetDistributionData = [
  { name: 'Savings', value: 40000 },
  { name: 'Shares', value: 25000 },
  { name: 'Dividends Paid', value: 10000 },
];
const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))'];


function AdminDashboard() {
  return (
    <div className="space-y-8">
      <PageTitle title="Admin Dashboard" subtitle="Welcome to AcademInvest. Here's an overview of your association." />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Members"
          value="285"
          icon={<Users className="h-6 w-6 text-accent" />}
          description="+20.1% from last month"
        />
        <StatCard
          title="Total Savings"
          value="$45,231.89"
          icon={<DollarSign className="h-6 w-6 text-accent" />}
          description="+15.5% from last month"
        />
        <StatCard
          title="Active Schools"
          value="3"
          icon={<School className="h-6 w-6 text-accent" />}
          description="All schools participating"
        />
        <StatCard
          title="Dividends Paid (YTD)"
          value="$1,280"
          icon={<TrendingUp className="h-6 w-6 text-accent" />}
          description="+5% compared to last year"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-primary">Monthly Savings Trend</CardTitle>
            <CardDescription>Total savings collected per month this year.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={savingsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--foreground))" />
                <YAxis stroke="hsl(var(--foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                <Line type="monotone" dataKey="savings" stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 6 }} name="Savings ($)" />
                <Line type="monotone" dataKey="members" stroke="hsl(var(--accent))" strokeWidth={2} activeDot={{ r: 6 }} name="Active Members" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-primary">School Performance</CardTitle>
            <CardDescription>Member count and total savings by school.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={schoolPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
                <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--accent))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="savings" fill="hsl(var(--primary))" name="Total Savings ($)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="members" fill="hsl(var(--accent))" name="Members" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
       <Card className="shadow-xl overflow-hidden">
        <Image 
          src="https://placehold.co/1200x300.png"
          alt="Community finance banner"
          data-ai-hint="community finance collaboration"
          width={1200}
          height={300}
          className="w-full h-auto object-cover"
        />
        <CardContent className="p-6 bg-gradient-to-r from-primary to-accent text-primary-foreground">
          <h3 className="text-2xl font-semibold mb-2">Strengthen Your School Community</h3>
          <p className="mb-4">AcademInvest helps foster financial literacy and collaboration within your school. Empower members and build a stronger future together.</p>
          <Button variant="secondary" asChild>
            <Link href="/schools">Learn More About School Programs <ArrowRight className="ml-2 h-4 w-4"/></Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberDashboard({ memberId }: { memberId: string }) {
    const member = useMemo(() => mockMembers.find(m => m.id === memberId), [memberId]);
    const memberSavings = useMemo(() => mockSavings.filter(s => s.memberId === memberId && s.status === 'approved'), [memberId]);
    const memberDividends = useMemo(() => mockDividends.filter(d => d.memberId === memberId && d.status === 'approved'), [memberId]);
    
    const totalDividends = useMemo(() => memberDividends.reduce((sum, d) => sum + d.amount, 0), [memberDividends]);

    const savingsHistory = useMemo(() => memberSavings.slice(-6).map(s => ({
        date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric'}),
        amount: s.transactionType === 'deposit' ? s.amount : -s.amount,
    })), [memberSavings]);
    
    if (!member) {
        return <div className="text-center py-10">Member data not found. Please log in again.</div>;
    }

    return (
        <div className="space-y-8">
            <PageTitle title={`Welcome, ${member.fullName}`} subtitle="Here is a summary of your account." />

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="My Savings Balance"
                  value={`$${member.savingsBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  icon={<PiggyBank className="h-6 w-6 text-accent" />}
                  description={`Account: ${member.savingsAccountNumber}`}
                />
                <StatCard
                  title="My Shares"
                  value={member.sharesCount.toString()}
                  icon={<LucidePieChart className="h-6 w-6 text-accent" />}
                  description="Total shares owned"
                />
                <StatCard
                  title="My Dividends (Total)"
                  value={`$${totalDividends.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  icon={<TrendingUp className="h-6 w-6 text-accent" />}
                  description="Total dividends received"
                />
                 <StatCard
                  title="My School"
                  value={member.schoolName || ''}
                  icon={<School className="h-6 w-6 text-accent" />}
                  description={`Joined: ${new Date(member.joinDate).toLocaleDateString()}`}
                />
            </div>
            
             <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="font-headline text-primary">My Recent Savings Activity</CardTitle>
                <CardDescription>Your last 6 approved transactions.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={savingsHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="amount" name="Amount ($)" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-xl overflow-hidden">
                <CardContent className="p-6 bg-gradient-to-r from-primary to-accent text-primary-foreground">
                  <h3 className="text-2xl font-semibold mb-2">Want to see more details?</h3>
                  <p className="mb-4">Generate a full statement of your account activity for any period.</p>
                  <Button variant="secondary" asChild>
                    <Link href="/account-statement">Generate My Statement <ArrowRight className="ml-2 h-4 w-4"/></Link>
                  </Button>
                </CardContent>
            </Card>
        </div>
    );
}

export default function DashboardPage() {
  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem('userRole') as 'admin' | 'member' | null;
    const id = localStorage.getItem('loggedInMemberId');
    setUserRole(role);
    setMemberId(id);
    setIsLoading(false);
  }, []);

  if (isLoading) {
      return (
        <div className="space-y-8">
            <div className="h-8 w-64 bg-muted rounded animate-pulse"></div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="h-4 w-24 bg-muted rounded"></div>
                    <div className="h-6 w-6 bg-muted rounded-full"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 w-16 bg-muted rounded mb-1"></div>
                    <div className="h-3 w-32 bg-muted rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
        </div>
      );
  }

  if (userRole === 'member' && memberId) {
    return <MemberDashboard memberId={memberId} />;
  }

  // Fallback to AdminDashboard
  return <AdminDashboard />;
}
