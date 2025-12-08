/**
 * ESM wrapper for platform-detector
 *
 * This file provides ES Module exports for the frontend (Vite build).
 * The actual implementation is in platform-detector.js (CommonJS) for Node.js compatibility.
 *
 * This dual-file approach solves the Railway/Netlify deployment conflict:
 * - Railway (Node.js) uses: require('./platform-detector.js')
 * - Netlify (Vite) uses: import from './platform-detector.esm.js'
 */

// Import the CommonJS module - Vite handles this interop
import platformDetector from './platform-detector.js';

// Re-export as named ESM exports
export const detectPlatform = platformDetector.detectPlatform;
export const extractRestaurantName = platformDetector.extractRestaurantName;
export const getExtractionConfig = platformDetector.getExtractionConfig;
export const PLATFORM_CONFIG = platformDetector.PLATFORM_CONFIG;

// Also provide default export
export default platformDetector;
