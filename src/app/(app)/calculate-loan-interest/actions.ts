
'use server';

import prisma from '@/lib/prisma';
import type { Member, Loan, School, LoanType, AppliedServiceCharge, Prisma, ServiceChargeType, LoanRepayment } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/authorization';
import { eachMonthOfInterval, startOfMonth, endOfMonth, format, parse, differenceInMonths } from 'date-fns';

function roundToTwo(num: number) {
    return Math.round(num * 100) / 100;
}

export interface CalculationPageData {
    members: Pick<Member, 'id' | 'fullName' | 'memberId'>[];
    schools: Pick<School, 'id' | 'name'>[];
    loanTypes: Pick<LoanType, 'id' | 'name'>[];
    serviceChargeTypes: Pick<ServiceChargeType, 'id' | 'name'>[];
}

export interface InterestCalculationResult {
  loanId: string;
  memberId: string;
  fullName: string;
  loanAccountNumber?: string | null;
  principalPaid: number;
  interestPaid: number;
  month: string;
}

export async function calculateInterest(criteria: {
  scope: 'all' | 'school' | 'member' | 'loanType';
  schoolId?: string;
  memberId?: string;
  loanTypeId?: string;
}, period: { month: string, year: string }): Promise<InterestCalculationResult[]> {
  const { scope, schoolId, memberId, loanTypeId } = criteria;
  
  let memberWhereClause: Prisma.MemberWhereInput = { status: 'active' };
  if (scope === 'school' && schoolId) {
    memberWhereClause.schoolId = schoolId;
  } else if (scope === 'member' && memberId) {
    memberWhereClause.id = memberId;
  }

  const members = await prisma.member.findMany({
    where: memberWhereClause,
    select: { id: true, fullName: true }
  });
  const memberIds = members.map(m => m.id);

  let loanWhereClause: Prisma.LoanWhereInput = {
    memberId: { in: memberIds },
    status: { in: ['active', 'overdue', 'paid_off'] },
  };

  if (scope === 'loanType' && loanTypeId) {
    loanWhereClause.loanTypeId = loanTypeId;
  }
  
  try {
    const loansToProcess = await prisma.loan.findMany({
      where: loanWhereClause,
      include: { 
        member: { select: { fullName: true } },
        repayments: { 
            where: { status: 'approved' },
            orderBy: { paymentDate: 'asc' }
        }
      },
    });
    
    // Create a map of repayments by loan and month for efficient lookup
    const repaymentMap = new Map<string, Map<string, { principal: number, interest: number }>>();
    loansToProcess.forEach(loan => {
      const loanRepayments = new Map<string, { principal: number, interest: number }>();
      loan.repayments.forEach(repayment => {
        const monthKey = format(new Date(repayment.paymentDate), 'yyyy-MM');
        const existing = loanRepayments.get(monthKey) || { principal: 0, interest: 0 };
        existing.principal += repayment.principalPaid;
        existing.interest += repayment.interestPaid;
        loanRepayments.set(monthKey, existing);
      });
      repaymentMap.set(loan.id, loanRepayments);
    });

    const results: InterestCalculationResult[] = [];
    const calculationStartDate = startOfMonth(new Date(parseInt(period.year), parseInt(period.month)));
    
    loansToProcess.forEach(loan => {
      const disbursementDate = new Date(loan.disbursementDate);
      // Skip loans disbursed after the calculation period
      if (disbursementDate > calculationStartDate) return;

      const firstRepaymentDate = loan.repayments.length > 0 ? new Date(loan.repayments[0].paymentDate) : disbursementDate;

      // Determine the months to iterate over for this specific loan
      const start = startOfMonth(firstRepaymentDate);
      const end = endOfMonth(new Date()); // up to current date
      const monthIntervals = eachMonthOfInterval({ start, end });
      
      monthIntervals.forEach(monthDate => {
          const monthKey = format(monthDate, 'yyyy-MM');
          const repaymentForMonth = repaymentMap.get(loan.id)?.get(monthKey);
          
          results.push({
            loanId: loan.id,
            memberId: loan.memberId,
            fullName: loan.member.fullName,
            loanAccountNumber: loan.loanAccountNumber,
            principalPaid: repaymentForMonth?.principal || 0,
            interestPaid: repaymentForMonth?.interest || 0,
            month: format(monthDate, 'MMMM yyyy'),
          });
      });
    });

    return results.sort((a, b) => {
        if (a.fullName < b.fullName) return -1;
        if (a.fullName > b.fullName) return 1;
        const dateA = parse(a.month, 'MMMM yyyy', new Date());
        const dateB = parse(b.month, 'MMMM yyyy', new Date());
        return dateA.getTime() - dateB.getTime();
    });

  } catch (error) {
      console.error('Failed to calculate loan interest:', error);
      throw new Error('An unexpected error occurred during loan interest calculation.');
  }
}

export type AmortizationRow = {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
};

// Moved the pure calculation helper to `src/lib/loan-calculations.ts` so it can
// be used on the client without being treated as a Server Action.

export async function getCalculationPageData(): Promise<CalculationPageData> {
  await requirePermission('loanInterestCalculation:view');
  const [members, schools, loanTypes, serviceChargeTypes] = await Promise.all([
    prisma.member.findMany({ where: { status: 'active' }, select: { id: true, fullName: true, memberId: true }, orderBy: { fullName: 'asc' } }),
    prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.loanType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.serviceChargeType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  return { members, schools, loanTypes, serviceChargeTypes };
}


const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export async function postInterestCharges(
    charges: { loanId: string; memberId: string; calculatedInterest: number }[], 
    period: { month: string, year: string },
    serviceChargeTypeIdForInterest: string
): Promise<{ success: boolean; message: string }> {
  // Authorization: ensure caller has permission to create service charge records
  await requirePermission('serviceCharge:create');

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
    const chargesToCreate = charges.filter(c => c.calculatedInterest > 0);
    
    if (chargesToCreate.length === 0) {
      return { success: true, message: 'No interest charges to post.' };
    }

    await prisma.appliedServiceCharge.createMany({
      data: chargesToCreate.map(result => ({
        memberId: result.memberId,
        serviceChargeTypeId: loanInterestChargeType.id,
        amountCharged: roundToTwo(result.calculatedInterest),
        dateApplied: dateApplied,
        status: 'pending',
        notes: `Monthly loan interest for ${monthName} ${period.year} on Loan ID ${result.loanId}`,
      })),
      skipDuplicates: true // Avoid re-posting if this logic is run multiple times
    });

    revalidatePath('/applied-service-charges');
    revalidatePath('/approve-transactions');
    return { success: true, message: `${chargesToCreate.length} loan interest charges have been submitted as service charges.` };
  } catch (error) {
    console.error("Failed to post interest charges:", error);
    throw new Error("An unexpected error occurred while posting interest charges.");
  }
}
