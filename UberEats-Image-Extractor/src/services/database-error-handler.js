/**
 * Shared database error handling utilities
 * Extracted from usage-tracking-service.js pattern
 *
 * Provides retry logic for transient database errors (Cloudflare 5xx, network issues)
 */

const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second

/**
 * Check if an error is transient/retryable
 * @param {Error|object|string} error - The error to check
 * @returns {boolean} True if error is transient and should be retried
 */
function isTransientError(error) {
  if (!error) return false;

  const errorStr = typeof error === 'string' ? error :
    (error.message || error.code || JSON.stringify(error));

  // Auth-specific retryable errors (Supabase marks these as retryable)
  if (error.name === 'AuthRetryableFetchError') {
    return true;
  }

  // Supabase auth error with status 0 (network failure)
  if (error.__isAuthError && error.status === 0) {
    return true;
  }

  // Cloudflare 5xx errors (returned as HTML)
  if (errorStr.includes('520:') || errorStr.includes('502:') ||
      errorStr.includes('503:') || errorStr.includes('504:') ||
      errorStr.includes('cloudflare') || errorStr.includes('<!DOCTYPE html>')) {
    return true;
  }

  // Network/connection errors (including undici HTTP client errors)
  if (errorStr.includes('ECONNRESET') || errorStr.includes('ETIMEDOUT') ||
      errorStr.includes('ENOTFOUND') || errorStr.includes('ECONNREFUSED') ||
      errorStr.includes('UND_ERR_CONNECT_TIMEOUT') ||
      errorStr.includes('ConnectTimeoutError') ||
      errorStr.includes('fetch failed')) {
    return true;
  }

  // HTTP 5xx status codes
  if (error.status >= 500 || error.code >= 500) {
    return true;
  }

  return false;
}

/**
 * Format error message for logging (clean up verbose Cloudflare HTML)
 * @param {Error|object|string} error - The error to format
 * @returns {string} A clean, concise error message
 */
function formatErrorMessage(error) {
  if (!error) return 'Unknown error';

  const errorStr = typeof error === 'string' ? error :
    (error.message || JSON.stringify(error));

  // Cloudflare HTML error page - extract the key info
  if (errorStr.includes('<!DOCTYPE html>')) {
    const titleMatch = errorStr.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      return `Cloudflare: ${titleMatch[1].split('|')[1]?.trim() || titleMatch[1]}`;
    }
    return 'Cloudflare connection error (HTML response received)';
  }

  // Supabase/PostgreSQL errors
  if (error.code && error.message) {
    return `${error.code}: ${error.message}`;
  }

  // Truncate very long messages
  if (errorStr.length > 200) {
    return errorStr.substring(0, 200) + '...';
  }

  return errorStr;
}

/**
 * Execute a database operation with retry logic
 * @param {Function} operation - Async function returning { data, error } (Supabase pattern)
 * @param {string} operationName - Name for logging
 * @param {number} retryCount - Current retry attempt (internal)
 * @returns {Promise<any>} The data from successful operation
 * @throws {Error} If operation fails after all retries
 */
async function executeWithRetry(operation, operationName, retryCount = 0) {
  try {
    const result = await operation();

    // Handle Supabase { data, error } pattern
    if (result && typeof result === 'object' && 'error' in result) {
      const { data, error } = result;

      if (error) {
        if (isTransientError(error) && retryCount < MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(2, retryCount);
          console.warn(`[${operationName}] Transient error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES}): ${formatErrorMessage(error)}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeWithRetry(operation, operationName, retryCount + 1);
        }

        console.error(`[${operationName}] Database operation failed:`, formatErrorMessage(error));
        throw error;
      }

      return data;
    }

    // Handle direct return value (non-Supabase pattern)
    return result;
  } catch (error) {
    if (isTransientError(error) && retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, retryCount);
      console.warn(`[${operationName}] Transient error in catch, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES}): ${formatErrorMessage(error)}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return executeWithRetry(operation, operationName, retryCount + 1);
    }

    console.error(`[${operationName}] Failed after ${retryCount} retries:`, formatErrorMessage(error));
    throw error;
  }
}

module.exports = {
  isTransientError,
  formatErrorMessage,
  executeWithRetry,
  MAX_RETRIES,
  BASE_DELAY
};
