
'use server';

/**
 * Server-only utility functions.
 * This file contains functions that should only ever run on the server,
 * particularly those that depend on Node.js-specific modules like 'crypto'.
 */
import crypto from 'crypto';

/**
 * Hashes a token using SHA256.
 * This function MUST remain in a 'use server' file.
 * @param token The input token string.
 * @returns The SHA256 hashed token as a hex string.
 */
export const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
