

'use server';

import prisma from '@/lib/prisma';
import type { Member } from '@prisma/client';
import bcrypt from 'bcryptjs';

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


export async function verifyMemberCredentials(data: {phoneNumber: string, password?: string}): Promise<{ success: boolean; member?: Member; error?: string; }> {
    const memberResult = await prisma.member.findFirst({ where: {phoneNumber: data.phoneNumber}});
      
    if (!memberResult) {
        return { success: false, error: 'Phone number not found.' };
    }
    
    if (!memberResult.password) {
        return { success: false, error: 'This member account is not yet configured for password login.' };
    }
    
    const passwordMatch = await bcrypt.compare(data.password || '', memberResult.password);

    if (!passwordMatch) {
        return { success: false, error: 'Incorrect password.' };
    }

    return { success: true, member: memberResult };
}

