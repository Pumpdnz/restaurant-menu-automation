/**
 * Variable Replacement Client Service
 * Frontend version of available variables for use in React components
 */

export interface Variable {
  name: string;
  description: string;
  example: string;
}

export interface VariableCategory {
  category: string;
  variables: Variable[];
  /** If true, category is collapsed by default */
  collapsedByDefault?: boolean;
}

/**
 * Get list of all available variables with descriptions
 * Organized by category for easy browsing
 * @returns Array of variable categories with their variables
 */
export function getAvailableVariables(): VariableCategory[] {
  return [
    // Restaurant & Contact Information - Always visible
    {
      category: 'Restaurant & Contact',
      variables: [
        { name: 'restaurant_name', description: 'Restaurant name', example: 'Bella Pizza' },
        { name: 'organisation_name', description: 'Organisation name', example: 'Bella Group Ltd' },
        { name: 'city', description: 'Restaurant city', example: 'Auckland' },
        { name: 'cuisine', description: 'Cuisine type(s)', example: 'Italian, Pizza' },
        { name: 'first_name', description: 'Contact first name', example: 'John' },
        { name: 'demo_store_url', description: 'Demo store URL', example: 'https://demo-bella.pumpd.co.nz' },
      ]
    },
    // Example Restaurants - For social proof
    {
      category: 'Example Restaurants',
      variables: [
        { name: 'example_restaurant_1', description: 'Example restaurant (same city)', example: 'Famous Burgers Auckland' },
        { name: 'example_restaurant_1_url', description: 'Example restaurant URL', example: 'https://famous-burgers.pumpd.co.nz' },
        { name: 'example_restaurant_2', description: 'Second example restaurant', example: 'Thai Delight Auckland' },
        { name: 'example_restaurant_2_url', description: 'Second example URL', example: 'https://thai-delight.pumpd.co.nz' },
      ]
    },
    // Sales Information
    {
      category: 'Sales & Timing',
      variables: [
        { name: 'last_contacted_day', description: 'Last contact (natural)', example: 'yesterday' },
      ]
    },
    // Qualification - Contact & Business
    {
      category: 'Qualification: Contact & Business',
      collapsedByDefault: true,
      variables: [
        { name: 'contact_role', description: "Contact's role", example: 'Owner' },
        { name: 'number_of_venues', description: 'Number of venues', example: '3' },
        { name: 'website_type', description: 'Website type', example: 'Custom Domain' },
        { name: 'meeting_link', description: 'Meeting/demo link', example: 'https://meet.google.com/abc' },
      ]
    },
    // Qualification - Current Tech Stack
    {
      category: 'Qualification: Tech & Operations',
      collapsedByDefault: true,
      variables: [
        { name: 'point_of_sale', description: 'POS system', example: 'Lightspeed' },
        { name: 'online_ordering_platform', description: 'Ordering platform', example: 'ChowNow' },
        { name: 'online_ordering_handles_delivery', description: 'Platform handles delivery', example: 'Yes' },
        { name: 'self_delivery', description: 'Self-delivery capability', example: 'No' },
      ]
    },
    // Qualification - UberEats Metrics
    {
      category: 'Qualification: UberEats Metrics',
      collapsedByDefault: true,
      variables: [
        { name: 'weekly_uber_sales_volume', description: 'Weekly order volume', example: '250 orders' },
        { name: 'uber_aov', description: 'Average order value', example: '$32.50' },
        { name: 'uber_markup', description: 'Menu markup %', example: '25.0%' },
        { name: 'uber_profitability', description: 'Profitability %', example: '15.5%' },
        { name: 'uber_profitability_description', description: 'Profitability notes', example: 'Profitable after commission' },
      ]
    },
    // Qualification - Sales Strategy
    {
      category: 'Qualification: Sales Strategy',
      collapsedByDefault: true,
      variables: [
        { name: 'current_marketing_description', description: 'Current marketing', example: 'Social media, email' },
        { name: 'qualification_details', description: 'Qualification notes', example: 'Very interested' },
        { name: 'painpoints', description: 'Pain points', example: 'High commission' },
        { name: 'core_selling_points', description: 'Selling points', example: 'Lower fees' },
        { name: 'features_to_highlight', description: 'Features to highlight', example: 'Custom domain' },
        { name: 'possible_objections', description: 'Possible objections', example: 'Migration effort' },
      ]
    }
  ];
}

/**
 * Get a flat list of all variable names
 * @returns Array of variable names
 */
export function getAllVariableNames(): string[] {
  return getAvailableVariables().flatMap(category =>
    category.variables.map(v => v.name)
  );
}

/**
 * Check if a variable name is valid
 * @param variableName - The variable name to check
 * @returns true if the variable exists
 */
export function isValidVariable(variableName: string): boolean {
  return getAllVariableNames().includes(variableName);
}

/**
 * Extract variables from message content
 * @param messageContent - The message template content
 * @returns Array of variable names found in the message
 */
export function extractVariables(messageContent: string): string[] {
  if (!messageContent) return [];

  const regex = /{([a-zA-Z_][a-zA-Z0-9_]*)}/g;
  const matches = messageContent.matchAll(regex);
  const variables = new Set<string>();

  for (const match of matches) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Validate variables in a message
 * @param messageContent - The message to validate
 * @returns Validation result with isValid flag and lists of known/unknown variables
 */
export function validateVariables(messageContent: string): {
  isValid: boolean;
  unknownVariables: string[];
  knownVariables: string[];
  totalVariables: number;
} {
  const variables = extractVariables(messageContent);
  const validNames = getAllVariableNames();

  const knownVariables = variables.filter(v => validNames.includes(v));
  const unknownVariables = variables.filter(v => !validNames.includes(v));

  return {
    isValid: unknownVariables.length === 0,
    unknownVariables,
    knownVariables,
    totalVariables: variables.length
  };
}
