

'use server';

import prisma from '@/lib/prisma';
import type { Dividend, Member, Prisma } from '@prisma/client';
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

export async function addDividend(data: DividendInput): Promise<{success: boolean; error?: string}> {
  try {
    const member = await prisma.member.findUnique({ where: { id: data.memberId } });
    if (!member) throw new Error('Member not found');
    
    await prisma.dividend.create({
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
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: message };
  }
}

export async function updateDividend(id: string, data: Partial<DividendInput>): Promise<{success: boolean; error?: string}> {
  try {
    if (!data.memberId) {
      throw new Error('Member is required to update a dividend record.');
    }
    const member = await prisma.member.findUnique({ where: { id: data.memberId } });
    if (!member) throw new Error('Member not found');
    
    await prisma.dividend.update({
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
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: message };
  }
}


export async function deleteDividend(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const dividend = await prisma.dividend.findUnique({ where: { id } });
    if (dividend?.status === 'approved') {
        return { success: false, message: 'Cannot delete an approved dividend record.' };
    }
    await prisma.dividend.delete({ where: { id } });
    revalidatePath('/dividends');
    revalidatePath('/approve-transactions');
    return { success: true, message: 'Dividend record deleted successfully.' };
  } catch (error) {
    console.error('Failed to delete dividend:', error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}

export type ImportedDividend = {
  memberId: string;
  amount: number;
  shareCountAtDistribution: number;
  distributionDate: Date;
  notes?: string;
}

export type AllocationMethod = 'deposit-to-savings' | 'add-to-shares' | 'deduct-from-savings';

export async function importDividends(dividends: ImportedDividend[], allocationMethod: AllocationMethod): Promise<{ success: boolean; message: string; }> {
    if (dividends.length === 0) {
        return { success: true, message: 'No new dividends to import.' };
    }

    try {
        await prisma.$transaction(async (tx) => {
            for (const dividendData of dividends) {
                const { memberId, amount, distributionDate, notes } = dividendData;

                if (allocationMethod === 'deposit-to-savings' || allocationMethod === 'deduct-from-savings') {
                    const primarySavingAccount = await tx.memberSavingAccount.findFirst({
                        where: { memberId },
                        orderBy: { createdAt: 'asc' }
                    });

                    if (!primarySavingAccount) {
                        // In a real scenario, you might want to create an account or handle this case differently
                        console.warn(`Skipping dividend for member ${memberId}: No savings account found.`);
                        continue;
                    }
                    
                    const transactionType = allocationMethod === 'deposit-to-savings' ? 'deposit' : 'withdrawal';
                    const noteText = allocationMethod === 'deposit-to-savings' ? 'Dividend/Profit Distribution' : 'Loss Allocation';

                    await tx.saving.create({
                        data: {
                            memberId,
                            memberSavingAccountId: primarySavingAccount.id,
                            amount,
                            date: distributionDate,
                            month: new Date(distributionDate).toLocaleString('default', { month: 'long', year: 'numeric' }),
                            transactionType,
                            status: 'pending',
                            notes: notes || noteText,
                            depositMode: 'Bank',
                            sourceName: 'Internal System Posting'
                        }
                    });

                } else if (allocationMethod === 'add-to-shares') {
                     const primaryShareCommitment = await tx.memberShareCommitment.findFirst({
                        where: { memberId, shareType: { paymentType: 'INSTALLMENT' } },
                        orderBy: { joinDate: 'asc' }
                    });

                     if (!primaryShareCommitment) {
                        console.warn(`Skipping dividend for member ${memberId}: No suitable share commitment found to add funds to.`);
                        continue;
                    }
                    
                    await tx.sharePayment.create({
                        data: {
                            commitmentId: primaryShareCommitment.id,
                            amount,
                            paymentDate: distributionDate,
                            status: 'pending',
                            notes: notes || 'Dividend allocated to shares',
                            depositMode: 'Bank',
                            sourceName: 'Internal System Posting'
                        }
                    });
                }
            }
        });
        
        revalidatePath('/dividends');
        revalidatePath('/approve-transactions');
        revalidatePath('/savings');
        revalidatePath('/shares');
        
        return { success: true, message: `Successfully submitted ${dividends.length} dividend allocations for approval.` };

    } catch (error) {
        console.error("Failed during dividend import and allocation:", error);
        return { success: false, message: 'A critical error occurred during the import process. Please check for invalid data.' };
    }
}
