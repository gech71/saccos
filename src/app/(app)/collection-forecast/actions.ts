
'use server';

import prisma from '@/lib/prisma';
import type { School, SavingAccountType, ShareType, Member, ServiceChargeType, LoanType } from '@prisma/client';
import { requirePermission } from '@/lib/authorization';

export interface ForecastResult {
    memberId: string;
    fullName: string;
    schoolName: string;
    expectedContribution: number;
}

export interface ForecastPageData {
    schools: Pick<School, 'id', 'name'>[];
    savingAccountTypes: Pick<SavingAccountType, 'id', 'name'>[];
    shareTypes: Pick<ShareType, 'id', 'name'>[];
    loanTypes: Pick<LoanType, 'id', 'name'>[];
}

export async function getForecastPageData(): Promise<ForecastPageData> {
    try {
        await requirePermission('collectionForecast:view');
    } catch (err) {
        return { schools: [], savingAccountTypes: [], shareTypes: [], loanTypes: [] };
    }
    const [schools, savingAccountTypes, shareTypes, loanTypes] = await Promise.all([
        prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.savingAccountType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.shareType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.loanType.findMany({ select: { id: true, name: true}, orderBy: { name: 'asc' }}),
    ]);
    return { schools, savingAccountTypes, shareTypes, loanTypes };
}

export async function getCollectionForecast(criteria: {
    schoolId: string;
    collectionType: 'savings' | 'shares' | 'loans';
    typeId: string;
}): Promise<ForecastResult[]> {
    try {
        await requirePermission('collectionForecast:view');
    } catch (err) {
        return [];
    }
    const { schoolId, collectionType, typeId } = criteria;

    const includeClause: any = {
        school: { select: { name: true } },
        memberSavingAccounts: {},
        memberShareCommitments: {},
        loans: {
            where: {
                status: { in: ['active', 'overdue'] }
            }
        }
    };

    if (collectionType === 'shares') {
        includeClause.memberShareCommitments.where = { shareTypeId: typeId };
    }
    if (collectionType === 'savings') {
        includeClause.memberSavingAccounts.where = { savingAccountTypeId: typeId };
    }
     if (collectionType === 'loans') {
        includeClause.loans.where.loanTypeId = typeId;
    }

    
    const [members, monthlyServiceCharges] = await Promise.all([
        prisma.member.findMany({
            where: {
                schoolId,
                status: 'active',
            },
            include: includeClause,
        }),
        prisma.serviceChargeType.findMany({
            where: { frequency: 'monthly' }
        })
    ]);

    const totalMonthlyCharges = monthlyServiceCharges.reduce((sum, charge) => sum + charge.amount, 0);

    let results: ForecastResult[] = [];

    if (collectionType === 'savings') {
        results = members
            .map(m => {
                const relevantAccount = m.memberSavingAccounts.find(acc => acc.savingAccountTypeId === typeId);
                const expectedSaving = relevantAccount?.expectedMonthlySaving ?? 0;
                const totalExpected = expectedSaving + totalMonthlyCharges;

                if (totalExpected > 0) {
                    return {
                        memberId: m.id,
                        fullName: m.fullName,
                        schoolName: m.school?.name ?? 'N/A',
                        expectedContribution: totalExpected,
                    };
                }
                return null;
            })
            .filter((r): r is ForecastResult => r !== null);
    } else if (collectionType === 'shares') {
        results = members
            .map(m => {
                const commitment = m.memberShareCommitments.find(sc => sc.shareTypeId === typeId);
                const expectedShare = commitment?.monthlyCommittedAmount ?? 0;
                const totalExpected = expectedShare + totalMonthlyCharges;
                
                if (totalExpected > 0) {
                    return {
                        memberId: m.id,
                        fullName: m.fullName,
                        schoolName: m.school?.name ?? 'N/A',
                        expectedContribution: totalExpected,
                    };
                }
                return null;
            })
            .filter((r): r is ForecastResult => r !== null);
    } else { // loans
        results = members
            .flatMap(m => m.loans.map(loan => ({ member: m, loan })))
            .map(({member, loan}) => {
                const expectedRepayment = loan.monthlyRepaymentAmount ?? 0;
                if (expectedRepayment > 0) {
                    return {
                        memberId: member.id,
                        fullName: member.fullName,
                        schoolName: member.school?.name ?? 'N/A',
                        expectedContribution: expectedRepayment + totalMonthlyCharges,
                    };
                }
                return null;
            })
            .filter((r): r is ForecastResult => r !== null);
    }
    
    return results.sort((a,b) => a.fullName.localeCompare(b.fullName));
}
