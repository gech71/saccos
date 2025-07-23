

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
        const { balance, expectedMonthlySaving, member, savingAccountType, createdAt, initialBalance } = account;
        const accountCreationDate = new Date(createdAt);
        const currentDate = new Date();
        
        let contributionPeriods = 0;
        if (accountCreationDate <= currentDate) {
            contributionPeriods = differenceInMonths(currentDate, accountCreationDate); // +1 is not needed if we want full months passed
        }
        contributionPeriods = Math.max(0, contributionPeriods);

        const totalExpected = (expectedMonthlySaving || 0) * contributionPeriods;
        
        // The amount contributed is the current balance minus the initial balance.
        const totalContributed = balance - initialBalance;
        
        let fulfillmentPercentage = 0;
        if (totalExpected > 0) {
            fulfillmentPercentage = (totalContributed / totalExpected) * 100;
        } else if (totalContributed > 0) {
            fulfillmentPercentage = 100; // If no expected contribution but has contributed, they've fulfilled 100% of "nothing"
        } else if (totalExpected === 0 && totalContributed === 0) {
            fulfillmentPercentage = 100; // Fulfilled 100% of a zero expectation
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
