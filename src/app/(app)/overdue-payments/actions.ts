

'use server';

import prisma from '@/lib/prisma';
import type { School, Share, Saving, Member, ShareType, MemberShareCommitment, AppliedServiceCharge, ServiceChargeType } from '@prisma/client';
import { differenceInMonths, parseISO, format, compareDesc } from 'date-fns';
import { revalidatePath } from 'next/cache';

export interface OverdueShareDetail {
  shareTypeId: string;
  shareTypeName: string;
  monthlyCommittedAmount: number;
  totalExpectedContribution: number;
  totalAmountPaid: number;
  overdueAmount: number;
}

export interface OverdueMemberInfo {
  memberId: string;
  fullName: string;
  schoolName: string;
  schoolId: string;
  joinDate: string;
  expectedMonthlySaving: number;
  savingsBalance: number;
  overdueSavingsAmount: number;
  overdueSharesDetails: OverdueShareDetail[];
  pendingServiceCharges: (AppliedServiceCharge & { serviceChargeTypeName: string })[];
  totalOverdueServiceCharges: number;
  hasAnyOverdue: boolean;
}

export interface OverduePageData {
    overdueMembers: OverdueMemberInfo[];
    schools: Pick<School, 'id', 'name'>[];
    shareTypes: Pick<ShareType, 'id', 'name'>[];
}


export async function getOverduePaymentsPageData(): Promise<OverduePageData> {
  const [members, allSharePayments, allShareTypes, allSchools, appliedCharges] = await Promise.all([
    prisma.member.findMany({ 
        where: { status: 'active' },
        include: { 
          school: { select: { name: true }}, 
          memberShareCommitments: {
            include: {
              shareType: true,
            }
          },
          memberSavingAccounts: true,
        }
    }),
    prisma.sharePayment.findMany({ where: { status: 'approved' }}),
    prisma.shareType.findMany(),
    prisma.school.findMany({ select: {id: true, name: true}}),
    prisma.appliedServiceCharge.findMany({ where: { status: 'pending' }, include: { serviceChargeType: true } })
  ]);
  
  const currentDate = new Date();
  const overdueMembers: OverdueMemberInfo[] = members.map(member => {
    const joinDate = new Date(member.joinDate);
    const contributionPeriods = differenceInMonths(currentDate, joinDate) + 1;

    // Savings Overdue
    const totalExpectedSavings = member.memberSavingAccounts.reduce((sum, acc) => sum + (acc.expectedMonthlySaving * contributionPeriods), 0);
    const totalSavingsBalance = member.memberSavingAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    const overdueSavingsAmount = Math.max(0, totalExpectedSavings - totalSavingsBalance);

    // Shares Overdue
    const overdueSharesDetails: OverdueShareDetail[] = (member.memberShareCommitments || [])
      .map(commitment => {
        const shareType = commitment.shareType;
        if (!shareType || shareType.paymentType === 'ONCE') return null;

        const monthlyCommitted = commitment.shareType.monthlyPayment ?? 0;
        const totalExpectedShareContribution = monthlyCommitted * contributionPeriods;
        
        const totalAmountPaid = commitment.amountPaid;
        const overdueAmount = Math.max(0, totalExpectedShareContribution - totalAmountPaid);
        
        if (overdueAmount > 0) {
            return {
              shareTypeId: commitment.shareTypeId,
              shareTypeName: shareType.name,
              monthlyCommittedAmount: monthlyCommitted,
              totalExpectedContribution: totalExpectedShareContribution,
              totalAmountPaid,
              overdueAmount,
            };
        }
        return null;
      })
      .filter((d): d is OverdueShareDetail => d !== null);
      
    // Service Charges Overdue
    const pendingServiceCharges = appliedCharges
        .filter(asc => asc.memberId === member.id)
        .map(c => ({...c, dateApplied: c.dateApplied.toISOString(), serviceChargeTypeName: c.serviceChargeType.name }));
    const totalOverdueServiceCharges = pendingServiceCharges.reduce((sum, asc) => sum + asc.amountCharged, 0);

    const hasAnyOverdue = overdueSavingsAmount > 0 || overdueSharesDetails.length > 0 || totalOverdueServiceCharges > 0;

    return {
      memberId: member.id,
      fullName: member.fullName,
      schoolName: member.school?.name ?? 'N/A',
      schoolId: member.schoolId,
      joinDate: member.joinDate.toISOString(),
      expectedMonthlySaving: member.memberSavingAccounts.reduce((sum, acc) => sum + acc.expectedMonthlySaving, 0),
      savingsBalance: totalSavingsBalance,
      overdueSavingsAmount,
      overdueSharesDetails,
      pendingServiceCharges,
      totalOverdueServiceCharges,
      hasAnyOverdue,
    };
  })
  .filter(m => m.hasAnyOverdue);
  
  return {
      overdueMembers,
      schools: allSchools,
      shareTypes: allShareTypes,
  };
}

