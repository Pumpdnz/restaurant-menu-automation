// Usage Statistics Export Utility
// Provides CSV and JSON export functionality for usage statistics

export interface UsageStats {
  total_credits_used: number;
  total_extractions: number;
  total_restaurants_created: number;
  total_menu_extractions: number;
  total_menu_items_extracted: number;
  total_standard_extractions: number;
  total_standard_menu_items: number;
  total_premium_extractions: number;
  total_premium_menu_items: number;
  total_logos_extracted: number;
  total_logos_processed: number;
  total_google_search_extractions: number;
  total_platform_details_extractions: number;
  total_csv_downloads: number;
  total_csv_without_images: number;
  total_csv_with_images: number;
  total_image_upload_jobs: number;
  total_images_uploaded_to_cdn: number;
  total_image_zip_downloads: number;
  total_images_downloaded: number;
  // Lead Scraping
  total_lead_scrape_jobs: number;
  total_lead_scrape_api_calls: number;
  total_leads_converted: number;
  // Branding
  total_branding_extractions: number;
  // Registration
  total_user_accounts_registered: number;
  total_restaurants_registered: number;
  total_menus_uploaded: number;
  total_item_tags_added: number;
  total_option_sets_added: number;
  total_code_injections_generated: number;
  total_website_settings_configured: number;
  total_stripe_payments_configured: number;
  total_services_configured: number;
  total_onboarding_users_created: number;
  total_setups_finalized: number;
}

// Billing rates (matching backend)
export const BILLING_RATES: Record<string, number> = {
  standard_extraction: 0.10,
  premium_extraction: 0.25,
  logo_extraction: 0.15,
  logo_processing: 0.20,
  google_search: 0.05,
  platform_details: 0.05,
  csv_download: 0.01,
  csv_with_images_download: 0.02,
  image_cdn_upload: 0.001,
  image_zip_download: 0.05,
  lead_scrape_job: 1.00,
  lead_scrape_api_call: 0.05,
  lead_converted: 0.25,
  branding_extraction: 0.20,
};

interface ExportFilters {
  organisationId?: string;
  organisationName?: string;
  startDate: string;
  endDate: string;
}

export class UsageExporter {
  /**
   * Export usage statistics to CSV format
   */
  static exportToCSV(stats: UsageStats, filters: ExportFilters): void {
    const rows: string[][] = [
      ['Usage Statistics Report'],
      [`Generated: ${new Date().toISOString()}`],
      [`Organization: ${filters.organisationName || 'All Organizations'}`],
      [`Date Range: ${filters.startDate} to ${filters.endDate}`],
      [''],
      ['Category', 'Metric', 'Count', 'Rate ($)', 'Cost ($)'],
    ];

    // Extraction metrics
    rows.push(['Extractions', 'Standard Extractions', String(stats.total_standard_extractions), '0.10', (stats.total_standard_extractions * 0.10).toFixed(2)]);
    rows.push(['Extractions', 'Premium Extractions', String(stats.total_premium_extractions), '0.25', (stats.total_premium_extractions * 0.25).toFixed(2)]);
    rows.push(['Extractions', 'Total Menu Items', String(stats.total_menu_items_extracted), '-', '-']);

    // Logo metrics
    rows.push(['Logos', 'Logo Extractions', String(stats.total_logos_extracted), '0.15', (stats.total_logos_extracted * 0.15).toFixed(2)]);
    rows.push(['Logos', 'Logo Processing', String(stats.total_logos_processed), '0.20', (stats.total_logos_processed * 0.20).toFixed(2)]);

    // Search metrics
    rows.push(['Search', 'Google Searches', String(stats.total_google_search_extractions), '0.05', (stats.total_google_search_extractions * 0.05).toFixed(2)]);
    rows.push(['Search', 'Platform Details', String(stats.total_platform_details_extractions), '0.05', (stats.total_platform_details_extractions * 0.05).toFixed(2)]);

    // CSV metrics
    rows.push(['Exports', 'CSV Downloads', String(stats.total_csv_without_images), '0.01', (stats.total_csv_without_images * 0.01).toFixed(2)]);
    rows.push(['Exports', 'CSV with Images', String(stats.total_csv_with_images), '0.02', (stats.total_csv_with_images * 0.02).toFixed(2)]);

    // Image metrics
    rows.push(['Images', 'CDN Uploads', String(stats.total_images_uploaded_to_cdn), '0.001', (stats.total_images_uploaded_to_cdn * 0.001).toFixed(2)]);
    rows.push(['Images', 'ZIP Downloads', String(stats.total_image_zip_downloads), '0.05', (stats.total_image_zip_downloads * 0.05).toFixed(2)]);

    // Lead Scraping metrics
    rows.push(['Lead Scraping', 'Scrape Jobs', String(stats.total_lead_scrape_jobs), '1.00', (stats.total_lead_scrape_jobs * 1.00).toFixed(2)]);
    rows.push(['Lead Scraping', 'API Calls', String(stats.total_lead_scrape_api_calls), '0.05', (stats.total_lead_scrape_api_calls * 0.05).toFixed(2)]);
    rows.push(['Lead Scraping', 'Leads Converted', String(stats.total_leads_converted), '0.25', (stats.total_leads_converted * 0.25).toFixed(2)]);

    // Branding metrics
    rows.push(['Branding', 'Branding Extractions', String(stats.total_branding_extractions), '0.20', (stats.total_branding_extractions * 0.20).toFixed(2)]);

    // Registration metrics (tracking only, no cost)
    rows.push(['Registration', 'User Accounts', String(stats.total_user_accounts_registered), '0.00', '0.00']);
    rows.push(['Registration', 'Restaurants', String(stats.total_restaurants_registered), '0.00', '0.00']);
    rows.push(['Registration', 'Menus Uploaded', String(stats.total_menus_uploaded), '0.00', '0.00']);
    rows.push(['Registration', 'Item Tags', String(stats.total_item_tags_added), '0.00', '0.00']);
    rows.push(['Registration', 'Option Sets', String(stats.total_option_sets_added), '0.00', '0.00']);
    rows.push(['Registration', 'Code Injections', String(stats.total_code_injections_generated), '0.00', '0.00']);
    rows.push(['Registration', 'Website Settings', String(stats.total_website_settings_configured), '0.00', '0.00']);
    rows.push(['Registration', 'Stripe Payments', String(stats.total_stripe_payments_configured), '0.00', '0.00']);
    rows.push(['Registration', 'Services', String(stats.total_services_configured), '0.00', '0.00']);
    rows.push(['Registration', 'Onboarding Users', String(stats.total_onboarding_users_created), '0.00', '0.00']);
    rows.push(['Registration', 'Setups Finalized', String(stats.total_setups_finalized), '0.00', '0.00']);

    // Total
    rows.push(['']);
    rows.push(['', 'TOTAL CREDITS', '', '', String(stats.total_credits_used)]);

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const filename = `usage-stats-${filters.startDate}-to-${filters.endDate}.csv`;
    this.downloadFile(csvContent, filename, 'text/csv');
  }

