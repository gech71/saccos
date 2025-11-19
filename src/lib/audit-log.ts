
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
    actorId?: string; // actorId is now optional
    targetId?: string;
    targetType?: string;
    details?: Prisma.JsonValue;
  } = {}
) {
  try {
    let actorId = options.actorId;
    let actorName = 'System';
    let actorType: 'ADMIN' | 'MEMBER' | 'SYSTEM' = 'SYSTEM';

    if (!actorId) {
        const session = await auth();
        if (session?.user?.id) {
            actorId = session.user.id;
            actorName = session.user.name || 'Unknown';
            actorType = session.user.isMember ? 'MEMBER' : 'ADMIN';
        }
    }
    
    if (!actorId) {
        console.warn(`Audit log for action "${action}" skipped: No actor ID could be determined.`);
        return;
    }


    const { targetId, targetType, details } = options;

    await prisma.auditLog.create({
      data: {
        actorId,
        actorName,
        actorType,
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
