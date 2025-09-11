const crypto = require('crypto');

/**
 * CloudWaitress API Service
 * Handles user registration through CloudWaitress API
 * Uses HMAC-SHA256 signature to bypass email verification
 */
class CloudWaitressAPIService {
  constructor() {
    // Use environment variables or fallback to hardcoded values
    this.baseUrl = process.env.CLOUDWAITRESS_API_URL || 'https://api.cloudwaitress.com';
    this.integratorId = process.env.CLOUDWAITRESS_INTEGRATOR_ID || 'CWI_e2dae966-8523-4fd6-a853-58586a296bff';
    this.secret = process.env.CLOUDWAITRESS_SECRET || 'CWS_09908059-7b25-492f-86c9-34c672d689a4';
  }

  /**
   * Generate HMAC-SHA256 signature for API authentication
   * @param {string} email - User email
   * @param {string} phone - User phone number
   * @param {string} password - User password
   * @returns {string} Hex-encoded signature
   */
  generateSignature(email, phone, password) {
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(email)
      .update(phone)
      .update(password);
    return hmac.digest('hex');
  }

  /**
   * Format phone number for New Zealand
   * Ensures phone number starts with +64
   * @param {string} phone - Raw phone number
   * @returns {string} Formatted phone number
   */
  formatPhoneNumber(phone) {
    if (!phone) return '';
    
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle NZ phone numbers
    if (cleaned.startsWith('64')) {
      return '+' + cleaned;
    } else if (cleaned.startsWith('0')) {
      // Remove leading 0 and add +64
      return '+64' + cleaned.substring(1);
    } else if (cleaned.length === 9) {
      // Assume NZ number without country code or leading 0
      return '+64' + cleaned;
    }
    
    // Return with + if not already present
    return phone.startsWith('+') ? phone : '+' + cleaned;
  }

  /**
   * Register a new user through CloudWaitress API
   * Uses signature to bypass email verification
   * @param {string} email - User email
   * @param {string} phone - User phone number (will be formatted for NZ)
   * @param {string} password - User password
   * @returns {Promise<Object>} Registration response
   */
  async registerUser(email, phone, password) {
    try {
      // Format phone number for NZ
      const formattedPhone = this.formatPhoneNumber(phone);
      
      // Generate signature for authentication and verification bypass
      const signature = this.generateSignature(email, formattedPhone, password);
      
      console.log('[CloudWaitress] Starting registration for:', email);
      console.log('[CloudWaitress] Phone formatted:', formattedPhone);
      console.log('[CloudWaitress] Generated signature:', signature);
      console.log('[CloudWaitress] Using secret:', this.secret ? 'Secret is set' : 'SECRET IS MISSING!');
      
      // Step 1: Start registration
      const startPayload = {
        integrator_id: this.integratorId,
        email,
        phone: formattedPhone,
        password,
        signature
      };
      
      console.log('[CloudWaitress] Calling /users/register/start with payload:', {
        integrator_id: this.integratorId,
        email,
        phone: formattedPhone,
        password: '***hidden***'
      });
      
      const startResponse = await fetch(`${this.baseUrl}/users/register/start`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(startPayload)
      });
      
      const startData = await startResponse.json();
      console.log('[CloudWaitress] Start response status:', startResponse.status);
      console.log('[CloudWaitress] Start response data:', startData);
      
      // Check if there's a signature in the response
      if (startData.signature) {
        console.log('[CloudWaitress] Signature from API response:', startData.signature);
        console.log('[CloudWaitress] Our generated signature:', signature);
        console.log('[CloudWaitress] Signatures match:', startData.signature === signature);
      }
      
      // CloudWaitress returns outcome: 0 for success, anything else is an error
      if (!startResponse.ok || startData.outcome !== 0) {
        console.error('[CloudWaitress] Start registration failed');
        console.error('[CloudWaitress] Status:', startResponse.status);
        console.error('[CloudWaitress] Outcome:', startData.outcome);
        console.error('[CloudWaitress] Message:', startData.message);
        
        // Handle specific error cases
        if (startData.message?.includes('already exists') || 
            startData.message?.includes('already registered')) {
          return {
            success: false,
            error: 'User already exists',
            alreadyExists: true
          };
        }
        
        throw new Error(startData.message || `Registration start failed with outcome: ${startData.outcome}`);
      }
      
      if (!startData.token) {
        console.error('[CloudWaitress] No token in response:', startData);
        throw new Error('No token received from registration start');
      }
      
      console.log('[CloudWaitress] Registration started, token received');
      
      // Step 2: Auto-verify using admin password (bypasses email verification)
      const adminPassword = process.env.PUMPD_ADMIN_PASSWORD || '7uo@%K2^Hz%yiXDeP39Ckp6BvF!2';
      const verifyPayload = {
        token: startData.token,
        email_confirmation_code: adminPassword // Admin password bypasses email verification
      };
      
      console.log('[CloudWaitress] Calling /users/register/verify with payload:', {
        token: startData.token ? 'token_exists' : 'no_token',
        email_confirmation_code: 'admin_password'
      });
      
      const verifyResponse = await fetch(`${this.baseUrl}/users/register/verify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(verifyPayload)
      });
      
      const verifyData = await verifyResponse.json();
      console.log('[CloudWaitress] Verify response status:', verifyResponse.status);
      console.log('[CloudWaitress] Verify response data:', verifyData);
      
      // CloudWaitress returns outcome: 0 for success, anything else is an error
      if (!verifyResponse.ok || verifyData.outcome !== 0) {
        console.error('[CloudWaitress] Verification failed');
        console.error('[CloudWaitress] Outcome code:', verifyData.outcome);
        console.error('[CloudWaitress] Error message:', verifyData.message);
        
        // Check if user already exists
        if (verifyData.message?.toLowerCase().includes('already')) {
          return {
            success: false,
            error: 'User already exists',
            alreadyExists: true
          };
        }
        
        throw new Error(verifyData.message || `Registration verification failed with outcome: ${verifyData.outcome}`);
      }
      
      console.log('[CloudWaitress] Registration completed successfully');
      console.log('[CloudWaitress] User data returned:', verifyData);
      
      return {
        success: true,
        data: verifyData,
        email,
        message: 'User registered successfully'
      };
      
    } catch (error) {
      console.error('[CloudWaitress] Registration error:', error);
      
      // Return structured error response
      return {
        success: false,
        error: error.message || 'Registration failed',
        details: error
      };
    }
  }

  /**
   * Check if a user exists (by attempting registration and checking for "already exists" error)
   * @param {string} email - User email to check
   * @returns {Promise<boolean>} True if user exists
   */
  async checkUserExists(email) {
    try {
      // Try to start registration with dummy data
      const phone = '+640000000000'; // Dummy NZ phone
      const password = 'TempCheck123!'; // Dummy password
      const signature = this.generateSignature(email, phone, password);
      
      const response = await fetch(`${this.baseUrl}/users/register/start`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          integrator_id: this.integratorId,
          email,
          phone,
          password,
          signature
        })
      });
      
      const data = await response.json();
      
      // User exists if we get "already exists" error
      return data.message?.includes('already exists') || false;
      
    } catch (error) {
      console.error('[CloudWaitress] Error checking user existence:', error);
      return false;
    }
  }
}

// Export for CommonJS (Node.js)
module.exports = CloudWaitressAPIService;

// Also export for ES6 if needed
module.exports.CloudWaitressAPIService = CloudWaitressAPIService;