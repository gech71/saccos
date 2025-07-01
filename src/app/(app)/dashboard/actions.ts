'use server';

import prisma from '@/lib/prisma';
import { subMonths, format, startOfMonth } from 'date-fns';

export interface AdminDashboardData {
  totalMembers: number;
  totalSavings: number;
  totalSchools: number;
  totalDividendsYTD: number;
  savingsTrend: { month: string; savings: number; }[];
  schoolPerformance: { name: string; members: number; savings: number; }[];
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const totalMembers = await prisma.member.count({ where: { status: 'active' } });
  
  const totalSavingsResult = await prisma.member.aggregate({
    _sum: { savingsBalance: true },
    where: { status: 'active' },
  });
  const totalSavings = totalSavingsResult._sum.savingsBalance || 0;

  const totalSchools = await prisma.school.count();

  const totalDividendsResult = await prisma.dividend.aggregate({
    _sum: { amount: true },
    where: {
      status: 'approved',
      distributionDate: { gte: new Date(new Date().getFullYear(), 0, 1) },
    },
  });
  const totalDividendsYTD = totalDividendsResult._sum.amount || 0;

  // Savings Trend for the last 6 months
  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
  const savingsLast6Months = await prisma.saving.findMany({
    where: {
      status: 'approved',
      transactionType: 'deposit',
      date: { gte: sixMonthsAgo },
    },
    select: { amount: true, date: true },
    orderBy: { date: 'asc' },
  });

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

  // School Performance
  const schools = await prisma.school.findMany({
    include: {
      _count: {
        select: { members: { where: { status: 'active' } } },
      },
    },
  });

  const schoolSavings = await prisma.member.groupBy({
    by: ['schoolId'],
    _sum: {
      savingsBalance: true,
    },
    where: { status: 'active' }
  });

  const schoolPerformance = schools.map(school => {
    const savingsData = schoolSavings.find(s => s.schoolId === school.id);
    return {
      name: school.name,
      members: school._count.members,
      savings: savingsData?._sum.savingsBalance || 0,
    };
  });


  return {
    totalMembers,
    totalSavings,
    totalSchools,
    totalDividendsYTD,
    savingsTrend,
    schoolPerformance,
  };
}
