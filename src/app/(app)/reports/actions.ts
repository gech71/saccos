
'use server';

import prisma from '@/lib/prisma';
import type { Saving, Share, Dividend, SavingAccountType, Loan, LoanRepayment } from '@prisma/client';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';

export async function getReportPageData() {
    const [schools, savingAccountTypes] = await Promise.all([
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
        })
    ]);
    
    return { schools, savingAccountTypes };
}

export type ReportType = 'savings' | 'share-allocations' | 'dividend-distributions' | 'saving-interest' | 'loans' | 'loan-interest';

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
    savingAccountTypeId?: string
): Promise<ReportData | null> {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return null;

    const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Define the date range for the report
    if (!dateRange.from || !dateRange.to) {
        throw new Error("Date range is required for generating a report.");
    }
    const startDate = startOfDay(dateRange.from);
    const endDate = endOfDay(dateRange.to);
    const periodName = `${format(startDate, 'PPP')} - ${format(endDate, 'PPP')}`;


    if (reportType === 'savings') {
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
            // Since we filtered, there should be exactly one account of the specified type.
            const account = member.memberSavingAccounts[0];
            if (!account) continue;

            // Calculate initial balance at the START of the period
            const transactionsBefore = account.savings.filter(s => new Date(s.date) < startDate);
            let initialBalance = account.initialBalance;
            transactionsBefore.forEach(tx => {
                initialBalance += tx.transactionType === 'deposit' ? tx.amount : -tx.amount;
            });

            // Calculate deposits and withdrawals WITHIN the period
            const transactionsDuring = account.savings.filter(s => {
                const txDate = new Date(s.date);
                return txDate >= startDate && txDate <= endDate;
            });
            
            const totalDeposit = transactionsDuring.filter(s => s.transactionType === 'deposit').reduce((sum, s) => sum + s.amount, 0);
            const totalWithdrawal = transactionsDuring.filter(s => s.transactionType === 'withdrawal').reduce((sum, s) => sum + s.amount, 0);
            
            // Only include members with activity or a balance
            if (initialBalance === 0 && totalDeposit === 0 && totalWithdrawal === 0) {
                continue;
            }

            const netSaving = totalDeposit - totalWithdrawal;
            const totalAmount = initialBalance + netSaving; // Simplified total, as interest is posted as a transaction

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
        
        return {
            title: `Saving Report for ${savingAccountType.name} (${periodName})`,
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
    
    // Get all member IDs for the selected school
    const memberIds = (await prisma.member.findMany({
        where: { schoolId },
        select: { id: true }
    })).map(m => m.id);

    if (reportType === 'share-allocations') {
        const shares = await prisma.share.findMany({
            where: { 
                memberId: { in: memberIds }, 
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
                memberId: { in: memberIds }, 
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
                memberId: { in: memberIds },
                status: 'approved',
                notes: { contains: 'Monthly interest posting' },
                date: {
                    gte: startDate,
                    lte: endDate,
                }
            },
            include: { member: { select: { fullName: true } } },
            orderBy: { date: 'desc' }
        });

        const totalInterest = interestTransactions.reduce((sum, tx) => sum + tx.amount, 0);

        return {
            title: `Saving Interest Report (${periodName})`,
            schoolName: school.name,
            reportDate,
            summary: [
                { label: 'Total Interest Posted', value: `${totalInterest.toFixed(2)} Birr` },
                { label: 'Total Transactions', value: interestTransactions.length.toString() },
            ],
            columns: ['Date', 'Member', 'Interest Amount'],
            rows: interestTransactions.map(tx => [
                new Date(tx.date).toLocaleDateString(),
                tx.member.fullName,
                tx.amount
            ]),
            chartType: 'none',
        };
    }

    if (reportType === 'loans') {
        const loans = await prisma.loan.findMany({
            where: {
                memberId: { in: memberIds },
                disbursementDate: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                member: { select: { fullName: true } },
                loanType: { select: { name: true } }
            },
            orderBy: { disbursementDate: 'desc' }
        });

        const totalPrincipal = loans.reduce((sum, l) => sum + l.principalAmount, 0);
        const totalRemaining = loans.reduce((sum, l) => sum + l.remainingBalance, 0);

        return {
            title: `Loan Report (${periodName})`,
            schoolName: school.name,
            reportDate,
            summary: [
                { label: 'Total Loans Disbursed', value: loans.length.toString() },
                { label: 'Total Principal', value: `${totalPrincipal.toFixed(2)} Birr` },
                { label: 'Total Remaining Balance', value: `${totalRemaining.toFixed(2)} Birr` },
            ],
            columns: ['Disbursement Date', 'Member', 'Loan Type', 'Principal', 'Remaining Balance', 'Status'],
            rows: loans.map(l => [
                new Date(l.disbursementDate).toLocaleDateString(),
                l.member.fullName,
                l.loanType.name,
                l.principalAmount,
                l.remainingBalance,
                l.status
            ]),
            chartType: 'none',
        };
    }

    if (reportType === 'loan-interest') {
        const repayments = await prisma.loanRepayment.findMany({
            where: {
                memberId: { in: memberIds },
                interestPaid: { gt: 0 },
                paymentDate: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: { 
                member: { select: { fullName: true } },
                loan: { select: { loanType: { select: { name: true } } } }
            },
            orderBy: { paymentDate: 'desc' }
        });

        const totalInterestPaid = repayments.reduce((sum, r) => sum + r.interestPaid, 0);

        return {
            title: `Loan Interest Paid Report (${periodName})`,
            schoolName: school.name,
            reportDate,
            summary: [
                { label: 'Total Interest Paid', value: `${totalInterestPaid.toFixed(2)} Birr` },
                { label: 'Total Repayments with Interest', value: repayments.length.toString() }
            ],
            columns: ['Payment Date', 'Member', 'Loan Type', 'Interest Paid'],
            rows: repayments.map(r => [
                new Date(r.paymentDate).toLocaleDateString(),
                r.member.fullName,
                r.loan?.loanType.name || 'N/A',
                r.interestPaid
            ]),
            chartType: 'none',
        };
    }

    return null;
}
