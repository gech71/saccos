

'use server';

import prisma from '@/lib/prisma';
import type { Saving, SharePayment, Dividend, Loan, LoanRepayment, AppliedServiceCharge } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { addMonths } from 'date-fns';
import { requirePermission } from '@/lib/authorization';

export type PendingTransaction = (Saving | SharePayment | Dividend | Loan | AppliedServiceCharge | LoanRepayment) & { 
    transactionTypeLabel: string; 
    memberName: string;
    transactionCategory: 'Savings' | 'Shares' | 'Dividends' | 'Loans' | 'Loan Repayments' | 'Service Charges' | 'Saving Interest' | 'Loan Interest';
};

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  await requirePermission('transactionApproval:view');
  const [pendingSavings, pendingSharePayments, pendingDividends, pendingLoans, pendingServiceCharges, pendingLoanRepayments] = await Promise.all([
    prisma.saving.findMany({
      where: { status: 'pending' },
      include: { member: { select: { fullName: true }}},
      orderBy: { date: 'asc' },
    }),
    prisma.sharePayment.findMany({
      where: { status: 'pending' },
      include: { 
          commitment: { 
              include: { 
                  member: { select: { fullName: true }},
                  shareType: { select: { name: true }}
                }
            }
        },
      orderBy: { paymentDate: 'asc' },
    }),
    prisma.dividend.findMany({
      where: { status: 'pending' },
      include: { member: { select: { fullName: true }}},
      orderBy: { distributionDate: 'asc' },
    }),
    prisma.loan.findMany({
        where: { status: 'pending' },
        include: { 
            member: { select: { fullName: true }},
            loanType: { select: { name: true }}
        },
        orderBy: { disbursementDate: 'asc' },
    }),
    prisma.appliedServiceCharge.findMany({
        where: { status: 'pending' },
        include: { 
            member: { select: { fullName: true }},
            serviceChargeType: { select: { name: true }}
        },
        orderBy: { dateApplied: 'asc' },
    }),
    prisma.loanRepayment.findMany({
      where: { status: 'pending' },
      include: { 
        member: { select: { fullName: true }},
        loan: { include: { loanType: { select: { name: true }}}}
      },
      orderBy: { paymentDate: 'asc' },
    })
  ]);

  const formattedSavings: PendingTransaction[] = pendingSavings.map(s => {
    const isInterest = s.notes?.toLowerCase().includes('savings interest');
    return {
        ...s,
        date: s.date.toISOString(),
        transactionTypeLabel: isInterest ? 'Saving Interest Deposit' : (s.transactionType === 'deposit' ? 'Savings Deposit' : 'Savings Withdrawal'),
        memberName: s.member.fullName,
        transactionCategory: isInterest ? 'Saving Interest' : 'Savings'
    };
  });

  const formattedSharePayments: PendingTransaction[] = pendingSharePayments.map(s => ({
    ...s,
    paymentDate: s.paymentDate.toISOString(),
    transactionTypeLabel: `Share Payment (${s.commitment.shareType.name})`,
    memberName: s.commitment.member.fullName,
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
      transactionTypeLabel: `Loan Application (${l.loanType.name})`,
      memberName: l.member.fullName,
      transactionCategory: 'Loans'
  }));
  
  const formattedServiceCharges: PendingTransaction[] = pendingServiceCharges.map(sc => {
      const isInterest = sc.notes?.toLowerCase().includes('loan interest');
      return {
        ...sc,
        dateApplied: sc.dateApplied.toISOString(),
        transactionTypeLabel: `Service Charge (${sc.serviceChargeType.name})`,
        memberName: sc.member.fullName,
        transactionCategory: isInterest ? 'Loan Interest' : 'Service Charges'
      };
  });
  
  const formattedLoanRepayments: PendingTransaction[] = pendingLoanRepayments.map(lr => {
      // If principal is 0 and interest is > 0, it's an interest payment.
      // Otherwise, it's a regular repayment (even if it includes interest).
      const isInterestOnly = lr.principalPaid === 0 && lr.interestPaid > 0;
      return {
        ...lr,
        paymentDate: lr.paymentDate.toISOString(),
        transactionTypeLabel: isInterestOnly ? `Loan Interest Payment (${lr.loan.loanType?.name || 'N/A'})` : `Loan Repayment (${lr.loan.loanType?.name || 'N/A'})`,
        memberName: lr.member.fullName,
        transactionCategory: isInterestOnly ? 'Loan Interest' : 'Loan Repayments'
      };
  });
  
  const allTransactions = [...formattedSavings, ...formattedSharePayments, ...formattedDividends, ...formattedLoans, ...formattedServiceCharges, ...formattedLoanRepayments];
  
  return allTransactions.sort(
      (a, b) => {
        const dateA = new Date((a as any).date || (a as any).paymentDate || (a as any).disbursementDate || (a as any).distributionDate || (a as any).dateApplied).getTime();
        const dateB = new Date((b as any).date || (b as any).paymentDate || (b as any).disbursementDate || (b as any).distributionDate || (b as any).dateApplied).getTime();
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
    revalidatePath('/applied-service-charges');
    revalidatePath('/loan-repayments');
};

export async function approveTransaction(txId: string, txType: string): Promise<{ success: boolean; message: string }> {
  try {
    await requirePermission('transactionApproval:edit');
    await prisma.$transaction(async (tx) => {
      if (txType === 'Savings' || txType === 'Saving Interest') {
        const savingTx = await tx.saving.findUnique({ where: { id: txId }, include: { memberSavingAccount: true } });
        if (!savingTx || savingTx.status !== 'pending') throw new Error('Transaction not found or not pending.');
        if (!savingTx.memberSavingAccountId) throw new Error('Transaction is not linked to a specific savings account.');
        
        const account = savingTx.memberSavingAccount;
        if (!account) throw new Error('Associated savings account not found.');

        // Logic for setting initial balance
        if (account.balance === 0 && account.initialBalance === 0) {
            await tx.memberSavingAccount.update({
                where: { id: savingTx.memberSavingAccountId },
                data: {
                    initialBalance: savingTx.amount,
                    balance: savingTx.amount,
                }
            });
            // Mark the transaction as approved but don't double-count by adding to balance again.
            // Or, we can delete the transaction after setting the initial balance.
            // Let's mark as approved and add a note.
             await tx.saving.update({ 
                where: { id: txId }, 
                data: { 
                    status: 'approved',
                    notes: `Approved as initial opening balance. ${savingTx.notes || ''}`.trim()
                } 
            });

        } else {
            // Standard transaction logic
            await tx.saving.update({ where: { id: txId }, data: { status: 'approved' } });
            
            const amountChange = savingTx.transactionType === 'deposit' ? savingTx.amount : -savingTx.amount;
            
            await tx.memberSavingAccount.update({
              where: { id: savingTx.memberSavingAccountId },
              data: { balance: { increment: amountChange } },
            });

            // Check if this is a share refund withdrawal
            if (savingTx.transactionType === 'withdrawal' && savingTx.notes?.startsWith('Share refund for commitment ID:')) {
                const commitmentId = savingTx.notes.split(': ')[1];
                if (commitmentId) {
                    await tx.memberShareCommitment.update({
                        where: { id: commitmentId },
                        data: { status: 'REFUNDED' }
                    });
                }
            }
        }

      } else if (txType === 'Shares') {
        const sharePaymentTx = await tx.sharePayment.findUnique({ where: { id: txId }, include: { commitment: true } });
        if (!sharePaymentTx || sharePaymentTx.status !== 'pending') throw new Error('Transaction not found or not pending.');
        
        await tx.sharePayment.update({ where: { id: txId }, data: { status: 'approved' } });
        
        const updatedCommitment = await tx.memberShareCommitment.update({
            where: { id: sharePaymentTx.commitmentId },
            data: {
                amountPaid: {
                    increment: sharePaymentTx.amount,
                }
            }
        });

        if (updatedCommitment.amountPaid >= updatedCommitment.totalCommittedAmount) {
             await tx.memberShareCommitment.update({
                where: { id: sharePaymentTx.commitmentId },
                data: { status: 'PAID_OFF' }
            });
        }
        
      } else if (txType === 'Dividends') {
        await tx.dividend.update({
          where: { id: txId },
          data: { status: 'approved' },
        });
      } else if (txType === 'Loans') {
          const loanTx = await tx.loan.findUnique({ where: { id: txId }});
          if (!loanTx || loanTx.status !== 'pending') throw new Error('Loan application not found or not pending.');
          
          const nextDueDate = addMonths(new Date(), 1); // Calculate due date from now
          await tx.loan.update({
              where: { id: txId },
              data: { 
                  status: 'active',
                  nextDueDate: nextDueDate,
              },
          });
      } else if (txType === 'Loan Repayments' || txType === 'Loan Interest') {
        const repaymentTx = await tx.loanRepayment.findUnique({ where: { id: txId, status: 'pending' }});
        if (!repaymentTx) throw new Error('Loan repayment not found or not pending.');

        const loan = await tx.loan.findUnique({ where: { id: repaymentTx.loanId }});
        if (!loan) throw new Error(`Associated loan for repayment ${txId} not found.`);
        
        await tx.loanRepayment.update({ where: { id: txId }, data: { status: 'approved' }});
        
        const newBalance = loan.remainingBalance - repaymentTx.principalPaid;
        await tx.loan.update({
            where: { id: repaymentTx.loanId },
            data: {
                remainingBalance: newBalance,
                status: newBalance < 0.01 ? 'paid_off' : loan.status,
            }
        });
      } else if (txType === 'Service Charges') {
        const serviceChargeTx = await tx.appliedServiceCharge.findUnique({ where: { id: txId } });
        if (!serviceChargeTx || serviceChargeTx.status !== 'pending') throw new Error('Service charge not found or not pending.');
        await tx.appliedServiceCharge.update({ where: { id: txId }, data: { status: 'paid' } });
      }
    });

    revalidateAllPaths();
    return { success: true, message: 'Transaction approved successfully.' };
  } catch (error) {
    console.error('Approval Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to approve transaction.';
    return { success: false, message };
  }
}

export async function rejectTransaction(txId: string, txType: string, reason: string): Promise<{ success: boolean; message: string }> {
   try {
  await requirePermission('transactionApproval:edit');
    if (txType === 'Savings' || txType === 'Saving Interest') {
        await prisma.saving.update({ where: { id: txId }, data: { status: 'rejected', notes: reason } });
    } else if (txType === 'Shares') {
        await prisma.sharePayment.update({ where: { id: txId }, data: { status: 'rejected', notes: reason } });
    } else if (txType === 'Dividends') {
        await prisma.dividend.update({ where: { id: txId }, data: { status: 'rejected', notes: reason } });
    } else if (txType === 'Loans') {
        await prisma.loan.update({ where: { id: txId }, data: { status: 'rejected', notes: reason } });
    } else if (txType === 'Loan Repayments' || txType === 'Loan Interest') {
        await prisma.loanRepayment.update({ where: { id: txId }, data: { status: 'rejected', notes: reason } });
    } else if (txType === 'Service Charges') {
        await prisma.appliedServiceCharge.update({ where: { id: txId }, data: { status: 'rejected', notes: reason } });
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
    await requirePermission('transactionApproval:edit');
    for (const { txId, txType } of transactions) {
      // Re-using the single approval logic for atomicity and validation
      const result = await approveTransaction(txId, txType);
      if (!result.success) {
        throw new Error(`Failed to approve transaction ${txId}: ${result.message}`);
      }
    }
    return { success: true, message: `${transactions.length} transactions approved successfully.` };
  } catch (error) {
    console.error('Bulk Approval Error:', error);
    const message = error instanceof Error ? error.message : 'One or more transactions failed to approve during bulk operation.';
    return { success: false, message };
  }
}

export async function rejectMultipleTransactions(
  transactions: { txId: string; txType: string }[],
  reason: string
): Promise<{ success: boolean; message: string }> {
  try {
    await requirePermission('transactionApproval:edit');
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
