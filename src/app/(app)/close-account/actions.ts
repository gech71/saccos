
'use server';

import prisma from '@/lib/prisma';
import type { Saving, Member, MemberSavingAccount } from '@prisma/client';

function roundToTwo(num: number) {
    return Math.round(num * 100) / 100;
}

export type ActiveMemberForClosure = Pick<Member, 'id' | 'fullName'> & {
    memberSavingAccounts: Pick<MemberSavingAccount, 'accountNumber' | 'balance'>[]
};

export async function getActiveMembersForClosure() {
  return prisma.member.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      fullName: true,
      memberSavingAccounts: {
          select: {
              accountNumber: true,
              balance: true,
          }
      },
    },
    orderBy: { fullName: 'asc' },
  });
}

export async function calculateFinalPayout(memberId: string): Promise<{
  currentBalance: number;
  accruedInterest: number;
  totalPayout: number;
} | null> {
    const memberAccounts = await prisma.memberSavingAccount.findMany({
        where: { memberId },
        include: { savingAccountType: true }
    });

    if (memberAccounts.length === 0) return null;

    let totalBalance = 0;
    let totalAccruedInterest = 0;

    for (const account of memberAccounts) {
        const interestRate = account.savingAccountType?.interestRate || 0.01; // Fallback
        // Simplified interest for demo: prorated for half a month
        const accruedInterest = account.balance * (interestRate / 12) * 0.5;
        totalBalance += account.balance;
        totalAccruedInterest += accruedInterest;
    }
    
    totalBalance = roundToTwo(totalBalance);
    totalAccruedInterest = roundToTwo(totalAccruedInterest);

    return {
        currentBalance: totalBalance,
        accruedInterest: totalAccruedInterest,
        totalPayout: roundToTwo(totalBalance + totalAccruedInterest),
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
        memberSavingAccountId: null, // This is a general interest posting
        amount: accruedInterest, // Already rounded
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
        memberSavingAccountId: null, // This is a general payout
        amount: totalPayout, // Already rounded
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
        if (accruedInterest > 0) {
            await tx.saving.create({ data: interestTransaction });
        }

        // 2. Post final withdrawal
        if (totalPayout > 0) {
            await tx.saving.create({ data: finalWithdrawal });
        }

        // 3. Update all saving accounts for this member to zero balance
        await tx.memberSavingAccount.updateMany({
            where: { memberId },
            data: { balance: 0 },
        });

        // 4. Update member status
        const updatedMember = await tx.member.update({
            where: { id: memberId },
            data: {
                status: 'inactive',
                closureDate: now,
            },
        });

        return updatedMember;
    });
}
