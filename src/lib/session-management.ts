/**
 * Session Management Utilities
 * Handles concurrent session limits, session tracking, and revocation
 */

import prisma from './prisma';
import crypto from 'crypto';

const MAX_CONCURRENT_SESSIONS = 1; // Maximum concurrent sessions per user

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
}): Promise<void> {
  const { sessionId, userId, userType, refreshToken, ipAddress, userAgent, expiresAt } = params;
  
  // Hash the refresh token before storing
  const hashedRefreshToken = hashRefreshToken(refreshToken);
  
  // Check current active sessions for this user
  const activeSessions = await prisma.activeSession.findMany({
    where: {
      userId,
      userType,
      expiresAt: { gt: new Date() }, // Only count non-expired sessions
    },
    orderBy: { createdAt: 'asc' }, // Oldest first
  });
  
  // If we've reached or exceeded the limit, invalidate existing sessions
  // When MAX_CONCURRENT_SESSIONS = 1, invalidate ALL existing sessions before creating new one
  if (activeSessions.length >= MAX_CONCURRENT_SESSIONS) {
    if (MAX_CONCURRENT_SESSIONS === 1) {
      // Special case: when limit is 1, invalidate ALL existing sessions
      console.debug(`[session-management] invalidating all existing sessions for userId=${userId}, userType=${userType}`);
      await prisma.activeSession.deleteMany({
        where: {
          userId,
          userType,
          expiresAt: { gt: new Date() },
        },
      });
    } else {
      // For limits > 1, keep the newest sessions and invalidate oldest
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
 */
export async function validateRefreshToken(
  refreshToken: string,
  userId: string,
  userType: 'user' | 'member'
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

