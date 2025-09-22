'use server';

import axios from 'axios';

export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; message: string }> {
  if (!email) {
    return { success: false, message: 'Email address is required.' };
  }

  const authApiBaseUrl = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
  if (!authApiBaseUrl) {
    console.error('NEXT_PUBLIC_AUTH_API_BASE_URL is not set.');
    return {
      success: false,
      message: 'The system is not configured for password resets.',
    };
  }

  try {
    // Call the external authentication server's forgot-password endpoint
    const response = await axios.post(
      `${authApiBaseUrl}/api/Auth/forgot-password`,
      { email }
    );

    // The external API should ideally always return a generic success message
    // to prevent email enumeration. We will trust its response.
    if (response.data && response.data.isSuccess) {
      return {
        success: true,
        message:
          response.data.message ||
          `If an account exists for ${email}, a password reset link has been sent.`,
      };
    } else {
      // If the API call itself succeeds but the operation fails (e.g., validation error)
      const errorMessage =
        response.data?.errors?.join(' ') ||
        response.data?.message ||
        'An error occurred.';
      return { success: false, message: errorMessage };
    }
  } catch (error) {
    // Handle network errors or cases where the auth server is down
    console.error('Forgot password API call failed:', error);
    // To prevent leaking information, we can still return a generic "success" message to the user
    // while logging the actual error on the server.
    return {
      success: true,
      message: `If an account exists for ${email}, a password reset link has been sent.`,
    };
  }
}
