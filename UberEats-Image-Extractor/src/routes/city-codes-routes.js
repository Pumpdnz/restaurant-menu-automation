/**
 * City Codes Routes
 * API routes for city/region lookup data
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const leadScrapeService = require('../services/lead-scrape-service');

/**
 * GET /api/city-codes
 * List all city codes for dropdown selection
 * Query params:
 *   - country: string (nz, au) - optional filter
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const cities = await leadScrapeService.getCityCodes(req.query.country);
    res.json({ success: true, cities, count: cities.length });
  } catch (error) {
    console.error('Error fetching city codes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/city-codes/cuisines
 * List all available UberEats cuisines for dropdown selection
 */
router.get('/cuisines', authMiddleware, async (req, res) => {
  try {
    const cuisines = await leadScrapeService.getCuisines();
    res.json({ success: true, cuisines, count: cuisines.length });
  } catch (error) {
    console.error('Error fetching cuisines:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
