
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Users, School, TrendingUp, ArrowRight, PiggyBank, PieChart as LucidePieChart, FileText, Loader2 } from 'lucide-react';
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
import { getAdminDashboardData, getMemberDashboardData, type AdminDashboardData, type MemberDashboardData } from './actions';
import { format } from 'date-fns';

export default function DashboardPage() {
  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | MemberDashboardData | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('userRole') as 'admin' | 'member' | null;
    const id = localStorage.getItem('loggedInMemberId');
    setUserRole(role);
    setMemberId(id);
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!userRole) return;
      setIsLoading(true);
      try {
        if (userRole === 'admin') {
          const data = await getAdminDashboardData();
          setDashboardData(data);
        } else if (userRole === 'member' && memberId) {
          const data = await getMemberDashboardData(memberId);
          setDashboardData(data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        // Optionally, set an error state and show a toast
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [userRole, memberId]);

  if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
  }

  if (userRole === 'admin' && dashboardData) {
    const adminData = dashboardData as AdminDashboardData;
    return (
      <div className="space-y-8">
        <PageTitle title="Admin Dashboard" subtitle="Welcome to AcademInvest. Here's an overview of your association." />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Members"
            value={adminData.totalMembers.toLocaleString()}
            icon={<Users className="h-6 w-6 text-accent" />}
          />
          <StatCard
            title="Total Savings"
            value={`$${adminData.totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<DollarSign className="h-6 w-6 text-accent" />}
          />
          <StatCard
            title="Active Schools"
            value={adminData.totalSchools.toLocaleString()}
            icon={<School className="h-6 w-6 text-accent" />}
          />
          <StatCard
            title="Dividends Paid (YTD)"
            value={`$${adminData.totalDividendsYTD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
                <LineChart data={adminData.savingsTrend}>
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
                <BarChart data={adminData.schoolPerformance}>
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

  if (userRole === 'member' && dashboardData) {
    const memberData = (dashboardData as MemberDashboardData);
    const { member, totalDividends, savingsHistory } = memberData;

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
                  value={member.school?.name || ''}
                  icon={<School className="h-6 w-6 text-accent" />}
                  description={`Joined: ${format(new Date(member.joinDate), 'PPP')}`}
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
                    <Bar dataKey="amount" name="Amount ($)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
  
  return null; // Fallback for when data is not loaded or role is not set
}
