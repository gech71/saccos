

'use server';

import prisma from '@/lib/prisma';
import type { Saving, Member, MemberSavingAccount, MemberShareCommitment } from '@prisma/client';

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
  totalSharesPaid: number;
  accruedInterest: number;
  totalPayout: number;
} | null> {
    const member = await prisma.member.findUnique({
        where: { id: memberId },
        include: {
            memberSavingAccounts: {
                include: { savingAccountType: true }
            },
            memberShareCommitments: true
        }
    });

    if (!member) return null;

    // Savings Calculation
    let totalSavingsBalance = 0;
    let totalAccruedInterest = 0;

    for (const account of member.memberSavingAccounts) {
        const interestRate = account.savingAccountType?.interestRate || 0.01; // Fallback
        // Simplified interest for demo: prorated for half a month
        const accruedInterest = account.balance * (interestRate / 12) * 0.5;
        totalSavingsBalance += account.balance;
        totalAccruedInterest += accruedInterest;
    }

    // Shares Calculation
    const totalSharesPaid = member.memberShareCommitments.reduce((sum, commitment) => {
        return sum + commitment.amountPaid;
    }, 0);
    
    totalSavingsBalance = roundToTwo(totalSavingsBalance);
    totalAccruedInterest = roundToTwo(totalAccruedInterest);

    return {
        currentBalance: totalSavingsBalance,
        totalSharesPaid: roundToTwo(totalSharesPaid),
        accruedInterest: totalAccruedInterest,
        totalPayout: roundToTwo(totalSavingsBalance + totalSharesPaid + totalAccruedInterest),
    };
}

export async function confirmAccountClosure(
    memberId: string,
    payoutDetails: {
        totalPayout: number,
        accruedInterest: number,
        totalSharesPaid: number,
        savingsBalance: number,
        depositMode: 'Cash' | 'Bank' | 'Wallet',
        sourceName?: string,
        transactionReference?: string,
        evidenceUrl?: string,
    }
) {
    const { totalPayout, accruedInterest, totalSharesPaid, savingsBalance, depositMode, sourceName, transactionReference, evidenceUrl } = payoutDetails;
    
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new Error('Member not found');
    
    const now = new Date();
    const transactionMonth = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Payout amount for just the savings portion
    const savingsPayoutAmount = roundToTwo(savingsBalance + accruedInterest);

    return prisma.$transaction(async (tx) => {
        // 1. Post final interest as a separate transaction
        if (accruedInterest > 0) {
            await tx.saving.create({ data: {
                memberId: member.id,
                memberSavingAccountId: null,
                amount: accruedInterest,
                date: now,
                month: transactionMonth,
                transactionType: 'deposit',
                status: 'approved',
                notes: 'Final interest on account closure.',
                depositMode: 'Bank',
                sourceName: 'Internal System Posting',
                transactionReference: `CLOSURE-INT-${member.id}`,
                evidenceUrl: null,
            }});
        }

        // 2. Post final savings withdrawal
        if (savingsPayoutAmount > 0) {
             await tx.saving.create({ data: {
                memberId: member.id,
                memberSavingAccountId: null,
                amount: savingsPayoutAmount,
                date: now,
                month: transactionMonth,
                transactionType: 'withdrawal',
                status: 'approved',
                notes: `Savings payout on account closure via ${depositMode}.`,
                depositMode,
                sourceName,
                transactionReference,
                evidenceUrl,
            }});
        }
        
        // 3. Post share refund as a separate withdrawal transaction
        if (totalSharesPaid > 0) {
            await tx.saving.create({
                data: {
                    memberId: member.id,
                    memberSavingAccountId: null,
                    amount: totalSharesPaid,
                    date: now,
                    month: transactionMonth,
                    transactionType: 'withdrawal',
                    status: 'approved',
                    notes: `Share refund on account closure via ${depositMode}.`,
                    depositMode,
                    sourceName,
                    transactionReference,
                    evidenceUrl,
                }
            })
        }

        // 4. Update all saving accounts for this member to zero balance
        await tx.memberSavingAccount.updateMany({
            where: { memberId },
            data: { balance: 0 },
        });

        // 5. Update share commitments to REFUNDED status
        await tx.memberShareCommitment.updateMany({
            where: { memberId },
            data: { status: 'REFUNDED' }
        })

        // 6. Update member status
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
