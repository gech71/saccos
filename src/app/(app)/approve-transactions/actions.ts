'use server';

import prisma from '@/lib/prisma';
import type { Saving, Share, Dividend } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export type PendingTransaction = (Saving | Share | Dividend) & { transactionTypeLabel: string; memberName: string };

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  const pendingSavings = await prisma.saving.findMany({
    where: { status: 'pending' },
    include: { member: { select: { fullName: true }}},
    orderBy: { date: 'asc' },
  });

  const pendingShares = await prisma.share.findMany({
    where: { status: 'pending' },
     include: { member: { select: { fullName: true }}},
    orderBy: { allocationDate: 'asc' },
  });

  const pendingDividends = await prisma.dividend.findMany({
    where: { status: 'pending' },
     include: { member: { select: { fullName: true }}},
    orderBy: { distributionDate: 'asc' },
  });

  const formattedSavings: PendingTransaction[] = pendingSavings.map(s => ({
    ...s,
    date: s.date.toISOString(),
    transactionTypeLabel: s.transactionType === 'deposit' ? 'Savings Deposit' : 'Savings Withdrawal',
    memberName: s.member.fullName,
  }));

  const formattedShares: PendingTransaction[] = pendingShares.map(s => ({
    ...s,
    allocationDate: s.allocationDate.toISOString(),
    transactionTypeLabel: 'Share Allocation',
    memberName: s.member.fullName,
  }));

  const formattedDividends: PendingTransaction[] = pendingDividends.map(d => ({
    ...d,
    distributionDate: d.distributionDate.toISOString(),
    transactionTypeLabel: 'Dividend Distribution',
    memberName: d.member.fullName,
  }));
  
  return [...formattedSavings, ...formattedShares, ...formattedDividends].sort(
      (a, b) => new Date(a.date || a.allocationDate).getTime() - new Date(b.date || b.allocationDate).getTime()
    );
}

export async function approveTransaction(txId: string, txType: string): Promise<{ success: boolean; message: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      if (txType.startsWith('Savings')) {
        const savingTx = await tx.saving.findUnique({ where: { id: txId } });
        if (!savingTx || savingTx.status !== 'pending') throw new Error('Transaction not found or not pending.');

        await tx.saving.update({ where: { id: txId }, data: { status: 'approved' } });

        const amountChange = savingTx.transactionType === 'deposit' ? savingTx.amount : -savingTx.amount;
        await tx.member.update({
          where: { id: savingTx.memberId },
          data: { savingsBalance: { increment: amountChange } },
        });

      } else if (txType === 'Share Allocation') {
        const shareTx = await tx.share.findUnique({ where: { id: txId } });
        if (!shareTx || shareTx.status !== 'pending') throw new Error('Transaction not found or not pending.');
        
        await tx.share.update({ where: { id: txId }, data: { status: 'approved' } });
        
        await tx.member.update({
          where: { id: shareTx.memberId },
          data: { sharesCount: { increment: shareTx.count } },
        });

      } else if (txType === 'Dividend Distribution') {
        await tx.dividend.update({
          where: { id: txId },
          data: { status: 'approved' },
        });
      }
    });

    revalidatePath('/approve-transactions');
    revalidatePath('/savings');
    revalidatePath('/shares');
    revalidatePath('/dividends');
    revalidatePath('/members'); // Member balances might change
    return { success: true, message: 'Transaction approved successfully.' };
  } catch (error) {
    console.error('Approval Error:', error);
    return { success: false, message: 'Failed to approve transaction.' };
  }
}

export async function rejectTransaction(txId: string, txType: string, reason: string): Promise<{ success: boolean; message: string }> {
   try {
    if (txType.startsWith('Savings')) {
        await prisma.saving.update({ where: { id: txId }, data: { status: 'rejected', notes: reason } });
    } else if (txType === 'Share Allocation') {
        await prisma.share.update({ where: { id: txId }, data: { status: 'rejected', notes: reason } });
    } else if (txType === 'Dividend Distribution') {
        await prisma.dividend.update({ where: { id: txId }, data: { status: 'rejected', notes: reason } });
    }
     revalidatePath('/approve-transactions');
     return { success: true, message: 'Transaction rejected.' };
   } catch (error) {
     console.error('Rejection Error:', error);
     return { success: false, message: 'Failed to reject transaction.' };
   }
}
