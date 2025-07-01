
'use server';

import prisma from '@/lib/prisma';
import type { Loan, Prisma, Member, LoanType, School, Collateral, Address, Organization } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export type LoanWithDetails = Loan & { 
  collaterals: (Collateral & { organization: Organization | null, address: Address | null })[]
  memberName?: string;
  loanTypeName?: string;
};

export interface LoansPageData {
  loans: LoanWithDetails[];
  members: Pick<Member, 'id' | 'fullName'>[];
  loanTypes: LoanType[];
  subcities: string[];
}

export async function getLoansPageData(): Promise<LoansPageData> {
  const loans = await prisma.loan.findMany({
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
      collaterals: {
        include: {
          organization: true,
          address: true
        }
      }
    },
    orderBy: { disbursementDate: 'desc' },
  });
  const members = await prisma.member.findMany({
    where: { status: 'active' },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  });
  const loanTypes = await prisma.loanType.findMany({ orderBy: { name: 'asc' } });

  const addressSubcities = await prisma.address.findMany({
    select: { subCity: true },
    distinct: ['subCity'],
    where: { subCity: { not: null } }
  });
  const subcities = addressSubcities.map(a => a.subCity!);

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
    subcities,
  };
}

export type CollateralInput = Omit<Collateral, 'id' | 'loanId'> & {
    organization?: Prisma.OrganizationCreateWithoutCollateralInput;
    address?: Prisma.AddressCreateWithoutCollateralInput;
}

export type LoanInput = Omit<Loan, 'id' | 'interestRate' | 'loanTerm' | 'repaymentFrequency' | 'remainingBalance' | 'collaterals' | 'disbursementDate' | 'nextDueDate' | 'notes'> & {
    disbursementDate: string;
    notes?: string | null;
    collaterals?: CollateralInput[];
};

export async function addLoan(data: LoanInput): Promise<Loan> {
  const { collaterals, memberId, loanTypeId, principalAmount, disbursementDate, status, loanAccountNumber, notes } = data;
  
  const loanType = await prisma.loanType.findUnique({ where: { id: loanTypeId }});
  if (!loanType) throw new Error("Loan Type not found");
  
  const member = await prisma.member.findUnique({ where: { id: memberId }});
  if (!member) throw new Error("Member not found");

  const newLoan = await prisma.loan.create({
    data: {
      memberId,
      loanTypeId,
      principalAmount,
      status,
      notes,
      loanAccountNumber: loanAccountNumber || `LN${Date.now().toString().slice(-6)}`,
      disbursementDate: new Date(disbursementDate),
      interestRate: loanType.interestRate,
      loanTerm: loanType.loanTerm,
      repaymentFrequency: loanType.repaymentFrequency,
      remainingBalance: principalAmount,
      collaterals: collaterals ? { create: collaterals.map(c => ({
        fullName: c.fullName,
        organization: c.organization ? { create: c.organization } : undefined,
        address: c.address ? { create: c.address } : undefined,
      })) } : undefined,
    },
  });
  revalidatePath('/loans');
  return newLoan;
}

export async function updateLoan(id: string, data: LoanInput): Promise<Loan> {
    const { collaterals, memberId, loanTypeId, principalAmount, disbursementDate, status, loanAccountNumber, notes } = data;
    
    const loanType = await prisma.loanType.findUnique({ where: { id: loanTypeId }});
    if (!loanType) throw new Error("Loan Type not found");
    
    const member = await prisma.member.findUnique({ where: { id: memberId }});
    if (!member) throw new Error("Member not found");

    const updatedLoan = await prisma.loan.update({
        where: { id },
        data: {
            memberId,
            loanTypeId,
            principalAmount,
            status,
            loanAccountNumber,
            notes,
            disbursementDate: new Date(disbursementDate),
            interestRate: loanType.interestRate,
            loanTerm: loanType.loanTerm,
            repaymentFrequency: loanType.repaymentFrequency,
            remainingBalance: principalAmount,
            collaterals: {
                deleteMany: {},
                create: collaterals ? collaterals.map(c => ({
                    fullName: c.fullName,
                    organization: c.organization ? { create: c.organization } : undefined,
                    address: c.address ? { create: c.address } : undefined,
                })) : undefined,
            }
        },
    });

    revalidatePath('/loans');
    return updatedLoan;
}

export async function deleteLoan(id: string): Promise<{ success: boolean; message: string }> {
  try {
    // Check for repayments first
    const repaymentCount = await prisma.loanRepayment.count({ where: { loanId: id } });
    if (repaymentCount > 0) {
      return { success: false, message: "Cannot delete a loan with existing repayments." };
    }
    
    await prisma.loan.delete({ where: { id } });
    revalidatePath('/loans');
    return { success: true, message: 'Loan application deleted successfully.' };
  } catch (error) {
    console.error("Failed to delete loan:", error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
