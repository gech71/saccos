'use client';

import { PageTitle } from '@/components/page-title';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Users, School, TrendingUp, ArrowRight } from 'lucide-react';
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
  PieChart as RechartsPieChart, // Renamed to avoid conflict with lucide-react PieChart
  Pie,
  Cell,
} from 'recharts';
import React, { useEffect, useState } from 'react';

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


export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Basic skeleton or loading state
    return (
      <div className="space-y-8">
        <PageTitle title="Dashboard" subtitle="Overview of your association's performance." />
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
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="animate-pulse h-[350px]"><CardContent className="p-6 h-full bg-muted rounded-lg"></CardContent></Card>
          <Card className="animate-pulse h-[350px]"><CardContent className="p-6 h-full bg-muted rounded-lg"></CardContent></Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <PageTitle title="Dashboard" subtitle="Welcome to AcademInvest. Here's an overview of your association." />

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

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-primary">Asset Distribution</CardTitle>
            <CardDescription>Current breakdown of association assets.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPieChart>
                <Pie
                  data={assetDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {assetDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                    contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                    }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-primary">Quick Actions</CardTitle>
            <CardDescription>Access key features quickly.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <QuickActionLink href="/members/add" title="Add New Member" icon={<Users className="text-primary"/>} />
            <QuickActionLink href="/savings/record" title="Record Savings" icon={<PiggyBank className="text-primary"/>} />
            <QuickActionLink href="/shares/allocate" title="Allocate Shares" icon={<PieChart className="text-primary"/>} /> {/* Lucide PieChart */}
            <QuickActionLink href="/reports" title="Generate Report" icon={<FileText className="text-primary"/>} />
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

interface QuickActionLinkProps {
    href: string;
    title: string;
    icon: React.ReactNode;
}

function QuickActionLink({ href, title, icon }: QuickActionLinkProps) {
    return (
        <Link href={href} passHref>
            <Button variant="outline" className="w-full justify-start h-12 text-left group hover:bg-accent/10">
                <div className="flex items-center gap-3">
                    <span className="p-2 bg-accent/20 rounded-md group-hover:bg-accent/30 transition-colors">
                        {icon}
                    </span>
                    <span className="font-medium text-primary group-hover:text-accent transition-colors">{title}</span>
                </div>
            </Button>
        </Link>
    )
}

