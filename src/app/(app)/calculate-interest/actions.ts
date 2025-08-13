

'use server';

import prisma from '@/lib/prisma';
import type { Member, SavingAccountType, School, Saving, Prisma, MemberSavingAccount } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { startOfDay, endOfDay, eachDayOfInterval, differenceInDays, format, parse } from 'date-fns';
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
    
    // Create a map of transactions by date for efficient lookup within the period
    const transactionsByDate = new Map<string, Saving[]>();
    account.savings
        .filter(tx => {
            const txDate = new Date(tx.date);
            return txDate >= periodStart && txDate <= periodEnd;
        })
        .forEach(tx => {
            const txDateString = format(new Date(tx.date), 'yyyy-MM-dd');
            if (!transactionsByDate.has(txDateString)) {
                transactionsByDate.set(txDateString, []);
            }
            transactionsByDate.get(txDateString)!.push(tx);
        });

    // 2. Calculate sum of daily balances for the period
    let totalDailyBalance = 0;
    const intervalDays = eachDayOfInterval({ start: periodStart, end: periodEnd });
    let runningDayBalance = balanceAtPeriodStart;

    intervalDays.forEach(day => {
        const dayString = format(day, 'yyyy-MM-dd');
        
        // Add the balance *before* this day's transactions to the total
        totalDailyBalance += runningDayBalance;
        
        // Apply this day's transactions to get the closing balance, which will be the next day's opening balance
        const transactionsOnThisDay = transactionsByDate.get(dayString) || [];
        transactionsOnThisDay.forEach(tx => {
            runningDayBalance += tx.transactionType === 'deposit' ? tx.amount : -tx.amount;
        });
    });


    // 3. Calculate Average Daily Balance and Interest
    const averageDailyBalance = totalDailyBalance / daysInPeriod;
    const annualRate = account.savingAccountType.interestRate;
    // Correct interest calculation for the period
    const calculatedInterest = roundToTwo((averageDailyBalance * annualRate / 365) * daysInPeriod);

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

    const existingTransactions = await prisma.saving.findMany({
        where: {
            memberSavingAccountId: {
                in: transactions.map(t => t.memberSavingAccountId)
            },
            notes: {
                contains: `Interest posting for period ending`
            },
            month: monthName, // Check for the same month/year to avoid duplicates
        }
    });

    const newTransactionsData: Prisma.SavingCreateManyInput[] = transactions
        .filter(result => !existingTransactions.some(et => et.memberSavingAccountId === result.memberSavingAccountId))
        .map(result => ({
            memberId: result.memberId,
            memberSavingAccountId: result.memberSavingAccountId,
            amount: result.calculatedInterest,
            date: postingDate,
            month: monthName,
            transactionType: 'deposit',
            status: 'pending',
            notes: `Interest posting for period ending ${format(postingDate, 'PPP')}`,
            depositMode: 'Bank',
            sourceName: 'Internal System Posting',
            transactionReference: `INT-${format(postingDate, 'yyyyMMdd')}-${result.memberId.slice(-6)}`,
            evidenceUrl: null
        }));
    
    if (newTransactionsData.length === 0) {
        const skippedCount = transactions.length;
        return { success: true, message: `All ${skippedCount} interest transaction(s) have already been posted for this period and were skipped.` };
    }

    await prisma.saving.createMany({
        data: newTransactionsData,
        skipDuplicates: true, // Just in case, though filter should prevent this
    });

    revalidatePath('/savings');
    revalidatePath('/approve-transactions');
    
    const postedCount = newTransactionsData.length;
    const skippedCount = transactions.length - postedCount;
    let message = `${postedCount} interest transaction(s) submitted for approval.`;
    if (skippedCount > 0) {
        message += ` ${skippedCount} transaction(s) were skipped as they were already posted for this period.`
    }

    return { success: true, message };
}

