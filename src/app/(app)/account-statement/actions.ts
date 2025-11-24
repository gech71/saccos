
'use server';

import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/authorization';
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

export type MemberForStatement = Pick<Member, 'id' | 'fullName' | 'status' | 'memberId'> & {
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
        memberId: true,
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

  // Server-side authorization: ensure the requesting user is allowed to view this member's data.
  // Members may only access their own data. Admins (non-members) are allowed.
  try {
    const session = await requireAuth();
    const user = (session as any).user;

    // If the authenticated user is a member, ensure they only request their own memberId
    if (user.isMember) {
      if (user.id !== memberId) {
        // Unauthorized access attempt — deny
        return null;
      }
    }
    // If user is not a member (admin), allow. Optionally extend with permission checks here.
  } catch (err) {
    // If we cannot determine session or authentication fails, deny access
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
  
  // 1. Check whether the initial balance has already been represented by an approved transaction.
  const initialBalanceTransaction = await prisma.saving.findFirst({
    where: {
      memberSavingAccountId: accountId,
      status: 'approved',
      notes: { contains: 'initial opening balance', mode: 'insensitive' },
    },
    select: { id: true },
  });

  // 2. Fetch all approved transactions that occurred *before* the statement's start date
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
  
  // 3. Calculate Balance Brought Forward. Only seed with the stored initial balance
  //    if it hasn't already been captured as a transaction (to avoid double counting).
  const shouldSeedInitialBalance = !initialBalanceTransaction;
  let balanceBroughtForward = shouldSeedInitialBalance ? account.initialBalance : 0;
  balanceBroughtForward = transactionsBeforeRange.reduce((balance, tx) => {
    if (tx.transactionType === 'deposit') return balance + tx.amount;
    if (tx.transactionType === 'withdrawal') return balance - tx.amount;
    return balance;
  }, balanceBroughtForward); 

  // 4. Fetch transactions *within* the date range for the main statement body
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
  
  // 5. Process transactions for the statement, starting with the correctly calculated BBF
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
