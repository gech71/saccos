

'use server';

import prisma from '@/lib/prisma';
import type { Loan, Member, LoanRepayment, Prisma, LoanType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { compareDesc } from 'date-fns';

export interface RepaymentsByMember {
  memberId: string;
  memberName: string;
  totalRepaid: number;
  repaymentCount: number;
  repayments: (LoanRepayment & { loan?: { loanAccountNumber: string | null }, balanceAfter: number })[];
}

export interface LoanRepaymentsPageData {
  repaymentsByMember: RepaymentsByMember[];
  activeLoans: (Loan & { member: Member | null} & { loanType: { name: string } | null })[];
}

export async function getLoanRepaymentsPageData(): Promise<LoanRepaymentsPageData> {
  const [allLoans, activeLoans] = await Promise.all([
    prisma.loan.findMany({
        include: {
            repayments: {
                orderBy: {
                    paymentDate: 'asc' // Fetch in chronological order to calculate running balance
                }
            },
            member: {
                select: { fullName: true }
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
    })
  ]);

  // Process all repayments to add a running balance
  const allRepaymentsWithBalance: (LoanRepayment & { balanceAfter: number, loan?: { loanAccountNumber: string | null }, memberName: string })[] = [];
  
  allLoans.forEach(loan => {
      let runningBalance = loan.principalAmount;
      loan.repayments.forEach(repayment => {
          runningBalance -= repayment.principalPaid;
          allRepaymentsWithBalance.push({
              ...repayment,
              balanceAfter: runningBalance,
              loan: { loanAccountNumber: loan.loanAccountNumber },
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
    
    // Calculate minimum payment for validation
    const principalPortion = loan.loanTerm > 0 ? loan.principalAmount / loan.loanTerm : 0;
    const interestPortion = loan.remainingBalance * (loan.interestRate / 12);
    const minimumPayment = principalPortion + interestPortion;
    
    if (data.amountPaid < minimumPayment) {
        const finalPayment = loan.remainingBalance + interestPortion;
        if (Math.abs(data.amountPaid - finalPayment) > 0.01) { // Check if it's not a final payment with a small tolerance
            throw new Error(`Payment amount must be at least ${minimumPayment.toFixed(2)} Birr, or the final settlement amount of ${finalPayment.toFixed(2)} Birr.`);
        }
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
