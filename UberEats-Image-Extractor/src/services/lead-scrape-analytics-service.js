/**
 * Lead Scrape Analytics Service
 * Provides aggregation and analytics for lead scraping data
 */

const { getSupabaseClient } = require('./database-service');

/**
 * Get summary statistics for lead scraping
 * @param {string} organisationId - Organization ID
 * @param {object} filters - Filter options
 * @returns {Promise<object>} Summary statistics
 */
async function getSummaryStats(organisationId, filters = {}) {
  const client = getSupabaseClient();
  const { startDate, endDate, platform } = filters;

  try {
    let query = client
      .from('lead_scrape_jobs')
      .select('*')
      .eq('organisation_id', organisationId)
      .in('status', ['completed', 'in_progress']);

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);
    if (platform) query = query.eq('platform', platform);

    const { data: jobs, error } = await query;

    if (error) throw error;

    const completedJobs = jobs.filter(j => j.status === 'completed');
    const totalLeadsExtracted = jobs.reduce((sum, j) => sum + (j.leads_extracted || 0), 0);
    const totalLeadsPassed = jobs.reduce((sum, j) => sum + (j.leads_passed || 0), 0);
    const totalLeadsFailed = jobs.reduce((sum, j) => sum + (j.leads_failed || 0), 0);

    // Calculate average success rate
    let avgSuccessRate = 0;
    if (completedJobs.length > 0) {
      const successRates = completedJobs.map(j => {
        const total = (j.leads_passed || 0) + (j.leads_failed || 0);
        return total > 0 ? ((j.leads_passed || 0) / total) * 100 : 0;
      });
      avgSuccessRate = successRates.reduce((sum, r) => sum + r, 0) / completedJobs.length;
    }

    return {
      total_jobs: jobs.length,
      completed_jobs: completedJobs.length,
      total_leads_extracted: totalLeadsExtracted,
      total_leads_passed: totalLeadsPassed,
      total_leads_failed: totalLeadsFailed,
      unique_cities: [...new Set(jobs.map(j => j.city).filter(Boolean))].length,
      unique_cuisines: [...new Set(jobs.map(j => j.cuisine).filter(Boolean))].length,
      avg_success_rate: Math.round(avgSuccessRate * 10) / 10
    };
  } catch (error) {
    console.error('[LeadScrapeAnalytics] Error getting summary stats:', error);
    throw error;
  }
}

/**
 * Get coverage data grouped by city and cuisine
 * @param {string} organisationId - Organization ID
 * @param {object} filters - Filter options
 * @returns {Promise<Array>} Coverage data by city
 */
