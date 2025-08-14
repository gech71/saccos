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
    },
    orderBy: {
      closureDate: 'desc',
    },
  });

  const memberIds = closedMembers.map(m => m.id);

  const closureSavings = await prisma.saving.findMany({
      where: {
          memberId: { in: memberIds },
          notes: {
              contains: 'on account closure'
          }
      }
  });

  return closedMembers.map(member => {
    const memberSavings = closureSavings.filter(s => s.memberId === member.id);
    
    const finalInterestPayout = memberSavings.find(s => s.notes?.includes('Final interest'))?.amount || 0;
    
    const finalSavingsPayout = memberSavings.find(s => s.notes?.includes('Savings payout'))?.amount || 0;
    
    // Find the specific withdrawal transaction for the share refund
    const finalSharesRefund = memberSavings.find(s => s.notes?.includes('Share refund'))?.amount || 0;

    return {
      ...member,
      finalSavingsPayout,
      finalInterestPayout,
      finalSharesRefund,
    };
  });
}
