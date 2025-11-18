
'use server';

import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { format, compareDesc } from 'date-fns';
import type { Member, School, Address, EmergencyContact, MemberSavingAccount, Loan, LoanRepayment, AppliedServiceCharge, Saving, SchoolHistory, Dividend, MemberShareCommitment, SharePayment, ShareType, LoanType, ServiceChargeType, SavingAccountType } from '@prisma/client';

type GuaranteedLoan = Loan & { member: { fullName: string }, loanType: { name: string } | null };
export interface MemberDetails {
    member: Member;
    school: School | null;
    address: Address | null;
    emergencyContact: EmergencyContact | null;
    savingAccounts: (MemberSavingAccount & { savingAccountType: SavingAccountType | null })[];
    shareCommitments: (MemberShareCommitment & { shareType: ShareType | null, payments: SharePayment[] })[];
    sharePayments: SharePayment[];
    loans: (Loan & { loanType: LoanType | null })[];
    guaranteedLoans: GuaranteedLoan[];
    dividends: Dividend[];
    loanRepayments: (LoanRepayment & { balanceAfter: number })[];
    serviceCharges: (AppliedServiceCharge & { serviceChargeType: ServiceChargeType | null })[];
    monthlySavings: { month: string, deposits: number, withdrawals: number, net: number }[];
    monthlyLoanRepayments: { month: string, totalRepaid: number }[];
    allSavingsTransactions: (Saving & { balanceAfter: number })[];
    schoolHistory: SchoolHistory[];
}


export async function getMemberDetails(memberId: string): Promise<MemberDetails | null> {
    // Server-side authorization: ensure requesting user can view this member
    try {
        const session = await auth();
        const user = session?.user as any;
        if (!user) return null; // not authenticated

        // Members may only view their own profile
        if (user.isMember) {
            if (user.id !== memberId) {
                // Deny access if a member tries to view another member's profile
                return null;
            }
        }
        // Admins (non-members) are allowed; add specific permission checks here if needed
        // For now, any admin can view any member profile
    } catch (err) {
        console.error("Session validation error:", err);
        return null;
    }
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

    // --- Data Sanitization & Processing ---

    // Sanitize guaranteed loans
    const safeGuaranteedLoans = guaranteedLoans.map(loan => ({
        ...loan,
        loanType: loan.loanType ? loan.loanType : { name: '[Deleted Loan Type]' }
    })) as GuaranteedLoan[];

    // Process loan repayments with balance calculation
    const allLoanRepaymentsWithBalance: (LoanRepayment & { balanceAfter: number })[] = [];
    loans.forEach(loan => {
        let runningBalance = loan.principalAmount;
        (loan.repayments || []).forEach(repayment => {
            runningBalance -= (repayment.principalPaid || 0);
            allLoanRepaymentsWithBalance.push({ ...repayment, balanceAfter: runningBalance });
        });
    });
    allLoanRepaymentsWithBalance.sort((a,b) => compareDesc(new Date(a.paymentDate), new Date(b.paymentDate)));

    // Process savings with running balance
    const totalInitialBalance = (member.memberSavingAccounts || []).reduce((sum, acc) => sum + (acc.initialBalance || 0), 0);
    let runningSavingsBalance = totalInitialBalance;
    const savingsWithBalance = (member.savings || []).map(tx => {
        if (tx.transactionType === 'deposit') {
            runningSavingsBalance += tx.amount;
        } else {
            runningSavingsBalance -= tx.amount;
        }
        return { ...tx, balanceAfter: runningSavingsBalance };
    });

    // Process monthly savings
    const monthlySavingsMap = new Map<string, { deposits: number, withdrawals: number }>();
    (member.savings || []).forEach(saving => {
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
    const allRepaymentsFromAllLoans = loans.flatMap(l => l.repayments || []);
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

    const allSharePayments = (member.memberShareCommitments || []).flatMap(c => c.payments || []);
    
    // Sanitize loans to remove repayments from the main object to avoid redundant data transfer
    const sanitizedLoans = loans.map(l => {
        const { repayments, ...loanWithoutRepayments } = l;
        return loanWithoutRepayments;
    });

    return {
        member,
        school: member.school,
        address: member.address,
        emergencyContact: member.emergencyContact,
        savingAccounts: member.memberSavingAccounts || [],
        shareCommitments: member.memberShareCommitments || [],
        sharePayments: allSharePayments,
        loans: sanitizedLoans,
        guaranteedLoans: safeGuaranteedLoans,
        dividends: member.dividends || [],
        loanRepayments: allLoanRepaymentsWithBalance,
        serviceCharges: member.appliedServiceCharges || [],
        monthlySavings,
        monthlyLoanRepayments,
        allSavingsTransactions: savingsWithBalance.sort((a, b) => compareDesc(new Date(a.date), new Date(b.date))),
        schoolHistory: member.schoolHistory || [],
    };
}
