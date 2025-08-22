

'use server';

import prisma from '@/lib/prisma';
import type { Member } from '@prisma/client';

export async function findMemberByPhoneNumber(phoneNumber: string): Promise<Member | null> {
  if (!phoneNumber) {
    return null;
  }

  const member = await prisma.member.findFirst({
    where: {
      phoneNumber: phoneNumber.trim(),
    },
  });

  return member;
}
