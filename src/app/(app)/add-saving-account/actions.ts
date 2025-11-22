
'use server';

import prisma from '@/lib/prisma';
import type { Member, SavingAccountType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/authorization';

export async function getAccountCreationData(): Promise<{
  members: Pick<Member, 'id' | 'fullName' | 'salary'>[];
  savingAccountTypes: SavingAccountType[];
}> {
  try {
    await requirePermission('savingAccount:create');
  } catch (err) {
    return { members: [], savingAccountTypes: [] };
  }

  try {
    const [members, savingAccountTypes] = await Promise.all([
      prisma.member.findMany({
        where: { status: 'active' },
        select: { id: true, memberId: true, fullName: true, salary: true },
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
    await requirePermission('savingAccount:create');
  } catch (err) {
    return { success: false, error: "You don't have permission to create saving accounts." };
  }
  
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

    // Create the new MemberSavingAccount with zero balance initially.
    const newAccount = await prisma.memberSavingAccount.create({
      data: {
        memberId,
        savingAccountTypeId,
        accountNumber: finalAccountNumber,
        expectedMonthlySaving,
        initialBalance: 0, // Always start at 0
        balance: 0,
      }
    });
    
    // If there is an initial balance, create a pending transaction for it.
    // This harmonizes the logic with bulk imports.
    if (initialBalance > 0) {
      await prisma.saving.create({
        data: {
          memberId,
          memberSavingAccountId: newAccount.id,
          amount: initialBalance,
          date: new Date(),
          month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
          transactionType: 'deposit',
          status: 'pending',
          notes: 'Initial opening balance.',
          depositMode: 'Cash',
        }
      });
    }


    revalidatePath('/members');
    revalidatePath('/savings-accounts');
    revalidatePath('/savings');
    revalidatePath('/approve-transactions');
    return { success: true };
  } catch (error) {
      console.error('Failed to create saving account:', error);
      if (error instanceof Error) {
          return { success: false, error: error.message };
      }
      return { success: false, error: 'An unexpected error occurred while creating the account.' };
  }
}
