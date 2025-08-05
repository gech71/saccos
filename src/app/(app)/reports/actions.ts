
'use server';

import prisma from '@/lib/prisma';
import type { Saving, Share, Dividend } from '@prisma/client';
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns';

export async function getSchoolsForReport() {
    return prisma.school.findMany({
        select: {
            id: true,
            name: true,
        },
        orderBy: {
            name: 'asc',
        },
    });
}

export type ReportType = 'savings' | 'share-allocations' | 'dividend-distributions';

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

export async function generateSimpleReport(schoolId: string, reportType: ReportType, year: number, month?: number): Promise<ReportData | null> {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return null;

    const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Define the date range for the report
    let startDate: Date;
    let endDate: Date;
    let periodName: string;

    if (month !== undefined && month >= 0 && month <= 11) {
        // Monthly report
        const reportMonthDate = new Date(year, month);
        startDate = startOfMonth(reportMonthDate);
        endDate = endOfMonth(reportMonthDate);
        periodName = format(reportMonthDate, 'MMMM yyyy');
    } else {
        // Yearly report
        const reportYearDate = new Date(year, 0);
        startDate = startOfYear(reportYearDate);
        endDate = endOfYear(reportYearDate);
        periodName = year.toString();
    }


    if (reportType === 'savings') {
        const membersInSchool = await prisma.member.findMany({
            where: { schoolId },
            include: {
                memberSavingAccounts: {
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
            for (const account of member.memberSavingAccounts) {
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
        }
        
        return {
            title: `Saving Report (${periodName})`,
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
            chartData: [], // Chart data would need to be re-thought for this summary view
            chartType: 'none',
        };
    }
    
    // Fallback for other report types
    const memberIds = (await prisma.member.findMany({
        where: { schoolId },
        select: { id: true }
    })).map(m => m.id);

    if (reportType === 'share-allocations') {
        const shares = await prisma.share.findMany({
            where: { memberId: { in: memberIds }, status: 'approved' },
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
            where: { memberId: { in: memberIds }, status: 'approved' },
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
    
    return null;
}