export type OverduePaymentInput = {
    memberId: string;
    memberName: string;
    savingsAmount: number;
    shareAmounts: Record<string, number>; 
    serviceChargeAmount: number;
    paymentDate: string;
    depositMode: 'Cash' | 'Bank' | 'Wallet';
    paymentDetails?: {
        sourceName?: string;
        transactionReference?: string;
        evidenceUrl?: string;
    };
};

export async function recordOverduePayment(data: OverduePaymentInput): Promise<{success: boolean}> {
    const { memberId, savingsAmount, shareAmounts, serviceChargeAmount, paymentDate, depositMode, paymentDetails } = data;
    const date = new Date(paymentDate);
    const month = format(date, 'MMMM yyyy');

    await prisma.$transaction(async (tx) => {
        // 1. Create Saving transaction if amount is provided
        if (savingsAmount > 0) {
            const primarySavingAccount = await tx.memberSavingAccount.findFirst({
                where: { memberId },
                orderBy: { createdAt: 'asc'}
            });

            if (primarySavingAccount) {
                 await tx.saving.create({
                    data: {
                        memberId,
                        memberSavingAccountId: primarySavingAccount.id,
                        amount: savingsAmount,
                        date,
                        month,
                        transactionType: 'deposit',
                        status: 'pending',
                        depositMode: depositMode,
                        notes: 'Overdue payment catch-up',
                        sourceName: paymentDetails?.sourceName,
                        transactionReference: paymentDetails?.transactionReference,
                        evidenceUrl: paymentDetails?.evidenceUrl,
                    }
                });
            }
        }
        
        // 2. Create Share transactions if amounts are provided
        if (Object.keys(shareAmounts).length > 0) {
            for (const [shareTypeId, amount] of Object.entries(shareAmounts)) {
                if (amount <= 0) continue;
                
                const commitment = await tx.memberShareCommitment.findFirst({
                    where: { memberId, shareTypeId }
                });

                if (commitment) {
                     await tx.sharePayment.create({
                        data: {
                            commitmentId: commitment.id,
                            amount: amount,
                            paymentDate: date,
                            status: 'pending',
                            depositMode: depositMode,
                            notes: 'Overdue payment catch-up',
                            sourceName: paymentDetails?.sourceName,
                            transactionReference: paymentDetails?.transactionReference,
                            evidenceUrl: paymentDetails?.evidenceUrl,
                        }
                    });
                }
            }
        }
        
        // 3. Mark service charges as paid
        if (serviceChargeAmount > 0) {
            let remainingServiceChargePayment = serviceChargeAmount;
            const chargesToPay = await tx.appliedServiceCharge.findMany({
                where: { memberId, status: 'pending' },
                orderBy: { dateApplied: 'asc' },
            });
            for (const charge of chargesToPay) {
                if (remainingServiceChargePayment <= 0) break;
                if (remainingServiceChargePayment >= charge.amountCharged) {
                    await tx.appliedServiceCharge.update({
                        where: { id: charge.id },
                        data: { status: 'paid', notes: `Paid on ${paymentDate}` },
                    });
                    remainingServiceChargePayment -= charge.amountCharged;
                }
            }
        }
    });

    revalidatePath('/overdue-payments');
    revalidatePath('/approve-transactions');
    revalidatePath('/applied-service-charges');
    revalidatePath('/savings');
    revalidatePath('/shares');
    
    return { success: true };
}
