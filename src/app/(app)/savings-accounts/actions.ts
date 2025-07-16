
'use server';

import prisma from '@/lib/prisma';
import type { Prisma, School, MemberSavingAccount } from '@prisma/client';
import { differenceInMonths } from 'date-fns';

export interface SavingsAccountSummary {
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
  summaries: SavingsAccountSummary[];
  schools: Pick<School, 'id', 'name'>[];
}

export async function getSavingsAccountPageData(): Promise<SavingsAccountPageData> {
  const [memberSavingAccounts, schools] = await Promise.all([
    prisma.memberSavingAccount.findMany({
      include: {
        member: {
          include: {
            school: { select: { name: true } },
          },
        },
        savingAccountType: { select: { name: true } },
      },
      orderBy: { member: { fullName: 'asc' } },
    }),
    prisma.school.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const summaries: SavingsAccountSummary[] = memberSavingAccounts
    .filter(account => account.member.status === 'active')
    .map(account => {
        const { balance, expectedMonthlySaving, member, savingAccountType } = account;
        const joinDateObj = new Date(member.joinDate);
        const currentDate = new Date();
        
        let contributionPeriods = 0;
        if (joinDateObj <= currentDate) {
        contributionPeriods = differenceInMonths(currentDate, joinDateObj) + 1;
        }
        contributionPeriods = Math.max(0, contributionPeriods);

        const totalExpected = (expectedMonthlySaving || 0) * contributionPeriods;
        
        let fulfillmentPercentage = 0;
        if (totalExpected > 0) {
            fulfillmentPercentage = (balance / totalExpected) * 100;
        } else if (balance > 0) {
            fulfillmentPercentage = 100;
        }

        return {
        memberId: member.id,
        fullName: member.fullName,
        schoolName: member.school?.name ?? 'N/A',
        schoolId: member.schoolId,
        savingsBalance: balance,
        savingsAccountNumber: account.accountNumber,
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
