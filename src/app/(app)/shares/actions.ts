

'use server';

import prisma from '@/lib/prisma';
import type { SharePayment, Member, ShareType, MemberShareCommitment } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export interface MemberCommitmentWithDetails extends MemberShareCommitment {
  member: Pick<Member, 'fullName'>;
  shareType: Pick<ShareType, 'name' | 'totalAmount' | 'paymentType' | 'numberOfInstallments' | 'monthlyPayment'>;
}

export interface SharePaymentsPageData {
  commitments: MemberCommitmentWithDetails[];
  payments: SharePayment[];
}

export async function getSharePaymentsPageData(): Promise<SharePaymentsPageData> {
  const commitments = await prisma.memberShareCommitment.findMany({
    include: {
      member: { select: { fullName: true } },
      shareType: { select: { name: true, totalAmount: true, paymentType: true, numberOfInstallments: true, monthlyPayment: true } },
    },
    orderBy: { member: { fullName: 'asc' } },
  });

  const payments = await prisma.sharePayment.findMany({
    orderBy: { paymentDate: 'desc' },
  });

  const commitmentsWithDetails: MemberCommitmentWithDetails[] = commitments.map(c => {
    return {
      ...c,
      joinDate: c.joinDate.toISOString(),
    };
  });

  return {
    commitments: commitmentsWithDetails,
    payments: payments.map(p => ({ ...p, paymentDate: p.paymentDate.toISOString() })),
  };
}

export type SharePaymentInput = Omit<SharePayment, 'id' | 'status'>;

export async function addSharePayment(data: SharePaymentInput): Promise<SharePayment> {
  const commitment = await prisma.memberShareCommitment.findUnique({ where: { id: data.commitmentId } });
  if (!commitment) throw new Error("Share commitment not found");
  
  if (data.amount <= 0) throw new Error("Payment amount must be positive.");

  const newPayment = await prisma.sharePayment.create({
    data: {
      ...data,
      paymentDate: new Date(data.paymentDate),
      status: 'pending',
    },
  });
  
  // After payment, update the commitment's amountPaid and status
  const totalPaid = (await prisma.sharePayment.aggregate({
      _sum: { amount: true },
      where: { commitmentId: data.commitmentId, status: 'approved' }
  }))._sum.amount || 0;
  
  const newTotalPaid = totalPaid + data.amount; // Assuming it will be approved

  await prisma.memberShareCommitment.update({
      where: { id: data.commitmentId },
      data: {
          // This should ideally be updated after approval, but for now we optimistically update.
          // A more robust system would handle this in the approval action.
          status: newTotalPaid >= commitment.totalCommittedAmount ? 'PAID_OFF' : 'ACTIVE'
      }
  });


  revalidatePath('/shares'); // This page will now be share-payments
  revalidatePath('/approve-transactions');
  return newPayment;
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

    if (commitment.status === 'REFUNDED') {
        return { success: false, message: "This share commitment has already been refunded." };
    }

    const amountToRefund = commitment.amountPaid;
    if (amountToRefund <= 0) {
        return { success: false, message: "No amount has been paid for this share, so there is nothing to refund." };
    }

    // Find the member's primary savings account to record the withdrawal against.
    const primarySavingAccount = await prisma.memberSavingAccount.findFirst({
        where: { memberId: commitment.memberId },
        orderBy: { createdAt: 'asc'}
    });
    
    if (!primarySavingAccount) {
        return { success: false, message: `Cannot process refund because member ${commitment.member.fullName} does not have a savings account.` };
    }

    await prisma.$transaction(async (tx) => {
        // 1. Create a withdrawal transaction to represent the refund
        await tx.saving.create({
            data: {
                memberId: commitment.memberId,
                memberSavingAccountId: primarySavingAccount.id, // Link to the savings account
                amount: amountToRefund,
                date: new Date(),
                month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
                transactionType: 'withdrawal',
                status: 'pending', // This refund needs to be approved
                notes: `Share refund for commitment: ${commitment.shareType.name}`,
                depositMode: 'Bank', // Default for system transactions
                sourceName: 'Internal System Refund',
            }
        });

        // 2. Update the commitment status to REFUNDED
        await tx.memberShareCommitment.update({
            where: { id: commitmentId },
            data: { status: 'REFUNDED' }
        });
    });

    revalidatePath('/shares');
    revalidatePath('/approve-transactions');

    return { success: true, message: `Refund of ${amountToRefund.toFixed(2)} Birr for ${commitment.member.fullName}'s share submitted for approval.` };
}


// Keeping these for now, but they will likely be deprecated.
export async function updateShare(id: string, data: any): Promise<any> {
    return Promise.resolve();
}

export async function deleteShare(id: string): Promise<{ success: boolean; message: string }> {
    return { success: false, message: 'This action is deprecated.' };
}
