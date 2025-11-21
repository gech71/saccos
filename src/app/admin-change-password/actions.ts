'use server';

import { requireAuth } from '@/lib/authorization';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function changeAdminPassword(
  currentPassword: string,
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

    const isPasswordCorrect = await bcrypt.compare(currentPassword, adminUser.password);
    if (!isPasswordCorrect) {
      return { success: false, error: 'The temporary password you entered is incorrect.' };
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

    return { success: true };
  } catch (error) {
    console.error('Error changing admin password:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
