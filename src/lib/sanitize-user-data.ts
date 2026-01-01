/**
 * Utility functions to sanitize user and member data before sending to client
 * This prevents exposure of sensitive fields like passwordResetToken, passwords, etc.
 *
 * Improvements:
 * - Deep recursive sanitization to remove sensitive keys at any nested level
 * - Pattern-based matching for additional variants like `passwordHash` or `hashedPassword`
 */

const SENSITIVE_FIELD_PATTERNS: RegExp[] = [
  /^password$/i,
  /passwordResetToken/i,
  /passwordResetTokenExpires/i,
  /^temporaryPassword$/i,
  /passwordHash/i,
  /hashedPassword/i,
];

function isSensitiveKey(key: string) {
  if (!key) return false;
  return SENSITIVE_FIELD_PATTERNS.some((r) => r.test(key));
}

/**
 * Deeply sanitize an object/array by removing any keys that match sensitive patterns.
 * This is intentionally permissive (removes fields by name) to guard against accidental
 * future fields that contain password-like data.
 */
export function deepSanitize<T>(value: T): T {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((v) => deepSanitize(v)) as any;
  }

  if (typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as any)) {
      if (isSensitiveKey(k)) continue; // skip any sensitive fields
      result[k] = deepSanitize(v);
    }
    return result as any;
  }

  // primitives
  return value;
}

/**
 * Recursively find any sensitive keys in an object/array and return
 * an array of paths where sensitive keys were found.
 */
export function findSensitiveKeys(value: any, path = ''): string[] {
  if (value === null || value === undefined) return [];
  const matches: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      matches.push(...findSensitiveKeys(v, `${path}[${i}]`));
    });
    return matches;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as any)) {
      const currentPath = path ? `${path}.${k}` : k;
      if (isSensitiveKey(k)) matches.push(currentPath);
      matches.push(...findSensitiveKeys(v, currentPath));
    }
    return matches;
  }
  return [];
}

/**
 * Assert (in development) or detect (in production) that no sensitive fields
 * exist in a payload. In dev this throws to fail fast. In production it logs
 * an error and returns false so callers can re-sanitize if needed.
 */
export function assertNoSensitiveFields(value: any, context?: string): boolean {
  const matches = findSensitiveKeys(value);
  if (matches.length === 0) return true;
  const msg = `Sensitive fields detected in ${context || 'payload'}: ${matches.join(', ')}`;
  if (process.env.NODE_ENV !== 'production') {
    throw new Error(msg);
  }
  console.error(msg);
  return false;
}

/**
 * Remove sensitive fields from a member object (deeply)
 */
export function sanitizeMember<T extends Record<string, any>>(member: T): Omit<T, string> {
  return deepSanitize(member) as any;
}

/**
 * Remove sensitive fields from a user object (deeply)
 */
export function sanitizeUser<T extends Record<string, any>>(user: T): Omit<T, string> {
  return deepSanitize(user) as any;
}

/**
 * Remove sensitive fields from an array of members (deeply)
 */
export function sanitizeMembers<T extends Record<string, any>>(members: T[]): Array<Omit<T, string>> {
  return members.map((member) => sanitizeMember(member));
}

/**
 * Remove sensitive fields from an array of users (deeply)
 */
export function sanitizeUsers<T extends Record<string, any>>(users: T[]): Array<Omit<T, string>> {
  return users.map((user) => sanitizeUser(user));
}


