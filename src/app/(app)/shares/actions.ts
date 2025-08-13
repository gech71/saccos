
'use server';

import prisma from '@/lib/prisma';
import type { SharePayment, Member, ShareType, MemberShareCommitment } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export interface MemberCommitmentWithDetails extends MemberShareCommitment {
  member: Pick<Member, 'fullName'>;
  shareType: Pick<ShareType, 'name' | 'totalAmount' | 'paymentType' | 'numberOfInstallments'>;
  monthlyPayment: number;
}

export interface SharePaymentsPageData {
  commitments: MemberCommitmentWithDetails[];
  payments: SharePayment[];
}

export async function getSharePaymentsPageData(): Promise<SharePaymentsPageData> {
  const commitments = await prisma.memberShareCommitment.findMany({
    include: {
      member: { select: { fullName: true } },
      shareType: { select: { name: true, totalAmount: true, paymentType: true, numberOfInstallments: true } },
    },
    orderBy: { member: { fullName: 'asc' } },
  });

  const payments = await prisma.sharePayment.findMany({
    orderBy: { paymentDate: 'desc' },
  });

  const commitmentsWithDetails: MemberCommitmentWithDetails[] = commitments.map(c => {
    let monthlyPayment = 0;
    if (c.shareType.paymentType === 'INSTALLMENT' && c.shareType.numberOfInstallments && c.shareType.numberOfInstallments > 0) {
      monthlyPayment = c.shareType.totalAmount / c.shareType.numberOfInstallments;
    }
    return {
      ...c,
      joinDate: c.joinDate.toISOString(),
      monthlyPayment,
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

  revalidatePath('/shares'); // This page will now be share-payments
  revalidatePath('/approve-transactions');
  return newPayment;
}

// Keeping these for now, but they will likely be deprecated.
export async function updateShare(id: string, data: any): Promise<any> {
    return Promise.resolve();
}

export async function deleteShare(id: string): Promise<{ success: boolean; message: string }> {
    return { success: false, message: 'This action is deprecated.' };
}
