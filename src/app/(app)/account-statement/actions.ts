
'use server';

import prisma from '@/lib/prisma';
import type { Member, Saving, MemberSavingAccount, SavingAccountType } from '@prisma/client';
import type { DateRange } from 'react-day-picker';

export interface StatementData {
  member: Member;
  account: MemberSavingAccount & { savingAccountType: SavingAccountType | null };
  dateRange: DateRange;
  balanceBroughtForward: number;
  transactions: (Saving & { debit: number; credit: number; balance: number })[];
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

  // Fetch all approved savings transactions that occurred *before* the statement's start date
  const transactionsBeforeRange = await prisma.saving.findMany({
    where: {
        memberSavingAccountId: accountId,
        status: 'approved',
        date: {
            lt: dateRange.from,
        }
    },
    orderBy: { date: 'asc' },
  });
  
  // Calculate Balance Brought Forward by summing up all transactions before the start date.
  const balanceBroughtForward = transactionsBeforeRange.reduce((balance, tx) => {
    if (tx.transactionType === 'deposit') return balance + tx.amount;
    if (tx.transactionType === 'withdrawal') return balance - tx.amount;
    return balance;
  }, 0); // Start the balance from 0, as we are summing up all historical transactions.

  // Fetch and process transactions *within* the date range
  const transactionsInPeriodRaw = await prisma.saving.findMany({
      where: {
          memberSavingAccountId: accountId,
          status: 'approved',
          date: {
              gte: dateRange.from,
              lte: dateRange.to
          }
      },
      orderBy: { date: 'asc' },
  });

  let runningBalance = balanceBroughtForward;
  const transactionsInPeriod = transactionsInPeriodRaw.map(tx => {
      const credit = tx.transactionType === 'deposit' ? tx.amount : 0;
      const debit = tx.transactionType === 'withdrawal' ? tx.amount : 0;
      runningBalance += credit - debit;
      return { ...tx, debit, credit, balance: runningBalance };
  });

  return {
    member,
    account: account,
    schoolName: member.school?.name ?? null,
    dateRange,
    balanceBroughtForward,
    transactions: transactionsInPeriod,
    closingBalance: runningBalance,
  };
}
