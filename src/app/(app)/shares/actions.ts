

'use server';

import prisma from '@/lib/prisma';
import type { Share, Member, ShareType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

function roundToTwo(num: number) {
    return Math.round(num * 100) / 100;
}

export interface SharesPageData {
  shares: (Share & { memberName: string, shareTypeName: string })[];
  members: Pick<Member, 'id' | 'fullName' | 'savingsAccountNumber'>[];
  shareTypes: ShareType[];
}

export async function getSharesPageData(): Promise<SharesPageData> {
  const [shares, members, shareTypes] = await Promise.all([
    prisma.share.findMany({
        include: {
            member: { select: { fullName: true } },
            shareType: { select: { name: true } }
        },
        orderBy: { allocationDate: 'desc' },
    }),
    prisma.member.findMany({
        where: { status: 'active' },
        select: { id: true, fullName: true, savingsAccountNumber: true },
        orderBy: { fullName: 'asc' },
    }),
    prisma.shareType.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return {
    shares: shares.map(s => ({
        ...s,
        memberName: s.member.fullName,
        shareTypeName: s.shareType.name,
        allocationDate: s.allocationDate.toISOString()
    })),
    members,
    shareTypes,
  };
}

export type ShareInput = Omit<Share, 'id' | 'count' | 'status' | 'loanId' | 'totalValueForAllocation' | 'valuePerShare' | 'shareTypeName' | 'allocationDate'> & {
    allocationDate: string;
};


export async function addShare(data: ShareInput): Promise<Share> {
  const member = await prisma.member.findUnique({ where: { id: data.memberId } });
  if (!member) throw new Error("Member not found");
  
  const shareType = await prisma.shareType.findUnique({ where: { id: data.shareTypeId } });
  if (!shareType || shareType.valuePerShare <= 0) throw new Error("Share Type not found or has zero value");
  
  const contributionAmount = roundToTwo(data.contributionAmount || 0);
  const count = Math.floor(contributionAmount / shareType.valuePerShare);
  const totalValueForAllocation = roundToTwo(count * shareType.valuePerShare);

  if (count <= 0) throw new Error("Contribution amount is insufficient to allocate any shares.");

  const newShare = await prisma.share.create({
    data: {
      memberId: data.memberId,
      shareTypeId: data.shareTypeId,
      count,
      allocationDate: new Date(data.allocationDate),
      valuePerShare: shareType.valuePerShare,
      status: 'pending',
      contributionAmount: contributionAmount,
      totalValueForAllocation,
      depositMode: data.depositMode,
      sourceName: data.sourceName,
      transactionReference: data.transactionReference,
      evidenceUrl: data.evidenceUrl,
    },
  });

  revalidatePath('/shares');
  revalidatePath('/approve-transactions');
  return newShare;
}

export async function updateShare(id: string, data: ShareInput): Promise<Share> {
    const member = await prisma.member.findUnique({ where: { id: data.memberId } });
    if (!member) throw new Error("Member not found");
    
    const shareType = await prisma.shareType.findUnique({ where: { id: data.shareTypeId } });
    if (!shareType || shareType.valuePerShare <= 0) throw new Error("Share Type not found or has zero value");

    const contributionAmount = roundToTwo(data.contributionAmount || 0);
    const count = Math.floor(contributionAmount / shareType.valuePerShare);
    const totalValueForAllocation = roundToTwo(count * shareType.valuePerShare);

    if (count <= 0) throw new Error("Contribution amount is insufficient to allocate any shares.");

    const updatedShare = await prisma.share.update({
        where: { id },
        data: {
            memberId: data.memberId,
            shareTypeId: data.shareTypeId,
            count,
            allocationDate: new Date(data.allocationDate),
            valuePerShare: shareType.valuePerShare,
            status: 'pending', // Always require re-approval on edit
            contributionAmount: contributionAmount,
            totalValueForAllocation,
            depositMode: data.depositMode,
            sourceName: data.sourceName,
            transactionReference: data.transactionReference,
            evidenceUrl: data.evidenceUrl,
        },
    });

    revalidatePath('/shares');
    revalidatePath('/approve-transactions');
    return updatedShare;
}

export async function deleteShare(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const share = await prisma.share.findUnique({ where: { id } });
    if (!share) {
      return { success: false, message: 'Share record not found.' };
    }
    if (share.status === 'approved') {
       return { success: false, message: 'Cannot delete an approved share record. Please contact an administrator for adjustments.' };
    }
    await prisma.share.delete({ where: { id } });
    revalidatePath('/shares');
    return { success: true, message: 'Share record deleted successfully.' };
  } catch (error) {
    console.error('Failed to delete share:', error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
