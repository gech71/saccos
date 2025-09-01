

'use server';

import prisma from '@/lib/prisma';
import type { Member, Loan, School, LoanType, AppliedServiceCharge, Prisma, ServiceChargeType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

function roundToTwo(num: number) {
    return Math.round(num * 100) / 100;
}

export interface CalculationPageData {
    members: Pick<Member, 'id' | 'fullName'>[];
    schools: Pick<School, 'id', 'name'>[];
    loanTypes: Pick<LoanType, 'id', 'name'>[];
    serviceChargeTypes: Pick<ServiceChargeType, 'id' | 'name'>[];
}

export interface InterestCalculationResult {
  loanId: string;
  memberId: string;
  fullName: string;
  loanAccountNumber?: string | null;
  remainingBalance: number;
  interestRate: number;
  calculatedInterest: number;
}

export async function getCalculationPageData(): Promise<CalculationPageData> {
    const [members, schools, loanTypes, serviceChargeTypes] = await Promise.all([
        prisma.member.findMany({ where: { status: 'active'}, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
        prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.loanType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.serviceChargeType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return { members, schools, loanTypes, serviceChargeTypes };
}

export async function calculateInterest(criteria: {
  scope: 'all' | 'school' | 'member' | 'loanType';
  schoolId?: string;
  memberId?: string;
  loanTypeId?: string;
}): Promise<InterestCalculationResult[]> {
  const { scope, schoolId, memberId, loanTypeId } = criteria;
  
  let whereClause: Prisma.LoanWhereInput = {
    OR: [
      { status: 'active' },
      { status: 'overdue' }
    ],
    remainingBalance: { gt: 0 },
    interestRate: { gt: 0 }
  };

  if (scope === 'school' && schoolId) {
    whereClause.member = { schoolId: schoolId };
  } else if (scope === 'member' && memberId) {
    whereClause.memberId = memberId;
  } else if (scope === 'loanType' && loanTypeId) {
    whereClause.loanTypeId = loanTypeId;
  }

  const loansToProcess = await prisma.loan.findMany({
    where: whereClause,
    include: { member: { select: { fullName: true } } },
  });

  const results: InterestCalculationResult[] = loansToProcess.map(loan => {
    const monthlyRate = loan.interestRate / 12;
    const calculatedInterest = roundToTwo(loan.remainingBalance * monthlyRate);

    return {
      loanId: loan.id,
      memberId: loan.memberId,
      fullName: loan.member.fullName,
      loanAccountNumber: loan.loanAccountNumber,
      remainingBalance: loan.remainingBalance,
      interestRate: loan.interestRate,
      calculatedInterest,
    };
  }).filter(res => res.calculatedInterest > 0);

  return results;
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export async function postInterestCharges(
    charges: InterestCalculationResult[], 
    period: { month: string, year: string },
    serviceChargeTypeIdForInterest: string
): Promise<{ success: boolean; message: string }> {
  
  if (!serviceChargeTypeIdForInterest) {
    return { success: false, message: 'You must select a service charge type to post loan interest.' };
  }

  const loanInterestChargeType = await prisma.serviceChargeType.findUnique({
    where: { id: serviceChargeTypeIdForInterest },
  });

  if (!loanInterestChargeType) {
    return { success: false, message: 'The selected service charge type for interest was not found.' };
  }

  const monthIndex = parseInt(period.month, 10);
  const year = parseInt(period.year, 10);
  const monthName = monthNames[monthIndex];

  if (isNaN(monthIndex) || isNaN(year) || !monthName) {
      return { success: false, message: 'Invalid period provided. Could not parse month or year.' };
  }
  
  const dateApplied = new Date(year, monthIndex + 1, 0); // Last day of the selected month

  try {
    await prisma.appliedServiceCharge.createMany({
      data: charges.map(result => ({
        memberId: result.memberId,
        serviceChargeTypeId: loanInterestChargeType.id,
        amountCharged: result.calculatedInterest, // Already rounded
        dateApplied: dateApplied,
        status: 'pending',
        notes: `Monthly loan interest for ${monthName} ${period.year} on Loan ${result.loanAccountNumber}`,
      })),
      skipDuplicates: true // Avoid re-posting if this logic is run multiple times
    });

    revalidatePath('/applied-service-charges');
    return { success: true, message: `${charges.length} loan interest charges have been submitted as service charges.` };
  } catch (error) {
    console.error("Failed to post interest charges:", error);
    return { success: false, message: "An error occurred while posting charges." };
  }
}
