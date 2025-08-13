
'use server';

import prisma from '@/lib/prisma';
import type { ShareType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getShareTypes(): Promise<ShareType[]> {
  return prisma.shareType.findMany({
    orderBy: { name: 'asc' },
  });
}

export type ShareTypeInput = Omit<ShareType, 'id'>;

export async function addShareType(data: ShareTypeInput): Promise<ShareType> {
  const newShareType = await prisma.shareType.create({ data });
  revalidatePath('/share-types');
  return newShareType;
}

export async function updateShareType(id: string, data: Partial<ShareTypeInput>): Promise<ShareType> {
  const updatedShareType = await prisma.shareType.update({
    where: { id },
    data,
  });
  revalidatePath('/share-types');
  return updatedShareType;
}

export async function deleteShareType(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const commitmentsWithThisType = await prisma.memberShareCommitment.count({
        where: { shareTypeId: id }
    });

    if (commitmentsWithThisType > 0) {
      return { success: false, message: 'Cannot delete share type. It is currently in use by member commitments.' };
    }

    await prisma.shareType.delete({ where: { id } });
    revalidatePath('/share-types');
    return { success: true, message: 'Share type deleted successfully.' };
  } catch(error) {
    console.error("Failed to delete share type:", error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
