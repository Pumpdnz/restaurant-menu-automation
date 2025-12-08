/**
 * Lead URL Validation and Cleaning Service
 * Handles validation and cleaning of social media URLs and review counts
 */

/**
 * Clean and validate Instagram URL
 * - Strips query parameters
 * - Rejects reels, posts, stories, etc.
 * - Returns null if invalid
 * @param {string} url - Instagram URL to clean
 * @returns {string|null} Cleaned URL or null if invalid
 */
function cleanInstagramUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('instagram.com')) return null;

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Reject invalid patterns (reels, posts, stories, etc.)
    const invalidPatterns = ['/reel/', '/p/', '/stories/', '/reels/', '/tv/', '/explore/'];
    if (invalidPatterns.some(p => pathname.includes(p))) {
      console.log(`[URL Validation] Rejected Instagram URL (invalid pattern): ${url}`);
      return null;
    }

    // Extract username from pathname
    const pathParts = pathname.split('/').filter(p => p);
    if (pathParts.length === 0) return null;

    const username = pathParts[0];

    // Validate username format (alphanumeric, dots, underscores)
    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      console.log(`[URL Validation] Rejected Instagram URL (invalid username): ${url}`);
      return null;
    }

    // Return cleaned URL without query params
    return `https://www.instagram.com/${username}/`;
  } catch (e) {
    console.error(`[URL Validation] Error cleaning Instagram URL: ${e.message}`);
    return null;
  }
}

/**
 * Clean and validate Facebook URL
 * - Strips query parameters
 * - Rejects videos, groups, posts, events, etc.
 * - Handles /p/ profile URLs (e.g., /p/Buns-N-Rolls-100064005101592/)
 * - Returns null if invalid
 * @param {string} url - Facebook URL to clean
 * @returns {string|null} Cleaned URL or null if invalid
 */
function cleanFacebookUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('facebook.com')) return null;

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Reject invalid patterns (videos, groups, posts, etc.)
    const invalidPatterns = ['/videos/', '/groups/', '/posts/', '/events/', '/photos/', '/watch/', '/gaming/', '/video.php', '/photo.php'];
    if (invalidPatterns.some(p => pathname.includes(p))) {
      console.log(`[URL Validation] Rejected Facebook URL (invalid pattern): ${url}`);
      return null;
    }

    // Extract page name from pathname
    const pathParts = pathname.split('/').filter(p => p);
    if (pathParts.length === 0) return null;

    const firstPart = pathParts[0];

    // Skip system pages
    const systemPages = ['login', 'help', 'marketplace', 'watch', 'gaming', 'pages', 'profile.php', 'sharer', 'share'];
    if (systemPages.includes(firstPart.toLowerCase())) {
      console.log(`[URL Validation] Rejected Facebook URL (system page): ${url}`);
      return null;
    }

    // Handle /p/ profile URLs (e.g., /p/Business-Name-100064005101592/)
    // The /p/ prefix is Facebook's newer profile URL format
    if (firstPart === 'p' && pathParts.length >= 2) {
      const profileName = pathParts[1];
      return `https://www.facebook.com/p/${profileName}/`;
    }

    // Handle /profile.php?id=XXX format
    if (firstPart === 'profile.php') {
      const profileId = urlObj.searchParams.get('id');
      if (profileId) {
        return `https://www.facebook.com/profile.php?id=${profileId}`;
      }
      return null;
    }

    // Standard page URL format
    return `https://www.facebook.com/${firstPart}/`;
  } catch (e) {
    console.error(`[URL Validation] Error cleaning Facebook URL: ${e.message}`);
    return null;
  }
}

/**
 * Clean review count to extract just the integer
 * Handles formats like:
 * - "281 Google reviews"
 * - "(500+ reviews)"
 * - "3,521 reviews"
 * - "355 reviews"
 * @param {string|number} reviewStr - Review string or number
 * @returns {number|null} Integer count or null
 */
function cleanReviewCount(reviewStr) {
  if (reviewStr === null || reviewStr === undefined) return null;
  if (typeof reviewStr === 'number') return Math.floor(reviewStr);

  // Convert to string and remove commas
  const cleaned = String(reviewStr).replace(/,/g, '');

  // Extract the first number found
  const match = cleaned.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Validate that a URL is a valid website URL (not a delivery platform)
 * @param {string} url - Website URL to validate
 * @returns {string|null} URL if valid, null if invalid
 */
function cleanWebsiteUrl(url) {
  if (!url || typeof url !== 'string') return null;

  // Must start with http
  if (!url.startsWith('http')) return null;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Reject delivery platform URLs
    const deliveryPlatforms = [
      'ubereats.com',
      'doordash.com',
      'delivereasy.co.nz',
      'menulog.co.nz',
      'menulog.com.au',
      'grubhub.com',
      'postmates.com',
      'skip.com',
      'deliveroo.com',
      'foodora.com'
    ];

    if (deliveryPlatforms.some(platform => hostname.includes(platform))) {
      console.log(`[URL Validation] Rejected website URL (delivery platform): ${url}`);
      return null;
    }

    return url;
  } catch (e) {
    return null;
  }
}

module.exports = {
  cleanInstagramUrl,
  cleanFacebookUrl,
  cleanReviewCount,
  cleanWebsiteUrl
};
