
'use server';

import prisma from '@/lib/prisma';
import type { Saving, Share, Dividend } from '@prisma/client';
import { format } from 'date-fns';

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

export async function generateSimpleReport(schoolId: string, reportType: ReportType): Promise<ReportData | null> {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return null;

    const memberIds = (await prisma.member.findMany({
        where: { schoolId },
        select: { id: true }
    })).map(m => m.id);
    
    const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    if (reportType === 'savings') {
        const savings = await prisma.saving.findMany({
            where: { memberId: { in: memberIds }, status: 'approved' },
            include: { member: { select: { fullName: true }}},
            orderBy: { date: 'desc' }
        });
        
        const totalDeposits = savings.filter(s => s.transactionType === 'deposit').reduce((sum, s) => sum + s.amount, 0);
        const totalWithdrawals = savings.filter(s => s.transactionType === 'withdrawal').reduce((sum, s) => sum + s.amount, 0);

        const monthlyData: { [key: string]: { Deposits: number, Withdrawals: number } } = {};
        savings.forEach(s => {
            const monthKey = format(new Date(s.date), 'yyyy-MM');
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { Deposits: 0, Withdrawals: 0 };
            }
            if (s.transactionType === 'deposit') {
                monthlyData[monthKey].Deposits += s.amount;
            } else {
                monthlyData[monthKey].Withdrawals += s.amount;
            }
        });

        const chartData = Object.keys(monthlyData).map(key => ({
            month: format(new Date(key), 'MMM yy'),
            ...monthlyData[key]
        })).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

        return {
            title: 'Savings Transaction Report',
            schoolName: school.name,
            reportDate,
            summary: [
                { label: 'Total Deposits', value: `Birr ${totalDeposits.toFixed(2)}` },
                { label: 'Total Withdrawals', value: `Birr ${totalWithdrawals.toFixed(2)}` },
                { label: 'Net Savings', value: `Birr ${(totalDeposits - totalWithdrawals).toFixed(2)}` },
                { label: 'Total Transactions', value: savings.length.toString() },
            ],
            columns: ['Date', 'Member', 'Type', 'Amount', 'Status'],
            rows: savings.map(s => [
                new Date(s.date).toLocaleDateString(),
                s.member.fullName,
                s.transactionType,
                s.amount,
                s.status
            ]),
            chartData,
            chartType: 'bar',
        };
    }
    
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
                { label: 'Total Value of Shares', value: `Birr ${totalSharesValue.toFixed(2)}` },
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
                { label: 'Total Dividends Distributed', value: `Birr ${totalDividendAmount.toFixed(2)}` },
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
