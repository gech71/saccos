
'use server';

import prisma from '@/lib/prisma';
import { format } from 'date-fns';
import type { Member, School, Address, EmergencyContact, MemberSavingAccount, Share, Loan, LoanRepayment, AppliedServiceCharge } from '@prisma/client';

export interface MemberDetails {
    member: Member;
    school: School | null;
    address: Address | null;
    emergencyContact: EmergencyContact | null;
    savingAccounts: MemberSavingAccount[];
    shares: (Share & { shareTypeName: string })[];
    loans: (Loan & { loanTypeName: string })[];
    loanRepayments: LoanRepayment[];
    serviceCharges: (AppliedServiceCharge & { serviceChargeTypeName: string })[];
    monthlySavings: { month: string, deposits: number, withdrawals: number, net: number }[];
    monthlyLoanRepayments: { month: string, totalRepaid: number }[];
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
            shares: {
                where: { status: 'approved' },
                include: {
                    shareType: true
                },
                orderBy: {
                    allocationDate: 'desc'
                }
            },
            loans: {
                include: {
                    loanType: true
                },
                orderBy: {
                    disbursementDate: 'desc'
                }
            },
            loanRepayments: {
                orderBy: {
                    paymentDate: 'desc'
                }
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
                    date: 'desc'
                }
            }
        }
    });

    if (!member) {
        return null;
    }

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
    })).sort((a,b) => new Date(b.month).getTime() - new Date(a.month).getTime());

    // Process monthly loan repayments
    const monthlyLoanRepaymentsMap = new Map<string, number>();
    member.loanRepayments.forEach(repayment => {
        const month = format(new Date(repayment.paymentDate), 'MMMM yyyy');
        const currentTotal = monthlyLoanRepaymentsMap.get(month) || 0;
        monthlyLoanRepaymentsMap.set(month, currentTotal + repayment.amountPaid);
    });

    const monthlyLoanRepayments = Array.from(monthlyLoanRepaymentsMap.entries()).map(([month, totalRepaid]) => ({
        month,
        totalRepaid
    })).sort((a,b) => new Date(b.month).getTime() - new Date(a.month).getTime());


    return {
        member,
        school: member.school,
        address: member.address,
        emergencyContact: member.emergencyContact,
        savingAccounts: member.memberSavingAccounts,
        shares: member.shares.map(s => ({ ...s, shareTypeName: s.shareType.name })),
        loans: member.loans.map(l => ({ ...l, loanTypeName: l.loanType.name })),
        loanRepayments: member.loanRepayments,
        serviceCharges: member.appliedServiceCharges.map(sc => ({ ...sc, serviceChargeTypeName: sc.serviceChargeType.name })),
        monthlySavings,
        monthlyLoanRepayments
    };
}
