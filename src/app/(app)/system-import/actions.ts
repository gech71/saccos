

'use server';

import prisma from '@/lib/prisma';
import type { School, SavingAccountType, LoanType, ShareType, ServiceChargeType, Member, MemberSavingAccount, MemberShareCommitment, Loan, AppliedServiceCharge } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export interface ImportPageData {
  savingTypes: Pick<SavingAccountType, 'id' | 'name'>[];
  loanTypes: Pick<LoanType, 'id' | 'name' | 'interestRate'>[];
  shareTypes: (Pick<ShareType, 'id' | 'name' | 'monthlyPayment' | 'paymentType'>)[];
  serviceChargeTypes: Pick<ServiceChargeType, 'id' | 'name' | 'frequency' | 'amount'>[];
  members: MemberDataForImport[];
}

export type MemberDataForImport = Pick<Member, 'id' | 'fullName' | 'schoolId' | 'salary'> & {
    memberSavingAccounts: Pick<MemberSavingAccount, 'savingAccountTypeId' | 'expectedMonthlySaving'>[],
    memberShareCommitments: (Pick<MemberShareCommitment, 'shareTypeId' | 'status'> & {shareType: {monthlyPayment: number | null, paymentType: 'ONCE' | 'INSTALLMENT'}})[],
    loans: Pick<Loan, 'loanTypeId' | 'principalAmount' | 'loanTerm' | 'interestRate' | 'remainingBalance'>[],
    appliedServiceCharges: Pick<AppliedServiceCharge, 'serviceChargeTypeId' | 'status'>[]
}

export async function getImportPageData(): Promise<ImportPageData> {
  const [savingTypes, loanTypes, shareTypes, serviceChargeTypes, members] = await Promise.all([
    prisma.savingAccountType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.loanType.findMany({ select: { id: true, name: true, interestRate: true }, orderBy: { name: 'asc' } }),
    prisma.shareType.findMany({ select: { id: true, name: true, monthlyPayment: true, paymentType: true }, orderBy: { name: 'asc' } }),
    prisma.serviceChargeType.findMany({ select: { id: true, name: true, frequency: true, amount: true }, orderBy: { name: 'asc' } }),
    prisma.member.findMany({
        where: { status: 'active' },
        select: {
            id: true,
            fullName: true,
            schoolId: true,
            salary: true,
            memberSavingAccounts: {
                select: {
                    savingAccountTypeId: true,
                    expectedMonthlySaving: true
                }
            },
            memberShareCommitments: {
                select: {
                    shareTypeId: true,
                    status: true,
                    shareType: {
                        select: { monthlyPayment: true, paymentType: true }
                    }
                }
            },
            loans: {
                where: { status: { in: ['active', 'overdue']}},
                select: {
                    loanTypeId: true,
                    principalAmount: true,
                    loanTerm: true,
                    interestRate: true,
                    remainingBalance: true,
                }
            },
            appliedServiceCharges: {
                select: {
                    serviceChargeTypeId: true,
                    status: true
                }
            }
        },
        orderBy: {
            fullName: 'asc'
        }
    })
  ]);

  return { savingTypes, loanTypes, shareTypes, serviceChargeTypes, members };
}

export type ImportPayload = {
    collectionMonth: string;
    collectionYear: string;
    collections: {
        memberId: string;
        values: Record<string, number>;
    }[];
}

