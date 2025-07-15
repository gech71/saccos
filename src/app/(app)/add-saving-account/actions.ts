
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
  accountNumber: string;
}

export async function createSavingAccount(data: AccountCreationData) {
  const { memberId, savingAccountTypeId, initialBalance, accountNumber } = data;

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    throw new Error('Member not found.');
  }

  // Use provided account number or generate a new one
  const finalAccountNumber = accountNumber || `SA-${Date.now().toString().slice(-6)}`;
  
  // Check if this account number is already in use
  if (accountNumber) {
    const existingAccount = await prisma.member.findUnique({
        where: { savingsAccountNumber: accountNumber }
    });
    if (existingAccount && existingAccount.id !== memberId) {
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
    // Update member with the new primary account information
    await tx.member.update({
      where: { id: memberId },
      data: {
        savingAccountTypeId: savingAccountTypeId,
        savingsAccountNumber: finalAccountNumber,
        expectedMonthlySaving: savingAccountType.expectedMonthlyContribution ?? 0,
      },
    });

    // If there's an initial balance, create a pending deposit transaction
    if (initialBalance > 0) {
      await tx.saving.create({
        data: {
          memberId: memberId,
          amount: initialBalance,
          date: new Date(),
          month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
          transactionType: 'deposit',
          status: 'pending',
          notes: `Initial deposit for new account #${finalAccountNumber}`,
          depositMode: 'Bank', // Assume initial deposits are system-level/bank
          sourceName: 'System Opening Balance',
        },
      });
    }
  });

  revalidatePath('/members');
  revalidatePath('/savings-accounts');
  revalidatePath('/savings');
  revalidatePath('/approve-transactions');
}
