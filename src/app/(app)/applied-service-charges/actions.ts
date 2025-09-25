

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
  try {
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
  } catch (error) {
    console.error('Failed to get applied charges data:', error);
    throw new Error('Could not load page data. Please try again later.');
  }
}

export type AppliedChargeInput = Omit<AppliedServiceCharge, 'id' | 'serviceChargeTypeName' | 'status'> & {
    dateApplied: string;
};

export async function applyServiceCharge(data: AppliedChargeInput): Promise<AppliedServiceCharge> {
  try {
    const [member, serviceChargeType] = await Promise.all([
      prisma.member.findUnique({ where: { id: data.memberId } }),
      prisma.serviceChargeType.findUnique({ where: { id: data.serviceChargeTypeId } }),
    ]);

    if (!member || !serviceChargeType) {
      throw new Error('Invalid member or service charge type. Please ensure both are selected.');
    }

    const newCharge = await prisma.appliedServiceCharge.create({
      data: {
        ...data,
        dateApplied: new Date(data.dateApplied),
        status: 'pending',
      },
    });

    revalidatePath('/applied-service-charges');
    return newCharge;
  } catch (error) {
    console.error('Failed to apply service charge:', error);
    if (error instanceof Error) {
        throw new Error(error.message);
    }
    throw new Error('An unexpected error occurred while applying the charge.');
  }
}
