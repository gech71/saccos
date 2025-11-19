

'use server';

import prisma from '@/lib/prisma';
import type { School, SavingAccountType, LoanType, ShareType, ServiceChargeType, Member, MemberSavingAccount, MemberShareCommitment, Loan, AppliedServiceCharge } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { endOfMonth } from 'date-fns';
import { requirePermission } from '@/lib/authorization';


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
                where: { status: { in: ['active', 'overdue', 'pending']}},
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
            id: 'asc'
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
        values: Record<string, number | { principal: number; term: number } | { principalRepaid: number; interestRepaid: number }>;
    }[];
}

function roundToTwo(num: number) {
    return Math.round(num * 100) / 100;
}

export async function processImport(payload: ImportPayload): Promise<{ success: boolean, error?: string }> {
  await requirePermission('systemImport:create');
  const { collections, collectionMonth, collectionYear } = payload;
  const firstDayOfMonth = new Date(`${collectionMonth} 1, ${collectionYear}`);
  const importDate = endOfMonth(firstDayOfMonth);
  
  const allLoanTypes = await prisma.loanType.findMany();
  const loanTypeMap = new Map(allLoanTypes.map(lt => [lt.id, lt]));

  // Pre-fetch all saving account types, share types, and service charge types
  const [savingAccountTypes, shareTypes, serviceChargeTypes] = await Promise.all([
    prisma.savingAccountType.findMany(),
    prisma.shareType.findMany(),
    prisma.serviceChargeType.findMany()
  ]);
  
  const savingTypeMap = new Map(savingAccountTypes.map(st => [st.id, st]));
  const shareTypeMap = new Map(shareTypes.map(st => [st.id, st]));

  try {
    // Process collections in smaller batches to avoid transaction timeout
    const BATCH_SIZE = 5; // Process 5 members at a time
    
    for (let i = 0; i < collections.length; i += BATCH_SIZE) {
      const batchCollections = collections.slice(i, i + BATCH_SIZE);
      
      await prisma.$transaction(async (tx) => {
        for (const collection of batchCollections) {
          const { memberId, values } = collection;
          
          // Pre-fetch member data and existing accounts for this member
          const [member, existingSavingAccounts, existingShareCommitments, existingLoans] = await Promise.all([
            tx.member.findUnique({ where: { id: memberId } }),
            tx.memberSavingAccount.findMany({ where: { memberId } }),
            tx.memberShareCommitment.findMany({ where: { memberId } }),
            tx.loan.findMany({ where: { memberId, status: { in: ['active', 'overdue', 'pending'] } } })
          ]);
          
          // Create maps for faster lookups
          const savingAccountsMap = new Map(existingSavingAccounts.map(acc => [acc.savingAccountTypeId, acc]));
          const shareCommitmentsMap = new Map(existingShareCommitments.map(comm => [comm.shareTypeId, comm]));
          const loansMap = new Map(existingLoans.map(loan => [loan.loanTypeId, loan]));

          for (const [key, value] of Object.entries(values)) {
            if (typeof value === 'object') {
                if ('principal' in value && value.principal <= 0) continue;
                if ('principalRepaid' in value && value.principalRepaid <= 0 && value.interestRepaid <= 0) continue;
            }
            if (typeof value === 'number' && value <= 0) continue;

            const [type, idWithSuffix] = key.split('_');
            const id = idWithSuffix.replace('_principal','').replace('_interest','');

            if (type === 'saving') {
              let account = savingAccountsMap.get(id);
              
              if (!account) {
                const savingAccountType = savingTypeMap.get(id);
                if (!savingAccountType) continue;
                
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
                    accountNumber: `SA${Math.floor(100000 + Math.random() * 900000)}`,
                    balance: 0,
                    initialBalance: 0,
                    expectedMonthlySaving,
                  }
                });
                savingAccountsMap.set(id, account);
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

            } else if (type === 'interest') {
                const savingAccount = savingAccountsMap.get(id);
                if (savingAccount && typeof value === 'number' && value > 0) {
                    await tx.saving.create({
                        data: {
                            memberId,
                            memberSavingAccountId: savingAccount.id,
                            amount: value,
                            date: importDate,
                            month: `${collectionMonth} ${collectionYear}`,
                            transactionType: 'deposit',
                            status: 'pending',
                            depositMode: 'Bank',
                            notes: `Savings Interest posting for ${collectionMonth} ${collectionYear}`,
                        }
                    });
                }
            } else if (type === 'share') {
               let commitment = shareCommitmentsMap.get(id);
               
               if (!commitment) {
                    const shareType = shareTypeMap.get(id);
                    if (shareType) {
                        commitment = await tx.memberShareCommitment.create({
                            data: {
                                memberId,
                                shareTypeId: id,
                                totalCommittedAmount: shareType.totalAmount,
                            }
                        });
                        shareCommitmentsMap.set(id, commitment);
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
            } else if (type === 'loanrepay') {
                 if (typeof value !== 'object' || !('principalRepaid' in value)) continue;
                 const existingLoan = loansMap.get(id);
                 if (!existingLoan) continue;
                 
                 const { principalRepaid, interestRepaid } = value as { principalRepaid: number, interestRepaid: number };

                if(interestRepaid > 0) {
                     await tx.loanRepayment.create({
                         data: {
                             loanId: existingLoan.id,
                             memberId: memberId,
                             amountPaid: interestRepaid,
                             principalPaid: 0,
                             interestPaid: interestRepaid,
                             paymentDate: importDate,
                             status: 'pending',
                             depositMode: 'Cash',
                             notes: 'Imported Loan Interest'
                         }
                     });
                 }
                 if (principalRepaid > 0) {
                     await tx.loanRepayment.create({
                         data: {
                             loanId: existingLoan.id,
                             memberId: memberId,
                             amountPaid: principalRepaid,
                             principalPaid: principalRepaid,
                             interestPaid: 0,
                             paymentDate: importDate,
                             status: 'pending',
                             depositMode: 'Cash',
                             notes: 'Imported Loan Repayment'
                         }
                     });
                 }
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
      }, {
        timeout: 10000 // Increase transaction timeout to 10 seconds for each batch
      });
    }

    revalidatePath('/system-import');
    revalidatePath('/approve-transactions');
    revalidatePath('/approve-transactions/savings');
    revalidatePath('/approve-transactions/shares');
    revalidatePath('/approve-transactions/loan-repayments');
    revalidatePath('/approve-transactions/loans');
    revalidatePath('/approve-transactions/service-charges');
    revalidatePath('/savings');
    revalidatePath('/shares');
    revalidatePath('/loan-repayments');
    revalidatePath('/loans');
    revalidatePath('/applied-service-charges');

    return { success: true };
  } catch (error) {
    console.error("Error during system import processing:", error);
    if (error instanceof Error) {
        return { success: false, error: error.message };
    }
    return { success: false, error: "An unexpected error occurred during the import." };
  }
}
