import { auth } from '@/auth';

export async function requireAuth() {
  const session = await auth();
  if (!session || !session.user) {
    throw new Error('Authentication required.');
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
