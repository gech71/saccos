
import crypto from 'crypto';

/**
 * Creates a SHA256 signature from a sorted dictionary of parameters.
 * This is a synchronous utility function and should NOT be in a 'use server' file.
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
