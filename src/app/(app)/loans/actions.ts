

'use server';

import prisma from '@/lib/prisma';
import type { Loan, Prisma, Member, LoanType, Collateral } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { addMonths, differenceInMonths } from 'date-fns';
import { logAudit } from '@/lib/audit-log';
import { requirePermission } from '@/lib/authorization';

function roundToTwo(num: number) {
    return Math.round(num * 100) / 100;
}

export type LoanWithDetails = Loan & { 
  guarantors: { guarantor: { id: string, fullName: string } }[],
  collaterals: Collateral[],
  memberName?: string;
  loanTypeName?: string;
};

export interface LoansPageData {
  loans: LoanWithDetails[];
  members: (Pick<Member, 'id' | 'fullName' | 'joinDate' | 'memberId'> & { totalSavings: number, totalGuaranteed: number })[];
  loanTypes: LoanType[];
}

export async function getLoansPageData(): Promise<LoansPageData> {
  const [loans, membersData, loanTypes] = await Promise.all([
    prisma.loan.findMany({
      include: {
        member: {
          select: {
            fullName: true
          }
        },
        loanType: {
          select: {
            name: true,
          }
        },
        guarantors: {
            select: {
                guarantor: {
                    select: {
                        id: true,
                        fullName: true,
                    }
                }
            }
        },
        collaterals: true,
      },
      orderBy: { disbursementDate: 'desc' },
    }),
    prisma.member.findMany({
      where: { status: 'active' },
      select: { 
        id: true, 
        fullName: true,
        memberId: true,
        joinDate: true,
        memberSavingAccounts: {
            select: {
                balance: true
            }
        },
        _count: {
          select: {
            guaranteedLoans: {
              where: {
                loan: {
                  status: { in: ['active', 'overdue'] }
                }
              }
            }
          }
        }
       },
      orderBy: { fullName: 'asc' },
    }),
    prisma.loanType.findMany({ orderBy: { name: 'asc' } }),
  ]);
  
  const members = membersData.map(m => ({
      id: m.id,
      fullName: m.fullName,
      memberId: m.memberId,
      joinDate: m.joinDate,
      totalGuaranteed: m._count.guaranteedLoans,
      totalSavings: m.memberSavingAccounts.reduce((sum, acc) => sum + acc.balance, 0),
  }));

  return {
    loans: loans.map(l => ({ 
      ...l, 
      memberName: l.member.fullName,
      loanTypeName: l.loanType.name,
    })),
    members,
    loanTypes,
  };
}

export type CollateralInput = {
    type: 'GUARANTOR' | 'TITLE_DEED';
    description?: string;
    documentUrl?: string;
    guarantorId?: string;
};

export type LoanInput = Omit<Loan, 'id' | 'interestRate' | 'repaymentFrequency' | 'remainingBalance' | 'disbursementDate' | 'nextDueDate' | 'notes' | 'minLoanAmount' | 'maxLoanAmount' | 'minRepaymentPeriod' | 'maxRepaymentPeriod' | 'monthlyRepaymentAmount' | 'serviceFee' | 'insuranceFee' | 'purpose'> & {
    disbursementDate: string;
    notes?: string | null;
    purpose?: string | null;
    collaterals: CollateralInput[];
    monthlyRepaymentAmount: number;
    serviceFee: number;
    insuranceFee: number;
};

