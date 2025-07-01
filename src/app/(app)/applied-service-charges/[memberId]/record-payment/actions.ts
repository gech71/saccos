
'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getPaymentFormInitialData(memberId: string) {
    const member = await prisma.member.findUnique({
        where: { id: memberId },
        select: { fullName: true }
    });

    const pendingCharges = await prisma.appliedServiceCharge.aggregate({
        _sum: { amountCharged: true },
        where: { memberId, status: 'pending' }
    });
    
    return {
        memberName: member?.fullName || 'Member',
        totalPending: pendingCharges._sum.amountCharged || 0,
    };
}


export async function recordChargePayment(memberId: string, data: {
    amount: number;
    paymentDate: string;
    depositMode: 'Cash' | 'Bank' | 'Wallet';
    sourceName?: string;
    transactionReference?: string;
    evidenceUrl?: string;
}) {
    const { amount, paymentDate, depositMode, sourceName, transactionReference, evidenceUrl } = data;
    
    const pendingCharges = await prisma.appliedServiceCharge.findMany({
        where: { memberId, status: 'pending' },
        orderBy: { dateApplied: 'asc' },
    });

    if (pendingCharges.length === 0) {
        throw new Error('No pending charges found for this member.');
    }

    let remainingAmountToApply = amount;

    await prisma.$transaction(async (tx) => {
        for (const charge of pendingCharges) {
            if (remainingAmountToApply <= 0) break;
            
            if (remainingAmountToApply >= charge.amountCharged) {
                // Full payment for this charge
                await tx.appliedServiceCharge.update({
                    where: { id: charge.id },
                    data: {
                        status: 'paid',
                        notes: `${charge.notes || ''} Paid on ${paymentDate} via ${depositMode}.`.trim(),
                    },
                });
                remainingAmountToApply -= charge.amountCharged;
            } else {
                // Partial payment - for simplicity, we don't apply it and stop.
                // A more complex app could create a credit or mark partial payment.
                break;
            }
        }
    });

    // Revalidate the path to update the UI on the main page
    revalidatePath('/applied-service-charges');
}
