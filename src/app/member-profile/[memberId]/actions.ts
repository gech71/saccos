

'use server';

import prisma from '@/lib/prisma';
import { format, compareDesc } from 'date-fns';
import type { Member, School, Address, EmergencyContact, MemberSavingAccount, Loan, LoanRepayment, AppliedServiceCharge, Saving, SchoolHistory, Dividend, MemberShareCommitment, SharePayment } from '@prisma/client';

type GuaranteedLoan = Loan & { member: { fullName: string }, loanType: { name: string } | null };
export interface MemberDetails {
    member: Member;
    school: School | null;
    address: Address | null;
    emergencyContact: EmergencyContact | null;
    savingAccounts: MemberSavingAccount[];
    shareCommitments: (MemberShareCommitment & { shareType: { name: string } | null })[];
    sharePayments: SharePayment[];
    loans: (Loan & { loanTypeName: string })[];
    guaranteedLoans: GuaranteedLoan[];
    dividends: Dividend[];
    loanRepayments: (LoanRepayment & { balanceAfter: number })[];
    serviceCharges: (AppliedServiceCharge & { serviceChargeTypeName: string })[];
    monthlySavings: { month: string, deposits: number, withdrawals: number, net: number }[];
    monthlyLoanRepayments: { month: string, totalRepaid: number }[];
    allSavingsTransactions: (Saving & { balanceAfter: number })[];
    schoolHistory: SchoolHistory[];
}


export async function getMemberDetails(memberId: string): Promise<MemberDetails | null> {
    const member = await prisma.member.findUnique({
        where: { id: memberId },
        include: {
            school: true,
            address: true,
            emergencyContact: true,
            memberSavingAccounts: {
                include: {
                    savingAccountType: true
                }
            },
            memberShareCommitments: {
                include: {
                    shareType: true,
                    payments: {
                        where: { status: 'approved' },
                        orderBy: {
                            paymentDate: 'desc'
                        }
                    }
                },
                 orderBy: {
                    joinDate: 'desc'
                }
            },
            dividends: {
                where: { status: 'approved' },
                orderBy: { distributionDate: 'desc' }
            },
            appliedServiceCharges: {
                include: {
                    serviceChargeType: true
                },
                orderBy: {
                    dateApplied: 'desc'
                }
            },
            savings: { 
                where: { status: 'approved' },
                orderBy: {
                    date: 'asc' // Sort ASC to calculate running balance correctly
                }
            },
            schoolHistory: {
                orderBy: {
                    startDate: 'desc'
                }
            }
        }
    });

    if (!member) {
        return null;
    }
    
    // Fetch loans separately and process their repayments
    const loans = await prisma.loan.findMany({
        where: { memberId: memberId },
        include: {
            loanType: true,
            repayments: {
                orderBy: {
                    paymentDate: 'asc'
                }
            }
        },
        orderBy: {
            disbursementDate: 'desc'
        }
    });
    
    // Fetch loans the member has guaranteed for others
    const guaranteedLoans = await prisma.loan.findMany({
        where: {
            guarantors: {
                some: {
                    guarantorId: memberId,
                },
            },
            status: { in: ['active', 'overdue'] }
        },
        include: {
            member: {
                select: { fullName: true }
            },
            loanType: {
                select: { name: true }
            }
        },
    });


    const allLoanRepaymentsWithBalance: (LoanRepayment & { balanceAfter: number })[] = [];
    loans.forEach(loan => {
        let runningBalance = loan.principalAmount;
        loan.repayments.forEach(repayment => {
            runningBalance -= repayment.principalPaid;
            allLoanRepaymentsWithBalance.push({ ...repayment, balanceAfter: runningBalance });
        });
    });
    
    // Sort all repayments by date descending for final display
    allLoanRepaymentsWithBalance.sort((a,b) => compareDesc(new Date(a.paymentDate), new Date(b.paymentDate)));


    // Calculate running balance for savings
    const totalInitialBalance = member.memberSavingAccounts.reduce((sum, acc) => sum + acc.initialBalance, 0);
    let runningBalance = totalInitialBalance;
    const savingsWithBalance = member.savings
        .map(tx => {
            if (tx.transactionType === 'deposit') {
                runningBalance += tx.amount;
            } else {
                runningBalance -= tx.amount;
            }
            return { ...tx, balanceAfter: runningBalance };
        }); // Keep the ASC order for correct display


    // Process monthly savings
    const monthlySavingsMap = new Map<string, { deposits: number, withdrawals: number }>();
    member.savings.forEach(saving => {
        const month = format(new Date(saving.date), 'MMMM yyyy');
        if (!monthlySavingsMap.has(month)) {
            monthlySavingsMap.set(month, { deposits: 0, withdrawals: 0 });
        }
        const current = monthlySavingsMap.get(month)!;
        if (saving.transactionType === 'deposit') {
            current.deposits += saving.amount;
        } else {
            current.withdrawals += saving.amount;
        }
    });
    
    const monthlySavings = Array.from(monthlySavingsMap.entries()).map(([month, data]) => ({
        month,
        ...data,
        net: data.deposits - data.withdrawals
    })).sort((a,b) => compareDesc(new Date(a.month), new Date(b.month)));

    // Process monthly loan repayments
    const allRepaymentsFromAllLoans = loans.flatMap(l => l.repayments);
    const monthlyLoanRepaymentsMap = new Map<string, number>();
    allRepaymentsFromAllLoans.forEach(repayment => {
        const month = format(new Date(repayment.paymentDate), 'MMMM yyyy');
        const currentTotal = monthlyLoanRepaymentsMap.get(month) || 0;
        monthlyLoanRepaymentsMap.set(month, currentTotal + repayment.amountPaid);
    });

    const monthlyLoanRepayments = Array.from(monthlyLoanRepaymentsMap.entries()).map(([month, totalRepaid]) => ({
        month,
        totalRepaid
    })).sort((a,b) => compareDesc(new Date(a.month), new Date(b.month)));

    const allSharePayments = member.memberShareCommitments.flatMap(c => c.payments);

    return {
        member,
        school: member.school,
        address: member.address,
        emergencyContact: member.emergencyContact,
        savingAccounts: member.memberSavingAccounts.map(sa => ({ ...sa, savingAccountType: sa.savingAccountType ? { ...sa.savingAccountType } : null })),
        shareCommitments: member.memberShareCommitments.map(c => ({...c, payments:[], shareType: c.shareType ? { name: c.shareType.name } : null })),
        sharePayments: allSharePayments,
        loans: loans.map(l => ({ ...l, loanTypeName: l.loanType?.name ?? '[Deleted Loan Type]', repayments: [] })),
        guaranteedLoans: guaranteedLoans as GuaranteedLoan[],
        dividends: member.dividends,
        loanRepayments: allLoanRepaymentsWithBalance,
        serviceCharges: member.appliedServiceCharges.map(sc => ({ ...sc, serviceChargeTypeName: sc.serviceChargeType?.name ?? '[Deleted Charge Type]' })),
        monthlySavings,
        monthlyLoanRepayments,
        allSavingsTransactions: savingsWithBalance,
        schoolHistory: member.schoolHistory,
    };
}
