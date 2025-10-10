

'use server';

import prisma from '@/lib/prisma';
import type { SharePayment, Member, ShareType, MemberShareCommitment } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { compareDesc } from 'date-fns';

export interface MemberCommitmentWithDetails extends MemberShareCommitment {
  member: Pick<Member, 'fullName'>;
  shareType: Pick<ShareType, 'name' | 'totalAmount' | 'paymentType' | 'numberOfInstallments' | 'monthlyPayment'> | null;
}

export interface SharePaymentsPageData {
  commitments: MemberCommitmentWithDetails[];
}

export async function getSharePaymentsPageData(): Promise<SharePaymentsPageData> {
  const commitments = await prisma.memberShareCommitment.findMany({
      include: {
        member: { select: { fullName: true } },
        shareType: { select: { name: true, totalAmount: true, paymentType: true, numberOfInstallments: true, monthlyPayment: true } },
      },
      orderBy: { member: { fullName: 'asc' } },
    });

  const commitmentsWithDetails: MemberCommitmentWithDetails[] = commitments.map(c => {
    return {
      ...c,
      joinDate: c.joinDate.toISOString(),
    };
  });

  return {
    commitments: commitmentsWithDetails,
  };
}

export type SharePaymentInput = Omit<SharePayment, 'id' | 'status'>;

export async function addSharePayment(data: SharePaymentInput): Promise<{ success: boolean; error?: string }> {
  try {
    const commitment = await prisma.memberShareCommitment.findUnique({ where: { id: data.commitmentId } });
    if (!commitment) return { success: false, error: "Share commitment not found" };
    
    if (data.amount <= 0) return { success: false, error: "Payment amount must be positive." };

    await prisma.sharePayment.create({
      data: {
        ...data,
        paymentDate: new Date(data.paymentDate),
        status: 'pending',
      },
    });
    
    revalidatePath('/shares');
    revalidatePath('/approve-transactions');
    return { success: true };
  } catch (error) {
    console.error('Failed to add share payment:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function refundShareCommitment(commitmentId: string): Promise<{ success: boolean; message: string; }> {
    const commitment = await prisma.memberShareCommitment.findUnique({
        where: { id: commitmentId },
        include: { 
            member: true,
            shareType: true,
        }
    });

    if (!commitment) {
        return { success: false, message: "Share commitment not found." };
    }

    if (commitment.status === 'REFUNDED' || commitment.status === 'PENDING_REFUND') {
        return { success: false, message: "This share commitment has already been refunded or is pending refund." };
    }

    const amountToRefund = commitment.amountPaid;
    if (amountToRefund <= 0) {
        return { success: false, message: "No amount has been paid for this share, so there is nothing to refund." };
    }

    const primarySavingAccount = await prisma.memberSavingAccount.findFirst({
        where: { memberId: commitment.memberId },
        orderBy: { createdAt: 'asc'}
    });
    
    if (!primarySavingAccount) {
        return { success: false, message: `Cannot process refund because member ${commitment.member.fullName} does not have a savings account.` };
    }

    await prisma.$transaction(async (tx) => {
        await tx.saving.create({
            data: {
                memberId: commitment.memberId,
                memberSavingAccountId: primarySavingAccount.id,
                amount: amountToRefund,
                date: new Date(),
                month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
                transactionType: 'withdrawal',
                status: 'pending',
                notes: `Share refund for commitment ID: ${commitment.id}`,
                depositMode: 'Bank',
                sourceName: 'Internal System Refund',
            }
        });

        await tx.memberShareCommitment.update({
            where: { id: commitmentId },
            data: { status: 'PENDING_REFUND' }
        });
    });

    revalidatePath('/shares');
    revalidatePath('/approve-transactions');

    return { success: true, message: `Refund of ${amountToRefund.toFixed(2)} Birr for ${commitment.member.fullName}'s share submitted for approval.` };
}
