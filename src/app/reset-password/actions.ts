

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

        if (process.env.NODE_ENV !== 'production') {
            console.debug('[dev] validateResetToken: incoming token hashed:', hashedToken);
        }

        const user = await prisma.user.findFirst({
            where: { passwordResetToken: hashedToken },
        });

        if (user) {
            if (process.env.NODE_ENV !== 'production') {
                console.debug('[dev] validateResetToken: matched user', { id: user.id, email: user.email, expires: user.passwordResetTokenExpires });
            }
            if (!user.passwordResetTokenExpires || user.passwordResetTokenExpires < new Date()) {
                return { success: false, message: "Token has expired." };
            }
            return { success: true, message: "Token is valid." };
        }
        
        const member = await prisma.member.findFirst({
            where: { passwordResetToken: hashedToken },
        });

        if (member) {
            if (process.env.NODE_ENV !== 'production') {
                console.debug('[dev] validateResetToken: matched member', { id: member.id, email: member.email, expires: member.passwordResetTokenExpires });
            }
            if (!member.passwordResetTokenExpires || member.passwordResetTokenExpires < new Date()) {
                return { success: false, message: "Token has expired." };
            }
            return { success: true, message: "Token is valid." };
        }

        if (process.env.NODE_ENV !== 'production') {
            console.debug('[dev] validateResetToken: no match for hashed token', hashedToken);
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
            if (process.env.NODE_ENV !== 'production') {
                console.debug('[dev] resetPassword: token validation failed', { message: validationResult.message });
            }
            return validationResult;
        }
        
        const hashedToken = hashToken(token);
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const user = await prisma.user.findFirst({
            where: { passwordResetToken: hashedToken },
        });

        if (user) {
            // Update the user's password locally and clear token
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    password: hashedPassword,
                    passwordResetToken: null,
                    passwordResetTokenExpires: null,
                    mustChangePassword: false,
                },
            });

            // Security: Invalidate all active sessions after password reset
            const { invalidateAllUserSessions } = await import('@/lib/session-management');
            await invalidateAllUserSessions(user.id, 'user');

            if (process.env.NODE_ENV !== 'production') {
                console.debug('[dev] resetPassword: updated user password and cleared token', { id: user.id, email: user.email });
            }

            return { success: true, message: "Password has been reset successfully." };
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

            // Security: Invalidate all active sessions after password reset
            const { invalidateAllUserSessions } = await import('@/lib/session-management');
            await invalidateAllUserSessions(member.id, 'member');

             return { success: true, message: "Password has been reset successfully." };
        }

        return { success: false, message: "Invalid token." };

    } catch (error) {
        console.error("Error resetting password:", error);
        return { success: false, message: "An unexpected error occurred while resetting the password." };
    }
}
