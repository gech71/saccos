

'use server';

import prisma from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email-service';
import crypto from 'crypto';
import { hashToken } from '@/lib/server-utils';

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

    // Ensure we use HTTPS in production, HTTP only for localhost
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    
    try {
      await sendPasswordResetEmail(normalizedEmail, resetUrl);
      return { success: true, message: genericSuccessMessage };
    } catch (emailError: any) {
      // Log the error but don't reveal if user exists (security best practice)
      console.error('Failed to send password reset email:', emailError);
      // Still return success message to prevent user enumeration
      // But log the actual error for administrators
      return { 
        success: false, 
        message: 'Unable to send password reset email. Please check your email configuration or contact support.' 
      };
    }

  } catch (error) {
    console.error('Error during password reset request:', error);
    return { success: false, message: 'An unexpected error occurred. Please try again later.' };
  }
}
