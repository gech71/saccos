
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
    actorType?: 'ADMIN' | 'MEMBER' | 'SYSTEM' | 'ANONYMOUS';
  } = {}
) {
  try {
    const session = await auth();
    const sessionUser = session?.user;
    
    let actorName = options.actorType === 'ANONYMOUS' ? 'Anonymous' : 'System';
    let actorType: 'ADMIN' | 'MEMBER' | 'SYSTEM' | 'ANONYMOUS' = options.actorType || 'SYSTEM';
    
    let userId: string | undefined;
    let memberId: string | undefined;

    if (sessionUser) {
        actorName = sessionUser.name || 'Unknown';
        if (sessionUser.isMember) {
            actorType = 'MEMBER';
            memberId = sessionUser.id;
        } else {
            actorType = 'ADMIN';
            userId = sessionUser.id;
        }
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

    