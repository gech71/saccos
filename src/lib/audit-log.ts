
'use server';

import { auth } from '@/auth';
import prisma from './prisma';
import type { Prisma } from '@prisma/client';

export type AuditAction = 
  // Member actions
  | 'MEMBER_CREATE' | 'MEMBER_UPDATE' | 'MEMBER_DELETE' | 'MEMBER_TRANSFER'
  // Loan actions
  | 'LOAN_CREATE' | 'LOAN_UPDATE' | 'LOAN_DELETE'
  // Repayment actions
  | 'LOAN_REPAYMENT_CREATE'
  // Transaction approval
  | 'TRANSACTION_APPROVE' | 'TRANSACTION_REJECT'
  // Settings
  | 'USER_ROLE_UPDATE' | 'ROLE_CREATE' | 'ROLE_UPDATE' | 'ROLE_DELETE'
  // Authentication
  | 'AUTH_LOGIN_SUCCESS' | 'AUTH_LOGIN_FAIL' | 'AUTH_PASSWORD_RESET';


export async function logAudit(
  action: AuditAction,
  options: {
    targetId?: string;
    targetType?: string;
    details?: Prisma.JsonValue;
  } = {}
) {
  try {
    const session = await auth();
    if (!session?.user) {
      console.warn("Audit log skipped: No active session found.");
      return;
    }

    const { targetId, targetType, details } = options;

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        actorName: session.user.name || 'System',
        actorType: session.user.isMember ? 'MEMBER' : 'ADMIN',
        action,
        targetId,
        targetType,
        details,
      },
    });

  } catch (error) {
    console.error("Failed to write to audit log:", error);
    // In a real-world scenario, you might have a fallback logging mechanism here
  }
}
