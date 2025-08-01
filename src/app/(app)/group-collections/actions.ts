
'use server';

import prisma from '@/lib/prisma';
import type { School, SavingAccountType, Member, Saving, MemberSavingAccount, ShareType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export type MemberWithSavingAccounts = Pick<Member, 'id' | 'fullName' | 'schoolId'> & {
    memberSavingAccounts: (Pick<MemberSavingAccount, 'id' | 'accountNumber' | 'expectedMonthlySaving'> & {
        savingAccountType: Pick<SavingAccountType, 'id' | 'name'> | null;
    })[];
};

export interface GroupCollectionsPageData {
  schools: Pick<School, 'id', 'name'>[];
  savingAccountTypes: Pick<SavingAccountType, 'id', 'name'>[];
  members: MemberWithSavingAccounts[];
}

export async function getGroupCollectionsPageData(): Promise<GroupCollectionsPageData> {
  const [schools, savingAccountTypes, members] = await Promise.all([
    prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.savingAccountType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.member.findMany({ 
        where: { status: 'active' },
        select: { 
            id: true,
            fullName: true,
            schoolId: true,
            memberSavingAccounts: {
                select: {
                    id: true,
                    accountNumber: true,
                    expectedMonthlySaving: true,
                    savingAccountType: {
                        select: {
                            id: true,
                            name: true,
                        }
                    }
                }
            }
        },
        orderBy: { fullName: 'asc' }
    }),
  ]);
  
  return { schools, savingAccountTypes, members };
}

export type BatchSavingData = Omit<Saving, 'id'> & { memberName?: string };

export async function recordBatchSavings(savingsData: BatchSavingData[]): Promise<{ success: boolean; message: string }> {
  try {
    const cleanData = savingsData.map(({ memberName, ...rest }) => rest);

    await prisma.saving.createMany({
      data: cleanData,
      skipDuplicates: true,
    });
    
    revalidatePath('/savings');
    revalidatePath('/approve-transactions');

    return { success: true, message: `Successfully submitted ${savingsData.length} savings collections for approval.` };
  } catch (error) {
    console.error("Batch savings recording failed:", error);
    if (error instanceof Error) {
        return { success: false, message: `Batch savings recording failed: ${error.message}` };
    }
    return { success: false, message: 'An error occurred while recording the batch savings.' };
  }
}
