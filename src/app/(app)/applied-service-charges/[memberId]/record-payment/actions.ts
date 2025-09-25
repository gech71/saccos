

'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getPaymentFormInitialData(memberId: string) {
    try {
        const member = await prisma.member.findUnique({
            where: { id: memberId },
            select: { fullName: true }
        });

        if (!member) {
            throw new Error("Member not found.");
        }

        const pendingCharges = await prisma.appliedServiceCharge.aggregate({
            _sum: { amountCharged: true },
            where: { memberId, status: 'pending' }
        });
        
        return {
            memberName: member?.fullName || 'Member',
            totalPending: pendingCharges._sum.amountCharged || 0,
        };
    } catch (error) {
        console.error('Failed to get payment form data:', error);
        throw new Error('Could not load payment data. Please try again.');
    }
}


export async function recordChargePayment(memberId: string, data: {
    amount: number;
    paymentDate: string;
    depositMode: 'Cash' | 'Bank' | 'Wallet';
    sourceName?: string;
    transactionReference?: string;
    evidenceUrl?: string;
}) {
    try {
        const { amount, paymentDate, depositMode, sourceName, transactionReference, evidenceUrl } = data;
        
        if (amount <= 0) {
            throw new Error("Payment amount must be greater than zero.");
        }

        const pendingCharges = await prisma.appliedServiceCharge.findMany({
            where: { memberId, status: 'pending' },
            orderBy: { dateApplied: 'asc' },
        });

        const totalPending = pendingCharges.reduce((sum, charge) => sum + charge.amountCharged, 0);

        if (pendingCharges.length === 0) {
            throw new Error('No pending charges found for this member.');
        }
        
        if (amount > totalPending) {
            throw new Error(`Payment amount cannot exceed the total pending amount of ${totalPending.toFixed(2)} Birr.`);
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
                    // Partial payment not supported in this simplified logic.
                    // We throw an error to indicate that exact amounts are preferred for now.
                    // A more complex app could create a credit or mark partial payment.
                    throw new Error('Partial payment of a single service charge is not supported. Please pay the exact charge amount or a total that covers one or more full charges.');
                }
            }
        });

        // Revalidate the path to update the UI on the main page
        revalidatePath('/applied-service-charges');
    } catch (error) {
        console.error('Failed to record charge payment:', error);
        if (error instanceof Error) {
            throw new Error(error.message);
        }
        throw new Error('An unexpected error occurred while recording the payment.');
    }
}
