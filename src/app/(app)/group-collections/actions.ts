
'use server';

import prisma from '@/lib/prisma';
import type { School, SavingAccountType, Member, Saving, MemberSavingAccount, ShareType, Loan } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export type MemberWithSavingAccounts = Pick<Member, 'id' | 'fullName' | 'schoolId'> & {
    memberSavingAccounts: (Pick<MemberSavingAccount, 'id' | 'accountNumber' | 'expectedMonthlySaving'> & {
        savingAccountType: Pick<SavingAccountType, 'id' | 'name'> | null;
    })[];
};

export type LoanWithMemberInfo = Loan & { member: { fullName: string }};

export interface GroupCollectionsPageData {
  schools: Pick<School, 'id', 'name'>[];
  savingAccountTypes: Pick<SavingAccountType, 'id', 'name'>[];
  shareTypes: Pick<ShareType, 'id', 'name'>[];
  members: MemberWithSavingAccounts[];
  loans: LoanWithMemberInfo[];
}

export async function getGroupCollectionsPageData(): Promise<GroupCollectionsPageData> {
  const [schools, savingAccountTypes, shareTypes, members, loans] = await Promise.all([
    prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.savingAccountType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.shareType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.member.findMany({ 
        where: { status: 'active' },
        select: { 
            id: true,
            fullName: true,
            schoolId: true,
            memberSavingAccounts: {
                select: {
                    id: true,
                    accountNumber: true,
                    expectedMonthlySaving: true,
                    savingAccountType: {
                        select: {
                            id: true,
                            name: true,
                        }
                    }
                }
            }
        },
        orderBy: { fullName: 'asc' }
    }),
    prisma.loan.findMany({
        where: { OR: [{ status: 'active' }, { status: 'overdue' }] },
        include: { member: { select: { fullName: true } } },
        orderBy: { member: { fullName: 'asc' } }
    }),
  ]);

  const serializedLoans = loans.map(l => ({
    ...l,
    disbursementDate: l.disbursementDate.toISOString(),
    nextDueDate: l.nextDueDate?.toISOString() ?? null,
  }));
  
  return { schools, savingAccountTypes, shareTypes, members, loans: serializedLoans };
}

export type BatchSavingData = Omit<Saving, 'id'> & { memberName?: string };

export async function recordBatchSavings(savingsData: BatchSavingData[]): Promise<{ success: boolean; message: string }> {
  try {
    const cleanData = savingsData.map(({ memberName, ...rest }) => rest);

    await prisma.saving.createMany({
      data: cleanData,
      skipDuplicates: true,
    });
    
    revalidatePath('/savings');
    revalidatePath('/approve-transactions');

    return { success: true, message: `Successfully submitted ${savingsData.length} savings collections for approval.` };
  } catch (error) {
    console.error("Batch savings recording failed:", error);
    if (error instanceof Error) {
        return { success: false, message: `Batch savings recording failed: ${error.message}` };
    }
    return { success: false, message: 'An error occurred while recording the batch savings.' };
  }
}

export type RepaymentBatchData = {
    loanId: string;
    loanAccountNumber: string | null;
    memberName: string;
    amountPaid: number;
    paymentDate: string;
    depositMode: 'Cash' | 'Bank' | 'Wallet';
    paymentDetails?: {
      sourceName?: string;
      transactionReference?: string;
      evidenceUrl?: string;
    };
}[];

export async function recordBatchLoanRepayments(repaymentsData: RepaymentBatchData): Promise<{ success: boolean; message: string }> {
  try {
    const loanIds = repaymentsData.map(r => r.loanId);
    const loansToUpdate = await prisma.loan.findMany({
      where: { id: { in: loanIds } },
    });

    const loanMap = new Map(loansToUpdate.map(l => [l.id, l]));

    await prisma.$transaction(async (tx) => {
      for (const repayment of repaymentsData) {
        const loan = loanMap.get(repayment.loanId);
        if (!loan) {
          throw new Error(`Loan with ID ${repayment.loanId} not found.`);
        }

        // Create the repayment record
        await tx.loanRepayment.create({
          data: {
            loanId: repayment.loanId,
            memberId: loan.memberId,
            amountPaid: repayment.amountPaid,
            paymentDate: new Date(repayment.paymentDate),
            depositMode: repayment.depositMode,
            sourceName: repayment.paymentDetails?.sourceName,
            transactionReference: repayment.paymentDetails?.transactionReference,
            evidenceUrl: repayment.paymentDetails?.evidenceUrl,
          },
        });

        // Update the loan's remaining balance
        const newBalance = loan.remainingBalance - repayment.amountPaid;
        await tx.loan.update({
          where: { id: repayment.loanId },
          data: {
            remainingBalance: newBalance,
            status: newBalance <= 0 ? 'paid_off' : loan.status,
          },
        });
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
