

'use server';

import prisma from '@/lib/prisma';
import type { Saving, Share, Dividend, SavingAccountType, Loan, LoanRepayment, LoanType, AppliedServiceCharge } from '@prisma/client';
import { format, startOfYear, endOfYear, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';

export async function getReportPageData() {
    try {
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
    } catch (error) {
        console.error('Failed to load data for reports page:', error);
        throw new Error('Could not load required data for generating reports.');
    }
}

export type ReportType = 'savings' | 'share-allocations' | 'dividend-distributions' | 'saving-interest' | 'loans' | 'loan-interest' | 'loan-repayment' | 'savings-no-interest' | 'loans-no-interest' | 'service-charges';

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

export interface FinancialReportData {
    title: string;
    reportDate: string;
    year1: number;
    year2: number;
    summary: { label: string; value: string; change?: string }[];
    columns: string[];
    rows: { metric: string; year1Value: number; year2Value: number; changePercentage: number }[];
    chartData: { name: string; Income: number; Expenses: number; }[];
}


export async function generateSimpleReport(
    schoolId: string, 
    reportType: ReportType, 
    dateRange: DateRange,
    savingAccountTypeId?: string,
    loanTypeId?: string,
): Promise<ReportData | null> {
    try {
        const school = await prisma.school.findUnique({ where: { id: schoolId } });
        if (!school) return null;

        const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        
        if (!dateRange.from || !dateRange.to) {
            throw new Error("Date range is required for generating a report.");
        }
        
        const from = startOfDay(dateRange.from);
        const to = endOfDay(dateRange.to);

        if (reportType === 'savings' || reportType === 'savings-no-interest') {
            const savingAccountType = await prisma.savingAccountType.findUnique({ where: { id: savingAccountTypeId } });
            if (!savingAccountType) return null;

            const includeInterest = reportType === 'savings';

            let whereClause: any = {
                member: { schoolId: schoolId },
                date: { gte: from, lte: to },
                status: 'approved',
                memberSavingAccountId: { not: null },
                memberSavingAccount: { savingAccountTypeId: savingAccountTypeId },
            };
            
            if (!includeInterest) {
                whereClause.notes = { not: { contains: 'Savings Interest' } };
            }

            const savings = await prisma.saving.findMany({
                where: whereClause,
                include: { member: { select: { fullName: true } } },
                orderBy: { date: 'asc' },
            });

            const totalDeposits = savings.filter(s => s.transactionType === 'deposit').reduce((sum, s) => sum + s.amount, 0);
            const totalWithdrawals = savings.filter(s => s.transactionType === 'withdrawal').reduce((sum, s) => sum + s.amount, 0);

            return {
                title: `${savingAccountType.name} Report`,
                schoolName: school.name,
                reportDate,
                summary: [
                    { label: 'Total Deposits', value: `${totalDeposits.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr` },
                    { label: 'Total Withdrawals', value: `${totalWithdrawals.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr` },
                    { label: 'Net Savings', value: `${(totalDeposits - totalWithdrawals).toLocaleString(undefined, {minimumFractionDigits: 2})} Birr` },
                ],
                columns: ['Date', 'Member Name', 'Transaction Type', 'Amount (Birr)'],
                rows: savings.map(s => [format(new Date(s.date), 'PPP'), s.member.fullName, s.transactionType, s.amount]),
                chartData: savings.map(s => ({ name: s.member.fullName, Amount: s.amount })),
                chartType: 'bar',
            };
        }
        
        return null;
    } catch (error) {
        console.error('Failed to generate report:', error);
        throw new Error('An unexpected error occurred while generating the report.');
    }
}


async function getFinancialsForYear(year: number) {
    const startDate = startOfYear(new Date(year, 0, 1));
    const endDate = endOfYear(new Date(year, 11, 31));

    const [loanInterest, serviceCharges, savingsInterest, loansDisbursed, savingsDeposits, savingsWithdrawals] = await Promise.all([
        prisma.loanRepayment.aggregate({
            _sum: { interestPaid: true },
            where: { status: 'approved', paymentDate: { gte: startDate, lte: endDate } },
        }),
        prisma.appliedServiceCharge.aggregate({
            _sum: { amountCharged: true },
            where: { status: 'paid', dateApplied: { gte: startDate, lte: endDate } },
        }),
        prisma.saving.aggregate({
            _sum: { amount: true },
            where: { status: 'approved', transactionType: 'deposit', notes: { contains: 'Savings Interest' }, date: { gte: startDate, lte: endDate } },
        }),
        prisma.loan.aggregate({
            _sum: { principalAmount: true },
            where: { status: { not: 'rejected' }, disbursementDate: { gte: startDate, lte: endDate } },
        }),
        prisma.saving.aggregate({
            _sum: { amount: true },
            where: { status: 'approved', transactionType: 'deposit', date: { gte: startDate, lte: endDate } },
        }),
        prisma.saving.aggregate({
            _sum: { amount: true },
            where: { status: 'approved', transactionType: 'withdrawal', date: { gte: startDate, lte: endDate } },
        })
    ]);

    const totalIncome = (loanInterest._sum.interestPaid || 0) + (serviceCharges._sum.amountCharged || 0);
    const totalExpenses = savingsInterest._sum.amount || 0;
    const netIncome = totalIncome - totalExpenses;
    const totalLoansDisbursed = loansDisbursed._sum.principalAmount || 0;
    const netSavings = (savingsDeposits._sum.amount || 0) - (savingsWithdrawals._sum.amount || 0);

    return {
        totalIncome,
        totalExpenses,
        netIncome,
        totalLoansDisbursed,
        netSavings,
        loanInterest: loanInterest._sum.interestPaid || 0,
        serviceCharges: serviceCharges._sum.amountCharged || 0,
        savingsInterest: savingsInterest._sum.amount || 0,
    };
}


export async function generateFinancialReport(year1: number, year2: number): Promise<FinancialReportData> {
    const [dataYear1, dataYear2] = await Promise.all([
        getFinancialsForYear(year1),
        getFinancialsForYear(year2),
    ]);

    const calculateChange = (val1: number, val2: number) => {
        if (val2 === 0) return val1 > 0 ? 100 : 0;
        return ((val1 - val2) / val2) * 100;
    };

    const formatChange = (change: number) => {
        if (change === 0) return 'No Change';
        return `${change > 0 ? 'Increase' : 'Decrease'} of ${Math.abs(change).toFixed(2)}%`;
    }
    
    const netIncomeChange = calculateChange(dataYear1.netIncome, dataYear2.netIncome);

    return {
        title: `Financial Report: ${year1} vs ${year2}`,
        reportDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        year1,
        year2,
        summary: [
            { label: `Net Income (${year1})`, value: `${dataYear1.netIncome.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr` },
            { label: `Net Income (${year2})`, value: `${dataYear2.netIncome.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr` },
            { label: 'Net Income Change', value: `${netIncomeChange.toFixed(2)}%`, change: formatChange(netIncomeChange) },
            { label: `Total Loans Disbursed (${year1})`, value: `${dataYear1.totalLoansDisbursed.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr` },
        ],
        columns: ['Metric', year1.toString(), year2.toString(), 'Change'],
        rows: [
            { metric: 'Total Income', year1Value: dataYear1.totalIncome, year2Value: dataYear2.totalIncome, changePercentage: calculateChange(dataYear1.totalIncome, dataYear2.totalIncome) },
            { metric: '  - Loan Interest Collected', year1Value: dataYear1.loanInterest, year2Value: dataYear2.loanInterest, changePercentage: calculateChange(dataYear1.loanInterest, dataYear2.loanInterest) },
            { metric: '  - Service Charges Collected', year1Value: dataYear1.serviceCharges, year2Value: dataYear2.serviceCharges, changePercentage: calculateChange(dataYear1.serviceCharges, dataYear2.serviceCharges) },
            { metric: 'Total Expenses (Interest Paid)', year1Value: dataYear1.totalExpenses, year2Value: dataYear2.totalExpenses, changePercentage: calculateChange(dataYear1.totalExpenses, dataYear2.totalExpenses) },
            { metric: 'Net Income', year1Value: dataYear1.netIncome, year2Value: dataYear2.netIncome, changePercentage: netIncomeChange },
            { metric: 'Total Loans Disbursed', year1Value: dataYear1.totalLoansDisbursed, year2Value: dataYear2.totalLoansDisbursed, changePercentage: calculateChange(dataYear1.totalLoansDisbursed, dataYear2.totalLoansDisbursed) },
            { metric: 'Net Savings Growth', year1Value: dataYear1.netSavings, year2Value: dataYear2.netSavings, changePercentage: calculateChange(dataYear1.netSavings, dataYear2.netSavings) },
        ],
        chartData: [
            { name: year1.toString(), Income: dataYear1.totalIncome, Expenses: dataYear1.totalExpenses },
            { name: year2.toString(), Income: dataYear2.totalIncome, Expenses: dataYear2.totalExpenses },
        ],
    };
}
