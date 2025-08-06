

'use server';

import prisma from '@/lib/prisma';
import type { Saving, Share, Dividend, SavingAccountType, Loan, LoanRepayment, LoanType } from '@prisma/client';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';

export async function getReportPageData() {
    const [schools, savingAccountTypes, loanTypes] = await Promise.all([
        prisma.school.findMany({
            select: {
                id: true,
                name: true,
            },
            orderBy: {
                name: 'asc',
            },
        }),
        prisma.savingAccountType.findMany({
            select: {
                id: true,
                name: true
            },
             orderBy: {
                name: 'asc',
            },
        }),
        prisma.loanType.findMany({
            select: {
                id: true,
                name: true
            },
            orderBy: {
                name: 'asc'
            }
        })
    ]);
    
    return { schools, savingAccountTypes, loanTypes };
}

export type ReportType = 'savings' | 'share-allocations' | 'dividend-distributions' | 'saving-interest' | 'loans' | 'loan-interest' | 'loan-repayment' | 'savings-no-interest' | 'loans-no-interest';

export interface ReportData {
    title: string;
    schoolName: string;
    reportDate: string;
    summary: { label: string; value: string; }[];
    columns: string[];
    rows: (string | number)[][];
    chartData?: any[];
    chartType?: 'bar' | 'pie' | 'line' | 'none';
}

