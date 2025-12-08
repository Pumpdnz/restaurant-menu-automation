/**
 * Demo Meeting Qualification Constants
 * Pre-configured options for qualification fields
 *
 * These constants are used in the TagInput component to provide
 * quick-select options while still allowing custom values.
 */

/**
 * Common painpoints that restaurant owners face
 * Used in the painpoints qualification field
 */
export const PREDEFINED_PAINPOINTS = [
  'High third-party commission fees',
  'Commission eating into margins',
  'Converting Uber customers to Direct Ordering',
  'Poor control over customer experience',
  'Limited customer data access',
  'Difficult to leverage customer data with current platform',
  'Lack of direct customer relationship',
  'Unable to run own promotions'
] as const;

/**
 * Pumpd's core selling points
 * Used in the core_selling_points qualification field
 */
export const PREDEFINED_SELLING_POINTS = [
  'Get more customers to order directly',
  'Get more regular customers',
  'Setup custom SMS messages based on activity data',
  'Improve margins on delivery by cutting delivery commissions to 5%',
  'Improve customer ordering experience',
  'Increase repeat ordering frequency',
  'Improve Google Business Profile Reviews',
  'Custom branding',
  'Built-in loyalty program',
  'Integrated marketing tools',
  'Customer insights & analytics'
] as const;

/**
 * Pumpd features to highlight during demos
 * Used in the features_to_highlight qualification field
 */
export const PREDEFINED_FEATURES = [
  '5% commission on delivery orders',
  '2% commission on pickup orders',
  'Custom Branding',
  'Beautiful online ordering platform',
  'Improved SEO with custom domain',
  'Welcome flow promotions',
  'Automated review requests',
  'Converting first-time customers to regulars with SMS Promotions',
  'Increasing repeat ordering with a loyalty program and customer-activity based SMS messages',
  'Real-time notifications',
  'Easy Menu management',
  'Unbeatable support',
  'Order management dashboard',
  'Order Aggregation',
  'Email marketing tools built in',
  'SMS marketing tools built in'
] as const;

/**
 * Common objections that prospects may raise
 * Used in the possible_objections qualification field
 */
export const PREDEFINED_OBJECTIONS = [
  'Has strong relationship with Online Ordering / POS provider',
  'Current Online Ordering is integrated with POS',
  'Price for delivery for customers',
  'No commission fee on current delivery platform',
  'UberEats and DoorDash receipt printing',
  'Concerned about customer adoption',
  'Worried about technical complexity',
  'Unsure about marketing capabilities',
  'Budget constraints',
  'Concerned about onboarding time',
  'Current contract obligations',
  'Happy with current setup'
] as const;

/**
 * Common POS systems
 * Used for autocomplete/suggestions in point_of_sale field
 */
export const COMMON_POS_SYSTEMS = [
  'Ai-Menu',
  'Book N Order',
  'Bustle (ex-POSboss)',
  'EPOS-NOW',
  'IdealPOS',
  'Lightspeed',
  'Loyverse',
  'POSbiz',
  'Salespoint',
  'Shopify POS',
  'Sipo CloudPOS',
  'Square',
  'SwiftPOS',
  'Tabin',
  'Tevalis',
  'None'
] as const;

/**
 * Common online ordering platforms
 * Used for autocomplete/suggestions in online_ordering_platform field
 */
export const COMMON_ORDERING_PLATFORMS = [
  'Bite',
  'Book N Order',
  'Bopple',
  'Bustle',
  'Foodhub',
  'Gloriafood',
  'Mobi2Go',
  'Me&U',
  'NextOrder',
  'Ordermeal',
  'Resdiary',
  'Sipo CloudPOS',
  'Tabin',
  'Tuckerfox',
  'Custom (website)',
  'None'
] as const;

/**
 * Website type options
 * Used in website_type select field
 */
export const WEBSITE_TYPES = [
  { value: 'platform_subdomain', label: 'Platform Subdomain (e.g., restaurant.mobi2go.com)' },
  { value: 'custom_domain', label: 'Custom Domain (e.g., www.restaurant.co.nz)' }
] as const;

/**
 * Contact role options
 * Common roles for restaurant contacts
 */
export const CONTACT_ROLES = [
  'Owner',
  'Co-Owner',
  'General Manager',
  'Manager',
  'Director',
  'Operations Manager',
  'Marketing Manager',
  'Head Chef',
  'Partner',
  'Other'
] as const;

/**
 * Type definition for tag items (used in JSONB arrays)
 */
export interface TagItem {
  type: 'predefined' | 'custom';
  value: string;
}

/**
 * Type definition for qualification data
 */
export interface QualificationData {
  // Contact & Business Context
  contact_role?: string;
  number_of_venues?: number;
  point_of_sale?: string;
  online_ordering_platform?: string;
  online_ordering_handles_delivery?: boolean | null;
  self_delivery?: boolean | null;

  // UberEats Metrics
  weekly_uber_sales_volume?: number;
  uber_aov?: number;
  uber_markup?: number;
  uber_profitability?: number;
  uber_profitability_description?: string;

  // Marketing & Website
  current_marketing_description?: string;
  website_type?: 'platform_subdomain' | 'custom_domain' | null;

  // Sales Context (JSON Arrays)
  painpoints?: TagItem[];
  core_selling_points?: TagItem[];
  features_to_highlight?: TagItem[];
  possible_objections?: TagItem[];

  // Meeting Details
  details?: string;
  meeting_link?: string;
}
