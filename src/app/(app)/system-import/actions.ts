
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

export type MemberDataForImport = Pick<Member, 'id' | 'fullName' | 'schoolId'> & {
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

  await prisma.$transaction(async (tx) => {
    for (const collection of collections) {
      const { memberId, values } = collection;

      for (const [key, amount] of Object.entries(values)) {
        if (amount <= 0) continue;

        const [type, idWithSuffix] = key.split('_');
        const id = idWithSuffix.replace('-principal', '').replace('-interest', '');


        if (type === 'saving') {
          const account = await tx.memberSavingAccount.findFirst({ where: { memberId, savingAccountTypeId: id }});
          if (account) {
            await tx.saving.create({
              data: {
                memberId,
                memberSavingAccountId: account.id,
                amount,
                date: paymentDate,
                month: `${collectionMonth} ${collectionYear}`,
                transactionType: 'deposit',
                status: 'pending',
                depositMode: 'Cash', // Default for batch
                notes: 'Bulk data import',
              }
            });
          }
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
            if (loan) {
                const principalPaid = values[`loan_${id}-principal`] || 0;
                const interestPaid = values[`loan_${id}-interest`] || 0;
                const totalPaid = principalPaid + interestPaid;

                if (totalPaid <= 0) continue;

                await tx.loanRepayment.create({
                    data: {
                        loanId: loan.id,
                        memberId,
                        amountPaid: totalPaid,
                        paymentDate,
                        interestPaid,
                        principalPaid,
                        depositMode: 'Cash',
                    }
                });
                await tx.loan.update({
                    where: { id: loan.id },
                    data: {
                        remainingBalance: { decrement: principalPaid },
                        status: (loan.remainingBalance - principalPaid) <= 0 ? 'paid_off' : loan.status,
                    }
                });
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
