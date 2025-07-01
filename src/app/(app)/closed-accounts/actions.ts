'use server';

import prisma from '@/lib/prisma';
import type { Member, School } from '@prisma/client';

export type ClosedAccountWithSchool = Member & { school: School | null };

export async function getClosedAccounts(): Promise<ClosedAccountWithSchool[]> {
  return prisma.member.findMany({
    where: { status: 'inactive' },
    include: {
      school: true,
    },
    orderBy: {
      closureDate: 'desc',
    },
  });
}
