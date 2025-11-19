

'use server';

import prisma from '@/lib/prisma';
import type { SavingAccountType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/authorization';

export async function getSavingAccountTypes(): Promise<SavingAccountType[]> {
  try {
    return prisma.savingAccountType.findMany({
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    console.error('Failed to get saving account types:', error);
    throw new Error('Could not load saving account types. Please try again.');
  }
}

export async function addSavingAccountType(data: Omit<SavingAccountType, 'id'>): Promise<SavingAccountType> {
  await requirePermission('configuration:create');
  try {
    const { name, interestRate, contributionType, contributionValue, description } = data;
    
    const newAccountType = await prisma.savingAccountType.create({ 
      data: {
        name,
        interestRate: (interestRate || 0),
        contributionType,
        contributionValue: (contributionValue || 0),
        description: description || null,
      }
    });
    revalidatePath('/saving-account-types');
    return newAccountType;
  } catch (error) {
    console.error('Failed to add saving account type:', error);
    throw new Error('An unexpected error occurred while adding the account type.');
  }
}

export async function updateSavingAccountType(id: string, data: Partial<Omit<SavingAccountType, 'id'>>): Promise<SavingAccountType> {
  await requirePermission('configuration:edit');
   try {
    const { name, interestRate, contributionType, contributionValue, description } = data;
    
    const updatedAccountType = await prisma.savingAccountType.update({
      where: { id },
      data: {
        name,
        interestRate: interestRate,
        contributionType,
        contributionValue: contributionValue,
        description: description,
      },
    });
    revalidatePath('/saving-account-types');
    return updatedAccountType;
  } catch (error) {
      console.error('Failed to update saving account type:', error);
      throw new Error('An unexpected error occurred while updating the account type.');
  }
}

export async function deleteSavingAccountType(id: string): Promise<{ success: boolean; message: string }> {
  await requirePermission('configuration:delete');
  try {
    const membersWithAccountType = await prisma.memberSavingAccount.count({
      where: { savingAccountTypeId: id },
    });
    if (membersWithAccountType > 0) {
      return { success: false, message: 'Cannot delete account type. It is currently in use by members.' };
    }
    
    await prisma.savingAccountType.delete({ where: { id } });
    revalidatePath('/saving-account-types');
    return { success: true, message: 'Saving account type deleted successfully.' };
  } catch (error) {
     console.error("Failed to delete saving account type:", error);
    return { success: false, message: 'An unexpected error occurred while deleting the account type.' };
  }
}
