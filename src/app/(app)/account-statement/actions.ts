
'use server';

import prisma from '@/lib/prisma';
import type { Member, Saving, MemberSavingAccount, SavingAccountType } from '@prisma/client';
import type { DateRange } from 'react-day-picker';
import { startOfDay } from 'date-fns';

export interface StatementData {
  member: Member;
  account: MemberSavingAccount & { savingAccountType: SavingAccountType | null };
  dateRange: DateRange;
  initialBalance: number;
  balanceBroughtForward: number;
  transactions: (Saving & { debit: number; credit: number; balance: number })[];
  totalDeposits: number;
  totalWithdrawals: number;
  closingBalance: number;
  schoolName: string | null;
}

export type MemberForStatement = Pick<Member, 'id' | 'fullName' | 'status'> & {
    memberSavingAccounts: (Pick<MemberSavingAccount, 'id' | 'accountNumber' | 'balance'> & { savingAccountType: Pick<SavingAccountType, 'name'> | null })[]
};

export async function getMembersForStatement(): Promise<MemberForStatement[]> {
  const members = await prisma.member.findMany({
    where: {
      memberSavingAccounts: {
        some: {} // Only get members who have at least one savings account
      }
    },
    select: {
        id: true,
        fullName: true,
        status: true,
        memberSavingAccounts: {
            select: {
                id: true,
                accountNumber: true,
                balance: true,
                savingAccountType: {
                    select: {
                        name: true
                    }
                }
            }
        }
    },
    orderBy: { fullName: 'asc' },
  });
  return members;
}

export async function generateStatement(
  memberId: string,
  accountId: string,
  dateRange: DateRange
): Promise<StatementData | null> {
  if (!memberId || !accountId || !dateRange.from || !dateRange.to) {
    return null;
  }

  // Normalize date range to start of the day for `from` and end of the day for `to`
  const fromDate = startOfDay(dateRange.from);
  const toDate = new Date(dateRange.to.setHours(23, 59, 59, 999));

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { school: { select: { name: true } } },
  });

  const account = await prisma.memberSavingAccount.findUnique({
      where: { id: accountId, memberId: memberId },
      include: { savingAccountType: true }
  });

  if (!member || !account) {
    return null;
  }
  
  // 1. Fetch all approved transactions that occurred *before* the statement's start date
  const transactionsBeforeRange = await prisma.saving.findMany({
    where: {
        memberSavingAccountId: accountId,
        status: 'approved',
        date: {
            lt: fromDate,
        },
    },
    orderBy: { date: 'asc' },
  });
  
  // 2. Calculate Balance Brought Forward by starting with the account's initial balance
  //    and then applying all transactions that happened BEFORE the statement period.
  let balanceBroughtForward = account.initialBalance;
  balanceBroughtForward = transactionsBeforeRange.reduce((balance, tx) => {
    if (tx.transactionType === 'deposit') return balance + tx.amount;
    if (tx.transactionType === 'withdrawal') return balance - tx.amount;
    return balance;
  }, balanceBroughtForward); 

  // 3. Fetch transactions *within* the date range for the main statement body
  let transactionsInPeriodRaw = await prisma.saving.findMany({
      where: {
          memberSavingAccountId: accountId,
          status: 'approved',
          date: {
              gte: fromDate,
              lte: toDate,
          },
      },
      orderBy: { date: 'asc' },
  });
  
  // 4. Process transactions for the statement, starting with the correctly calculated BBF
  let runningBalance = balanceBroughtForward;
  let totalDeposits = 0;
  let totalWithdrawals = 0;

  const transactionsInPeriod = transactionsInPeriodRaw.map(tx => {
      const credit = tx.transactionType === 'deposit' ? tx.amount : 0;
      const debit = tx.transactionType === 'withdrawal' ? tx.amount : 0;
      totalDeposits += credit;
      totalWithdrawals += debit;
      runningBalance += credit - debit;
      return { ...tx, debit, credit, balance: runningBalance };
  });

  return {
    member,
    account: account,
    schoolName: member.school?.name ?? null,
    dateRange,
    initialBalance: account.initialBalance,
    balanceBroughtForward,
    transactions: transactionsInPeriod,
    totalDeposits,
    totalWithdrawals,
    closingBalance: runningBalance,
  };
}
