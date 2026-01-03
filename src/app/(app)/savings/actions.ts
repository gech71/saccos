

'use server';

import prisma from '@/lib/prisma';
import type { Member, MemberSavingAccount, Saving } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/authorization';
import { requireCsrf } from '@/lib/csrf';



export type SavingWithMemberName = Saving & { memberName: string | null; memberSeqId?: string | null };

export interface SavingsPageData {
  savings: SavingWithMemberName[];
  members: (Pick<Member, 'id' | 'fullName' | 'status' | 'memberId'> & {
    memberSavingAccounts: Pick<MemberSavingAccount, 'id' | 'accountNumber' | 'balance'>[];
  })[];
}

export async function getSavingsPageData(): Promise<SavingsPageData> {
  await requirePermission('saving:view');
  const [savingsWithDetails, members] = await Promise.all([
    prisma.saving.findMany({
      include: {
        member: { select: { fullName: true, memberId: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.member.findMany({
      select: { 
        id: true, 
        fullName: true, 
        status: true,
        memberId: true,
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
      memberSeqId: member?.memberId || null,
      date: s.date.toISOString(),
    };
  });

  const payload = {
    savings: formattedSavings,
    members,
  };

  try {
    const { assertNoSensitiveFields, deepSanitize } = await import('@/lib/sanitize-user-data');
    if (!assertNoSensitiveFields(payload, 'getSavingsPageData')) {
      return deepSanitize(payload) as any;
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') throw e;
  }

  return payload;
}

export type SavingInput = Omit<Saving, 'id' | 'status'> & { memberName?: string };

export async function addSavingTransaction(data: SavingInput, csrfToken?: string): Promise<Saving> {
  await requirePermission('saving:create');
  await requireCsrf(csrfToken);
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

export async function updateSavingTransaction(id: string, data: SavingInput, csrfToken?: string): Promise<Saving> {
  await requirePermission('saving:edit');
  await requireCsrf(csrfToken);
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

export async function deleteSavingTransaction(id: string, csrfToken?: string): Promise<{ success: boolean, message: string }> {
  try {
    await requirePermission('saving:delete');
    await requireCsrf(csrfToken);
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
