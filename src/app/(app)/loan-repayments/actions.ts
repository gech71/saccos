
'use server';

import prisma from '@/lib/prisma';
import type { Loan, Member, LoanRepayment, Prisma, LoanType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export interface LoanRepaymentsPageData {
  repayments: (LoanRepayment & { loan?: { loanAccountNumber: string | null }, member?: { fullName: string }})[];
  activeLoans: (Loan & { member: Member | null} & { loanType: { name: string } | null })[];
}

export async function getLoanRepaymentsPageData(): Promise<LoanRepaymentsPageData> {
  const repaymentsData = await prisma.loanRepayment.findMany({
    include: {
      loan: {
        select: {
          loanAccountNumber: true,
          member: {
            select: {
              fullName: true,
            },
          },
        },
      },
    },
    orderBy: { paymentDate: 'desc' },
  });

  // Reshape the data to include member info at the top level for the UI
  const repayments = repaymentsData.map(r => {
    const { loan, ...rest } = r;
    return {
      ...rest,
      paymentDate: r.paymentDate.toISOString(),
      loan: loan ? { loanAccountNumber: loan.loanAccountNumber } : undefined,
      member: loan?.member,
    };
  });

  const activeLoans = await prisma.loan.findMany({
    where: {
      OR: [{ status: 'active' }, { status: 'overdue' }],
    },
    include: { 
        member: true,
        loanType: {
            select: {
                name: true
            }
        }
    },
    orderBy: [{ member: { fullName: 'asc' }}, {loanAccountNumber: 'asc'}]
  });

  return {
    repayments,
    activeLoans: activeLoans.map(l => ({...l, disbursementDate: l.disbursementDate.toISOString(), nextDueDate: l.nextDueDate?.toISOString() ?? null })),
  };
}

export type LoanRepaymentInput = Omit<LoanRepayment, 'id' | 'memberId' | 'interestPaid' | 'principalPaid'>;

export async function addLoanRepayment(data: LoanRepaymentInput): Promise<{ success: boolean; message: string }> {
  try {
    const loan = await prisma.loan.findUnique({ where: { id: data.loanId } });
    if (!loan) throw new Error('Loan not found');

    if (data.amountPaid <= 0) {
        throw new Error('Payment amount must be positive.');
    }

    await prisma.$transaction(async (tx) => {
      // 1. Calculate interest for the current period
      const monthlyInterestRate = loan.interestRate / 12;
      const interestForMonth = loan.remainingBalance * monthlyInterestRate;

      // 2. Allocate payment
      const interestPaid = Math.min(data.amountPaid, interestForMonth);
      const principalPaid = data.amountPaid - interestPaid;
      
      const newBalance = loan.remainingBalance - principalPaid;

      // 3. Create the repayment record with detailed allocation
      await tx.loanRepayment.create({ 
        data: {
            ...data,
            paymentDate: new Date(data.paymentDate),
            memberId: loan.memberId,
            interestPaid: interestPaid,
            principalPaid: principalPaid,
        }
      });

      // 4. Update the loan's remaining balance
      await tx.loan.update({
        where: { id: data.loanId },
        data: {
          remainingBalance: newBalance,
          status: newBalance <= 0 ? 'paid_off' : loan.status,
        },
      });
    });

    revalidatePath('/loan-repayments');
    revalidatePath('/loans');
    return { success: true, message: 'Loan repayment recorded successfully.' };
  } catch (error) {
    console.error('Failed to record loan repayment:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred while recording the repayment.';
    return { success: false, message: errorMessage };
  }
}
