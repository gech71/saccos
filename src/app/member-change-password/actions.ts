

'use server';

import { requireAuth } from '@/lib/authorization';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function changeMemberPassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAuth();
    const user = session?.user;

    // 1. Ensure user is authenticated and is a member
    if (!user || !user.isMember) {
      return { success: false, error: 'Unauthorized. You must be logged in as a member.' };
    }

    const memberId = user.id;

    // 2. Fetch the current member from the database
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member || !member.password) {
      return { success: false, error: 'Member account not found or has no password set.' };
    }

    // Since the middleware already authenticated the user with their temp password to get here,
    // we don't need to re-verify it. We just need to ensure they are in the 'mustChangePassword' state.
    if (!member.mustChangePassword) {
      // This is a safeguard, in theory middleware should prevent non-must-change users from reaching this.
      return { success: false, error: 'Password has already been changed.' };
    }

    // 4. Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 5. Update the member's password and clear the mustChangePassword flag
    await prisma.member.update({
      where: { id: memberId },
      data: {
        password: hashedNewPassword,
        mustChangePassword: false,
        temporaryPassword: null, // Clear the temporary password
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error changing member password:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
