
'use server';

import prisma from '@/lib/prisma';
import type { AuditLog, Prisma } from '@prisma/client';

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
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.actorName) {
        where.OR = [
            { user: { name: { contains: filters.actorName, mode: 'insensitive' } } },
            { member: { fullName: { contains: filters.actorName, mode: 'insensitive' } } },
        ];
    }
    if (filters.action) {
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

    return { logs, totalCount };
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    throw new Error('Could not retrieve audit logs.');
  }
}
