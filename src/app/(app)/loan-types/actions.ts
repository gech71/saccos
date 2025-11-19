

'use server';

import prisma from '@/lib/prisma';
import type { LoanType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/authorization';

export async function getLoanTypes(): Promise<LoanType[]> {
  try {
    return prisma.loanType.findMany({
      orderBy: { name: 'asc' },
    });
  } catch (error) {
      console.error('Failed to get loan types:', error);
      throw new Error('Could not load loan types. Please try again.');
  }
}

export async function addLoanType(data: Omit<LoanType, 'id'>): Promise<LoanType> {
  await requirePermission('configuration:create');
  try {
    const newLoanType = await prisma.loanType.create({ 
      data: {
        ...data,
        purposes: data.purposes || [], // Ensure purposes is initialized as an empty array
      } 
    });
    revalidatePath('/loan-types');
    return newLoanType;
  } catch (error) {
      console.error('Failed to add loan type:', error);
      throw new Error('An unexpected error occurred while adding the loan type.');
  }
}

export async function updateLoanType(id: string, data: Partial<Omit<LoanType, 'id'>>): Promise<LoanType> {
  await requirePermission('configuration:edit');
  try {
    const updatedLoanType = await prisma.loanType.update({
      where: { id },
      data,
    });
    revalidatePath('/loan-types');
    return updatedLoanType;
  } catch (error) {
      console.error('Failed to update loan type:', error);
      throw new Error('An unexpected error occurred while updating the loan type.');
  }
}

export async function deleteLoanType(id: string): Promise<{ success: boolean; message: string }> {
  try {
    await requirePermission('configuration:delete');
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
    return { success: false, message: 'An unexpected error occurred while deleting the loan type.' };
  }
}
