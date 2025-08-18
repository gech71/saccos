
'use server';

import prisma from '@/lib/prisma';
import type { School, SavingAccountType, LoanType, ShareType, ServiceChargeType, Member, MemberSavingAccount, MemberShareCommitment, Loan } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export interface AggregatePageData {
  schools: Pick<School, 'id', 'name'>[];
  savingTypes: Pick<SavingAccountType, 'id', 'name'>[];
  loanTypes: Pick<LoanType, 'id', 'name'>[];
  shareTypes: (Pick<ShareType, 'id' | 'name'> & {monthlyPayment: number | null})[];
  serviceChargeTypes: Pick<ServiceChargeType, 'id' | 'name' | 'frequency' | 'amount'>[];
  members: MemberDataForAggregate[];
}

export type MemberDataForAggregate = Pick<Member, 'id' | 'fullName' | 'schoolId'> & {
    memberSavingAccounts: Pick<MemberSavingAccount, 'savingAccountTypeId' | 'expectedMonthlySaving'>[],
    memberShareCommitments: (Pick<MemberShareCommitment, 'shareTypeId'> & {shareType: {monthlyPayment: number | null}})[],
    loans: Pick<Loan, 'loanTypeId' | 'monthlyRepaymentAmount' | 'interestRate' | 'remainingBalance'>[]
}

export async function getAggregateData(): Promise<AggregatePageData> {
  const [schools, savingTypes, loanTypes, shareTypes, serviceChargeTypes, members] = await Promise.all([
    prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.savingAccountType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.loanType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.shareType.findMany({ select: { id: true, name: true, monthlyPayment: true }, orderBy: { name: 'asc' } }),
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
                    shareType: {
                        select: { monthlyPayment: true }
                    }
                }
            },
            loans: {
                where: { status: { in: ['active', 'overdue']}},
                select: {
                    loanTypeId: true,
                    monthlyRepaymentAmount: true,
                    interestRate: true,
                    remainingBalance: true,
                }
            }
        }
    })
  ]);

  return { schools, savingTypes, loanTypes, shareTypes, serviceChargeTypes, members };
}

export type CollectionPayload = {
    schoolId: string;
    collectionMonth: string;
    collectionYear: string;
    collections: {
        memberId: string;
        values: Record<string, number>;
    }[];
}

export async function processAggregateCollection(payload: CollectionPayload): Promise<{ success: boolean }> {
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
          await tx.saving.create({
            data: {
              memberId,
              memberSavingAccountId: (await tx.memberSavingAccount.findFirst({ where: { memberId, savingAccountTypeId: id }}))?.id || null,
              amount,
              date: paymentDate,
              month: `${collectionMonth} ${collectionYear}`,
              transactionType: 'deposit',
              status: 'pending',
              depositMode: 'Cash', // Default for batch
              notes: 'Aggregate group collection',
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
                       notes: 'Aggregate group collection',
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
                    notes: 'Aggregate group collection',
                }
             });
        }
      }
    }
  });

  revalidatePath('/aggregate-collections');
  revalidatePath('/approve-transactions');
  revalidatePath('/savings');
  revalidatePath('/shares');
  revalidatePath('/loan-repayments');
  revalidatePath('/applied-service-charges');

  return { success: true };
}
