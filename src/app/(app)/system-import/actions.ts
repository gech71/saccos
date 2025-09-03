

'use server';

import prisma from '@/lib/prisma';
import type { School, SavingAccountType, LoanType, ShareType, ServiceChargeType, Member, MemberSavingAccount, MemberShareCommitment, Loan, AppliedServiceCharge } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export interface ImportPageData {
  savingTypes: Pick<SavingAccountType, 'id' | 'name' | 'contributionType' | 'contributionValue'>[];
  loanTypes: Pick<LoanType, 'id' | 'name' | 'interestRate' | 'maxRepaymentPeriod'>[];
  shareTypes: (Pick<ShareType, 'id' | 'name' | 'monthlyPayment' | 'paymentType'>)[];
  serviceChargeTypes: Pick<ServiceChargeType, 'id' | 'name' | 'frequency' | 'amount'>[];
  members: MemberDataForImport[];
}

export type MemberDataForImport = Pick<Member, 'id' | 'fullName' | 'schoolId' | 'salary'> & {
    memberSavingAccounts: Pick<MemberSavingAccount, 'savingAccountTypeId' | 'expectedMonthlySaving'>[],
    memberShareCommitments: (Pick<MemberShareCommitment, 'shareTypeId' | 'status'> & {shareType: {monthlyPayment: number | null, paymentType: 'ONCE' | 'INSTALLMENT'}})[],
    loans: (Pick<Loan, 'id' | 'loanTypeId' | 'principalAmount' | 'loanTerm' | 'interestRate' | 'remainingBalance'> & {loanType: Pick<LoanType, 'name'>})[],
    appliedServiceCharges: Pick<AppliedServiceCharge, 'serviceChargeTypeId' | 'status'>[]
}

export async function getImportPageData(): Promise<ImportPageData> {
  const [savingTypes, loanTypes, shareTypes, serviceChargeTypes, members] = await Promise.all([
    prisma.savingAccountType.findMany({ select: { id: true, name: true, contributionType: true, contributionValue: true }, orderBy: { name: 'asc' } }),
    prisma.loanType.findMany({ select: { id: true, name: true, interestRate: true, maxRepaymentPeriod: true }, orderBy: { name: 'asc' } }),
    prisma.shareType.findMany({ select: { id: true, name: true, monthlyPayment: true, paymentType: true, totalAmount: true }, orderBy: { name: 'asc' } }),
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
                    id: true,
                    loanTypeId: true,
                    principalAmount: true,
                    loanTerm: true,
                    interestRate: true,
                    remainingBalance: true,
                    loanType: { select: { name: true }}
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
        values: Record<string, number | { principal: number; term: number }>;
    }[];
}

function roundToTwo(num: number) {
    return Math.round(num * 100) / 100;
}

export async function processImport(payload: ImportPayload): Promise<{ success: boolean }> {
  const { collections, collectionMonth, collectionYear } = payload;
  const importDate = new Date(`${collectionMonth} 1, ${collectionYear}`);
  
  const allLoanTypes = await prisma.loanType.findMany();
  const loanTypeMap = new Map(allLoanTypes.map(lt => [lt.id, lt]));

  await prisma.$transaction(async (tx) => {
    for (const collection of collections) {
      const { memberId, values } = collection;

      for (const [key, value] of Object.entries(values)) {
        if (typeof value === 'object' && ('principal' in value) && value.principal <= 0) continue;
        if (typeof value === 'number' && value <= 0) continue;

        const [type, id] = key.split('_');

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
              amount: value as number,
              date: importDate,
              month: `${collectionMonth} ${collectionYear}`,
              transactionType: 'deposit',
              status: 'pending',
              depositMode: 'Cash',
              notes: 'Bulk data import',
            }
          });

        } else if (type === 'share') {
           let commitment = await tx.memberShareCommitment.findFirst({ where: {memberId, shareTypeId: id}});
           
           if (!commitment) {
                const shareType = await tx.shareType.findUnique({ where: { id }});
                if (shareType) {
                    commitment = await tx.memberShareCommitment.create({
                        data: {
                            memberId,
                            shareTypeId: id,
                            totalCommittedAmount: shareType.totalAmount,
                        }
                    });
                } else {
                    continue; 
                }
           }

            await tx.sharePayment.create({
                data: {
                    commitmentId: commitment.id,
                    amount: value as number,
                    paymentDate: importDate,
                    depositMode: 'Cash',
                    status: 'pending',
                    notes: 'Bulk data import',
                }
            });
        } else if (type === 'loan') {
            const loanType = loanTypeMap.get(id);
            if (!loanType || typeof value !== 'object' || !('principal' in value)) continue;

            const loan = await tx.loan.create({
                data: {
                    memberId,
                    loanTypeId: id,
                    principalAmount: value.principal,
                    interestRate: loanType.interestRate,
                    loanTerm: value.term || loanType.maxRepaymentPeriod,
                    repaymentFrequency: loanType.repaymentFrequency,
                    disbursementDate: importDate,
                    status: 'pending', // Imported loans must be approved
                    remainingBalance: value.principal,
                    notes: 'Loan created from bulk system import.',
                }
            });
            
        } else if (type === 'service') {
             await tx.appliedServiceCharge.create({
                data: {
                    memberId,
                    serviceChargeTypeId: id,
                    amountCharged: value as number,
                    dateApplied: importDate,
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
  revalidatePath('/loans');
  revalidatePath('/applied-service-charges');

  return { success: true };
}
