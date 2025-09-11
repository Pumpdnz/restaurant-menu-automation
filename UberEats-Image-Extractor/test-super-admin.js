const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:3007';

// Test configuration - you'll need to provide these values
const SUPER_ADMIN_TOKEN = process.env.TEST_SUPER_ADMIN_TOKEN || '';
const REGULAR_USER_TOKEN = process.env.TEST_USER_TOKEN || '';

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function testEndpoint(name, config) {
  try {
    console.log(`${colors.blue}Testing: ${name}${colors.reset}`);
    const response = await axios(config);
    console.log(`${colors.green}✓ ${name} - Status: ${response.status}${colors.reset}`);
    return { success: true, data: response.data };
  } catch (error) {
    const status = error.response?.status || 'Network Error';
    const message = error.response?.data?.error || error.message;
    console.log(`${colors.red}✗ ${name} - Status: ${status} - ${message}${colors.reset}`);
    return { success: false, error: message, status };
  }
}

async function runTests() {
  console.log(`${colors.yellow}\n========================================${colors.reset}`);
  console.log(`${colors.yellow}Super Admin API Endpoint Tests${colors.reset}`);
  console.log(`${colors.yellow}========================================\n${colors.reset}`);

  if (!SUPER_ADMIN_TOKEN) {
    console.log(`${colors.red}ERROR: Please set TEST_SUPER_ADMIN_TOKEN in .env${colors.reset}`);
    console.log('To get a token:');
    console.log('1. Login as super admin in the app');
    console.log('2. Check localStorage.getItem("auth_token") in browser console');
    console.log('3. Add to .env: TEST_SUPER_ADMIN_TOKEN=your_token_here\n');
    return;
  }

  // Test 1: Organizations endpoint with super admin token
  console.log(`${colors.yellow}1. Testing with Super Admin Token${colors.reset}\n`);
  
  const orgResult = await testEndpoint('GET /api/super-admin/organizations', {
    method: 'GET',
    url: `${API_BASE_URL}/api/super-admin/organizations`,
    headers: {
      'Authorization': `Bearer ${SUPER_ADMIN_TOKEN}`
    }
  });

  // Test 2: Stats endpoint
  const statsResult = await testEndpoint('GET /api/super-admin/stats', {
    method: 'GET',
    url: `${API_BASE_URL}/api/super-admin/stats`,
    headers: {
      'Authorization': `Bearer ${SUPER_ADMIN_TOKEN}`
    }
  });

  // Test 3: Users endpoint
  const usersResult = await testEndpoint('GET /api/super-admin/users', {
    method: 'GET',
    url: `${API_BASE_URL}/api/super-admin/users`,
    headers: {
      'Authorization': `Bearer ${SUPER_ADMIN_TOKEN}`
    }
  });

  // Test 4: Without token (should fail)
  console.log(`\n${colors.yellow}2. Testing without Authorization${colors.reset}\n`);
  
  await testEndpoint('GET /api/super-admin/organizations (No Auth)', {
    method: 'GET',
    url: `${API_BASE_URL}/api/super-admin/organizations`
  });

  // Test 5: With regular user token (should fail)
  if (REGULAR_USER_TOKEN) {
    console.log(`\n${colors.yellow}3. Testing with Regular User Token${colors.reset}\n`);
    
    await testEndpoint('GET /api/super-admin/organizations (Regular User)', {
      method: 'GET',
      url: `${API_BASE_URL}/api/super-admin/organizations`,
      headers: {
        'Authorization': `Bearer ${REGULAR_USER_TOKEN}`
      }
    });
  }

  // Display results summary
  console.log(`\n${colors.yellow}========================================${colors.reset}`);
  console.log(`${colors.yellow}Test Summary${colors.reset}`);
  console.log(`${colors.yellow}========================================${colors.reset}\n`);

  if (orgResult.success) {
    console.log(`${colors.green}✓ Super admin endpoints are accessible with proper token${colors.reset}`);
    if (orgResult.data?.organizations) {
      console.log(`  - Found ${orgResult.data.organizations.length} organizations`);
    }
  }

  if (statsResult.success && statsResult.data?.stats) {
    console.log(`${colors.green}✓ Stats endpoint working${colors.reset}`);
    console.log(`  - Total organizations: ${statsResult.data.stats.totalOrganizations}`);
    console.log(`  - Total users: ${statsResult.data.stats.totalUsers}`);
    console.log(`  - Active users (30 days): ${statsResult.data.stats.activeUsers}`);
  }

  if (usersResult.success && usersResult.data?.users) {
    console.log(`${colors.green}✓ Users endpoint working${colors.reset}`);
    console.log(`  - Found ${usersResult.data.users.length} users`);
  }

  console.log('\n');
}

// Run the tests
runTests().catch(console.error);