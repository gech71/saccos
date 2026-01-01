import { auth } from '@/auth';
import { isActiveSession } from './session-management';

/**
 * Require authentication and validate the session is still active
 * This ensures that revoked sessions (e.g., from new login or password change)
 * are immediately rejected, even if the access token hasn't expired yet
 */
export async function requireAuth() {
  const session = await auth();
  if (!session || !session.user) {
    throw new Error('Authentication required.');
  }

  // Validate session against activeSession table to ensure it hasn't been revoked
  // This provides immediate revocation even for tokens that haven't expired
  const sessionId = (session as any).jti as string | undefined;
  const user = (session as any).user as any;
  
  if (sessionId && user?.id) {
    try {
      const userType = user.isMember ? 'member' : 'user';
      const isActive = await isActiveSession(sessionId, user.id, userType);
      
      if (!isActive) {
        console.warn(`[AUTH] Session invalidated - jti ${sessionId} is not active for user ${user.id}`);
        throw new Error('Session has been revoked. Please log in again.');
      }
    } catch (error) {
      // If it's already an Error with a message, re-throw it
      if (error instanceof Error && error.message.includes('revoked')) {
        throw error;
      }
      // For other errors (e.g., database issues), log but don't block
      // This prevents database outages from breaking authentication
      console.error('[AUTH] Error validating active session:', error);
    }
  }

  return session;
}

export async function requirePermission(permission: string) {
  const session = await requireAuth();
  const user = (session as any).user;
  // Members do not have elevated permissions
  if (user.isMember) {
    throw new Error('Insufficient permissions.');
  }

  const permissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];
  if (!permissions.includes(permission)) {
    throw new Error('Insufficient permissions.');
  }

  return session;
}
