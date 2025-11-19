

'use server';

import prisma from '@/lib/prisma';
import type { ShareType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/authorization';

export async function getShareTypes(): Promise<ShareType[]> {
  try {
    return prisma.shareType.findMany({
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    console.error('Failed to get share types:', error);
    throw new Error('Could not load share types. Please try again.');
  }
}

export type ShareTypeInput = Omit<ShareType, 'id'>;

export async function addShareType(data: ShareTypeInput): Promise<ShareType> {
  await requirePermission('configuration:create');
  try {
    const newShareType = await prisma.shareType.create({ data });
    revalidatePath('/share-types');
    return newShareType;
  } catch (error) {
    console.error('Failed to add share type:', error);
    throw new Error('An unexpected error occurred while adding the share type.');
  }
}

export async function updateShareType(id: string, data: Partial<ShareTypeInput>): Promise<ShareType> {
  await requirePermission('configuration:edit');
  try {
    const updatedShareType = await prisma.shareType.update({
      where: { id },
      data,
    });
    revalidatePath('/share-types');
    return updatedShareType;
  } catch (error) {
    console.error('Failed to update share type:', error);
    throw new Error('An unexpected error occurred while updating the share type.');
  }
}

export async function deleteShareType(id: string): Promise<{ success: boolean; message: string }> {
  await requirePermission('configuration:delete');
  try {
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
    return { success: false, message: 'An unexpected database error occurred. Ensure there are absolutely no references to this share type.' };
  }
}
