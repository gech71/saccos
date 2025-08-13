'use server';

import prisma from '@/lib/prisma';
import type { Member, School, Saving, SharePayment } from '@prisma/client';

export type ClosedAccountWithDetails = Member & { 
  school: School | null;
  finalSavingsPayout: number;
  finalInterestPayout: number;
  finalSharesRefund: number;
};

export async function getClosedAccounts(): Promise<ClosedAccountWithDetails[]> {
  const closedMembers = await prisma.member.findMany({
    where: { status: 'inactive' },
    include: {
      school: true,
      savings: {
        where: {
          notes: {
            contains: 'on account closure',
          },
        },
      },
      sharePayments: {
          where: {
              commitmentId: 'CLOSURE_REFUND'
          }
      }
    },
    orderBy: {
      closureDate: 'desc',
    },
  });

  return closedMembers.map(member => {
    const finalInterestPayout = member.savings.find(s => s.notes?.includes('Final interest'))?.amount || 0;
    const finalSavingsPayout = member.savings.find(s => s.notes?.includes('Savings payout'))?.amount || 0;
    // Share refunds are stored as negative numbers in the payment record
    const finalSharesRefund = Math.abs(member.sharePayments.find(p => p.commitmentId === 'CLOSURE_REFUND')?.amount || 0);

    // We remove the relations from the final object as they are processed and no longer needed on the client in this shape.
    const { savings, sharePayments, ...restOfMember } = member;

    return {
      ...restOfMember,
      finalSavingsPayout,
      finalInterestPayout,
      finalSharesRefund,
    };
  });
}

    