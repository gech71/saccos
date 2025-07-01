
'use server';

import prisma from '@/lib/prisma';
import type { School, SavingAccountType, ShareType } from '@prisma/client';

export interface ForecastResult {
    memberId: string;
    fullName: string;
    schoolName: string;
    expectedContribution: number;
}

export interface ForecastPageData {
    schools: Pick<School, 'id' | 'name'>[];
    savingAccountTypes: Pick<SavingAccountType, 'id' | 'name'>[];
    shareTypes: Pick<ShareType, 'id' | 'name'>[];
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
    
    const members = await prisma.member.findMany({
        where: {
            schoolId,
            status: 'active',
        },
        include: {
            school: { select: { name: true } },
            shareCommitments: {
                where: { shareTypeId: collectionType === 'shares' ? typeId : undefined }
            }
        }
    });

    let results: ForecastResult[] = [];

    if (collectionType === 'savings') {
        results = members
            .filter(m => m.savingAccountTypeId === typeId && (m.expectedMonthlySaving ?? 0) > 0)
            .map(m => ({
                memberId: m.id,
                fullName: m.fullName,
                schoolName: m.school?.name ?? 'N/A',
                expectedContribution: m.expectedMonthlySaving ?? 0,
            }));
    } else { // 'shares'
        results = members
            .map(m => {
                const commitment = m.shareCommitments.find(sc => sc.shareTypeId === typeId);
                if (commitment && commitment.monthlyCommittedAmount > 0) {
                    return {
                        memberId: m.id,
                        fullName: m.fullName,
                        schoolName: m.school?.name ?? 'N/A',
                        expectedContribution: commitment.monthlyCommittedAmount,
                    };
                }
                return null;
            })
            .filter((r): r is ForecastResult => r !== null);
    }
    
    return results.sort((a,b) => a.fullName.localeCompare(b.fullName));
}
