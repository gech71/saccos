

'use server';

import prisma from '@/lib/prisma';
import type { Member, SavingAccountType, School, Saving, Prisma, MemberSavingAccount } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { startOfDay, endOfDay, eachDayOfInterval, differenceInDays, format } from 'date-fns';
import type { DateRange } from 'react-day-picker';


function roundToTwo(num: number) {
    return Math.round(num * 100) / 100;
}

export interface CalculationPageData {
    members: Pick<Member, 'id' | 'fullName'>[];
    schools: Pick<School, 'id' | 'name'>[];
    savingAccountTypes: Pick<SavingAccountType, 'id' | 'name' | 'interestRate'>[];
}

export interface InterestCalculationResult {
  memberId: string;
  memberSavingAccountId: string;
  fullName: string;
  savingsAccountNumber?: string | null;
  savingsBalance: number;
  interestRate: number;
  calculatedInterest: number;
}

export async function getCalculationPageData(): Promise<CalculationPageData> {
    const [members, schools, savingAccountTypes] = await Promise.all([
        prisma.member.findMany({
            where: { status: 'active' },
            select: { id: true, fullName: true },
            orderBy: { fullName: 'asc' }
        }),
        prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.savingAccountType.findMany({ where: { interestRate: { gt: 0 } }, select: { id: true, name: true, interestRate: true }, orderBy: { name: 'asc' } }),
    ]);
    return { members, schools, savingAccountTypes };
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];


export async function calculateInterest(criteria: {
  scope: 'all' | 'school' | 'member' | 'accountType';
  schoolId?: string;
  memberId?: string;
  accountTypeId?: string;
}, period: DateRange): Promise<InterestCalculationResult[]> {
  const { scope, schoolId, memberId, accountTypeId } = criteria;

  if (!period.from) {
      throw new Error("A start date for the period is required.");
  }
  
  const periodStart = startOfDay(period.from);
  // If no 'to' date, use the 'from' date for a single-day calculation
  const periodEnd = period.to ? endOfDay(period.to) : endOfDay(period.from);

  const daysInPeriod = differenceInDays(periodEnd, periodStart) + 1;
  
  let whereClause: Prisma.MemberSavingAccountWhereInput = {
    balance: { gt: 0 },
    member: { status: 'active' },
    savingAccountType: {
        interestRate: { gt: 0 }
    }
  };

  if (scope === 'school' && schoolId) {
    whereClause.member = { ...whereClause.member, schoolId: schoolId };
  } else if (scope === 'member' && memberId) {
    whereClause.member = { ...whereClause.member, id: memberId };
  } else if (scope === 'accountType' && accountTypeId) {
    whereClause.savingAccountTypeId = accountTypeId;
  }

  const accountsToProcess = await prisma.memberSavingAccount.findMany({
    where: whereClause,
    include: { 
        member: { select: { fullName: true, id: true } }, 
        savingAccountType: true,
        savings: {
            where: { status: 'approved' },
            orderBy: { date: 'asc' }
        }
    },
  });

  const results: InterestCalculationResult[] = accountsToProcess
    .map(account => {
    if (!account.savingAccountType) return null;

    // 1. Calculate balance at the beginning of the period
    let balanceAtPeriodStart = account.initialBalance;
    const transactionsBeforePeriod = account.savings.filter(tx => new Date(tx.date) < periodStart);
    transactionsBeforePeriod.forEach(tx => {
        balanceAtPeriodStart += tx.transactionType === 'deposit' ? tx.amount : -tx.amount;
    });
    
    // 2. Calculate sum of daily balances for the period
    let totalDailyBalance = 0;
    const intervalDays = eachDayOfInterval({ start: periodStart, end: periodEnd });
    
    // Create a map of transactions by date for efficient lookup
    const transactionsByDate = new Map<string, Saving[]>();
    account.savings.forEach(tx => {
        const txDate = format(new Date(tx.date), 'yyyy-MM-dd');
        if (txDate >= format(periodStart, 'yyyy-MM-dd') && txDate <= format(periodEnd, 'yyyy-MM-dd')) {
            if (!transactionsByDate.has(txDate)) {
                transactionsByDate.set(txDate, []);
            }
            transactionsByDate.get(txDate)!.push(tx);
        }
    });

    let runningDayBalance = balanceAtPeriodStart;
    intervalDays.forEach(day => {
        const dayString = format(day, 'yyyy-MM-dd');
        const transactionsOnThisDay = transactionsByDate.get(dayString) || [];
        
        // Apply transactions at the start of the day to get the closing balance
        transactionsOnThisDay.forEach(tx => {
            runningDayBalance += tx.transactionType === 'deposit' ? tx.amount : -tx.amount;
        });

        // Add the closing balance for this day to the total
        totalDailyBalance += runningDayBalance;
    });

    // 3. Calculate Average Daily Balance and Interest
    const averageDailyBalance = totalDailyBalance / daysInPeriod;
    const annualRate = account.savingAccountType.interestRate;
    const calculatedInterest = roundToTwo(averageDailyBalance * (annualRate / 365) * daysInPeriod);

    return {
      memberId: account.memberId,
      memberSavingAccountId: account.id,
      fullName: account.member.fullName,
      savingsAccountNumber: account.accountNumber,
      savingsBalance: account.balance, // Current balance for display
      interestRate: account.savingAccountType.interestRate,
      calculatedInterest,
    };
  }).filter((res): res is InterestCalculationResult => res !== null && res.calculatedInterest > 0);

  return results;
}


export async function postInterestTransactions(
    transactions: InterestCalculationResult[],
    period: DateRange
): Promise<{ success: boolean; message: string }> {
    if (transactions.length === 0) {
        return { success: false, message: 'No interest transactions to post.' };
    }

    if (!period.from || !period.to) {
        return { success: false, message: 'A full date range is required to post interest.' };
    }

    const postingDate = endOfDay(period.to);
    const monthName = format(postingDate, 'MMMM yyyy');

    try {
        const newInterestTransactionsData: Prisma.SavingCreateManyInput[] = transactions.map(result => ({
          memberId: result.memberId,
          memberSavingAccountId: result.memberSavingAccountId,
          amount: result.calculatedInterest, // Already rounded
          date: postingDate, 
          month: monthName,
          transactionType: 'deposit',
          status: 'pending',
          notes: `Interest posting for period ending ${format(postingDate, 'PPP')}`,
          depositMode: 'Bank', // System-generated
          sourceName: 'Internal System Posting',
          transactionReference: `INT-${format(postingDate, 'yyyyMMdd')}-${result.memberId.slice(-6)}`,
          evidenceUrl: null
        }));

        await prisma.saving.createMany({
            data: newInterestTransactionsData,
            skipDuplicates: true,
        });

        revalidatePath('/savings');
        revalidatePath('/approve-transactions');

        return { success: true, message: `${transactions.length} interest transactions have been submitted for approval.` };
    } catch (error) {
        console.error("Failed to post interest transactions:", error);
        return { success: false, message: 'An error occurred while posting interest transactions.' };
    }
}
