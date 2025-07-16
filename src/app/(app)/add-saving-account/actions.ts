

'use server';

import prisma from '@/lib/prisma';
import type { Member, SavingAccountType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getAccountCreationData(): Promise<{
  members: Pick<Member, 'id' | 'fullName' | 'salary'>[];
  savingAccountTypes: SavingAccountType[];
}> {
  const [members, savingAccountTypes] = await Promise.all([
    prisma.member.findMany({
      where: { status: 'active' },
      select: { id: true, fullName: true, salary: true },
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

  const savingAccountType = await prisma.savingAccountType.findUnique({
      where: { id: savingAccountTypeId },
  });
  if (!savingAccountType) {
      throw new Error('Selected saving account type not found.');
  }

  const existingAccount = await prisma.memberSavingAccount.findFirst({
      where: { memberId, savingAccountTypeId }
  });

  if (existingAccount) {
      throw new Error(`This member already has a '${savingAccountType.name}' account.`);
  }

  const finalAccountNumber = accountNumber || `SA-${Date.now().toString().slice(-6)}`;
  
  if (accountNumber) {
    const existingByAcctNo = await prisma.memberSavingAccount.findFirst({
        where: { accountNumber: accountNumber }
    });
    if (existingByAcctNo) {
        throw new Error(`Account number ${accountNumber} is already in use.`);
    }
  }
  
  if (initialBalance < expectedMonthlySaving) {
      throw new Error(`Initial balance cannot be less than the expected monthly saving of ${expectedMonthlySaving.toFixed(2)} Birr.`);
  }

  await prisma.$transaction(async (tx) => {
    // 1. Create the new MemberSavingAccount link
    const newMemberAccount = await tx.memberSavingAccount.create({
      data: {
        memberId,
        savingAccountTypeId,
        accountNumber: finalAccountNumber,
        expectedMonthlySaving,
        balance: 0, // Balance starts at 0, initial deposit will update it after approval
      }
    });

    // 2. If there's an initial balance, create a pending deposit transaction.
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
  });

  revalidatePath('/members');
  revalidatePath('/savings-accounts');
  revalidatePath('/savings');
  revalidatePath('/approve-transactions');
}
