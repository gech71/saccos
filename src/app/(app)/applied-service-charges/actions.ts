
'use server';

import prisma from '@/lib/prisma';
import type { AppliedServiceCharge, Member, School, ServiceChargeType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { compareAsc } from 'date-fns';

export interface MemberServiceChargeSummary {
  memberId: string;
  fullName: string;
  schoolName: string;
  schoolId: string;
  totalApplied: number;
  totalPaid: number;
  totalPending: number;
  fulfillmentPercentage: number;
}

export interface AppliedChargesPageData {
  summaries: MemberServiceChargeSummary[];
  members: Pick<Member, 'id' | 'fullName' | 'savingsAccountNumber'>[];
  serviceChargeTypes: ServiceChargeType[];
  schools: Pick<School, 'id' | 'name'>[];
}

export async function getAppliedChargesPageData(): Promise<AppliedChargesPageData> {
  const [members, serviceChargeTypes, schools, appliedCharges] = await Promise.all([
    prisma.member.findMany({ 
        where: { status: 'active' },
        include: { school: { select: { name: true } } },
    }),
    prisma.serviceChargeType.findMany({ orderBy: { name: 'asc' } }),
    prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.appliedServiceCharge.findMany(),
  ]);

  const summaries: MemberServiceChargeSummary[] = members.map(member => {
    const memberCharges = appliedCharges.filter(asc => asc.memberId === member.id);
    const totalApplied = memberCharges.reduce((sum, asc) => sum + asc.amountCharged, 0);
    const totalPaid = memberCharges
      .filter(asc => asc.status === 'paid')
      .reduce((sum, asc) => sum + asc.amountCharged, 0);
    const totalPending = totalApplied - totalPaid;
    const fulfillmentPercentage = totalApplied > 0 ? (totalPaid / totalApplied) * 100 : 100;

    return {
      memberId: member.id,
      fullName: member.fullName,
      schoolName: member.school?.name || 'N/A',
      schoolId: member.schoolId,
      totalApplied,
      totalPaid,
      totalPending,
      fulfillmentPercentage,
    };
  });

  return {
    summaries,
    members: members.map(m => ({ id: m.id, fullName: m.fullName, savingsAccountNumber: m.savingsAccountNumber })),
    serviceChargeTypes,
    schools,
  };
}

export type AppliedChargeInput = Omit<AppliedServiceCharge, 'id' | 'serviceChargeTypeName' | 'status'> & {
    dateApplied: string;
};

export async function applyServiceCharge(data: AppliedChargeInput): Promise<AppliedServiceCharge> {
  const [member, serviceChargeType] = await Promise.all([
    prisma.member.findUnique({ where: { id: data.memberId } }),
    prisma.serviceChargeType.findUnique({ where: { id: data.serviceChargeTypeId } }),
  ]);

  if (!member || !serviceChargeType) {
    throw new Error('Invalid member or service charge type.');
  }

  const newCharge = await prisma.appliedServiceCharge.create({
    data: {
      ...data,
      dateApplied: new Date(data.dateApplied),
      serviceChargeTypeName: serviceChargeType.name,
      status: 'pending',
    },
  });

  revalidatePath('/applied-service-charges');
  return newCharge;
}

export async function recordServiceChargePayment(memberId: string, amountPaid: number, paymentDate: string, depositMode: string): Promise<{ success: boolean; message: string }> {
  try {
    const pendingCharges = await prisma.appliedServiceCharge.findMany({
      where: {
        memberId,
        status: 'pending',
      },
      orderBy: {
        dateApplied: 'asc', // Pay oldest charges first
      },
    });

    if (pendingCharges.length === 0) {
      return { success: false, message: 'No pending charges found for this member.' };
    }

    let remainingPayment = amountPaid;

    await prisma.$transaction(async (tx) => {
        for (const charge of pendingCharges) {
            if (remainingPayment <= 0) break;

            if (remainingPayment >= charge.amountCharged) {
                await tx.appliedServiceCharge.update({
                    where: { id: charge.id },
                    data: { status: 'paid', notes: `Paid on ${paymentDate} via ${depositMode}` },
                });
                remainingPayment -= charge.amountCharged;
            } else {
                 // Partial payment not supported in this simplified logic.
                 // A real app might create a partial payment record.
                 // Here, we just stop if the amount doesn't cover the full charge.
            }
        }
    });

    revalidatePath('/applied-service-charges');
    return { success: true, message: `Payment of $${amountPaid.toFixed(2)} applied successfully.` };
  } catch (error) {
    console.error('Failed to record service charge payment:', error);
    return { success: false, message: 'An error occurred while recording the payment.' };
  }
}
