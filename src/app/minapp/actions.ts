'use server';

import axios from 'axios';
import crypto from 'crypto';

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

/**
 * Creates a SHA256 signature from a sorted dictionary of parameters.
 * @param payload The sorted dictionary of key-value pairs.
 * @returns The SHA256 hash as a hex string.
 */
export function createSignature(payload: Record<string, string>): string {
  const sortedPayload = new Map(Object.entries(payload).sort());
  const temp: string[] = [];
  sortedPayload.forEach((value, key) => {
    temp.push(`${key}=${value}`);
  });
  const dataString = temp.join('&');
  return crypto.createHash('sha256').update(dataString).digest('hex');
}

interface RequestMoneyParams {
    token: string;
    amount: string;
    accountNo: string;
    companyName: string;
    transactionId: string;
    transactionTime: string;
}

/**
 * Implements STEP 03: Request Money from the customer via NIBtera API.
 * @param params The parameters needed to make the request.
 * @returns An object containing the response data or an error message.
 */
export async function requestMoney(params: RequestMoneyParams): Promise<{ success: boolean; data?: any; error?: string }> {
    const apiUrl = process.env.NIB_REQUEST_MONEY_URL;
    const apiKey = process.env.NIB_API_KEY;
    const callBackURL = `${process.env.NEXT_PUBLIC_APP_URL}/api/minapp/callback`;

    if (!apiUrl || !apiKey || !callBackURL) {
        console.error('NIB_REQUEST_MONEY_URL, NIB_API_KEY, or NEXT_PUBLIC_APP_URL are not set.');
        return { success: false, error: 'Service configuration error.' };
    }

    try {
        const integrityCheckPayload = {
            accountNo: params.accountNo,
            amount: params.amount,
            callBackURL: callBackURL,
            companyName: params.companyName,
            Key: apiKey,
            token: params.token,
            transactionId: params.transactionId,
            transactionTime: params.transactionTime,
        };

        const signature = createSignature(integrityCheckPayload);

        const requestBody = {
            ...integrityCheckPayload,
            signature,
        };
        
        const response = await axios.post(apiUrl, requestBody, {
            headers: {
                'Authorization': `Bearer ${params.token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
        });

        if (response.status === 200) {
            return { success: true, data: response.data };
        } else {
            return { success: false, error: `Request failed with status: ${response.status}` };
        }
    } catch (error) {
        console.error('Error requesting money from NIBtera:', error);
        if (axios.isAxiosError(error) && error.response) {
            return { success: false, error: `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}` };
        }
        return { success: false, error: 'An unexpected error occurred during the transaction.' };
    }
}
