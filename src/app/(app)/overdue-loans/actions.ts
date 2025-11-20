
'use server';

import prisma from '@/lib/prisma';
import type { Loan, School, Member } from '@prisma/client';
import { differenceInDays } from 'date-fns';
import { requirePermission } from '@/lib/authorization';

export interface OverdueLoanInfo extends Loan {
  daysOverdue: number;
  memberName: string;
}

export interface OverdueLoansPageData {
  overdueLoans: OverdueLoanInfo[];
  schools: Pick<School, 'id', 'name'>[];
}

export async function getOverdueLoansPageData(): Promise<OverdueLoansPageData> {
  try {
    await requirePermission('overdueLoan:view');
  } catch (err) {
    return { overdueLoans: [], schools: [] };
  }
  const today = new Date();
  const loans = await prisma.loan.findMany({
    where: {
      OR: [
        { status: 'overdue' },
        { 
          status: 'active',
          nextDueDate: {
            lt: today,
          }
        },
      ],
    },
    include: {
      member: {
        select: {
          fullName: true,
        },
      },
      loanType: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      nextDueDate: 'asc',
    },
  });

  const overdueLoans: OverdueLoanInfo[] = loans.map(loan => ({
    ...loan,
    disbursementDate: loan.disbursementDate.toISOString(),
    nextDueDate: loan.nextDueDate?.toISOString() ?? null,
    daysOverdue: loan.nextDueDate ? differenceInDays(today, loan.nextDueDate) : 0,
    memberName: loan.member.fullName,
    loanTypeName: loan.loanType.name,
  }));

  const schools = await prisma.school.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
  });

  return { overdueLoans, schools };
}
