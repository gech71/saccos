
'use server';

import prisma from '@/lib/prisma';
import { subMonths, format, startOfMonth } from 'date-fns';
import type { School } from '@prisma/client';

export interface AdminDashboardData {
  totalMembers: number;
  totalSavings: number;
  totalSchools: number;
  totalDividendsYTD: number;
  savingsTrend: { month: string; savings: number; }[];
  schoolPerformance: { name: string; members: number; savings: number; }[];
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  // Fetch raw data in parallel
  const [
    totalMembers,
    totalSavingsResult,
    totalSchools,
    totalDividendsResult,
    savingsLast6Months,
    schoolsWithMemberCounts,
    allMemberSavingAccounts,
  ] = await Promise.all([
    prisma.member.count({ where: { status: 'active' } }),
    prisma.memberSavingAccount.aggregate({ _sum: { balance: true } }),
    prisma.school.count(),
    prisma.dividend.aggregate({
      _sum: { amount: true },
      where: {
        status: 'approved',
        distributionDate: { gte: new Date(new Date().getFullYear(), 0, 1) },
      },
    }),
    prisma.saving.findMany({
      where: {
        status: 'approved',
        transactionType: 'deposit',
        date: { gte: startOfMonth(subMonths(new Date(), 5)) },
      },
      select: { amount: true, date: true },
      orderBy: { date: 'asc' },
    }),
    prisma.school.findMany({
        include: { _count: { select: { members: { where: { status: 'active' } } } } },
    }),
    prisma.memberSavingAccount.findMany({
        where: { member: { status: 'active' } },
        select: { balance: true, member: { select: { schoolId: true } } }
    }),
  ]);

  // Process total stats
  const totalSavings = totalSavingsResult._sum.balance || 0;
  const totalDividendsYTD = totalDividendsResult._sum.amount || 0;

  // Process Savings Trend
  const monthlySavings: { [key: string]: number } = {};
  for (let i = 5; i >= 0; i--) {
    const month = format(subMonths(new Date(), i), 'MMM');
    monthlySavings[month] = 0;
  }

  savingsLast6Months.forEach(saving => {
    const month = format(new Date(saving.date), 'MMM');
    if (monthlySavings[month] !== undefined) {
      monthlySavings[month] += saving.amount;
    }
  });

  const savingsTrend = Object.keys(monthlySavings).map(month => ({
    month,
    savings: monthlySavings[month],
  }));

  // Process School Performance
  const schoolSavingsMap = new Map<string, number>();
  allMemberSavingAccounts.forEach(account => {
      if (account.member.schoolId) {
          const currentTotal = schoolSavingsMap.get(account.member.schoolId) || 0;
          schoolSavingsMap.set(account.member.schoolId, currentTotal + account.balance);
      }
  });

  const schoolPerformance = schoolsWithMemberCounts.map(school => ({
    name: school.name,
    members: school._count.members,
    savings: schoolSavingsMap.get(school.id) || 0,
  }));

  return {
    totalMembers,
    totalSavings,
    totalSchools,
    totalDividendsYTD,
    savingsTrend,
    schoolPerformance,
  };
}
