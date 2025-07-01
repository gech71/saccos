'use server';

import prisma from '@/lib/prisma';
import type { LoanType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getLoanTypes(): Promise<LoanType[]> {
  return prisma.loanType.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function addLoanType(data: Omit<LoanType, 'id'>): Promise<LoanType> {
  const newLoanType = await prisma.loanType.create({ data });
  revalidatePath('/loan-types');
  return newLoanType;
}

export async function updateLoanType(id: string, data: Partial<Omit<LoanType, 'id'>>): Promise<LoanType> {
  const updatedLoanType = await prisma.loanType.update({
    where: { id },
    data,
  });
  revalidatePath('/loan-types');
  return updatedLoanType;
}

export async function deleteLoanType(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const loansWithThisType = await prisma.loan.count({
      where: { loanTypeId: id },
    });

    if (loansWithThisType > 0) {
      return { success: false, message: 'Cannot delete loan type. It is currently in use by active loans.' };
    }

    await prisma.loanType.delete({ where: { id } });
    revalidatePath('/loan-types');
    return { success: true, message: 'Loan type deleted successfully.' };
  } catch (error) {
    console.error("Failed to delete loan type:", error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
