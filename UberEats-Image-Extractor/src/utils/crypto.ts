/**
 * Cryptographic utilities for secure token generation
 * Used for invitation tokens and other security-sensitive operations
 */

/**
 * Generates a cryptographically secure random token
 * @param length - Length of the token (default 32 bytes = 64 hex chars)
 * @returns URL-safe token string
 */
export function generateSecureToken(length: number = 32): string {
  // Create a typed array to hold the random values
  const array = new Uint8Array(length);
  
  // Fill the array with cryptographically secure random values
  crypto.getRandomValues(array);
  
  // Convert to hex string
  const hexString = Array.from(array)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  
  // Make it URL-safe by replacing problematic characters
  // This is already hex, so it's URL-safe, but we'll keep this pattern
  // in case we want to use base64 in the future
  return hexString;
}

/**
 * Generates a shorter, human-friendly invitation code
 * @param length - Number of characters (default 8)
 * @returns Alphanumeric code (uppercase)
 */
export function generateInviteCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  let code = '';
  for (let i = 0; i < length; i++) {
    // Use modulo to map random byte to character index
    code += chars[array[i] % chars.length];
  }
  
  return code;
}

/**
 * Generates an expiry date for invitations
 * @param days - Number of days until expiry (default 7)
 * @returns ISO string date
 */
export function generateExpiryDate(days: number = 7): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Checks if a date has expired
 * @param expiryDate - ISO string date to check
 * @returns true if expired, false otherwise
 */
export function isExpired(expiryDate: string): boolean {
  return new Date(expiryDate) < new Date();
}

/**
 * Generates a URL-safe base64 token (alternative to hex)
 * @param length - Number of bytes (default 32)
 * @returns URL-safe base64 string
 */
export function generateBase64Token(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  // Convert to base64
  const base64 = btoa(String.fromCharCode(...array));
  
  // Make URL-safe by replacing + with -, / with _, and removing =
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}