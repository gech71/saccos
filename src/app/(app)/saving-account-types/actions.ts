
'use server';

import prisma from '@/lib/prisma';
import type { SavingAccountType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getSavingAccountTypes(): Promise<SavingAccountType[]> {
  return prisma.savingAccountType.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function addSavingAccountType(data: Omit<SavingAccountType, 'id'>): Promise<SavingAccountType> {
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
}

export async function updateSavingAccountType(id: string, data: Partial<Omit<SavingAccountType, 'id'>>): Promise<SavingAccountType> {
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
}

export async function deleteSavingAccountType(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const membersWithAccountType = await prisma.member.count({
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
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
