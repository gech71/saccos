
'use client';

import React, { useEffect, useState } from 'react';
import { PageTitle } from '@/components/page-title';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Users, School, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
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
} from 'recharts';
import { getAdminDashboardData, type AdminDashboardData } from './actions';

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const data = await getAdminDashboardData();
        setDashboardData(data);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
  }

  if (dashboardData) {
    return (
      <div className="space-y-8">
        <PageTitle title="Admin Dashboard" subtitle="Welcome to AcademInvest. Here's an overview of your association." />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Members"
            value={dashboardData.totalMembers.toLocaleString()}
            icon={<Users className="h-6 w-6 text-accent" />}
          />
          <StatCard
            title="Total Savings"
            value={`Birr ${dashboardData.totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<DollarSign className="h-6 w-6 text-accent" />}
          />
          <StatCard
            title="Active Schools"
            value={dashboardData.totalSchools.toLocaleString()}
            icon={<School className="h-6 w-6 text-accent" />}
          />
          <StatCard
            title="Dividends Paid (YTD)"
            value={`Birr ${dashboardData.totalDividendsYTD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<TrendingUp className="h-6 w-6 text-accent" />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-primary">Monthly Savings Trend (Last 6 Months)</CardTitle>
              <CardDescription>Total approved deposits per month.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dashboardData.savingsTrend}>
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
                  <Line type="monotone" dataKey="savings" stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 6 }} name="Savings (Birr)" />
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
                <BarChart data={dashboardData.schoolPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--foreground))" angle={-15} textAnchor="end" height={50} />
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
                  <Bar yAxisId="left" dataKey="savings" fill="hsl(var(--primary))" name="Total Savings (Birr)" radius={[4, 4, 0, 0]} />
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
  
  return null; // Fallback for when data is not loaded
}
