
'use server';

import axios from 'axios';

/**
 * Validates the NIBtera authentication token.
 * 
 * @param token The Bearer token received from the request header.
 * @returns An object containing the phone number if successful, or an error message.
 */
export async function validateNibToken(token: string): Promise<{ phoneNumber?: string; error?: string }> {
  const apiUrl = process.env.NIB_VALIDATE_TOKEN_URL;

  if (!apiUrl) {
    console.error('NIB_VALIDATE_TOKEN_URL is not set in the environment variables.');
    return { error: 'Service configuration error.' };
  }

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (response.status === 200 && response.data?.phone) {
      return { phoneNumber: response.data.phone };
    } else {
      return { error: 'Invalid token or unable to retrieve phone number.' };
    }
  } catch (error) {
    console.error('Error validating NIBtera token:', error);
    if (axios.isAxiosError(error) && error.response) {
      return { error: `Token validation failed with status: ${error.response.status}` };
    }
    return { error: 'An unexpected error occurred during token validation.' };
  }
}
