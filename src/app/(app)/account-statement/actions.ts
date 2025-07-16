
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
  accountNumber: string | null;
}

export async function getMembersForStatement() {
  const members = await prisma.member.findMany({
    select: { id: true, fullName: true, status: true, memberSavingAccounts: { select: { accountNumber: true }} },
    orderBy: { fullName: 'asc' },
  });
  // Simplification: returning the first account number if multiple exist
  return members.map(m => ({
    id: m.id,
    fullName: m.fullName,
    savingsAccountNumber: m.memberSavingAccounts[0]?.accountNumber || null,
    status: m.status,
  }));
}

export async function getMemberInitialData(memberId: string) {
    const account = await prisma.memberSavingAccount.findFirst({
        where: { memberId },
        select: {
            id: true,
            balance: true,
            accountNumber: true,
        },
    });
    return {
      id: memberId,
      savingsBalance: account?.balance || 0,
      savingsAccountNumber: account?.accountNumber || null,
    }
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
    include: { school: { select: { name: true } }, memberSavingAccounts: true },
  });

  if (!member) {
    return null;
  }

  // This is a simplification. For a true multi-account statement, we'd need to select a specific account.
  // Here we just use the first one.
  const primaryAccount = member.memberSavingAccounts[0];

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
    accountNumber: primaryAccount?.accountNumber ?? null,
    dateRange,
    balanceBroughtForward,
    transactions: transactionsInPeriod,
    closingBalance: runningBalance,
  };
}
