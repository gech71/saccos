

'use server';

import prisma from '@/lib/prisma';
import type { Saving, Share, Dividend, SavingAccountType, Loan, LoanRepayment, LoanType, AppliedServiceCharge } from '@prisma/client';
import { format, startOfYear, endOfYear, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { requirePermission } from '@/lib/authorization';

export async function getReportPageData() {
    await requirePermission('report:view');
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
        await requirePermission('report:view');
        const school = await prisma.school.findUnique({ where: { id: schoolId } });
        if (!school) return null;

        const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        
        if (!dateRange.from || !dateRange.to) {
            throw new Error("Date range is required for generating a report.");
        }
        
        const from = startOfDay(dateRange.from);
        const to = endOfDay(dateRange.to);
        
        let whereClause: any = {
            member: { schoolId: schoolId },
            status: 'approved',
        };

        if (reportType === 'savings' || reportType === 'savings-no-interest' || reportType === 'saving-interest') {
            const savingAccountType = await prisma.savingAccountType.findUnique({ where: { id: savingAccountTypeId } });
            if (!savingAccountType) return null;

            let title = '';
            let savingWhereClause: any = {
                ...whereClause,
                date: { gte: from, lte: to },
                memberSavingAccountId: { not: null },
                memberSavingAccount: { savingAccountTypeId: savingAccountTypeId },
            };

            if (reportType === 'savings') {
                title = `${savingAccountType.name} Report`;
            } else if (reportType === 'savings-no-interest') {
                title = `${savingAccountType.name} Report (Excluding Interest)`;
                savingWhereClause.notes = { not: { contains: 'Savings Interest' } };
            } else if (reportType === 'saving-interest') {
                title = `${savingAccountType.name} Interest Report`;
                savingWhereClause.notes = { contains: 'Savings Interest' };
                savingWhereClause.transactionType = 'deposit';
            }

            const savings = await prisma.saving.findMany({
                where: savingWhereClause,
                include: { member: { select: { fullName: true } } },
                orderBy: { date: 'asc' },
            });

            const totalDeposits = savings.filter(s => s.transactionType === 'deposit').reduce((sum, s) => sum + s.amount, 0);
            const totalWithdrawals = savings.filter(s => s.transactionType === 'withdrawal').reduce((sum, s) => sum + s.amount, 0);

            return {
                title: title,
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
        } else if (reportType === 'loans' || reportType === 'loans-no-interest') {
            const loanType = loanTypeId ? await prisma.loanType.findUnique({ where: { id: loanTypeId } }) : null;
            let loanWhereClause: any = {
                member: { schoolId },
                status: { not: 'rejected' },
                disbursementDate: { gte: from, lte: to },
            };
            if(loanTypeId) loanWhereClause.loanTypeId = loanTypeId;
            
            const loans = await prisma.loan.findMany({
                where: loanWhereClause,
                include: { member: { select: { fullName: true } }, loanType: { select: { name: true } } },
                orderBy: { disbursementDate: 'asc' },
            });
            const totalDisbursed = loans.reduce((sum, l) => sum + l.principalAmount, 0);

            return {
                title: `${loanType?.name || 'All'} Loan Disbursement Report`,
                schoolName: school.name,
                reportDate,
                summary: [{ label: 'Total Disbursed', value: `${totalDisbursed.toLocaleString(undefined, { minimumFractionDigits: 2 })} Birr` }],
                columns: ['Disbursement Date', 'Member Name', 'Loan Type', 'Principal Amount (Birr)', 'Term (Months)'],
                rows: loans.map(l => [format(new Date(l.disbursementDate), 'PPP'), l.member.fullName, l.loanType.name, l.principalAmount, l.loanTerm]),
                chartType: 'bar',
                chartData: loans.map(l => ({ name: l.member.fullName, Amount: l.principalAmount })),
            };
        } else if (reportType === 'loan-repayment' || reportType === 'loan-interest') {
             const loanType = loanTypeId ? await prisma.loanType.findUnique({ where: { id: loanTypeId } }) : null;
             let repaymentWhereClause: any = {
                member: { schoolId },
                status: 'approved',
                paymentDate: { gte: from, lte: to },
             };
             if (loanTypeId) repaymentWhereClause.loan = { loanTypeId };

             if (reportType === 'loan-interest') {
                repaymentWhereClause.interestPaid = { gt: 0 };
             }

             const repayments = await prisma.loanRepayment.findMany({
                where: repaymentWhereClause,
                include: { member: { select: { fullName: true }}, loan: { include: { loanType: { select: { name: true }}}}},
                orderBy: { paymentDate: 'asc' }
             });

             const totalRepaid = repayments.reduce((sum, r) => sum + r.amountPaid, 0);
             const totalPrincipal = repayments.reduce((sum, r) => sum + r.principalPaid, 0);
             const totalInterest = repayments.reduce((sum, r) => sum + r.interestPaid, 0);
             
             return {
                title: `${reportType === 'loan-interest' ? 'Loan Interest Collected' : 'Loan Repayment'} Report for ${loanType?.name || 'All Loans'}`,
                schoolName: school.name,
                reportDate,
                summary: [
                    { label: 'Total Repaid', value: `${totalRepaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} Birr` },
                    { label: 'Total Principal Paid', value: `${totalPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2 })} Birr` },
                    { label: 'Total Interest Paid', value: `${totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })} Birr` },
                ],
                columns: ['Payment Date', 'Member Name', 'Loan Type', 'Amount Paid', 'Principal Paid', 'Interest Paid'],
                rows: repayments.map(r => [format(new Date(r.paymentDate), 'PPP'), r.member.fullName, r.loan.loanType.name, r.amountPaid, r.principalPaid, r.interestPaid]),
                chartType: 'bar',
                chartData: repayments.map(r => ({ name: r.member.fullName, Amount: r.amountPaid })),
             };
        } else if (reportType === 'share-allocations') {
             const sharePayments = await prisma.sharePayment.findMany({
                where: {
                    commitment: { member: { schoolId }},
                    status: 'approved',
                    paymentDate: { gte: from, lte: to }
                },
                include: { commitment: { include: { member: { select: { fullName: true }}, shareType: { select: { name: true } }}}},
                orderBy: { paymentDate: 'asc' }
             });
             const totalPaid = sharePayments.reduce((sum, p) => sum + p.amount, 0);

             return {
                title: 'Share Payments Report',
                schoolName: school.name,
                reportDate,
                summary: [{ label: 'Total Share Payments', value: `${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} Birr` }],
                columns: ['Payment Date', 'Member Name', 'Share Type', 'Amount Paid (Birr)'],
                rows: sharePayments.map(p => [format(new Date(p.paymentDate), 'PPP'), p.commitment.member.fullName, p.commitment.shareType.name, p.amount]),
                chartType: 'bar',
                chartData: sharePayments.map(p => ({ name: p.commitment.member.fullName, Amount: p.amount })),
             };
        } else if (reportType === 'dividend-distributions') {
            const dividends = await prisma.dividend.findMany({
                where: { member: { schoolId }, status: 'approved', distributionDate: { gte: from, lte: to }},
                include: { member: { select: { fullName: true }}},
                orderBy: { distributionDate: 'asc' },
            });
            const totalDistributed = dividends.reduce((sum, d) => sum + d.amount, 0);

            return {
                title: 'Dividend Distribution Report',
                schoolName: school.name,
                reportDate,
                summary: [{ label: 'Total Dividends Distributed', value: `${totalDistributed.toLocaleString(undefined, {minimumFractionDigits: 2})} Birr` }],
                columns: ['Distribution Date', 'Member Name', 'Shares Held', 'Dividend Amount (Birr)'],
                rows: dividends.map(d => [format(new Date(d.distributionDate), 'PPP'), d.member.fullName, d.shareCountAtDistribution, d.amount]),
                chartType: 'bar',
                chartData: dividends.map(d => ({ name: d.member.fullName, Amount: d.amount })),
            };
        } else if (reportType === 'service-charges') {
            const charges = await prisma.appliedServiceCharge.findMany({
                where: { member: { schoolId }, status: 'paid', dateApplied: { gte: from, lte: to }},
                include: { member: { select: { fullName: true }}, serviceChargeType: { select: { name: true }}},
                orderBy: { dateApplied: 'asc' }
            });
            const totalCollected = charges.reduce((sum, c) => sum + c.amountCharged, 0);
            return {
                title: 'Paid Service Charges Report',
                schoolName: school.name,
                reportDate,
                summary: [{ label: 'Total Service Charges Collected', value: `${totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })} Birr`}],
                columns: ['Date Paid', 'Member Name', 'Charge Type', 'Amount (Birr)'],
                rows: charges.map(c => [format(new Date(c.dateApplied), 'PPP'), c.member.fullName, c.serviceChargeType.name, c.amountCharged]),
                chartType: 'bar',
                chartData: charges.map(c => ({ name: c.serviceChargeType.name, Amount: c.amountCharged })),
            }
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