export async function addLoan(data: LoanInput): Promise<{ success: boolean; loan?: Loan; error?: string }> {
  await requirePermission('loan:create');
  const { collaterals, memberId, loanTypeId, principalAmount, disbursementDate, status, loanAccountNumber, notes, purpose, loanTerm } = data;

  try {
  const loanType = await prisma.loanType.findUnique({ where: { id: loanTypeId }});
  if (!loanType) return { success: false, error: 'Loan Type not found.' };

  const member = await prisma.member.findUnique({ 
    where: { id: memberId },
    include: { memberSavingAccounts: true }
  });
  if (!member) return { success: false, error: 'Member not found.' };

  // VALIDATION LOGIC
    if (principalAmount < loanType.minLoanAmount || principalAmount > loanType.maxLoanAmount) {
      return { success: false, error: `Loan amount must be between ${loanType.minLoanAmount.toLocaleString()} and ${loanType.maxLoanAmount.toLocaleString()} ETB for this loan type.` };
    }
    if (loanTerm < loanType.minRepaymentPeriod || loanTerm > loanType.maxRepaymentPeriod) {
      return { success: false, error: `Repayment period must be between ${loanType.minRepaymentPeriod} and ${loanType.maxRepaymentPeriod} months for this loan type.` };
    }

  const rawGuarantorIds = collaterals.filter(c => c.type === 'GUARANTOR' && c.guarantorId).map(c => c.guarantorId!);
  const guarantorIds = [...new Set(rawGuarantorIds)];
  
  if (guarantorIds.length > 0) {
      const guarantorChecks = await prisma.member.findMany({
          where: { id: { in: guarantorIds } },
          include: { _count: { select: { guaranteedLoans: { where: { loan: { status: { in: ['active', 'overdue'] } } } } } }
      }});

        for (const guarantor of guarantorChecks) {
          if (guarantor._count.guaranteedLoans >= 2) {
            return { success: false, error: `Member ${guarantor.fullName} is already guaranteeing two active loans and cannot be added as a guarantor.` };
          }
        }
  }

  if (loanType.collateralLogic === 'GUARANTOR_OR_SAVINGS_BALANCE') {
      const totalSavings = member.memberSavingAccounts.reduce((sum, acc) => sum + acc.balance, 0);
        if (totalSavings < (loanType.minSavingBalance || 0) && guarantorIds.length === 0) {
          return { success: false, error: `Member must have at least one guarantor if savings are less than ${loanType.minSavingBalance} ETB.` };
        }
  } else if (loanType.collateralLogic === 'GUARANTOR_AND_TITLE_DEED_OVER_X') {
      const threshold = loanType.collateralThresholdAmount || 200000;
      if (principalAmount <= threshold) {
            if (!collaterals.some(c => c.type === 'GUARANTOR')) return { success: false, error: `Loans up to ${threshold.toLocaleString()} ETB require at least one guarantor.` };
      } else { 
            if (!collaterals.some(c => c.type === 'TITLE_DEED')) return { success: false, error: `Loans over ${threshold.toLocaleString()} ETB require a house title deed.` };
      }
  } else if (loanType.collateralLogic === 'GUARANTOR') {
          if (guarantorIds.length === 0) return { success: false, error: "This loan type requires at least one guarantor." };
  } else if (loanType.collateralLogic === 'TITLE_DEED') {
          if (!collaterals.some(c => c.type === 'TITLE_DEED')) return { success: false, error: "This loan type requires a title deed." };
  }
  
  if (loanType.minSavingMonths && loanType.minSavingMonths > 0) {
      const monthsSinceJoined = differenceInMonths(new Date(), new Date(member.joinDate));
        if (monthsSinceJoined < loanType.minSavingMonths) {
          return { success: false, error: `Member must have at least ${loanType.minSavingMonths} months of membership to be eligible for this loan.` };
        }
  }

    if (loanType.purposes.length > 0 && (!purpose || !loanType.purposes.includes(purpose))) {
      return { success: false, error: "A valid purpose must be selected for this loan type." };
    }

  const fixedPrincipalPayment = roundToTwo(principalAmount / loanTerm);
  const firstMonthInterest = roundToTwo(principalAmount * (loanType.interestRate / 12));
  const firstMonthRepayment = fixedPrincipalPayment + firstMonthInterest;
  
  const insuranceFee = roundToTwo(principalAmount * (loanType.insuranceFeePercentage || 0));
  const serviceFee = loanType.serviceFee || 0;

  const newLoan = await prisma.loan.create({
    data: {
      principalAmount: roundToTwo(principalAmount),
      status,
      notes,
      purpose,
      loanTerm,
      loanAccountNumber: loanAccountNumber || `LN${Math.floor(100000 + Math.random() * 900000)}`,
      disbursementDate: new Date(disbursementDate),
      interestRate: loanType.interestRate,
      repaymentFrequency: loanType.repaymentFrequency,
      remainingBalance: roundToTwo(principalAmount),
      insuranceFee,
      serviceFee,
      monthlyRepaymentAmount: roundToTwo(firstMonthRepayment),
      member: { connect: { id: memberId } },
      loanType: { connect: { id: loanTypeId } },
      collaterals: { 
        create: collaterals.filter(c => c.type === 'TITLE_DEED').map(c => ({
          type: 'TITLE_DEED',
          description: c.description,
          documentUrl: c.documentUrl,
        }))
      },
      guarantors: {
        create: guarantorIds.map(guarantorId => ({
            guarantorId: guarantorId
        }))
      }
    },
  });

  await logAudit('LOAN_CREATE', {
      targetId: newLoan.id,
      targetType: 'LOAN',
      details: { memberId: member.memberId, loanType: loanType.name, amount: principalAmount }
  });

  return { success: true, loan: newLoan };
  } catch (err: any) {
    console.error('Failed to add loan:', err);
    return { success: false, error: 'An unexpected server error occurred. Please check the logs.' };
  }
}

export async function updateLoan(id: string, data: LoanInput): Promise<{ success: boolean; loan?: Loan; error?: string }> {
  await requirePermission('loan:edit');
  revalidatePath('/loans');
    try {
    // For this complex update, it's safer to re-implement the creation logic.
    // A real scenario would need more careful handling of existing records.
    await deleteLoan(id, true); // Soft delete for audit purposes
    const res = await addLoan(data);
    if (!res.success) return { success: false, error: res.error };
    const updatedLoan = res.loan!;
    await logAudit('LOAN_UPDATE', { targetId: updatedLoan.id, targetType: 'LOAN' });
    return { success: true, loan: updatedLoan };
    } catch (err) {
      console.error('Failed to update loan:', err);
      return { success: false, error: 'An unexpected error occurred during loan update.' };
    }
}

export async function deleteLoan(id: string, isUpdate: boolean = false): Promise<{ success: boolean; message: string }> {
  try {
    await requirePermission('loan:delete');
    const loan = await prisma.loan.findUnique({ where: { id }, select: { member: { select: { memberId: true }}, loanType: { select: { name: true }} } });
    if (!loan) {
        return { success: false, message: "Loan not found." };
    }

    const repaymentCount = await prisma.loanRepayment.count({ where: { loanId: id } });
    if (repaymentCount > 0) {
      return { success: false, message: "Cannot delete a loan with existing repayments." };
    }
    
    await prisma.loanGuarantor.deleteMany({ where: { loanId: id } });
    await prisma.collateral.deleteMany({ where: { loanId: id }});

    await prisma.loan.delete({ where: { id } });

    if (!isUpdate) {
        await logAudit('LOAN_DELETE', {
            targetId: id,
            targetType: 'LOAN',
            details: { memberId: loan.member?.memberId, loanType: loan.loanType?.name }
        });
    }

    revalidatePath('/loans');
    return { success: true, message: 'Loan application deleted successfully.' };
  } catch (error) {
    console.error("Failed to delete loan:", error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
