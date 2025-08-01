

'use server';

import prisma from '@/lib/prisma';
import type { Loan, Member, LoanRepayment, Prisma, LoanType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { compareDesc } from 'date-fns';

function roundToTwo(num: number) {
    return Math.round(num * 100) / 100;
}

export interface RepaymentsByMember {
  memberId: string;
  memberName: string;
  totalRepaid: number;
  repaymentCount: number;
  repayments: (LoanRepayment & { loan?: { loanAccountNumber: string | null, loanTypeName?: string }, balanceAfter: number })[];
}

export interface LoanRepaymentsPageData {
  repaymentsByMember: RepaymentsByMember[];
  activeLoans: (Loan & { member: Member | null} & { loanType: { name: string } | null })[];
  loanTypes: Pick<LoanType, 'id' | 'name'>[];
}

export async function getLoanRepaymentsPageData(): Promise<LoanRepaymentsPageData> {
  const [allLoans, activeLoans, loanTypes] = await Promise.all([
    prisma.loan.findMany({
        include: {
            repayments: {
                orderBy: {
                    paymentDate: 'asc' // Fetch in chronological order to calculate running balance
                }
            },
            member: {
                select: { fullName: true }
            },
            loanType: {
                select: { name: true }
            }
        }
    }),
    prisma.loan.findMany({
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
    }),
    prisma.loanType.findMany({ select: { id: true, name: true }})
  ]);

  // Process all repayments to add a running balance
  const allRepaymentsWithBalance: (LoanRepayment & { balanceAfter: number, loan?: { loanAccountNumber: string | null, loanTypeName?: string }, memberName: string })[] = [];
  
  allLoans.forEach(loan => {
      let runningBalance = loan.principalAmount;
      loan.repayments.forEach(repayment => {
          runningBalance -= repayment.principalPaid;
          allRepaymentsWithBalance.push({
              ...repayment,
              balanceAfter: roundToTwo(runningBalance),
              loan: { loanAccountNumber: loan.loanAccountNumber, loanTypeName: loan.loanType?.name ?? 'N/A' },
              memberName: loan.member.fullName,
          });
      });
  });

  // Group repayments by member
  const repaymentsGrouped: Record<string, RepaymentsByMember> = {};
  
  // Sort all processed repayments by date descending for final display
  allRepaymentsWithBalance.sort((a,b) => compareDesc(new Date(a.paymentDate), new Date(b.paymentDate)));

  allRepaymentsWithBalance.forEach(r => {
    if (!r.memberId) return;

    if (!repaymentsGrouped[r.memberId]) {
      repaymentsGrouped[r.memberId] = {
        memberId: r.memberId,
        memberName: r.memberName,
        totalRepaid: 0,
        repaymentCount: 0,
        repayments: [],
      };
    }
    
    const group = repaymentsGrouped[r.memberId];
    group.totalRepaid += r.amountPaid;
    group.repaymentCount += 1;
    group.repayments.push({
      ...r,
      paymentDate: r.paymentDate.toISOString(),
    });
  });

  return {
    repaymentsByMember: Object.values(repaymentsGrouped).sort((a, b) => a.memberName.localeCompare(b.memberName)),
    activeLoans: activeLoans.map(l => ({...l, disbursementDate: l.disbursementDate.toISOString(), nextDueDate: l.nextDueDate?.toISOString() ?? null })),
    loanTypes,
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
    
    // Calculate final settlement amount for validation
    const interestForMonth = roundToTwo(loan.remainingBalance * (loan.interestRate / 12));
    const finalPayment = roundToTwo(loan.remainingBalance + interestForMonth);
    
    // Allow a small tolerance for floating point inaccuracies
    if (data.amountPaid > finalPayment + 0.01) {
        throw new Error(`Payment amount of ${data.amountPaid.toFixed(2)} cannot exceed the final settlement amount of ${finalPayment.toFixed(2)}.`);
    }

    await prisma.$transaction(async (tx) => {
      // 1. Calculate interest for the current period (re-calculate inside transaction for consistency)
      const freshInterestForMonth = roundToTwo(loan.remainingBalance * (loan.interestRate / 12));

      // 2. Allocate payment
      const interestPaid = roundToTwo(Math.min(data.amountPaid, freshInterestForMonth));
      const principalPaid = roundToTwo(data.amountPaid - interestPaid);
      
      const newBalance = roundToTwo(loan.remainingBalance - principalPaid);

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
