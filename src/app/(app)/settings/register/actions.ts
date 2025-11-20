'use server';

import prisma from '@/lib/prisma';
import { registerUserByAdmin } from '../actions';
import { requirePermission } from '@/lib/authorization';
import type { Role } from '@prisma/client';

export async function getRolesForRegistration(): Promise<Pick<Role, 'id' | 'name'>[]> {
    await requirePermission('user:create'); // or "admin:manage-roles"

    return prisma.role.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });
}

// Re-export the main registration action
export { registerUserByAdmin };
