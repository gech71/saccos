/**
 * Session Management Utilities
 * Handles concurrent session limits, session tracking, and revocation
 */

import prisma from './prisma';
import crypto from 'crypto';

const MAX_CONCURRENT_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '1', 10) || 1; // Maximum concurrent sessions per user
const ALLOW_CONCURRENT_SESSIONS = (process.env.ALLOW_CONCURRENT_SESSIONS || 'false').toLowerCase() === 'true';

/**
 * Hash a refresh token for secure storage
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new active session
 * Enforces concurrent session limits by invalidating oldest sessions if limit exceeded
 */
export async function createActiveSession(params: {
  sessionId: string;
  userId: string;
  userType: 'user' | 'member';
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  // If true, actively replace existing sessions to enforce the concurrency limit.
  // When false (default) the function will avoid aggressive invalidation to
  // prevent accidental revocation during refresh creation or parallel requests.
  forceReplace?: boolean;
}): Promise<void> {
  const { sessionId, userId, userType, refreshToken, ipAddress, userAgent, expiresAt } = params;
  const forceReplace = !!(params as any).forceReplace;
  
  // Hash the refresh token before storing
  const hashedRefreshToken = hashRefreshToken(refreshToken);
  
  // Idempotency: If a session with the same sessionId already exists and is active,
  // refresh that record instead of creating a new one. This avoids duplicate
  // sessions and prevents unnecessary invalidation churn when multiple requests
  // race to create a refresh token/session for the same user.
  const existing = await prisma.activeSession.findFirst({
    where: { sessionId, userId, userType, expiresAt: { gt: new Date() } },
  });
  if (existing) {
    await prisma.activeSession.update({
      where: { id: existing.id },
      data: { refreshToken: hashedRefreshToken, ipAddress, userAgent, expiresAt, lastActiveAt: new Date() },
    });
    console.debug('[session-management] refreshed existing active session', { id: existing.id, sessionId: existing.sessionId, userId, userType, expiresAt });
    return;
  }
  
  // Check current active sessions for this user
  const activeSessions = await prisma.activeSession.findMany({
    where: {
      userId,
      userType,
      expiresAt: { gt: new Date() }, // Only count non-expired sessions
    },
    orderBy: { createdAt: 'asc' }, // Oldest first
  });
  
  // If concurrency is allowed, skip invalidation entirely.
  if (!ALLOW_CONCURRENT_SESSIONS && activeSessions.length >= MAX_CONCURRENT_SESSIONS) {
    if (MAX_CONCURRENT_SESSIONS === 1) {
      if (forceReplace) {
        // Special case: when limit is 1 and caller requests replacement, invalidate ALL existing sessions
        console.debug(`[session-management] force-replacing existing sessions for userId=${userId}, userType=${userType}`);
        await prisma.activeSession.deleteMany({
          where: {
            userId,
            userType,
            expiresAt: { gt: new Date() },
          },
        });
      } else {
        // Non-forcing path: avoid aggressive invalidation which can cause churn
        // during page navigation or parallel refresh creation. Log and proceed
        // to create the session (may temporarily exceed the configured limit),
        // keeping the user experience stable.
        console.debug('[session-management] concurrent limit reached but forceReplace not set — skipping invalidation to avoid churn');
      }
    } else {
      if (forceReplace) {
        // For limits > 1 and forced replacement, invalidate the oldest sessions
        const sessionsToKeep = MAX_CONCURRENT_SESSIONS - 1;
        const sessionsToInvalidateCount = activeSessions.length - sessionsToKeep;
        if (sessionsToInvalidateCount > 0) {
          const sessionsToInvalidate = activeSessions.slice(0, sessionsToInvalidateCount);
          console.debug('[session-management] invalidating oldest sessions', sessionsToInvalidate.map(s => s.id));
          await prisma.activeSession.deleteMany({
            where: {
              id: { in: sessionsToInvalidate.map((s: { id: string }) => s.id) },
            },
          });
        }
      } else {
        console.debug('[session-management] concurrent limit reached and forceReplace not set — skipping invalidation');
      }
    }
  }
  
  // Create the new session
  const created = await prisma.activeSession.create({
    data: {
      sessionId,
      userId,
      userType,
      refreshToken: hashedRefreshToken,
      ipAddress,
      userAgent,
      expiresAt,
    },
  });

  console.debug('[session-management] created active session', { id: created.id, sessionId: created.sessionId, userId, userType, expiresAt });
}

/**
 * Validate if a refresh token exists and is active
 * Also validates that the sessionId from the token payload matches the database record
 * This ensures refresh tokens are bound to specific sessions and prevents token reuse
 */
export async function validateRefreshToken(
  refreshToken: string,
  userId: string,
  userType: 'user' | 'member',
  expectedSessionId?: string
): Promise<boolean> {
  const hashedToken = hashRefreshToken(refreshToken);
  const now = new Date();
  
  const session = await prisma.activeSession.findFirst({
    where: {
      refreshToken: hashedToken,
      userId,
      userType,
      expiresAt: { gt: now },
    },
  });
  
  if (session) {
    // Additional security: Verify sessionId binding if provided
    // This ensures the refresh token is bound to the specific session
    if (expectedSessionId && session.sessionId !== expectedSessionId) {
      console.warn(`[session-management] Session ID mismatch - expected ${expectedSessionId}, found ${session.sessionId}`);
      return false;
    }
    
    // Update last active timestamp
    await prisma.activeSession.update({
      where: { id: session.id },
      data: { lastActiveAt: now },
    });
    return true;
  }
  
  return false;
}

/**
 * Invalidate a specific session by refresh token
 */
export async function invalidateSessionByRefreshToken(refreshToken: string): Promise<void> {
  const hashedToken = hashRefreshToken(refreshToken);
  await prisma.activeSession.deleteMany({
    where: { refreshToken: hashedToken },
  });
}

/**
 * Invalidate a specific session by session ID
 */
export async function invalidateSessionById(sessionId: string): Promise<void> {
  await prisma.activeSession.deleteMany({
    where: { sessionId },
  });
}

/**
 * Invalidate all sessions for a user (used on password change, etc.)
 */
export async function invalidateAllUserSessions(
  userId: string,
  userType: 'user' | 'member'
): Promise<void> {
  await prisma.activeSession.deleteMany({
    where: {
      userId,
      userType,
    },
  });
}

/**
 * Clean up expired sessions (can be called periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.activeSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

/**
 * Check if a sessionId is the active session for a user
 * Used to validate JWTs against the current active session
 */
export async function isActiveSession(
  sessionId: string,
  userId: string,
  userType: 'user' | 'member'
): Promise<boolean> {
  const session = await prisma.activeSession.findFirst({
    where: {
      sessionId,
      userId,
      userType,
      expiresAt: { gt: new Date() },
    },
  });
  if (!session) {
    console.debug('[session-management] isActiveSession: no active session found for', { sessionId, userId, userType });
  }
  return !!session;
}

/**
 * Get active sessions for a user (for user visibility/management)
 */
export async function getUserActiveSessions(
  userId: string,
  userType: 'user' | 'member'
): Promise<Array<{
  id: string;
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
}>> {
  return prisma.activeSession.findMany({
    where: {
      userId,
      userType,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      sessionId: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      lastActiveAt: true,
      expiresAt: true,
    },
    orderBy: { lastActiveAt: 'desc' },
  });
}

