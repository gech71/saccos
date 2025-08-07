
'use server';

import prisma from '@/lib/prisma';
import { subMonths, format, startOfMonth } from 'date-fns';

export interface AdminDashboardData {
  totalMembers: number;
  totalSavings: number;
  totalSchools: number;
  totalDividendsYTD: number;
  totalLoanPrincipal: number;
  totalLoanInterestCollected: number;
  totalServiceChargesCollected: number;
  savingsTrend: { month: string; savings: number; }[];
  schoolPerformance: { name: string; members: number; savings: number; }[];
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const [
    totalMembers,
    totalSavingsResult,
    totalSchools,
    totalDividendsResult,
    savingsLast6Months,
    schools,
    totalLoanResult,
    totalLoanInterestResult,
    totalServiceChargeResult
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
      include: {
        _count: { select: { members: { where: { status: 'active' } } } },
        members: {
          where: { status: 'active' },
          include: {
            memberSavingAccounts: {
              select: {
                balance: true
              }
            }
          }
        }
      },
    }),
    prisma.loan.aggregate({
      _sum: { principalAmount: true },
       where: { status: { in: ['active', 'overdue', 'paid_off'] } },
    }),
    prisma.loanRepayment.aggregate({
      _sum: { interestPaid: true }
    }),
    prisma.appliedServiceCharge.aggregate({
      where: { status: 'paid' },
      _sum: { amountCharged: true }
    })
  ]);

  const totalSavings = totalSavingsResult._sum.balance || 0;
  const totalDividendsYTD = totalDividendsResult._sum.amount || 0;
  const totalLoanPrincipal = totalLoanResult._sum.principalAmount || 0;
  const totalLoanInterestCollected = totalLoanInterestResult._sum.interestPaid || 0;
  const totalServiceChargesCollected = totalServiceChargeResult._sum.amountCharged || 0;

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
  
  const schoolPerformance = schools.map(school => {
    const totalSchoolSavings = school.members.reduce((schoolSum, member) => {
      const memberTotal = member.memberSavingAccounts.reduce((memberSum, account) => memberSum + account.balance, 0);
      return schoolSum + memberTotal;
    }, 0);
    
    return {
      name: school.name,
      members: school._count.members,
      savings: totalSchoolSavings,
    };
  });

  return {
    totalMembers,
    totalSavings,
    totalSchools,
    totalDividendsYTD,
    totalLoanPrincipal,
    totalLoanInterestCollected,
    totalServiceChargesCollected,
    savingsTrend,
    schoolPerformance,
  };
}
