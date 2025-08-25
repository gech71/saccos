
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
    // A share type can only be deleted if there are no associated commitments that are in an active state.
    // Refunded or cancelled commitments are considered historical and do not block deletion.
    const activeCommitments = await prisma.memberShareCommitment.count({
      where: { 
        shareTypeId: id,
        status: {
          in: ['ACTIVE', 'PAID_OFF', 'PENDING_REFUND']
        }
      },
    });

    if (activeCommitments > 0) {
      return { success: false, message: 'Cannot delete share type. It is referenced by one or more active, paid off, or pending refund commitments.' };
    }

    await prisma.shareType.delete({ where: { id } });
    revalidatePath('/share-types');
    return { success: true, message: 'Share type deleted successfully.' };
  } catch(error) {
    console.error("Failed to delete share type:", error);
    // This catch block can still trigger if there are other unexpected relations, but the primary check should prevent most FK violations.
    return { success: false, message: 'An unexpected database error occurred. Ensure there are absolutely no references to this share type.' };
  }
}