async function getCoverageByCity(organisationId, filters = {}) {
  const client = getSupabaseClient();
  const { startDate, endDate, platform, city, cuisine } = filters;

  try {
    let query = client
      .from('lead_scrape_jobs')
      .select('id, city, cuisine, leads_extracted, leads_passed, leads_failed, page_offset, leads_limit, status, completed_at, updated_at')
      .eq('organisation_id', organisationId)
      .in('status', ['completed', 'in_progress']);

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);
    if (platform) query = query.eq('platform', platform);
    if (city) query = query.eq('city', city);
    if (cuisine) query = query.eq('cuisine', cuisine);

    const { data: jobs, error } = await query;

    if (error) throw error;

    // Group by city
    const cityMap = {};
    jobs.forEach(job => {
      const cityKey = job.city || 'Unknown';
      if (!cityMap[cityKey]) {
        cityMap[cityKey] = {
          city: cityKey,
          total_leads: 0,
          total_jobs: 0,
          cuisines: {},
          last_scraped: null,
          pages_scraped: new Set() // Track which pages (1-10) have been scraped
        };
      }

      cityMap[cityKey].total_leads += job.leads_extracted || 0;
      cityMap[cityKey].total_jobs += 1;

      // Calculate which pages this job covered and add to the set
      const pagesNeeded = Math.ceil((job.leads_limit || 21) / 21);
      const startPage = job.page_offset || 1;
      const endPage = startPage + pagesNeeded - 1;
      for (let page = startPage; page <= Math.min(endPage, 10); page++) {
        cityMap[cityKey].pages_scraped.add(page);
      }

      // Update last scraped (use completed_at or updated_at for in-progress jobs)
      const jobTimestamp = job.completed_at || job.updated_at;
      if (!cityMap[cityKey].last_scraped ||
          (jobTimestamp && jobTimestamp > cityMap[cityKey].last_scraped)) {
        cityMap[cityKey].last_scraped = jobTimestamp;
      }

      // Track cuisine breakdown
      const cuisineKey = job.cuisine || 'Unknown';
      if (!cityMap[cityKey].cuisines[cuisineKey]) {
        cityMap[cityKey].cuisines[cuisineKey] = {
          leads: 0,
          jobs: 0,
          pages_scraped: new Set(), // Track which pages (1-10) have been scraped per cuisine
          page_jobs: {} // Map page number to job ID
        };
      }
      cityMap[cityKey].cuisines[cuisineKey].leads += job.leads_extracted || 0;
      cityMap[cityKey].cuisines[cuisineKey].jobs += 1;
      // Add pages to cuisine-level tracking and map to job ID
      for (let page = startPage; page <= Math.min(endPage, 10); page++) {
        cityMap[cityKey].cuisines[cuisineKey].pages_scraped.add(page);
        // Store the most recent job ID for each page (later jobs overwrite earlier ones)
        cityMap[cityKey].cuisines[cuisineKey].page_jobs[page] = job.id;
      }
    });

    // Convert to array and sort by total leads
    // Convert Sets to sorted arrays for JSON serialization
    return Object.values(cityMap)
      .map(city => ({
        ...city,
        pages_scraped: [...city.pages_scraped].sort((a, b) => a - b),
        cuisines: Object.entries(city.cuisines)
          .map(([name, data]) => ({
            name,
            ...data,
            pages_scraped: [...data.pages_scraped].sort((a, b) => a - b)
          }))
          .sort((a, b) => b.leads - a.leads)
      }))
      .sort((a, b) => b.total_leads - a.total_leads);
  } catch (error) {
    console.error('[LeadScrapeAnalytics] Error getting coverage by city:', error);
    throw error;
  }
}

/**
 * Get heatmap matrix data (city x cuisine)
 * @param {string} organisationId - Organization ID
 * @param {object} filters - Filter options
 * @returns {Promise<object>} Heatmap data with cities, cuisines, and matrix
 */
async function getHeatmapMatrix(organisationId, filters = {}) {
  try {
    const coverage = await getCoverageByCity(organisationId, filters);

    // Extract all unique cuisines
    const allCuisines = new Set();
    coverage.forEach(city => {
      city.cuisines.forEach(c => allCuisines.add(c.name));
    });

    const cuisineList = [...allCuisines].sort();
    const cities = coverage.map(c => c.city);

    // Build matrix
    const matrix = coverage.map(city => {
      return cuisineList.map(cuisine => {
        const found = city.cuisines.find(c => c.name === cuisine);
        return found ? found.leads : 0;
      });
    });

    // Find max value for color scaling
    const maxValue = Math.max(...matrix.flat(), 1);

    return {
      cities,
      cuisines: cuisineList,
      matrix,
      maxValue
    };
  } catch (error) {
    console.error('[LeadScrapeAnalytics] Error getting heatmap matrix:', error);
    throw error;
  }
}

/**
 * Get gap opportunities (city/cuisine combinations with low or no coverage)
 * @param {string} organisationId - Organization ID
 * @param {object} filters - Filter options
 * @returns {Promise<Array>} Opportunity data sorted by score
 */
