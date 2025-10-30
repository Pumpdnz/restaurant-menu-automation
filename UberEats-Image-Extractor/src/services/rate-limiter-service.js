/**
 * Rate Limiter Service for Firecrawl API
 *
 * Implements a token bucket rate limiter with sliding window to enforce
 * request rate limits and prevent 402/429 errors.
 *
 * Algorithm: Sliding Window
 * - Tracks timestamps of all requests in the current window
 * - Automatically cleans up expired timestamps
 * - Delays requests that would exceed the rate limit
 *
 * Configuration via .env:
 * - FIRECRAWL_RATE_LIMIT: Max requests per window (default: 10)
 * - FIRECRAWL_RATE_WINDOW: Window size in milliseconds (default: 60000 = 1 minute)
 */

class RateLimiterService {
  constructor() {
    // Load configuration from environment with defaults
    this.rateLimit = parseInt(process.env.FIRECRAWL_RATE_LIMIT) || 10;
    this.rateLimitWindow = parseInt(process.env.FIRECRAWL_RATE_WINDOW) || 60000;

    // Track request timestamps
    this.requestTimestamps = [];

    console.log(`[Rate Limiter] Initialized with limit: ${this.rateLimit} requests per ${this.rateLimitWindow/1000}s`);
  }

  /**
   * Acquire a slot for making a request
   * Waits if necessary to respect rate limit, then records the request
   *
   * @param {string} identifier - Optional identifier for logging (e.g., "category-Burgers")
   * @returns {Promise<void>}
   */
  async acquireSlot(identifier = 'request') {
    // Clean up old timestamps outside the current window
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > windowStart);

    // Check if we're at the rate limit
    if (this.requestTimestamps.length >= this.rateLimit) {
      // Calculate how long we need to wait
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = oldestRequest + this.rateLimitWindow - now;

      if (waitTime > 0) {
        console.log(
          `[Rate Limiter] At limit (${this.requestTimestamps.length}/${this.rateLimit}), ` +
          `waiting ${Math.ceil(waitTime/1000)}s for "${identifier}"`
        );

        // Wait for the oldest request to expire from the window
        await this.sleep(waitTime);

        // Clean up again after waiting
        const newNow = Date.now();
        const newWindowStart = newNow - this.rateLimitWindow;
        this.requestTimestamps = this.requestTimestamps.filter(t => t > newWindowStart);
      }
    }

    // Record this request timestamp
    this.requestTimestamps.push(Date.now());

    // Log current usage
    const usage = this.getCurrentUsage();
    console.log(
      `[Rate Limiter] Request started: ${usage.current}/${usage.limit} in last ${usage.window/1000}s ` +
      `(${usage.percentage.toFixed(0)}% capacity)`
    );
  }

  /**
   * Get current rate limit usage statistics
   *
   * @returns {object} Usage statistics
   */
  getCurrentUsage() {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    const activeRequests = this.requestTimestamps.filter(t => t > windowStart);

    return {
      current: activeRequests.length,
      limit: this.rateLimit,
      window: this.rateLimitWindow,
      percentage: (activeRequests.length / this.rateLimit) * 100
    };
  }

  /**
   * Sleep utility
   *
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset the rate limiter (for testing)
   */
  reset() {
    this.requestTimestamps = [];
    console.log('[Rate Limiter] Reset');
  }

  /**
   * Get diagnostic information
   *
   * @returns {object} Diagnostic info
   */
  getDiagnostics() {
    const usage = this.getCurrentUsage();
    const now = Date.now();

    return {
      configuration: {
        rateLimit: this.rateLimit,
        rateLimitWindow: this.rateLimitWindow,
        windowInSeconds: this.rateLimitWindow / 1000
      },
      currentUsage: usage,
      timestamps: this.requestTimestamps.map(ts => ({
        timestamp: ts,
        ageMs: now - ts,
        ageSeconds: ((now - ts) / 1000).toFixed(1)
      }))
    };
  }
}

// Export singleton instance
module.exports = new RateLimiterService();
