

'use server';

import prisma from '@/lib/prisma';
import type { Dividend, Member } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export interface DividendsPageData {
  dividends: (Dividend & { memberName: string })[];
  members: Pick<Member, 'id' | 'fullName'>[];
}

export async function getDividendsPageData(): Promise<DividendsPageData> {
  const [dividends, members] = await Promise.all([
    prisma.dividend.findMany({
        include: { member: { select: { fullName: true } } },
        orderBy: { distributionDate: 'desc' }
    }),
    prisma.member.findMany({
        where: { status: 'active' },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' }
    }),
  ]);

  return {
    dividends: dividends.map(d => ({ ...d, memberName: d.member.fullName, distributionDate: d.distributionDate.toISOString() })),
    members,
  };
}

export type DividendInput = Omit<Dividend, 'id' | 'status'> & { memberName?: string };

export async function addDividend(data: DividendInput): Promise<Dividend> {
  const member = await prisma.member.findUnique({ where: { id: data.memberId } });
  if (!member) throw new Error('Member not found');
  
  const newDividend = await prisma.dividend.create({
    data: {
      memberId: data.memberId,
      amount: data.amount,
      distributionDate: new Date(data.distributionDate),
      shareCountAtDistribution: data.shareCountAtDistribution,
      status: 'pending',
      notes: data.notes,
    },
  });

  revalidatePath('/dividends');
  revalidatePath('/approve-transactions');
  return newDividend;
}

export async function updateDividend(id: string, data: Partial<DividendInput>): Promise<Dividend> {
  if (!data.memberId) {
    throw new Error('Member is required to update a dividend record.');
  }
  const member = await prisma.member.findUnique({ where: { id: data.memberId } });
  if (!member) throw new Error('Member not found');
  
  const updatedDividend = await prisma.dividend.update({
    where: { id },
    data: {
      memberId: data.memberId,
      amount: data.amount,
      distributionDate: data.distributionDate ? new Date(data.distributionDate) : undefined,
      shareCountAtDistribution: data.shareCountAtDistribution,
      status: 'pending', // Re-submit for approval on edit
      notes: data.notes,
    },
  });

  revalidatePath('/dividends');
  revalidatePath('/approve-transactions');
  return updatedDividend;
}


export async function deleteDividend(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const dividend = await prisma.dividend.findUnique({ where: { id } });
    if (dividend?.status === 'approved') {
        return { success: false, message: 'Cannot delete an approved dividend record.' };
    }
    await prisma.dividend.delete({ where: { id } });
    revalidatePath('/dividends');
    return { success: true, message: 'Dividend record deleted successfully.' };
  } catch (error) {
    console.error('Failed to delete dividend:', error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