export async function processImport(payload: ImportPayload): Promise<{ success: boolean }> {
  const { collections, collectionMonth, collectionYear } = payload;
  const paymentDate = new Date(`${collectionMonth} 1, ${collectionYear}`);
  
  const loanInterestChargeType = await prisma.serviceChargeType.findFirst({
    where: { name: 'Monthly Loan Interest' },
  });

  if (!loanInterestChargeType) {
      throw new Error('A service charge type named "Monthly Loan Interest" must exist to import loan interest payments.');
  }

  await prisma.$transaction(async (tx) => {
    for (const collection of collections) {
      const { memberId, values } = collection;

      for (const [key, amount] of Object.entries(values)) {
        if (amount <= 0) continue;

        const [type, idWithSuffix] = key.split('_');
        const id = idWithSuffix.replace('-principal', '').replace('-interest', '');


        if (type === 'saving') {
          let account = await tx.memberSavingAccount.findFirst({ where: { memberId, savingAccountTypeId: id }});
          
          if (!account) {
            const savingAccountType = await tx.savingAccountType.findUnique({ where: { id }});
            if (!savingAccountType) continue; 
            const member = await tx.member.findUnique({ where: { id: memberId }});
            
            let expectedMonthlySaving = 0;
            if (savingAccountType.contributionType === 'FIXED') {
              expectedMonthlySaving = savingAccountType.contributionValue;
            } else if (savingAccountType.contributionType === 'PERCENTAGE' && member?.salary) {
              expectedMonthlySaving = member.salary * savingAccountType.contributionValue;
            }

            account = await tx.memberSavingAccount.create({
              data: {
                memberId,
                savingAccountTypeId: id,
                accountNumber: `SA-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`,
                balance: 0,
                initialBalance: 0,
                expectedMonthlySaving,
              }
            });
          }

          await tx.saving.create({
            data: {
              memberId,
              memberSavingAccountId: account.id,
              amount,
              date: paymentDate,
              month: `${collectionMonth} ${collectionYear}`,
              transactionType: 'deposit',
              status: 'pending',
              depositMode: 'Cash',
              notes: 'Bulk data import',
            }
          });

        } else if (type === 'share') {
           const commitment = await tx.memberShareCommitment.findFirst({ where: {memberId, shareTypeId: id}});
           if (commitment) {
               await tx.sharePayment.create({
                   data: {
                       commitmentId: commitment.id,
                       amount,
                       paymentDate,
                       depositMode: 'Cash',
                       status: 'pending',
                       notes: 'Bulk data import',
                   }
               });
           }
        } else if (type === 'loan') {
            const loan = await tx.loan.findFirst({ where: { memberId, loanTypeId: id, status: { in: ['active', 'overdue']}}});
            const primarySavingAccount = await tx.memberSavingAccount.findFirst({ where: {memberId}, orderBy: { createdAt: 'asc' }});

            if (loan && primarySavingAccount) {
                const principalPaid = values[`loan_${id}-principal`] || 0;
                const interestPaid = values[`loan_${id}-interest`] || 0;

                // Handle principal portion as a savings deposit for now
                if (principalPaid > 0) {
                     await tx.saving.create({
                        data: {
                            memberId,
                            memberSavingAccountId: primarySavingAccount.id,
                            amount: principalPaid,
                            date: paymentDate,
                            month: `${collectionMonth} ${collectionYear}`,
                            transactionType: 'deposit',
                            status: 'pending',
                            depositMode: 'Cash',
                            notes: `Loan principal repayment for ${loan.loanType?.name || 'Loan'}`,
                        }
                    });
                }
                
                // Handle interest portion as a service charge
                if (interestPaid > 0) {
                    await tx.appliedServiceCharge.create({
                        data: {
                            memberId,
                            serviceChargeTypeId: loanInterestChargeType.id,
                            amountCharged: interestPaid,
                            dateApplied: paymentDate,
                            status: 'pending',
                            notes: `Loan interest repayment for ${loan.loanType?.name || 'Loan'}`
                        }
                    });
                }

                // To avoid double-counting, we can delete the keys after processing
                delete values[`loan_${id}-principal`];
                delete values[`loan_${id}-interest`];
            }
        } else if (type === 'service') {
             await tx.appliedServiceCharge.create({
                data: {
                    memberId,
                    serviceChargeTypeId: id,
                    amountCharged: amount,
                    dateApplied: paymentDate,
                    status: 'pending',
                    notes: 'Bulk data import',
                }
             });
        }
      }
    }
  });

  revalidatePath('/system-import');
  revalidatePath('/approve-transactions');
  revalidatePath('/savings');
  revalidatePath('/shares');
  revalidatePath('/loan-repayments');
  revalidatePath('/applied-service-charges');

  return { success: true };
}
