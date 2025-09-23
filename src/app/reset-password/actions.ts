
'use server';

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Hash the token to compare with the one in the database
const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};


export async function validateResetToken(token: string): Promise<{ success: boolean, message: string }> {
    if (!token) {
        return { success: false, message: "Invalid or missing token." };
    }
    
    const hashedToken = hashToken(token);

    const user = await prisma.user.findUnique({
        where: { passwordResetToken: hashedToken },
    });

    if (!user) {
        return { success: false, message: "Invalid token." };
    }

    if (!user.passwordResetTokenExpires || user.passwordResetTokenExpires < new Date()) {
        return { success: false, message: "Token has expired." };
    }

    return { success: true, message: "Token is valid." };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string; }> {
    if (!token || !newPassword) {
        return { success: false, message: "Token and new password are required." };
    }

    const validationResult = await validateResetToken(token);
    if (!validationResult.success) {
        return validationResult;
    }
    
    const hashedToken = hashToken(token);

    try {
        const user = await prisma.user.findUnique({
            where: { passwordResetToken: hashedToken },
        });

        if (!user) {
            // This should ideally not happen if validateResetToken passed, but it's a good safeguard.
            return { success: false, message: "Invalid token." };
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null, // Invalidate the token after use
                passwordResetTokenExpires: null,
            },
        });

        return { success: true, message: "Password has been reset successfully." };

    } catch (error) {
        console.error("Error resetting password:", error);
        return { success: false, message: "An unexpected error occurred." };
    }
}
