

'use server';

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export async function validateResetToken(token: string): Promise<{ success: boolean, message: string }> {
    if (!token) {
        return { success: false, message: "Invalid or missing token." };
    }
    
    try {
        const hashedToken = hashToken(token);

        const user = await prisma.user.findFirst({
            where: { passwordResetToken: hashedToken },
        });

        if (user) {
            if (!user.passwordResetTokenExpires || user.passwordResetTokenExpires < new Date()) {
                return { success: false, message: "Token has expired." };
            }
            return { success: true, message: "Token is valid." };
        }
        
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
    } catch (error) {
        console.error('Token validation error:', error);
        return { success: false, message: 'An error occurred while validating the token.' };
    }
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string; }> {
    if (!token || !newPassword) {
        return { success: false, message: "Token and new password are required." };
    }

    try {
        const validationResult = await validateResetToken(token);
        if (!validationResult.success) {
            return validationResult;
        }
        
        const hashedToken = hashToken(token);
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const user = await prisma.user.findFirst({
            where: { passwordResetToken: hashedToken },
        });

        if (user) {
             await prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordResetToken: null,
                    passwordResetTokenExpires: null,
                },
            });
             return { success: true, message: "This flow is for an admin. In a real app, you would now integrate with the external provider's password change API. For now, the token is cleared." };
        }

        const member = await prisma.member.findFirst({
            where: { passwordResetToken: hashedToken },
        });

        if (member) {
            await prisma.member.update({
                where: { id: member.id },
                data: {
                    password: hashedPassword,
                    passwordResetToken: null,
                    passwordResetTokenExpires: null,
                    mustChangePassword: false,
                },
            });
             return { success: true, message: "Password has been reset successfully." };
        }

        return { success: false, message: "Invalid token." };

    } catch (error) {
        console.error("Error resetting password:", error);
        return { success: false, message: "An unexpected error occurred while resetting the password." };
    }
}
