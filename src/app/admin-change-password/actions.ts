
'use server';

import { requireAuth } from '@/lib/authorization';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { invalidateAllUserSessions } from '@/lib/session-management';

export async function changeAdminPassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAuth();
    const user = session?.user;

    if (!user || user.isMember) {
      return { success: false, error: 'Unauthorized. You must be logged in as an admin user.' };
    }

    const userId = user.id;

    const adminUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!adminUser || !adminUser.password) {
      return { success: false, error: 'User account not found or has no password set.' };
    }
    
    // The user is already authenticated via middleware, so we don't need to re-verify the old password.
    // We just need to ensure they are in the 'mustChangePassword' state.
    if (!adminUser.mustChangePassword) {
      // This is a safeguard. In theory, middleware should prevent non-must-change users from reaching this.
      return { success: false, error: 'Password has already been changed.' };
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        mustChangePassword: false,
        temporaryPassword: null,
      },
    });

    // Security: Invalidate all active sessions for this user after password change
    await invalidateAllUserSessions(userId, 'user');

    return { success: true };
  } catch (error) {
    console.error('Error changing admin password:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
