

'use server';

import prisma from '@/lib/prisma';
import type { Member, SavingAccountType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getAccountCreationData(): Promise<{
  members: Pick<Member, 'id' | 'fullName' | 'salary'>[];
  savingAccountTypes: SavingAccountType[];
}> {
  try {
    const [members, savingAccountTypes] = await Promise.all([
      prisma.member.findMany({
        where: { status: 'active' },
        select: { id: true, fullName: true, salary: true },
        orderBy: { fullName: 'asc' },
      }),
      prisma.savingAccountType.findMany({ orderBy: { name: 'asc' } }),
    ]);
    return { members, savingAccountTypes };
  } catch (error) {
    console.error('Failed to get account creation data:', error);
    throw new Error('Could not load required data. Please try again later.');
  }
}

interface AccountCreationData {
  memberId: string;
  savingAccountTypeId: string;
  initialBalance: number;
  expectedMonthlySaving: number;
  accountNumber: string;
}

export async function createSavingAccount(data: AccountCreationData): Promise<{ success: boolean, error?: string }> {
  try {
    const { memberId, savingAccountTypeId, initialBalance, expectedMonthlySaving, accountNumber } = data;

    const savingAccountType = await prisma.savingAccountType.findUnique({
        where: { id: savingAccountTypeId },
    });
    if (!savingAccountType) {
        return { success: false, error: 'Selected saving account type not found.' };
    }

    const existingAccount = await prisma.memberSavingAccount.findFirst({
        where: { memberId, savingAccountTypeId }
    });

    if (existingAccount) {
        return { success: false, error: `This member already has a '${savingAccountType.name}' account.` };
    }

    const finalAccountNumber = accountNumber || `SA${Math.floor(100000 + Math.random() * 900000)}`;
    
    if (accountNumber) {
      const existingByAcctNo = await prisma.memberSavingAccount.findFirst({
          where: { accountNumber: accountNumber }
      });
      if (existingByAcctNo) {
          return { success: false, error: `Account number ${accountNumber} is already in use.` };
      }
    }
    
    if (initialBalance < 0) {
        return { success: false, error: `Initial balance cannot be negative.` };
    }

    // Create the new MemberSavingAccount with the initial balance set directly.
    await prisma.memberSavingAccount.create({
      data: {
        memberId,
        savingAccountTypeId,
        accountNumber: finalAccountNumber,
        expectedMonthlySaving,
        initialBalance: initialBalance,
        balance: initialBalance, // Set the current balance to the initial balance
      }
    });

    revalidatePath('/members');
    revalidatePath('/savings-accounts');
    revalidatePath('/savings');
    return { success: true };
  } catch (error) {
      console.error('Failed to create saving account:', error);
      if (error instanceof Error) {
          return { success: false, error: error.message };
      }
      return { success: false, error: 'An unexpected error occurred while creating the account.' };
  }
}
