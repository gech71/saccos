'use server';

import prisma from '@/lib/prisma';
import type { Saving } from '@prisma/client';

export async function getActiveMembersForClosure() {
  return prisma.member.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      fullName: true,
      savingsAccountNumber: true,
      savingsBalance: true,
    },
    orderBy: { fullName: 'asc' },
  });
}

export async function calculateFinalPayout(memberId: string): Promise<{
  currentBalance: number;
  accruedInterest: number;
  totalPayout: number;
} | null> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { savingAccountType: true },
  });

  if (!member) return null;

  const interestRate = member.savingAccountType?.interestRate || 0.01; // Fallback
  // Simplified interest for demo: prorated for half a month
  const accruedInterest = member.savingsBalance * (interestRate / 12) * 0.5;

  return {
    currentBalance: member.savingsBalance,
    accruedInterest,
    totalPayout: member.savingsBalance + accruedInterest,
  };
}

export async function confirmAccountClosure(
    memberId: string,
    payoutDetails: {
        totalPayout: number,
        accruedInterest: number,
        depositMode: 'Cash' | 'Bank' | 'Wallet',
        sourceName?: string,
        transactionReference?: string,
        evidenceUrl?: string,
    }
) {
    const { totalPayout, accruedInterest, depositMode, sourceName, transactionReference, evidenceUrl } = payoutDetails;
    
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new Error('Member not found');
    
    const now = new Date();

    const interestTransaction: Omit<Saving, 'id'> = {
        memberId: member.id,
        amount: accruedInterest,
        date: now,
        month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
        transactionType: 'deposit',
        status: 'approved', // Auto-approved on closure
        notes: 'Final interest on account closure.',
        depositMode: 'Bank', // System transaction
        sourceName: 'Internal System Posting',
        transactionReference: `CLOSURE-INT-${member.id}`,
        evidenceUrl: null,
    };
    
    const finalWithdrawal: Omit<Saving, 'id'> = {
        memberId: member.id,
        amount: totalPayout,
        date: now,
        month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
        transactionType: 'withdrawal',
        status: 'approved', // Auto-approved on closure
        notes: `Account closed. Payout via ${depositMode}.`,
        depositMode,
        sourceName,
        transactionReference,
        evidenceUrl,
    };

    return prisma.$transaction(async (tx) => {
        // 1. Post final interest
        await tx.saving.create({ data: interestTransaction });

        // 2. Post final withdrawal
        await tx.saving.create({ data: finalWithdrawal });

        // 3. Update member status and balance
        const updatedMember = await tx.member.update({
            where: { id: memberId },
            data: {
                savingsBalance: 0,
                status: 'inactive',
                closureDate: now,
            },
        });

        return updatedMember;
    });
}
