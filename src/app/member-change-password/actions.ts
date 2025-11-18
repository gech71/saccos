

'use server';

import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function changeMemberPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
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

    // 3. Verify the current (temporary) password
    const isPasswordCorrect = await bcrypt.compare(currentPassword, member.password);
    if (!isPasswordCorrect) {
      return { success: false, error: 'The temporary password you entered is incorrect.' };
    }

    // 4. Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 5. Update the member's password and clear the mustChangePassword flag
    await prisma.member.update({
      where: { id: memberId },
      data: {
        password: hashedNewPassword,
        mustChangePassword: false,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error changing member password:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
