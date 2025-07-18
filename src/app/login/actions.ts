
'use server';

import prisma from '@/lib/prisma';

export async function findMemberByPhoneNumber(phoneNumber: string): Promise<{ memberId: string | null; error: string | null }> {
  if (!phoneNumber) {
    return { memberId: null, error: 'Phone number is required.' };
  }

  const member = await prisma.member.findFirst({
    where: {
      phoneNumber: phoneNumber.trim(),
    },
  });

  if (member) {
    return { memberId: member.id, error: null };
  } else {
    return { memberId: null, error: 'Phone number not registered.' };
  }
}
