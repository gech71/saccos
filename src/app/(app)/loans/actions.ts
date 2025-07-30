
'use server';

import prisma from '@/lib/prisma';
import type { Loan, Prisma, Member, LoanType, Collateral, Address, Organization } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export type LoanWithDetails = Loan & { 
  guarantors: { guarantor: { id: string, fullName: string } }[],
  collaterals: Collateral[],
  memberName?: string;
  loanTypeName?: string;
};

export interface LoansPageData {
  loans: LoanWithDetails[];
  members: (Pick<Member, 'id' | 'fullName' | 'joinDate'> & { totalSavings: number, totalGuaranteed: number })[];
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
        joinDate: true,
        memberSavingAccounts: {
            select: {
                balance: true
            }
        },
        _count: {
            select: {
                guaranteedLoans: true
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
      joinDate: m.joinDate,
      totalGuaranteed: m._count.guaranteedLoans,
      totalSavings: m.memberSavingAccounts.reduce((sum, acc) => sum + acc.balance, 0),
  }));

  return {
    loans: loans.map(l => ({ 
      ...l, 
      memberName: l.member.fullName,
      loanTypeName: l.loanType.name,
      disbursementDate: l.disbursementDate.toISOString(), 
      nextDueDate: l.nextDueDate?.toISOString() ?? null 
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

export type LoanInput = Omit<Loan, 'id' | 'interestRate' | 'loanTerm' | 'repaymentFrequency' | 'remainingBalance' | 'disbursementDate' | 'nextDueDate' | 'notes'> & {
    disbursementDate: string;
    notes?: string | null;
    collaterals: CollateralInput[];
};

export async function addLoan(data: LoanInput): Promise<Loan> {
  const { collaterals, memberId, loanTypeId, principalAmount, disbursementDate, status, loanAccountNumber, notes, purpose } = data;
  
  const loanType = await prisma.loanType.findUnique({ where: { id: loanTypeId }});
  if (!loanType) throw new Error("Loan Type not found");
  
  const member = await prisma.member.findUnique({ 
    where: { id: memberId },
    include: { memberSavingAccounts: true }
  });
  if (!member) throw new Error("Member not found");

  // VALIDATION LOGIC
  if (loanType.name === 'Special Loan') {
      const monthsSinceJoined = (new Date().getTime() - new Date(member.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsSinceJoined < 3) throw new Error("Member must have at least 3 months of savings to be eligible for a Special Loan.");
      const totalSavings = member.memberSavingAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      if (totalSavings < 5000 && !collaterals.some(c => c.type === 'GUARANTOR')) {
          throw new Error("Member must have at least one guarantor if savings are less than 5,000 ETB.");
      }
      if(principalAmount > 5000 || principalAmount < 1000) throw new Error("Special Loan amount must be between 1,000 and 5,000 ETB.");
  } else if (loanType.name === 'Regular Loan') {
      if(principalAmount < 1000 || principalAmount > 300000) throw new Error("Regular Loan amount must be between 1,000 and 300,000 ETB.");

      if (principalAmount <= 200000) {
          if (!collaterals.some(c => c.type === 'GUARANTOR')) throw new Error("Loans up to 200,000 ETB require at least one guarantor.");
      } else { // > 200,000
          if (!collaterals.some(c => c.type === 'TITLE_DEED')) throw new Error("Loans over 200,000 ETB require a house title deed.");
      }
  }

  // Fee calculation
  const insuranceFee = loanType.name === 'Regular Loan' ? principalAmount * 0.01 : 0;
  const serviceFee = loanType.name === 'Regular Loan' ? 15 : 0;

  const guarantorIds = collaterals.filter(c => c.type === 'GUARANTOR' && c.guarantorId).map(c => c.guarantorId!);

  return await prisma.loan.create({
    data: {
      principalAmount,
      status,
      notes,
      purpose,
      loanAccountNumber: loanAccountNumber || `LN${Date.now().toString().slice(-6)}`,
      disbursementDate: new Date(disbursementDate),
      interestRate: loanType.interestRate,
      loanTerm: loanType.loanTerm,
      repaymentFrequency: loanType.repaymentFrequency,
      remainingBalance: principalAmount,
      insuranceFee,
      serviceFee,
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
}

export async function updateLoan(id: string, data: LoanInput): Promise<Loan> {
    revalidatePath('/loans');
    // For this complex update, it's safer to re-implement the creation logic.
    // A real scenario would need more careful handling of existing records.
    await deleteLoan(id);
    return addLoan(data);
}

export async function deleteLoan(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const repaymentCount = await prisma.loanRepayment.count({ where: { loanId: id } });
    if (repaymentCount > 0) {
      return { success: false, message: "Cannot delete a loan with existing repayments." };
    }
    
    // Need to delete related guarantors first due to the relation
    await prisma.loanGuarantor.deleteMany({ where: { loanId: id } });

    await prisma.loan.delete({ where: { id } });
    revalidatePath('/loans');
    return { success: true, message: 'Loan application deleted successfully.' };
  } catch (error) {
    console.error("Failed to delete loan:", error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
