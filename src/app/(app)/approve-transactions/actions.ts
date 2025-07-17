
'use server';

import prisma from '@/lib/prisma';
import type { Saving, Share, Dividend, Loan } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { addMonths } from 'date-fns';

export type PendingTransaction = (Saving | Share | Dividend | Loan) & { 
    transactionTypeLabel: string; 
    memberName: string;
    transactionCategory: 'Savings' | 'Shares' | 'Dividends' | 'Loans';
};

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  const [pendingSavings, pendingShares, pendingDividends, pendingLoans] = await Promise.all([
    prisma.saving.findMany({
      where: { status: 'pending' },
      include: { member: { select: { fullName: true }}},
      orderBy: { date: 'asc' },
    }),
    prisma.share.findMany({
      where: { status: 'pending' },
      include: { member: { select: { fullName: true }}},
      orderBy: { allocationDate: 'asc' },
    }),
    prisma.dividend.findMany({
      where: { status: 'pending' },
      include: { member: { select: { fullName: true }}},
      orderBy: { distributionDate: 'asc' },
    }),
    prisma.loan.findMany({
        where: { status: 'pending' },
        include: { member: { select: { fullName: true }}},
        orderBy: { disbursementDate: 'asc' },
    })
  ]);

  const formattedSavings: PendingTransaction[] = pendingSavings.map(s => ({
    ...s,
    date: s.date.toISOString(),
    transactionTypeLabel: s.transactionType === 'deposit' ? 'Savings Deposit' : 'Savings Withdrawal',
    memberName: s.member.fullName,
    transactionCategory: 'Savings'
  }));

  const formattedShares: PendingTransaction[] = pendingShares.map(s => ({
    ...s,
    allocationDate: s.allocationDate.toISOString(),
    transactionTypeLabel: 'Share Allocation',
    memberName: s.member.fullName,
    transactionCategory: 'Shares'
  }));

  const formattedDividends: PendingTransaction[] = pendingDividends.map(d => ({
    ...d,
    distributionDate: d.distributionDate.toISOString(),
    transactionTypeLabel: 'Dividend Distribution',
    memberName: d.member.fullName,
    transactionCategory: 'Dividends'
  }));

  const formattedLoans: PendingTransaction[] = pendingLoans.map(l => ({
      ...l,
      disbursementDate: l.disbursementDate.toISOString(),
      transactionTypeLabel: 'Loan Application',
      memberName: l.member.fullName,
      transactionCategory: 'Loans'
  }));
  
  const allTransactions = [...formattedSavings, ...formattedShares, ...formattedDividends, ...formattedLoans];
  
  return allTransactions.sort(
      (a, b) => {
        const dateA = new Date(a.date || a.allocationDate || a.disbursementDate).getTime();
        const dateB = new Date(b.date || b.allocationDate || b.disbursementDate).getTime();
        return dateA - dateB;
      }
    );
}

const revalidateAllPaths = () => {
    revalidatePath('/approve-transactions');
    revalidatePath('/savings');
    revalidatePath('/shares');
    revalidatePath('/dividends');
    revalidatePath('/loans');
    revalidatePath('/members'); 
    revalidatePath('/savings-accounts');
};

export async function approveTransaction(txId: string, txType: string): Promise<{ success: boolean; message: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      if (txType.startsWith('Savings')) {
        const savingTx = await tx.saving.findUnique({ where: { id: txId } });
        if (!savingTx || savingTx.status !== 'pending') throw new Error('Transaction not found or not pending.');
        
        await tx.saving.update({ where: { id: txId }, data: { status: 'approved' } });
        
        const memberAccounts = await tx.memberSavingAccount.findMany({ where: { memberId: savingTx.memberId }});
        if (memberAccounts.length === 0) throw new Error('No savings account found for this member.');

        const accountToUpdate = memberAccounts[0];
        const amountChange = savingTx.transactionType === 'deposit' ? savingTx.amount : -savingTx.amount;
        await tx.memberSavingAccount.update({
          where: { id: accountToUpdate.id },
          data: { balance: { increment: amountChange } },
        });

      } else if (txType === 'Share Allocation') {
        const shareTx = await tx.share.findUnique({ where: { id: txId } });
        if (!shareTx || shareTx.status !== 'pending') throw new Error('Transaction not found or not pending.');
        
        await tx.share.update({ where: { id: txId }, data: { status: 'approved' } });
        
      } else if (txType === 'Dividend Distribution') {
        await tx.dividend.update({
          where: { id: txId },
          data: { status: 'approved' },
        });
      } else if (txType === 'Loan Application') {
          const loanTx = await tx.loan.findUnique({ where: { id: txId }});
          if (!loanTx || loanTx.status !== 'pending') throw new Error('Loan application not found or not pending.');
          
          const nextDueDate = addMonths(loanTx.disbursementDate, 1);
          await tx.loan.update({
              where: { id: txId },
              data: { 
                  status: 'active',
                  nextDueDate: nextDueDate,
              },
          });
      }
    });

    revalidateAllPaths();
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
    } else if (txType === 'Loan Application') {
        await prisma.loan.update({ where: { id: txId }, data: { status: 'rejected', notes: reason } });
    }
     revalidateAllPaths();
     return { success: true, message: 'Transaction rejected.' };
   } catch (error) {
     console.error('Rejection Error:', error);
     return { success: false, message: 'Failed to reject transaction.' };
   }
}

export async function approveMultipleTransactions(
  transactions: { txId: string; txType: string }[]
): Promise<{ success: boolean; message: string }> {
  try {
    for (const { txId, txType } of transactions) {
      // Re-using the single approval logic for atomicity
      await approveTransaction(txId, txType);
    }
    return { success: true, message: `${transactions.length} transactions approved successfully.` };
  } catch (error) {
    console.error('Bulk Approval Error:', error);
    return { success: false, message: 'One or more transactions failed to approve during bulk operation.' };
  }
}

export async function rejectMultipleTransactions(
  transactions: { txId: string; txType: string }[],
  reason: string
): Promise<{ success: boolean; message: string }> {
  try {
    const commonReason = reason || "Rejected in bulk";
    for (const { txId, txType } of transactions) {
      await rejectTransaction(txId, txType, commonReason);
    }
    return { success: true, message: `${transactions.length} transactions rejected.` };
  } catch (error) {
    console.error('Bulk Rejection Error:', error);
    return { success: false, message: 'One or more transactions failed to reject during bulk operation.' };
  }
}
