
'use server';

import prisma from '@/lib/prisma';
import type { School, Loan, LoanRepayment, Member, LoanType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getGroupLoanRepaymentsPageData(): Promise<{
    schools: Pick<School, 'id', 'name'>[],
    loanTypes: Pick<LoanType, 'id', 'name'>[],
    allMembersForValidation: Pick<Member, 'id' | 'fullName'>[]
}> {
  const [schools, loanTypes, allMembersForValidation] = await Promise.all([
    prisma.school.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.loanType.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.member.findMany({
        where: { status: 'active' },
        select: { id: true, fullName: true }
    })
  ]);
  return { schools, loanTypes, allMembersForValidation };
}

export type LoanWithMemberInfo = Loan & {
  member: Pick<Member, 'fullName'>;
}

export async function getLoansByCriteria(criteria: { schoolId: string, loanTypeId?: string }): Promise<LoanWithMemberInfo[]> {
  const { schoolId, loanTypeId } = criteria;
  
  let whereClause: any = {
      OR: [
        { status: 'active' },
        { status: 'overdue' }
      ]
  };

  if (schoolId !== 'all') {
      whereClause.member = { schoolId: schoolId };
  }
  if (loanTypeId && loanTypeId !== 'all') {
      whereClause.loanTypeId = loanTypeId;
  }

  const loans = await prisma.loan.findMany({
    where: whereClause,
    include: {
      member: {
        select: { fullName: true }
      }
    },
    orderBy: [
      { member: { fullName: 'asc' } },
      { loanAccountNumber: 'asc' }
    ]
  });
  
  // Serialize Date objects to strings for the client
  return loans.map(loan => ({
    ...loan,
    memberName: loan.member.fullName,
    disbursementDate: loan.disbursementDate.toISOString(),
    nextDueDate: loan.nextDueDate?.toISOString() ?? null,
  }));
}

export type RepaymentBatchData = {
    loanId: string;
    loanAccountNumber: string | null;
    amountPaid: number;
    paymentDate: string;
    depositMode: 'Cash' | 'Bank' | 'Wallet';
    paymentDetails?: {
      sourceName?: string;
      transactionReference?: string;
      evidenceUrl?: string;
    };
}[];

export async function recordBatchRepayments(repaymentsData: RepaymentBatchData): Promise<{ success: boolean; message: string }> {
  try {
    const loanAccountNumbers = repaymentsData.map(r => r.loanAccountNumber).filter(Boolean) as string[];
    const loansToUpdate = await prisma.loan.findMany({
      where: { loanAccountNumber: { in: loanAccountNumbers } },
    });

    const loanMap = new Map(loansToUpdate.map(l => [l.loanAccountNumber, l]));

    await prisma.$transaction(async (tx) => {
      for (const repayment of repaymentsData) {
        if (!repayment.loanAccountNumber) continue;
        const loan = loanMap.get(repayment.loanAccountNumber);
        if (!loan) {
          throw new Error(`Loan with account number ${repayment.loanAccountNumber} not found.`);
        }
        
        if (repayment.amountPaid <= 0) continue; // Skip zero or negative payments

        // 1. Calculate interest for the current period
        const monthlyInterestRate = loan.interestRate / 12;
        const interestForMonth = loan.remainingBalance * monthlyInterestRate;

        // 2. Allocate payment
        const interestPaid = Math.min(repayment.amountPaid, interestForMonth);
        const principalPaid = repayment.amountPaid - interestPaid;
      
        const newBalance = loan.remainingBalance - principalPaid;

        // 3. Create the repayment record with detailed allocation
        await tx.loanRepayment.create({
          data: {
            loanId: loan.id, // Use the internal ID here
            memberId: loan.memberId,
            amountPaid: repayment.amountPaid,
            paymentDate: new Date(repayment.paymentDate),
            depositMode: repayment.depositMode,
            sourceName: repayment.paymentDetails?.sourceName,
            transactionReference: repayment.paymentDetails?.transactionReference,
            evidenceUrl: repayment.paymentDetails?.evidenceUrl,
            interestPaid,
            principalPaid,
          },
        });

        // 4. Update the loan's remaining balance
        await tx.loan.update({
          where: { id: loan.id }, // Update by internal ID
          data: {
            remainingBalance: newBalance,
            status: newBalance <= 0 ? 'paid_off' : loan.status,
          },
        });
        
        // Update the in-memory map for subsequent calculations in the same batch
        loan.remainingBalance = newBalance;
        loanMap.set(loan.loanAccountNumber as string, loan);
      }
    });

    revalidatePath('/loan-repayments');
    revalidatePath('/loans');
    
    return { success: true, message: `Successfully recorded ${repaymentsData.length} loan repayments.` };
  } catch (error) {
    console.error("Batch repayment failed:", error);
    return { success: false, message: "An error occurred during batch repayment." };
  }
}
