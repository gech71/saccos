'use server';

import prisma from '@/lib/prisma';
import type { Member, Saving } from '@prisma/client';
import type { DateRange } from 'react-day-picker';

export interface StatementData {
  member: Member;
  dateRange: DateRange;
  balanceBroughtForward: number;
  transactions: (Saving & { debit: number; credit: number; balance: number })[];
  closingBalance: number;
  schoolName: string | null;
}

export async function getMembersForStatement() {
  return prisma.member.findMany({
    select: { id: true, fullName: true, savingsAccountNumber: true, status: true },
    orderBy: { fullName: 'asc' },
  });
}

export async function getMemberInitialData(memberId: string) {
    return prisma.member.findUnique({
        where: { id: memberId },
        select: {
            id: true,
            savingsBalance: true,
            savingsAccountNumber: true,
        },
    });
}

export async function generateStatement(
  memberId: string,
  dateRange: DateRange
): Promise<StatementData | null> {
  if (!memberId || !dateRange.from || !dateRange.to) {
    return null;
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { school: { select: { name: true } } },
  });

  if (!member) {
    return null;
  }

  const allMemberTransactions = await prisma.saving.findMany({
    where: { memberId, status: 'approved' },
    orderBy: { date: 'asc' },
  });

  const balanceBroughtForward = allMemberTransactions
    .filter(tx => new Date(tx.date) < dateRange.from!)
    .reduce((balance, tx) => {
      if (tx.transactionType === 'deposit') return balance + tx.amount;
      if (tx.transactionType === 'withdrawal') return balance - tx.amount;
      return balance;
    }, 0);

  let runningBalance = balanceBroughtForward;
  const transactionsInPeriod = allMemberTransactions
    .filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= dateRange.from! && txDate <= dateRange.to!;
    })
    .map(tx => {
      const credit = tx.transactionType === 'deposit' ? tx.amount : 0;
      const debit = tx.transactionType === 'withdrawal' ? tx.amount : 0;
      runningBalance += credit - debit;
      return { ...tx, debit, credit, balance: runningBalance };
    });

  return {
    member,
    schoolName: member.school?.name ?? null,
    dateRange,
    balanceBroughtForward,
    transactions: transactionsInPeriod,
    closingBalance: runningBalance,
  };
}
