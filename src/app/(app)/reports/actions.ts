
'use server';

import prisma from '@/lib/prisma';

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
