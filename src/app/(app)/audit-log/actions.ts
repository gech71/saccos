
'use server';

import prisma from '@/lib/prisma';
import type { AuditLog, Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/authorization';

export interface AuditLogWithActor extends AuditLog {
  user: { name: string | null } | null;
  member: { fullName: string | null } | null;
}

export async function getAuditLogs(
  page: number = 1,
  limit: number = 15,
  filters: {
    actorName?: string;
    action?: string;
    targetId?: string;
  } = {}
): Promise<{ logs: AuditLogWithActor[]; totalCount: number }> {
  try {
    await requirePermission('audit:view');
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.actorName) {
        where.actorName = { contains: filters.actorName, mode: 'insensitive' };
    }
    if (filters.action && filters.action !== 'all') {
      where.action = { equals: filters.action };
    }
    if (filters.targetId) {
      where.targetId = { contains: filters.targetId, mode: 'insensitive' };
    }

    const [logs, totalCount] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        include: {
          user: { select: { name: true } },
          member: { select: { fullName: true } },
        },
        orderBy: { timestamp: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // The type assertion is safe because of the include statement.
    return { logs: logs as AuditLogWithActor[], totalCount };
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    throw new Error('Could not retrieve audit logs.');
  }
}
