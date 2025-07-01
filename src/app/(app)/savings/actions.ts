'use server';

import prisma from '@/lib/prisma';
import type { Saving, Member } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export interface SavingsPageData {
  savings: Saving[];
  members: Pick<Member, 'id' | 'fullName' | 'savingsAccountNumber' | 'savingsBalance'>[];
}

export async function getSavingsPageData(): Promise<SavingsPageData> {
  const [savings, members] = await Promise.all([
    prisma.saving.findMany({
      orderBy: { date: 'desc' },
    }),
    prisma.member.findMany({
      where: { status: 'active' },
      select: { id: true, fullName: true, savingsAccountNumber: true, savingsBalance: true },
      orderBy: { fullName: 'asc' },
    }),
  ]);
  return {
    savings: savings.map(s => ({ ...s, date: s.date.toISOString() })),
    members,
  };
}

export type SavingInput = Omit<Saving, 'id' | 'memberName' | 'status'>;

export async function addSavingTransaction(data: SavingInput): Promise<Saving> {
  const member = await prisma.member.findUnique({ where: { id: data.memberId } });
  if (!member) throw new Error('Member not found');
  
  if (data.transactionType === 'withdrawal' && data.amount > member.savingsBalance) {
      throw new Error("Withdrawal amount cannot exceed the member's current savings balance.");
  }

  const newSaving = await prisma.saving.create({
    data: {
      ...data,
      date: new Date(data.date),
      memberName: member.fullName,
      status: 'pending',
    },
  });

  revalidatePath('/savings');
  revalidatePath('/approve-transactions'); // Invalidate this path too
  return newSaving;
}

export async function updateSavingTransaction(id: string, data: SavingInput): Promise<Saving> {
  const member = await prisma.member.findUnique({ where: { id: data.memberId } });
  if (!member) throw new Error('Member not found');
  
  if (data.transactionType === 'withdrawal' && data.amount > member.savingsBalance) {
      throw new Error("Withdrawal amount cannot exceed the member's current savings balance.");
  }

  const updatedSaving = await prisma.saving.update({
    where: { id },
    data: {
      ...data,
      date: new Date(data.date),
      memberName: member.fullName,
      status: 'pending', // Re-submit for approval on edit
    },
  });

  revalidatePath('/savings');
  revalidatePath('/approve-transactions');
  return updatedSaving;
}

export async function deleteSavingTransaction(id: string): Promise<{ success: boolean, message: string }> {
  try {
    const saving = await prisma.saving.findUnique({ where: { id } });
    if (saving?.status === 'approved') {
        return { success: false, message: 'Cannot delete an approved transaction.' };
    }
    await prisma.saving.delete({ where: { id } });
    revalidatePath('/savings');
    revalidatePath('/approve-transactions');
    return { success: true, message: 'Transaction record deleted successfully.' };
  } catch (error) {
    console.error("Failed to delete saving record:", error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
