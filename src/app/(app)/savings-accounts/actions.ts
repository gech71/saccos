
'use server';

import prisma from '@/lib/prisma';
import type { Prisma, School } from '@prisma/client';
import { differenceInMonths } from 'date-fns';

export interface MemberSavingsSummary {
  memberId: string;
  fullName: string;
  schoolName: string;
  schoolId: string;
  savingsBalance: number;
  savingsAccountNumber: string | null;
  savingAccountTypeName: string | null;
  fulfillmentPercentage: number;
  expectedMonthlySaving: number;
}

export interface SavingsAccountPageData {
  summaries: MemberSavingsSummary[];
  schools: Pick<School, 'id', 'name'>[];
}

export async function getSavingsAccountPageData(): Promise<SavingsAccountPageData> {
  const whereClause: Prisma.MemberWhereInput = {
    status: 'active'
  };

  const [members, schools] = await Promise.all([
    prisma.member.findMany({
      where: whereClause,
      include: {
        school: { select: { name: true } },
        savingAccountType: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    }),
    prisma.school.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const summaries: MemberSavingsSummary[] = members.map(member => {
    const { savingsBalance, expectedMonthlySaving, joinDate, savingAccountType } = member;
    const joinDateObj = new Date(joinDate);
    const currentDate = new Date();
    
    let contributionPeriods = 0;
    if (joinDateObj <= currentDate) {
      contributionPeriods = differenceInMonths(currentDate, joinDateObj) + 1;
    }
    contributionPeriods = Math.max(0, contributionPeriods);

    const totalExpected = (expectedMonthlySaving || 0) * contributionPeriods;
    
    // Calculate fulfillment. If balance exceeds expected, it's >100%, but we cap at 100 for a clearer progress bar.
    // If no expected contribution, fulfillment is 100% if they have any balance, otherwise 0%.
    let fulfillmentPercentage = 0;
    if (totalExpected > 0) {
        fulfillmentPercentage = (savingsBalance / totalExpected) * 100;
    } else if (savingsBalance > 0) {
        fulfillmentPercentage = 100;
    }

    return {
      memberId: member.id,
      fullName: member.fullName,
      schoolName: member.school?.name ?? 'N/A',
      schoolId: member.schoolId,
      savingsBalance,
      savingsAccountNumber: member.savingsAccountNumber,
      savingAccountTypeName: savingAccountType?.name ?? 'N/A',
      fulfillmentPercentage,
      expectedMonthlySaving: expectedMonthlySaving ?? 0,
    };
  });

  return {
    summaries,
    schools,
  };
}
