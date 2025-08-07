
'use server';

import prisma from '@/lib/prisma';
import type { School, SavingAccountType, ShareType, Member, ServiceChargeType } from '@prisma/client';

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
}

export async function getForecastPageData(): Promise<ForecastPageData> {
    const [schools, savingAccountTypes, shareTypes] = await Promise.all([
        prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.savingAccountType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.shareType.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return { schools, savingAccountTypes, shareTypes };
}

export async function getCollectionForecast(criteria: {
    schoolId: string;
    collectionType: 'savings' | 'shares';
    typeId: string;
}): Promise<ForecastResult[]> {
    const { schoolId, collectionType, typeId } = criteria;
    
    const [members, monthlyServiceCharges] = await Promise.all([
        prisma.member.findMany({
            where: {
                schoolId,
                status: 'active',
            },
            include: {
                school: { select: { name: true } },
                shareCommitments: {
                    where: { shareTypeId: collectionType === 'shares' ? typeId : undefined }
                },
                memberSavingAccounts: {
                    where: { savingAccountTypeId: collectionType === 'savings' ? typeId : undefined }
                }
            }
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
    } else { // 'shares'
        results = members
            .map(m => {
                const commitment = m.shareCommitments.find(sc => sc.shareTypeId === typeId);
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
    }
    
    return results.sort((a,b) => a.fullName.localeCompare(b.fullName));
}
