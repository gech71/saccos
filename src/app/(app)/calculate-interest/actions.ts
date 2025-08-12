
'use server';

import prisma from '@/lib/prisma';
import type { Member, SavingAccountType, School, Saving, Prisma, MemberSavingAccount } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { startOfMonth, endOfMonth, eachDayOfInterval, differenceInDays, format } from 'date-fns';


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
}, period: { month: string, year: string }): Promise<InterestCalculationResult[]> {
  const { scope, schoolId, memberId, accountTypeId } = criteria;
  const monthIndex = parseInt(period.month, 10);
  const year = parseInt(period.year, 10);
  
  if (isNaN(monthIndex) || isNaN(year)) {
      throw new Error("Invalid month or year provided.");
  }

  const periodStart = startOfMonth(new Date(year, monthIndex));
  const periodEnd = endOfMonth(new Date(year, monthIndex));
  const daysInMonth = differenceInDays(periodEnd, periodStart) + 1;
  const monthName = monthNames[monthIndex];
  
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

  // Fetch existing interest transactions for the period to avoid duplicates
  const existingInterestNote = `Monthly interest posting for ${monthName} ${year}`;
  const existingInterestTransactions = await prisma.saving.findMany({
      where: {
          memberId: { in: accountsToProcess.map(acc => acc.memberId) },
          notes: existingInterestNote,
          status: { in: ['pending', 'approved'] }
      },
      select: {
          memberSavingAccountId: true,
      }
  });
  const processedAccountIds = new Set(existingInterestTransactions.map(tx => tx.memberSavingAccountId));


  const results: InterestCalculationResult[] = accountsToProcess
    .filter(account => !processedAccountIds.has(account.id)) // Exclude accounts that already have interest posted for the month
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
    let currentBalance = balanceAtPeriodStart;
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

    intervalDays.forEach(day => {
        const dayString = format(day, 'yyyy-MM-dd');
        const transactionsOnThisDay = transactionsByDate.get(dayString) || [];
        
        // Apply transactions for the day
        transactionsOnThisDay.forEach(tx => {
            currentBalance += tx.transactionType === 'deposit' ? tx.amount : -tx.amount;
        });

        // Add the closing balance for this day to the total
        totalDailyBalance += currentBalance;
    });

    // 3. Calculate Average Daily Balance and Interest
    const averageDailyBalance = totalDailyBalance / daysInMonth;
    const monthlyRate = account.savingAccountType.interestRate / 12;
    const calculatedInterest = roundToTwo(averageDailyBalance * monthlyRate);

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
    period: { month: string, year: string }
): Promise<{ success: boolean; message: string }> {
    if (transactions.length === 0) {
        return { success: false, message: 'No interest transactions to post.' };
    }

    const monthIndex = parseInt(period.month, 10);
    const year = parseInt(period.year, 10);
    const monthName = monthNames[monthIndex];

    if (isNaN(monthIndex) || isNaN(year) || !monthName) {
        return { success: false, message: 'Invalid period provided. Could not parse month or year.' };
    }

    try {
        const newInterestTransactionsData: Prisma.SavingCreateManyInput[] = transactions.map(result => ({
          memberId: result.memberId,
          memberSavingAccountId: result.memberSavingAccountId,
          amount: result.calculatedInterest, // Already rounded
          date: new Date(year, monthIndex + 1, 0), // Last day of the selected month
          month: `${monthName} ${period.year}`,
          transactionType: 'deposit',
          status: 'pending',
          notes: `Monthly interest posting for ${monthName} ${year}`,
          depositMode: 'Bank', // System-generated
          sourceName: 'Internal System Posting',
          transactionReference: `INT-${period.year}${(monthIndex + 1).toString().padStart(2, '0')}-${result.memberId.slice(-8)}`,
          evidenceUrl: null
        }));

        await prisma.saving.createMany({
            data: newInterestTransactionsData,
            skipDuplicates: true, // This is a safeguard, but our logic above should prevent duplicates
        });

        revalidatePath('/savings');
        revalidatePath('/approve-transactions');

        return { success: true, message: `${transactions.length} interest transactions have been submitted for approval.` };
    } catch (error) {
        console.error("Failed to post interest transactions:", error);
        return { success: false, message: 'An error occurred while posting interest transactions.' };
    }
}
