
'use server';

import prisma from '@/lib/prisma';
import type { School, Share, Saving, Member, ShareType, MemberShareCommitment, AppliedServiceCharge, ServiceChargeType } from '@prisma/client';
import { differenceInMonths, parseISO, format, compareDesc } from 'date-fns';

export interface OverdueShareDetail {
  shareTypeId: string;
  shareTypeName: string;
  monthlyCommittedAmount: number;
  totalExpectedContribution: number;
  totalAllocatedValue: number;
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
  pendingServiceCharges: AppliedServiceCharge[];
  totalOverdueServiceCharges: number;
  hasAnyOverdue: boolean;
}

export interface OverduePageData {
    overdueMembers: OverdueMemberInfo[];
    schools: Pick<School, 'id', 'name'>[];
    shareTypes: Pick<ShareType, 'id' | 'name'>[];
}


export async function getOverduePaymentsPageData(): Promise<OverduePageData> {
  const [members, allShares, allShareTypes, allSchools, appliedCharges] = await Promise.all([
    prisma.member.findMany({ 
        where: { status: 'active' },
        include: { school: { select: { name: true }}, shareCommitments: true }
    }),
    prisma.share.findMany({ where: { status: 'approved' }}),
    prisma.shareType.findMany(),
    prisma.school.findMany({ select: {id: true, name: true}}),
    prisma.appliedServiceCharge.findMany({ where: { status: 'pending' }, include: { serviceChargeType: true } })
  ]);
  
  const currentDate = new Date();
  const overdueMembers: OverdueMemberInfo[] = members.map(member => {
    const joinDate = new Date(member.joinDate);
    const contributionPeriods = differenceInMonths(currentDate, joinDate) + 1;

    // Savings Overdue
    const expectedMonthlySaving = member.expectedMonthlySaving ?? 0;
    const totalExpectedSavings = expectedMonthlySaving * contributionPeriods;
    const overdueSavingsAmount = Math.max(0, totalExpectedSavings - member.savingsBalance);

    // Shares Overdue
    const overdueSharesDetails: OverdueShareDetail[] = (member.shareCommitments || [])
      .map(commitment => {
        const shareType = allShareTypes.find(st => st.id === commitment.shareTypeId);
        if (!shareType) return null;
        const monthlyCommitted = commitment.monthlyCommittedAmount ?? 0;
        const totalExpectedShareContribution = monthlyCommitted * contributionPeriods;
        const memberSharesOfType = allShares.filter(s => s.memberId === member.id && s.shareTypeId === commitment.shareTypeId);
        const totalAllocatedValue = memberSharesOfType.reduce((sum, s) => sum + (s.totalValueForAllocation ?? (s.count * s.valuePerShare)), 0);
        const overdueAmount = Math.max(0, totalExpectedShareContribution - totalAllocatedValue);
        
        if (overdueAmount > 0) {
            return {
              shareTypeId: commitment.shareTypeId,
              shareTypeName: shareType.name,
              monthlyCommittedAmount: monthlyCommitted,
              totalExpectedContribution: totalExpectedShareContribution,
              totalAllocatedValue,
              overdueAmount,
            };
        }
        return null;
      })
      .filter((d): d is OverdueShareDetail => d !== null);
      
    // Service Charges Overdue
    const pendingServiceCharges = appliedCharges.filter(asc => asc.memberId === member.id).map(c => ({...c, dateApplied: c.dateApplied.toISOString()}));
    const totalOverdueServiceCharges = pendingServiceCharges.reduce((sum, asc) => sum + asc.amountCharged, 0);

    const hasAnyOverdue = overdueSavingsAmount > 0 || overdueSharesDetails.length > 0 || totalOverdueServiceCharges > 0;

    return {
      memberId: member.id,
      fullName: member.fullName,
      schoolName: member.school?.name ?? 'N/A',
      schoolId: member.schoolId,
      joinDate: member.joinDate.toISOString(),
      expectedMonthlySaving,
      savingsBalance: member.savingsBalance,
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
      shareTypes: allShareTypes.map(st => ({id: st.id, name: st.name})),
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
    const { memberId, memberName, savingsAmount, shareAmounts, serviceChargeAmount, paymentDate, depositMode, paymentDetails } = data;
    const date = new Date(paymentDate);
    const month = format(date, 'MMMM yyyy');

    await prisma.$transaction(async (tx) => {
        // 1. Create Saving transaction if amount is provided
        if (savingsAmount > 0) {
            await tx.saving.create({
                data: {
                    memberId,
                    memberName,
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
        
        // 2. Create Share transactions if amounts are provided
        if (Object.keys(shareAmounts).length > 0) {
            const shareTypeIds = Object.keys(shareAmounts);
            const shareTypes = await tx.shareType.findMany({ where: { id: { in: shareTypeIds } } });
            const shareTypeMap = new Map(shareTypes.map(st => [st.id, st]));

            for (const [shareTypeId, amount] of Object.entries(shareAmounts)) {
                if (amount <= 0) continue;
                const shareType = shareTypeMap.get(shareTypeId);
                if (!shareType || shareType.valuePerShare <= 0) continue;

                const count = Math.floor(amount / shareType.valuePerShare);
                if (count > 0) {
                    await tx.share.create({
                        data: {
                            memberId,
                            memberName,
                            shareTypeId,
                            shareTypeName: shareType.name,
                            count,
                            allocationDate: date,
                            valuePerShare: shareType.valuePerShare,
                            status: 'pending',
                            contributionAmount: amount,
                            totalValueForAllocation: count * shareType.valuePerShare,
                            notes: 'Overdue payment catch-up',
                            depositMode,
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
