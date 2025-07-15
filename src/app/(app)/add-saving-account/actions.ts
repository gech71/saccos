

'use server';

import prisma from '@/lib/prisma';
import type { Member, SavingAccountType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getAccountCreationData(): Promise<{
  members: Pick<Member, 'id' | 'fullName'>[];
  savingAccountTypes: SavingAccountType[];
}> {
  const [members, savingAccountTypes] = await Promise.all([
    prisma.member.findMany({
      where: { status: 'active' },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.savingAccountType.findMany({ orderBy: { name: 'asc' } }),
  ]);
  return { members, savingAccountTypes };
}

interface AccountCreationData {
  memberId: string;
  savingAccountTypeId: string;
  initialBalance: number;
  expectedMonthlySaving: number;
  accountNumber: string;
}

export async function createSavingAccount(data: AccountCreationData) {
  const { memberId, savingAccountTypeId, initialBalance, expectedMonthlySaving, accountNumber } = data;

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    throw new Error('Member not found.');
  }

  // Use provided account number or generate a new one if the member doesn't have one
  const finalAccountNumber = accountNumber || member.savingsAccountNumber || `SA-${Date.now().toString().slice(-6)}`;
  
  // Check if this account number is already in use by another member
  if (accountNumber) {
    const existingAccount = await prisma.member.findFirst({
        where: { 
            savingsAccountNumber: accountNumber,
            id: { not: memberId }
        }
    });
    if (existingAccount) {
        throw new Error(`Account number ${accountNumber} is already assigned to another member.`);
    }
  }

  const savingAccountType = await prisma.savingAccountType.findUnique({
      where: { id: savingAccountTypeId },
  });
  if (!savingAccountType) {
      throw new Error('Selected saving account type not found.');
  }

  await prisma.$transaction(async (tx) => {
    // If there's an initial balance, create a pending deposit transaction.
    // This is the core action now, rather than updating the member directly.
    if (initialBalance > 0) {
      await tx.saving.create({
        data: {
          memberId: memberId,
          amount: initialBalance,
          date: new Date(),
          month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
          transactionType: 'deposit',
          status: 'pending',
          notes: `Initial deposit for new account #${finalAccountNumber} (${savingAccountType.name})`,
          depositMode: 'Bank', // Assume initial deposits are system-level/bank
          sourceName: 'System Opening Balance',
        },
      });
    }

    // Update the member's primary account details only if they don't have one set.
    // This logic can be expanded in the future to manage multiple accounts.
    if (!member.savingAccountTypeId) {
        await tx.member.update({
            where: { id: memberId },
            data: {
                savingAccountTypeId: savingAccountTypeId,
                savingsAccountNumber: finalAccountNumber,
                expectedMonthlySaving: expectedMonthlySaving,
            },
        });
    }
  });

  revalidatePath('/members');
  revalidatePath('/savings-accounts');
  revalidatePath('/savings');
  revalidatePath('/approve-transactions');
}
