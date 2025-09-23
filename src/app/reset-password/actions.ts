
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

    // Check User table
    const user = await prisma.user.findFirst({
        where: { passwordResetToken: hashedToken },
    });

    if (user) {
        if (!user.passwordResetTokenExpires || user.passwordResetTokenExpires < new Date()) {
            return { success: false, message: "Token has expired." };
        }
        return { success: true, message: "Token is valid." };
    }
    
    // If not found in User, check Member table
    const member = await prisma.member.findFirst({
        where: { passwordResetToken: hashedToken },
    });

    if (member) {
        if (!member.passwordResetTokenExpires || member.passwordResetTokenExpires < new Date()) {
            return { success: false, message: "Token has expired." };
        }
        return { success: true, message: "Token is valid." };
    }

    return { success: false, message: "Invalid token." };
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
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    try {
        // Try updating a user first
        const user = await prisma.user.findFirst({
            where: { passwordResetToken: hashedToken },
        });

        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    // Admins might not have a local password, so this is conditional.
                    // The password reset in this case is handled by an external provider,
                    // but the token flow is now internal. A real app would call the provider API here.
                    // For now, we clear the token.
                    passwordResetToken: null,
                    passwordResetTokenExpires: null,
                },
            });
             return { success: true, message: "This flow is for an admin. In a real app, you would now integrate with the external provider's password change API. For now, the token is cleared." };
        }

        // If no user, try updating a member
        const member = await prisma.member.findFirst({
            where: { passwordResetToken: hashedToken },
        });

        if (member) {
            await prisma.member.update({
                where: { id: member.id },
                data: {
                    password: hashedPassword,
                    passwordResetToken: null, // Invalidate the token after use
                    passwordResetTokenExpires: null,
                },
            });
             return { success: true, message: "Password has been reset successfully." };
        }

        return { success: false, message: "Invalid token." };

    } catch (error) {
        console.error("Error resetting password:", error);
        return { success: false, message: "An unexpected error occurred." };
    }
}
