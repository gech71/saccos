
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
    actorId?: string; // For when session is not available
    targetId?: string;
    targetType?: string;
    details?: Prisma.JsonValue;
  } = {}
) {
  try {
    const session = await auth();
    const sessionUser = session?.user;
    
    let actorId: string | undefined = options.actorId;
    let actorName = 'System';
    let actorType: 'ADMIN' | 'MEMBER' | 'SYSTEM' = 'SYSTEM';
    
    let userId: string | undefined;
    let memberId: string | undefined;

    if (sessionUser) {
        actorId = sessionUser.id;
        actorName = sessionUser.name || 'Unknown';
        if (sessionUser.isMember) {
            actorType = 'MEMBER';
            memberId = sessionUser.id;
        } else {
            actorType = 'ADMIN';
            userId = sessionUser.id;
        }
    }
    
    if (!actorId && !options.actorId) {
        console.warn(`Audit log for action "${action}" skipped: No actor ID could be determined.`);
        return;
    }

    const { targetId, targetType, details } = options;

    await prisma.auditLog.create({
      data: {
        actorName,
        actorType,
        action,
        userId: userId,
        memberId: memberId,
        targetId,
        targetType,
        details,
      },
    });

  } catch (error) {
    console.error("Failed to write to audit log:", error);
  }
}
