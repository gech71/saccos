'use server';

import prisma from '@/lib/prisma';

export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  if (!email) {
    return { success: false, message: 'Email address is required.' };
  }

  const member = await prisma.member.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (member) {
    // In a real application, you would generate a secure, single-use token,
    // save its hash to the database with an expiry date, and then email
    // a link containing the token to the user.
    // e.g., sendPasswordResetEmail(member.email, resetToken);
    console.log(`Password reset requested for existing member: ${member.email}`);
  } else {
    // To prevent email enumeration attacks, do not reveal that the user does not exist.
    // Log it for monitoring purposes but return the same message.
    console.log(`Password reset requested for non-existing email: ${email}`);
  }

  // Always return a generic success message to the user.
  return {
    success: true,
    message: `If an account exists for ${email}, a password reset link has been sent.`,
  };
}