export async function generateSimpleReport(
    schoolId: string, 
    reportType: ReportType, 
    dateRange: DateRange,
    savingAccountTypeId?: string,
    loanTypeId?: string,
): Promise<ReportData | null> {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return null;

    const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    if (!dateRange.from || !dateRange.to) {
        throw new Error("Date range is required for generating a report.");
    }
    const startDate = startOfDay(dateRange.from);
    const endDate = endOfDay(dateRange.to);
    const periodName = `${format(startDate, 'PPP')} - ${format(endDate, 'PPP')}`;

    const memberIdsInSchool = (await prisma.member.findMany({
        where: { schoolId },
        select: { id: true }
    })).map(m => m.id);

    if (reportType === 'savings' || reportType === 'savings-no-interest') {
        if (!savingAccountTypeId) {
            throw new Error("Saving Account Type is required for this report.");
        }
        
        const savingAccountType = await prisma.savingAccountType.findUnique({ where: { id: savingAccountTypeId }});
        if (!savingAccountType) throw new Error("Saving account type not found.");

        const membersInSchool = await prisma.member.findMany({
            where: { 
                schoolId,
                memberSavingAccounts: {
                    some: {
                        savingAccountTypeId: savingAccountTypeId
                    }
                }
            },
            include: {
                memberSavingAccounts: {
                    where: { savingAccountTypeId },
                    include: {
                        savings: {
                            where: { status: 'approved' }
                        }
                    }
                }
            }
        });

        const reportRows: (string | number)[][] = [];
        let totalNetSavings = 0;
        let totalDepositsOverall = 0;
        let totalWithdrawalsOverall = 0;

        for (const member of membersInSchool) {
            const account = member.memberSavingAccounts[0];
            if (!account) continue;

            const transactionsBefore = account.savings.filter(s => new Date(s.date) < startDate);
            let initialBalance = account.initialBalance;
            transactionsBefore.forEach(tx => {
                initialBalance += tx.transactionType === 'deposit' ? tx.amount : -tx.amount;
            });

            const transactionsDuring = account.savings.filter(s => {
                const txDate = new Date(s.date);
                return txDate >= startDate && txDate <= endDate;
            });
            
            const totalDeposit = transactionsDuring
                .filter(s => s.transactionType === 'deposit' && (reportType === 'savings-no-interest' ? !s.notes?.toLowerCase().includes('interest') : true))
                .reduce((sum, s) => sum + s.amount, 0);

            const totalWithdrawal = transactionsDuring.filter(s => s.transactionType === 'withdrawal').reduce((sum, s) => sum + s.amount, 0);
            
            if (initialBalance === 0 && totalDeposit === 0 && totalWithdrawal === 0) {
                continue;
            }

            const netSaving = totalDeposit - totalWithdrawal;
            const totalAmount = initialBalance + netSaving;

            totalNetSavings += netSaving;
            totalDepositsOverall += totalDeposit;
            totalWithdrawalsOverall += totalWithdrawal;
            
            reportRows.push([
                member.id,
                member.fullName,
                totalDeposit,
                totalWithdrawal,
                initialBalance,
                netSaving,
                totalAmount
            ]);
        }
        
        const reportTitle = reportType === 'savings-no-interest' 
            ? `Saving Report (w/o Interest) for ${savingAccountType.name} (${periodName})`
            : `Saving Report for ${savingAccountType.name} (${periodName})`;

        return {
            title: reportTitle,
            schoolName: school.name,
            reportDate,
            summary: [
                { label: 'Total Deposits', value: `${totalDepositsOverall.toFixed(2)} Birr` },
                { label: 'Total Withdrawals', value: `${totalWithdrawalsOverall.toFixed(2)} Birr` },
                { label: 'Net Savings', value: `${totalNetSavings.toFixed(2)} Birr` },
                { label: 'Total Members in Report', value: reportRows.length.toString() },
            ],
            columns: ['Member ID', 'Name', 'Total Deposit', 'Total Withdrawal', 'Initial Saving Balance', 'Net Saving', 'Total Amount'],
            rows: reportRows,
            chartData: [],
            chartType: 'none',
        };
    }
    
    if (reportType === 'share-allocations') {
        const shares = await prisma.share.findMany({
            where: { 
                memberId: { in: memberIdsInSchool }, 
                status: 'approved',
                allocationDate: {
                    gte: startDate,
                    lte: endDate,
                }
            },
            include: { member: { select: { fullName: true }}, shareType: { select: { name: true }} },
            orderBy: { allocationDate: 'desc' }
        });

        const totalSharesCount = shares.reduce((sum, s) => sum + s.count, 0);
        const totalSharesValue = shares.reduce((sum, s) => sum + (s.totalValueForAllocation || s.count * s.valuePerShare), 0);

        const shareTypeData: { [key: string]: number } = {};
        shares.forEach(s => {
            const typeName = s.shareType.name;
            const value = s.totalValueForAllocation || (s.count * s.valuePerShare);
            if (!shareTypeData[typeName]) {
                shareTypeData[typeName] = 0;
            }
            shareTypeData[typeName] += value;
        });

        const chartData = Object.keys(shareTypeData).map(name => ({
            name,
            value: shareTypeData[name],
        }));

        return {
            title: 'Share Allocation Report',
            schoolName: school.name,
            reportDate,
            summary: [
                { label: 'Total Shares Allocated', value: totalSharesCount.toString() },
                { label: 'Total Value of Shares', value: `${totalSharesValue.toFixed(2)} Birr` },
                { label: 'Total Allocations', value: shares.length.toString() },
            ],
            columns: ['Date', 'Member', 'Share Type', 'Count', 'Value per Share', 'Total Value'],
            rows: shares.map(s => [
                new Date(s.allocationDate).toLocaleDateString(),
                s.member.fullName,
                s.shareType.name,
                s.count,
                s.valuePerShare,
                s.totalValueForAllocation || (s.count * s.valuePerShare)
            ]),
            chartData,
            chartType: 'pie',
        };
    }

    if (reportType === 'dividend-distributions') {
        const dividends = await prisma.dividend.findMany({
            where: { 
                memberId: { in: memberIdsInSchool }, 
                status: 'approved',
                distributionDate: {
                    gte: startDate,
                    lte: endDate,
                }
            },
            include: { member: { select: { fullName: true }}},
            orderBy: { distributionDate: 'desc' }
        });

        const totalDividendAmount = dividends.reduce((sum, d) => sum + d.amount, 0);
        
        const memberDividends: { [key: string]: number } = {};
        dividends.forEach(d => {
            const memberName = d.member.fullName;
            if (!memberDividends[memberName]) {
                memberDividends[memberName] = 0;
            }
            memberDividends[memberName] += d.amount;
        });

        const chartData = Object.entries(memberDividends)
            .map(([name, value]) => ({ name, Amount: value }))
            .sort((a, b) => b.Amount - a.Amount)
            .slice(0, 10);

        return {
            title: 'Dividend Distribution Report',
            schoolName: school.name,
            reportDate,
            summary: [
                { label: 'Total Dividends Distributed', value: `${totalDividendAmount.toFixed(2)} Birr` },
                { label: 'Total Payouts', value: dividends.length.toString() },
            ],
            columns: ['Date', 'Member', 'Amount', 'Shares at Distribution'],
            rows: dividends.map(d => [
                new Date(d.distributionDate).toLocaleDateString(),
                d.member.fullName,
                d.amount,
                d.shareCountAtDistribution
            ]),
            chartData,
            chartType: 'bar',
        };
    }
    
    if (reportType === 'saving-interest') {
        const interestTransactions = await prisma.saving.findMany({
            where: {
                memberId: { in: memberIdsInSchool },
                status: 'approved',
                notes: { contains: 'Monthly interest posting' },
                date: {
                    gte: startDate,
                    lte: endDate,
                },
                ...(savingAccountTypeId && { memberSavingAccountId: { in: (await prisma.memberSavingAccount.findMany({where: { savingAccountTypeId: savingAccountTypeId }, select: {id: true}})).map(a => a.id)}})
            },
            include: { member: { select: { fullName: true } } },
            orderBy: { date: 'desc' }
        });

        const interestByMember: { [key: string]: { name: string, totalInterest: number } } = {};
        interestTransactions.forEach(tx => {
            if (!interestByMember[tx.memberId]) {
                interestByMember[tx.memberId] = { name: tx.member.fullName, totalInterest: 0 };
            }
            interestByMember[tx.memberId].totalInterest += tx.amount;
        });
        
        const totalInterest = Object.values(interestByMember).reduce((sum, member) => sum + member.totalInterest, 0);

        return {
            title: `Saving Interest Report (${periodName})`,
            schoolName: school.name,
            reportDate,
            summary: [
                { label: 'Total Interest Posted', value: `${totalInterest.toFixed(2)} Birr` },
                { label: 'Total Members', value: Object.keys(interestByMember).length.toString() },
            ],
            columns: ['Member ID', 'Name', 'Total Interest'],
            rows: Object.entries(interestByMember).map(([id, data]) => [
                id,
                data.name,
                data.totalInterest
            ]),
            chartType: 'none',
        };
    }

    if (reportType === 'loans' || reportType === 'loans-no-interest') {
        const loans = await prisma.loan.findMany({
            where: {
                memberId: { in: memberIdsInSchool },
                disbursementDate: {
                    gte: startDate,
                    lte: endDate
                },
                ...(loanTypeId && { loanTypeId: loanTypeId })
            },
            include: {
                member: { select: { id: true, fullName: true } },
                loanType: { select: { name: true } }
            },
            orderBy: { disbursementDate: 'desc' }
        });

        const totalPrincipal = loans.reduce((sum, l) => sum + l.principalAmount, 0);
        const totalRemaining = loans.reduce((sum, l) => sum + l.remainingBalance, 0);
        
        const reportTitle = reportType === 'loans-no-interest'
          ? `Loan Report (w/o Interest) (${periodName})`
          : `Loan Report (${periodName})`;

        return {
            title: reportTitle,
            schoolName: school.name,
            reportDate,
            summary: [
                { label: 'Total Loans Disbursed', value: loans.length.toString() },
                { label: 'Total Principal', value: `${totalPrincipal.toFixed(2)} Birr` },
                { label: 'Total Remaining Balance', value: `${totalRemaining.toFixed(2)} Birr` },
            ],
            columns: ['Disbursement Date', 'Member ID', 'Name', 'Loan Type', 'Principal', 'Remaining Balance', 'Status'],
            rows: loans.map(l => [
                new Date(l.disbursementDate).toLocaleDateString(),
                l.member.id,
                l.member.fullName,
                l.loanType.name,
                l.principalAmount,
                l.remainingBalance,
                l.status
            ]),
            chartType: 'none',
        };
    }

    if (reportType === 'loan-repayment') {
        const loans = await prisma.loan.findMany({
            where: {
                memberId: { in: memberIdsInSchool },
                ...(loanTypeId && { loanTypeId: loanTypeId })
            },
            include: {
                member: { select: { id: true, fullName: true } },
                loanType: { select: { name: true } },
                repayments: {
                    where: {
                        paymentDate: {
                            gte: startDate,
                            lte: endDate
                        }
                    }
                }
            },
        });
        
        const reportRows = loans.map(loan => {
            const totalPrincipalPaid = loan.repayments.reduce((sum, r) => sum + r.principalPaid, 0);
            if (totalPrincipalPaid === 0) return null;

            return [
                loan.member.id,
                loan.member.fullName,
                loan.loanType.name,
                totalPrincipalPaid,
                loan.remainingBalance,
                loan.status
            ]
        }).filter((row): row is (string|number)[] => row !== null);

        const totalPrincipalRepaid = reportRows.reduce((sum, row) => sum + (row[3] as number), 0);
        
        return {
            title: `Loan Repayment Report (${periodName})`,
            schoolName: school.name,
            reportDate,
            summary: [
                { label: 'Total Loans with Repayments', value: reportRows.length.toString() },
                { label: 'Total Principal Repaid', value: `${totalPrincipalRepaid.toFixed(2)} Birr` },
            ],
            columns: ['Member ID', 'Name', 'Loan Type', 'Principal Repaid', 'Remaining Balance', 'Status'],
            rows: reportRows,
            chartType: 'none',
        };
    }

    if (reportType === 'loan-interest') {
        const repayments = await prisma.loanRepayment.findMany({
            where: {
                memberId: { in: memberIdsInSchool },
                interestPaid: { gt: 0 },
                paymentDate: {
                    gte: startDate,
                    lte: endDate
                },
                ...(loanTypeId && { loan: { loanTypeId: loanTypeId } })
            },
            include: { 
                member: { select: { fullName: true } },
            },
            orderBy: { paymentDate: 'desc' }
        });
        
        const interestByMember: { [key: string]: { name: string, totalInterest: number } } = {};
        repayments.forEach(r => {
            if (!interestByMember[r.memberId]) {
                interestByMember[r.memberId] = { name: r.member.fullName, totalInterest: 0 };
            }
            interestByMember[r.memberId].totalInterest += r.interestPaid;
        });

        const totalInterestPaid = Object.values(interestByMember).reduce((sum, member) => sum + member.totalInterest, 0);

        return {
            title: `Loan Interest Paid Report (${periodName})`,
            schoolName: school.name,
            reportDate,
            summary: [
                { label: 'Total Interest Paid', value: `${totalInterestPaid.toFixed(2)} Birr` },
                { label: 'Total Members', value: Object.keys(interestByMember).length.toString() }
            ],
            columns: ['Member ID', 'Name', 'Total Interest'],
            rows: Object.entries(interestByMember).map(([id, data]) => [
                id,
                data.name,
                data.totalInterest
            ]),
            chartType: 'none',
        };
    }

    return null;
}
