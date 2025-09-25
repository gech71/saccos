

'use server';

import prisma from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email-service';
import crypto from 'crypto';

// Hash the token before storing it in the database
const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; message: string }> {
  if (!email) {
    return { success: false, message: 'Email address is required.' };
  }

  const normalizedEmail = email.toLowerCase();
  const genericSuccessMessage = `If an account exists for ${normalizedEmail}, a password reset link has been sent.`;
  
  try {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetToken = hashToken(resetToken);
    const passwordResetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    const user = await prisma.user.findFirst({
        where: { 
            email: {
                equals: normalizedEmail,
                mode: 'insensitive'
            }
        },
    });

    if (user) {
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken,
                passwordResetTokenExpires,
            },
        });
    } else {
        const member = await prisma.member.findFirst({
            where: {
                email: {
                    equals: normalizedEmail,
                    mode: 'insensitive'
                }
            }
        });

        if (member) {
             if (!member.password) {
                console.log(`Password reset requested for member ${member.email} without a local password setup.`);
                return { success: true, message: genericSuccessMessage };
            }
            await prisma.member.update({
                where: { id: member.id },
                data: {
                    passwordResetToken,
                    passwordResetTokenExpires,
                },
            });
        } else {
            console.log(`Password reset requested for non-existent user/member: ${email}`);
            return { success: true, message: genericSuccessMessage };
        }
    }

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(normalizedEmail, resetUrl);

    return { success: true, message: genericSuccessMessage };

  } catch (error) {
    console.error('Error during password reset request:', error);
    return { success: false, message: 'An unexpected error occurred. Please try again later.' };
  }
}