  /**
   * Export usage statistics to JSON format
   */
  static exportToJSON(stats: UsageStats, filters: ExportFilters): void {
    const exportData = {
      report: {
        generated_at: new Date().toISOString(),
        organisation: filters.organisationName || 'All Organizations',
        organisation_id: filters.organisationId || null,
        date_range: {
          start: filters.startDate,
          end: filters.endDate,
        },
      },
      statistics: stats,
      billing_summary: {
        extraction_costs: {
          standard: { count: stats.total_standard_extractions, rate: 0.10, total: stats.total_standard_extractions * 0.10 },
          premium: { count: stats.total_premium_extractions, rate: 0.25, total: stats.total_premium_extractions * 0.25 },
        },
        logo_costs: {
          extraction: { count: stats.total_logos_extracted, rate: 0.15, total: stats.total_logos_extracted * 0.15 },
          processing: { count: stats.total_logos_processed, rate: 0.20, total: stats.total_logos_processed * 0.20 },
        },
        search_costs: {
          google: { count: stats.total_google_search_extractions, rate: 0.05, total: stats.total_google_search_extractions * 0.05 },
          platform: { count: stats.total_platform_details_extractions, rate: 0.05, total: stats.total_platform_details_extractions * 0.05 },
        },
        export_costs: {
          csv: { count: stats.total_csv_without_images, rate: 0.01, total: stats.total_csv_without_images * 0.01 },
          csv_with_images: { count: stats.total_csv_with_images, rate: 0.02, total: stats.total_csv_with_images * 0.02 },
        },
        image_costs: {
          cdn_upload: { count: stats.total_images_uploaded_to_cdn, rate: 0.001, total: stats.total_images_uploaded_to_cdn * 0.001 },
          zip_download: { count: stats.total_image_zip_downloads, rate: 0.05, total: stats.total_image_zip_downloads * 0.05 },
        },
        lead_scraping_costs: {
          jobs: { count: stats.total_lead_scrape_jobs, rate: 1.00, total: stats.total_lead_scrape_jobs * 1.00 },
          api_calls: { count: stats.total_lead_scrape_api_calls, rate: 0.05, total: stats.total_lead_scrape_api_calls * 0.05 },
          conversions: { count: stats.total_leads_converted, rate: 0.25, total: stats.total_leads_converted * 0.25 },
        },
        branding_costs: {
          extractions: { count: stats.total_branding_extractions, rate: 0.20, total: stats.total_branding_extractions * 0.20 },
        },
        total_credits: stats.total_credits_used,
      },
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const filename = `usage-stats-${filters.startDate}-to-${filters.endDate}.json`;
    this.downloadFile(jsonContent, filename, 'application/json');
  }

  /**
   * Download file helper
   */
  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
