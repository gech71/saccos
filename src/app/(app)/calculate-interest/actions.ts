
'use server';

import prisma from '@/lib/prisma';
import type { Member, SavingAccountType, School, Saving, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export interface CalculationPageData {
    members: Pick<Member, 'id' | 'fullName' | 'savingsAccountNumber'>[];
    schools: Pick<School, 'id' | 'name'>[];
    savingAccountTypes: Pick<SavingAccountType, 'id' | 'name' | 'interestRate'>[];
}

export interface InterestCalculationResult {
  memberId: string;
  fullName: string;
  savingsAccountNumber?: string | null;
  savingsBalance: number;
  interestRate: number;
  calculatedInterest: number;
}

export async function getCalculationPageData(): Promise<CalculationPageData> {
    const [members, schools, savingAccountTypes] = await Promise.all([
        prisma.member.findMany({ 
            where: { status: 'active' },
            select: { id: true, fullName: true, savingsAccountNumber: true }, 
            orderBy: { fullName: 'asc' } 
        }),
        prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.savingAccountType.findMany({ select: { id: true, name: true, interestRate: true }, orderBy: { name: 'asc' } }),
    ]);
    return { members, schools, savingAccountTypes };
}

export async function calculateInterest(criteria: {
  scope: 'all' | 'school' | 'member' | 'accountType';
  schoolId?: string;
  memberId?: string;
  accountTypeId?: string;
}): Promise<InterestCalculationResult[]> {
  const { scope, schoolId, memberId, accountTypeId } = criteria;
  
  let whereClause: Prisma.MemberWhereInput = {
    status: 'active',
    savingsBalance: { gt: 0 },
    savingAccountType: {
        interestRate: { gt: 0 }
    }
  };

  if (scope === 'school' && schoolId) {
    whereClause.schoolId = schoolId;
  } else if (scope === 'member' && memberId) {
    whereClause.id = memberId;
  } else if (scope === 'accountType' && accountTypeId) {
    whereClause.savingAccountTypeId = accountTypeId;
  }

  const membersToProcess = await prisma.member.findMany({
    where: whereClause,
    include: { savingAccountType: true },
  });

  const results: InterestCalculationResult[] = membersToProcess.map(member => {
    if (!member.savingAccountType) return null;

    const monthlyRate = member.savingAccountType.interestRate / 12;
    const calculatedInterest = member.savingsBalance * monthlyRate;

    return {
      memberId: member.id,
      fullName: member.fullName,
      savingsAccountNumber: member.savingsAccountNumber,
      savingsBalance: member.savingsBalance,
      interestRate: member.savingAccountType.interestRate,
      calculatedInterest,
    };
  }).filter((res): res is InterestCalculationResult => res !== null && res.calculatedInterest > 0);

  return results;
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export async function postInterestTransactions(
    transactions: InterestCalculationResult[],
    period: { month: string, year: string }
): Promise<{ success: boolean; message: string }> {
    if (transactions.length === 0) {
        return { success: false, message: 'No interest transactions to post.' };
    }

    const monthIndex = parseInt(period.month, 10);
    const year = parseInt(period.year, 10);
    const monthName = monthNames[monthIndex];

    if (isNaN(monthIndex) || isNaN(year) || !monthName) {
        return { success: false, message: 'Invalid period provided. Could not parse month or year.' };
    }

    try {
        const newInterestTransactionsData: Prisma.SavingCreateManyInput[] = transactions.map(result => ({
          memberId: result.memberId,
          amount: result.calculatedInterest,
          date: new Date(year, monthIndex + 1, 0), // Last day of the selected month
          month: `${monthName} ${period.year}`,
          transactionType: 'deposit',
          status: 'pending',
          notes: `Monthly interest posting for ${monthName} ${period.year}`,
          depositMode: 'Bank', // System-generated
          sourceName: 'Internal System Posting',
          transactionReference: `INT-${period.year}${(monthIndex + 1).toString().padStart(2, '0')}-${result.memberId.slice(-8)}`,
          evidenceUrl: null
        }));

        await prisma.saving.createMany({
            data: newInterestTransactionsData,
            skipDuplicates: true,
        });

        revalidatePath('/savings');
        revalidatePath('/approve-transactions');

        return { success: true, message: `${transactions.length} interest transactions have been submitted for approval.` };
    } catch (error) {
        console.error("Failed to post interest transactions:", error);
        return { success: false, message: 'An error occurred while posting interest transactions.' };
    }
}
