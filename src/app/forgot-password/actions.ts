
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

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // IMPORTANT: Always return a generic success message to prevent email enumeration attacks.
  // This means we don't reveal whether an account with that email actually exists.
  const genericSuccessMessage = `If an account exists for ${email}, a password reset link has been sent.`;

  if (!user) {
    console.log(`Password reset requested for non-existent user: ${email}`);
    return { success: true, message: genericSuccessMessage };
  }

  try {
    // If the user is a member (has no userId) and has no password, they can't reset.
    // This check is now correctly placed to only affect non-admin users.
    if (!user.userId && !user.password) {
        return { success: true, message: "This account is not configured for password-based login and cannot be reset." };
    }
      
    // 1. Generate a secure, URL-safe random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // 2. Hash the token for database storage
    const passwordResetToken = hashToken(resetToken);
    
    // 3. Set an expiration date (e.g., 1 hour from now)
    const passwordResetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    // 4. Update the user record in the database
    await prisma.user.update({
      where: { email },
      data: {
        passwordResetToken,
        passwordResetTokenExpires,
      },
    });

    // 5. Send the email with the *unhashed* token
    // We construct the full URL here
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(user.email, resetUrl);

    return { success: true, message: genericSuccessMessage };
  } catch (error) {
    console.error('Error during password reset request:', error);
    // Even if sending fails, return the generic message to the user for security.
    return { success: true, message: genericSuccessMessage };
  }
}
