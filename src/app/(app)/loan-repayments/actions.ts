
'use server';

import prisma from '@/lib/prisma';
import type { Loan, Member, LoanRepayment, Prisma, LoanType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { compareDesc } from 'date-fns';
import { logAudit } from '@/lib/audit-log';

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
  loanTypes: Pick<LoanType, 'id', 'name'>[];
}

export async function getLoanRepaymentsPageData(): Promise<LoanRepaymentsPageData> {
  const [allLoans, activeLoans, loanTypes] = await Promise.all([
    prisma.loan.findMany({
        include: {
            repayments: {
                where: { status: 'approved' },
                orderBy: {
                    paymentDate: 'asc' 
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

  const repaymentsGrouped: Record<string, RepaymentsByMember> = {};
  
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
    });
  });

  return {
    repaymentsByMember: Object.values(repaymentsGrouped).sort((a, b) => a.memberName.localeCompare(b.memberName)),
    activeLoans: activeLoans.map(l => ({...l })),
    loanTypes,
  };
}

export type LoanRepaymentInput = Pick<
  LoanRepayment,
  'loanId' | 'amountPaid' | 'paymentDate' | 'depositMode' | 'sourceName' | 'transactionReference' | 'evidenceUrl' | 'notes'
>;


export async function addLoanRepayment(data: LoanRepaymentInput): Promise<{ success: boolean; message: string }> {
  try {
    const loan = await prisma.loan.findUnique({ where: { id: data.loanId } });
    if (!loan) throw new Error('Loan not found');

    if (data.amountPaid <= 0) {
        throw new Error('Payment amount must be positive.');
    }
    
    const interestForMonth = roundToTwo(loan.remainingBalance * (loan.interestRate / 12));
    const finalPayment = roundToTwo(loan.remainingBalance + interestForMonth);
    
    const tolerance = 0.01;
    if (data.amountPaid > finalPayment + tolerance) {
        throw new Error(`Payment amount of ${data.amountPaid.toFixed(2)} cannot exceed the final settlement amount of ${finalPayment.toFixed(2)}.`);
    }

    const calculatedInterestPaid = roundToTwo(Math.min(data.amountPaid, interestForMonth));
    const calculatedPrincipalPaid = roundToTwo(data.amountPaid - calculatedInterestPaid);

    const newRepayment = await prisma.loanRepayment.create({ 
      data: {
          ...data,
          memberId: loan.memberId,
          paymentDate: new Date(data.paymentDate),
          interestPaid: calculatedInterestPaid,
          principalPaid: calculatedPrincipalPaid,
          status: 'pending',
      }
    });

    await logAudit('LOAN_REPAYMENT_CREATE', {
        targetId: newRepayment.id,
        targetType: 'LOAN_REPAYMENT',
        details: { loanId: data.loanId, memberId: loan.memberId, amount: data.amountPaid }
    });

    revalidatePath('/loan-repayments');
    revalidatePath('/approve-transactions');
    return { success: true, message: 'Loan repayment submitted for approval.' };
  } catch (error) {
    console.error('Failed to record loan repayment:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred while recording the repayment.';
    return { success: false, message: errorMessage };
  }
}