async function getOpportunities(organisationId, filters = {}) {
  const client = getSupabaseClient();

  try {
    const coverage = await getCoverageByCity(organisationId, filters);

    // Get all available cuisines from the database
    const { data: cuisinesData, error: cuisinesError } = await client
      .from('ubereats_cuisines')
      .select('display_name, slug')
      .eq('is_active', true);

    if (cuisinesError) throw cuisinesError;

    const expectedCuisines = cuisinesData?.map(c => c.slug) || [
      'pizza', 'thai', 'chinese', 'indian', 'japanese',
      'mexican', 'italian', 'burgers', 'korean', 'vietnamese'
    ];

    // Get all cities we've scraped
    const cities = coverage.map(c => c.city);

    const opportunities = [];

    cities.forEach(city => {
      const cityData = coverage.find(c => c.city === city);

      expectedCuisines.forEach(cuisine => {
        // Match cuisine by slug (normalize both to lowercase, handle variations)
        const normalizedCuisine = cuisine.toLowerCase().replace(/[^a-z]/g, '');
        const cuisineData = cityData?.cuisines.find(c => {
          const normalizedName = c.name.toLowerCase().replace(/[^a-z]/g, '');
          return normalizedName === normalizedCuisine ||
                 normalizedName.includes(normalizedCuisine) ||
                 normalizedCuisine.includes(normalizedName);
        });
        const currentLeads = cuisineData?.leads || 0;
        const currentMaxPage = cuisineData?.max_page || 0;
        const lastScraped = cityData?.last_scraped || null;

        // Calculate opportunity score (higher = more opportunity)
        let score = 0;

        if (currentLeads === 0) {
          score = 100; // Never scraped this combo
        } else if (currentLeads < 20) {
          score = 80 - currentLeads; // Low coverage
        } else if (currentMaxPage < 3) {
          score = 50 - (currentMaxPage * 10); // Only scraped first pages
        } else if (currentLeads < 50) {
          score = 30; // Moderate coverage, could use more
        }

        if (score > 20) {
          opportunities.push({
            city,
            cuisine,
            current_leads: currentLeads,
            current_max_page: currentMaxPage,
            suggested_page_offset: currentMaxPage + 1,
            opportunity_score: Math.round(score),
            priority: score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low',
            last_scraped: lastScraped
          });
        }
      });
    });

    // Sort by score descending
    return opportunities.sort((a, b) => b.opportunity_score - a.opportunity_score);
  } catch (error) {
    console.error('[LeadScrapeAnalytics] Error getting opportunities:', error);
    throw error;
  }
}

/**
 * Get activity trends over time
 * @param {string} organisationId - Organization ID
 * @param {object} filters - Filter options
 * @returns {Promise<Array>} Daily activity data
 */
async function getActivityTrends(organisationId, filters = {}) {
  const client = getSupabaseClient();
  const { timeframe = '30d' } = filters;

  try {
    // Calculate start date based on timeframe
    const days = parseInt(timeframe) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: jobs, error } = await client
      .from('lead_scrape_jobs')
      .select('created_at, completed_at, leads_extracted, status')
      .eq('organisation_id', organisationId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by date
    const dateMap = {};
    jobs.forEach(job => {
      const date = job.created_at.split('T')[0];
      if (!dateMap[date]) {
        dateMap[date] = {
          date,
          jobs_created: 0,
          jobs_completed: 0,
          leads_extracted: 0
        };
      }
      dateMap[date].jobs_created += 1;
      if (job.status === 'completed') {
        dateMap[date].jobs_completed += 1;
      }
      dateMap[date].leads_extracted += job.leads_extracted || 0;
    });

    // Fill in missing dates with zeros
    const result = [];
    const endDate = new Date();
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      result.push(dateMap[dateStr] || {
        date: dateStr,
        jobs_created: 0,
        jobs_completed: 0,
        leads_extracted: 0
      });
      current.setDate(current.getDate() + 1);
    }

    return result;
  } catch (error) {
    console.error('[LeadScrapeAnalytics] Error getting activity trends:', error);
    throw error;
  }
}

module.exports = {
  getSummaryStats,
  getCoverageByCity,
  getHeatmapMatrix,
  getOpportunities,
  getActivityTrends
};
