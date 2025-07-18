
'use server';

import prisma from '@/lib/prisma';
import type { Member, MemberSavingAccount, Saving } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export type SavingWithMemberName = Saving & { memberName: string | null };

export interface SavingsPageData {
  savings: SavingWithMemberName[];
  members: (Pick<Member, 'id' | 'fullName' | 'status'> & {
    memberSavingAccounts: Pick<MemberSavingAccount, 'id' | 'accountNumber' | 'balance'>[];
  })[];
}

export async function getSavingsPageData(): Promise<SavingsPageData> {
  const [savingsWithDetails, members] = await Promise.all([
    prisma.saving.findMany({
      include: {
        member: { select: { fullName: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.member.findMany({
      select: { 
        id: true, 
        fullName: true, 
        status: true,
        memberSavingAccounts: {
          select: {
            id: true,
            accountNumber: true,
            balance: true
          }
        }
      },
      orderBy: { fullName: 'asc' },
    }),
  ]);
  
  const formattedSavings: SavingWithMemberName[] = savingsWithDetails.map(s => {
    const { member, ...rest } = s;
    return {
      ...rest,
      memberName: member?.fullName || 'Deleted Member', // Handle cases where a member might be deleted
      date: s.date.toISOString(),
    };
  });

  return {
    savings: formattedSavings,
    members,
  };
}

export type SavingInput = Omit<Saving, 'id' | 'status'> & { memberName?: string };

export async function addSavingTransaction(data: SavingInput): Promise<Saving> {
  const member = await prisma.member.findUnique({ where: { id: data.memberId } });
  if (!member) throw new Error('Member not found');
  
  const account = await prisma.memberSavingAccount.findUnique({ where: {id: data.memberSavingAccountId! }})
  if (!account) throw new Error('Savings account not found');

  if (data.transactionType === 'withdrawal' && data.amount > account.balance) {
      throw new Error("Withdrawal amount cannot exceed the selected account's balance.");
  }

  const { memberName, ...restOfData } = data;

  const newSaving = await prisma.saving.create({
    data: {
      ...restOfData,
      date: new Date(data.date),
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
  
  const account = await prisma.memberSavingAccount.findUnique({ where: {id: data.memberSavingAccountId! }})
  if (!account) throw new Error('Savings account not found');
  
  if (data.transactionType === 'withdrawal' && data.amount > account.balance) {
      throw new Error("Withdrawal amount cannot exceed the account's current balance.");
  }

  const { memberName, ...restOfData } = data;

  const updatedSaving = await prisma.saving.update({
    where: { id },
    data: {
      ...restOfData,
      date: new Date(data.date),
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
