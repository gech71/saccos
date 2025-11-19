
'use server';

import prisma from '@/lib/prisma';
import { registerUserByAdmin } from '../actions';
import type { Role } from '@prisma/client';

export async function getRolesForRegistration(): Promise<Pick<Role, 'id' | 'name'>[]> {
    return prisma.role.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });
}

// Re-export the main registration action
export { registerUserByAdmin };
