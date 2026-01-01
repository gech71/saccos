/**
 * Utility functions to sanitize user and member data before sending to client
 * This prevents exposure of sensitive fields like passwordResetToken, passwords, etc.
 */

/**
 * Sensitive fields that should NEVER be sent to the client
 */
const SENSITIVE_MEMBER_FIELDS = [
  'password',
  'passwordResetToken',
  'passwordResetTokenExpires',
  'temporaryPassword',
] as const;

const SENSITIVE_USER_FIELDS = [
  'password',
  'passwordResetToken',
  'passwordResetTokenExpires',
] as const;

/**
 * Remove sensitive fields from a member object
 */
export function sanitizeMember<T extends Record<string, any>>(member: T): Omit<T, typeof SENSITIVE_MEMBER_FIELDS[number]> {
  const sanitized = { ...member };
  SENSITIVE_MEMBER_FIELDS.forEach(field => {
    delete sanitized[field];
  });
  return sanitized;
}

/**
 * Remove sensitive fields from a user object
 */
export function sanitizeUser<T extends Record<string, any>>(user: T): Omit<T, typeof SENSITIVE_USER_FIELDS[number]> {
  const sanitized = { ...user };
  SENSITIVE_USER_FIELDS.forEach(field => {
    delete sanitized[field];
  });
  return sanitized;
}

/**
 * Remove sensitive fields from an array of members
 */
export function sanitizeMembers<T extends Record<string, any>>(members: T[]): Array<Omit<T, typeof SENSITIVE_MEMBER_FIELDS[number]>> {
  return members.map(member => sanitizeMember(member));
}

/**
 * Remove sensitive fields from an array of users
 */
export function sanitizeUsers<T extends Record<string, any>>(users: T[]): Array<Omit<T, typeof SENSITIVE_USER_FIELDS[number]>> {
  return users.map(user => sanitizeUser(user));
}

