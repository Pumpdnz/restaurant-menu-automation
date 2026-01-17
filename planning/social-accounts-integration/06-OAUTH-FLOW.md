# OAuth Flow & Token Management

## Overview

Complete guide to implementing Meta OAuth 2.0 authentication for Instagram and Facebook account connection, including token acquisition, refresh, and management.

## OAuth 2.0 Flow Diagram

```
┌─────────┐                                    ┌──────────┐
│  User   │                                    │   Meta   │
│ (Client)│                                    │  OAuth   │
└────┬────┘                                    └────┬─────┘
     │                                              │
     │  1. Click "Connect Instagram"                │
     ├──────────────────────────────────────────────┤
     │                                              │
     │  2. Redirect to Meta OAuth Dialog            │
     │     with client_id, redirect_uri, scope      │
     ├─────────────────────────────────────────────>│
     │                                              │
     │  3. User logs in & authorizes                │
     │     Grants permissions                       │
     │<─────────────────────────────────────────────┤
     │                                              │
     │  4. Redirect back with authorization code    │
     │     https://your-app.com/callback?code=ABC   │
     │<─────────────────────────────────────────────┤
     │                                              │
┌────▼────┐                                    ┌────▼─────┐
│  Your   │  5. Exchange code for token        │   Meta   │
│ Server  │    POST /oauth/access_token        │ Graph API│
└────┬────┘                                    └────┬─────┘
     │                                              │
     ├─────────────────────────────────────────────>│
     │                                              │
     │  6. Return short-lived user access token     │
     │     { access_token: "...", expires_in: 3600 }│
     │<─────────────────────────────────────────────┤
     │                                              │
     │  7. Exchange for long-lived token            │
     ├─────────────────────────────────────────────>│
     │                                              │
     │  8. Return long-lived token (60 days)        │
     │<─────────────────────────────────────────────┤
     │                                              │
     │  9. Get user's Instagram accounts/Pages      │
     ├─────────────────────────────────────────────>│
     │                                              │
     │ 10. Return accounts list                     │
     │<─────────────────────────────────────────────┤
     │                                              │
     │ 11. Get Page access token                    │
     ├─────────────────────────────────────────────>│
     │                                              │
     │ 12. Return page access token                 │
     │<─────────────────────────────────────────────┤
     │                                              │
     │ 13. Store encrypted tokens in database       │
     └──────────────────────────────────────────────┘
```

## Step-by-Step Implementation

### Step 1: Initiate OAuth Flow

**Endpoint**: `GET /api/auth/social/connect`

**Backend Code**:

```javascript
// routes/social-auth-routes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

router.get('/auth/social/connect/:platform', async (req, res) => {
  const { platform } = req.params; // 'instagram' or 'facebook'
  const organisationId = req.user.organisationId;

  // Generate state parameter for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');

  // Store state in session or Redis with 10 min expiry
  await redis.setex(`oauth_state:${state}`, 600, JSON.stringify({
    organisationId,
    userId: req.user.id,
    platform,
    timestamp: Date.now()
  }));

  // Build Meta OAuth URL
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: `${process.env.APP_URL}/auth/meta/callback`,
    state: state,
    scope: [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts'
    ].join(','),
    response_type: 'code'
  });

  const oauthUrl = `https://www.facebook.com/v22.0/dialog/oauth?${params}`;

  res.json({ authUrl: oauthUrl });
});

module.exports = router;
```

**Frontend Code**:

```javascript
// React component
const connectInstagram = async () => {
  try {
    const response = await fetch('/api/auth/social/connect/instagram');
    const { authUrl } = await response.json();

    // Open OAuth in popup or redirect
    window.location.href = authUrl;
    // OR
    // window.open(authUrl, 'oauth', 'width=600,height=700');
  } catch (error) {
    console.error('Failed to initiate OAuth:', error);
  }
};
```

### Step 2: Handle OAuth Callback

**Endpoint**: `GET /auth/meta/callback`

```javascript
// routes/social-auth-routes.js
router.get('/auth/meta/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Check for OAuth errors
  if (error) {
    return res.redirect(
      `/settings/social-accounts?error=${encodeURIComponent(error_description)}`
    );
  }

  if (!code || !state) {
    return res.redirect('/settings/social-accounts?error=Invalid callback');
  }

  // Validate state parameter (CSRF protection)
  const stateData = await redis.get(`oauth_state:${state}`);
  if (!stateData) {
    return res.redirect('/settings/social-accounts?error=Invalid state');
  }

  const { organisationId, userId, platform } = JSON.parse(stateData);
  await redis.del(`oauth_state:${state}`);

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?` +
      `client_id=${process.env.META_APP_ID}&` +
      `client_secret=${process.env.META_APP_SECRET}&` +
      `code=${code}&` +
      `redirect_uri=${encodeURIComponent(process.env.APP_URL + '/auth/meta/callback')}`
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error.message);
    }

    const shortLivedToken = tokenData.access_token;

    // Exchange for long-lived user token
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${process.env.META_APP_ID}&` +
      `client_secret=${process.env.META_APP_SECRET}&` +
      `fb_exchange_token=${shortLivedToken}`
    );

    const longLivedData = await longLivedResponse.json();
    const longLivedToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in; // ~5184000 seconds (60 days)

    // Get user's Instagram accounts and Facebook Pages
    const accountsResponse = await fetch(
      `https://graph.facebook.com/v22.0/me/accounts?` +
      `fields=id,name,instagram_business_account,access_token&` +
      `access_token=${longLivedToken}`
    );

    const accountsData = await accountsResponse.json();

    // Save accounts to database
    await saveConnectedAccounts({
      organisationId,
      userId,
      userAccessToken: longLivedToken,
      expiresIn,
      accounts: accountsData.data
    });

    res.redirect('/settings/social-accounts?success=connected');

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(
      `/settings/social-accounts?error=${encodeURIComponent(error.message)}`
    );
  }
});
```

### Step 3: Save Connected Accounts

```javascript
// services/social-accounts-service.js
const { encrypt } = require('../utils/encryption');

async function saveConnectedAccounts({
  organisationId,
  userId,
  userAccessToken,
  expiresIn,
  accounts
}) {
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

  for (const page of accounts) {
    // Check if page has Instagram Business account
    if (page.instagram_business_account) {
      const igAccountId = page.instagram_business_account.id;

      // Get Instagram account details
      const igResponse = await fetch(
        `https://graph.facebook.com/v22.0/${igAccountId}?` +
        `fields=id,username,profile_picture_url,followers_count&` +
        `access_token=${userAccessToken}`
      );

      const igData = await igResponse.json();

      // Exchange for long-lived page token
      const pageLongLivedResponse = await fetch(
        `https://graph.facebook.com/v22.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${process.env.META_APP_ID}&` +
        `client_secret=${process.env.META_APP_SECRET}&` +
        `fb_exchange_token=${page.access_token}`
      );

      const pageLongLivedData = await pageLongLivedResponse.json();
      const pageAccessToken = pageLongLivedData.access_token;

      // Check existing account
      const { data: existing } = await supabase
        .from('social_media_accounts')
        .select('id')
        .eq('organisation_id', organisationId)
        .eq('platform', 'instagram')
        .eq('platform_account_id', igAccountId)
        .single();

      const accountData = {
        organisation_id: organisationId,
        platform: 'instagram',
        account_type: 'business',
        platform_account_id: igAccountId,
        username: igData.username,
        profile_picture_url: igData.profile_picture_url,
        access_token: encrypt(pageAccessToken), // Encrypt!
        token_expires_at: null, // Page tokens don't expire
        page_id: page.id,
        page_name: page.name,
        status: 'active',
        can_publish_feed: true,
        can_publish_stories: true,
        can_publish_reels: true,
        last_token_refresh: new Date(),
        last_synced_at: new Date()
      };

      if (existing) {
        // Update existing account
        await supabase
          .from('social_media_accounts')
          .update(accountData)
          .eq('id', existing.id);
      } else {
        // Insert new account
        await supabase
          .from('social_media_accounts')
          .insert(accountData);
      }
    }

    // Save Facebook Page (even without Instagram)
    const { data: existingPage } = await supabase
      .from('social_media_accounts')
      .select('id')
      .eq('organisation_id', organisationId)
      .eq('platform', 'facebook')
      .eq('platform_account_id', page.id)
      .single();

    // Exchange for long-lived page token
    const fbPageLongLivedResponse = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&` +
      `client_id=${process.env.META_APP_ID}&` +
      `client_secret=${process.env.META_APP_SECRET}&` +
      `fb_exchange_token=${page.access_token}`
    );

    const fbPageLongLivedData = await fbPageLongLivedResponse.json();
    const fbPageAccessToken = fbPageLongLivedData.access_token;

    const pageData = {
      organisation_id: organisationId,
      platform: 'facebook',
      account_type: 'page',
      platform_account_id: page.id,
      username: page.name,
      page_id: page.id,
      page_name: page.name,
      access_token: encrypt(fbPageAccessToken),
      token_expires_at: null,
      status: 'active',
      can_publish_feed: true,
      last_token_refresh: new Date(),
      last_synced_at: new Date()
    };

    if (existingPage) {
      await supabase
        .from('social_media_accounts')
        .update(pageData)
        .eq('id', existingPage.id);
    } else {
      await supabase
        .from('social_media_accounts')
        .insert(pageData);
    }
  }
}
```

## Token Management

### Token Refresh Strategy

```javascript
// services/token-refresh-service.js
const { decrypt, encrypt } = require('../utils/encryption');

class TokenRefreshService {
  // Check for expiring tokens daily
  async checkExpiringTokens() {
    const { data: accounts } = await supabase
      .from('social_media_accounts')
      .select('*')
      .eq('status', 'active')
      .not('token_expires_at', 'is', null)
      .lt('token_expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    for (const account of accounts || []) {
      await this.refreshToken(account);
    }
  }

  async refreshToken(account) {
    try {
      const decryptedToken = decrypt(account.access_token);

      // Try to refresh the token
      const response = await fetch(
        `https://graph.facebook.com/v22.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${process.env.META_APP_ID}&` +
        `client_secret=${process.env.META_APP_SECRET}&` +
        `fb_exchange_token=${decryptedToken}`
      );

      const data = await response.json();

      if (data.error) {
        // Token refresh failed - mark account for reconnection
        await supabase
          .from('social_media_accounts')
          .update({
            status: 'expired',
            error_message: data.error.message,
            connection_error_count: account.connection_error_count + 1
          })
          .eq('id', account.id);

        // Notify organization
        await this.notifyTokenExpiry(account);

        return;
      }

      // Update with new token
      const newExpiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null;

      await supabase
        .from('social_media_accounts')
        .update({
          access_token: encrypt(data.access_token),
          token_expires_at: newExpiresAt,
          last_token_refresh: new Date(),
          status: 'active',
          error_message: null
        })
        .eq('id', account.id);

      console.log(`Refreshed token for account ${account.id}`);

    } catch (error) {
      console.error(`Failed to refresh token for account ${account.id}:`, error);

      await supabase
        .from('social_media_accounts')
        .update({
          status: 'error',
          error_message: error.message,
          connection_error_count: account.connection_error_count + 1
        })
        .eq('id', account.id);
    }
  }

  async notifyTokenExpiry(account) {
    // Send email or in-app notification to reconnect account
    // Implementation depends on your notification system
  }
}

module.exports = new TokenRefreshService();
```

### Scheduled Token Refresh (Cron Job)

```javascript
// jobs/token-refresh-job.js
const cron = require('node-cron');
const TokenRefreshService = require('../services/token-refresh-service');

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running token refresh check...');
  await TokenRefreshService.checkExpiringTokens();
  console.log('Token refresh check complete');
});
```

## Disconnection Flow

```javascript
// routes/social-auth-routes.js
router.delete('/api/social/accounts/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const organisationId = req.user.organisationId;

  try {
    // Get account
    const { data: account } = await supabase
      .from('social_media_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('organisation_id', organisationId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Optional: Revoke token on Meta's side
    const decryptedToken = decrypt(account.access_token);
    await fetch(
      `https://graph.facebook.com/v22.0/me/permissions?` +
      `access_token=${decryptedToken}`,
      { method: 'DELETE' }
    );

    // Update status to disconnected
    await supabase
      .from('social_media_accounts')
      .update({
        status: 'disconnected',
        access_token: null,
        refresh_token: null
      })
      .eq('id', accountId);

    res.json({ success: true });

  } catch (error) {
    console.error('Error disconnecting account:', error);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});
```

## Security Best Practices

### 1. State Parameter Validation

Always validate the OAuth state parameter to prevent CSRF attacks:

```javascript
// Generate cryptographically secure random state
const state = crypto.randomBytes(32).toString('hex');

// Store with short expiry (10 minutes)
await redis.setex(`oauth_state:${state}`, 600, JSON.stringify({
  organisationId,
  userId,
  timestamp: Date.now()
}));

// Validate on callback
const stateData = await redis.get(`oauth_state:${state}`);
if (!stateData) {
  throw new Error('Invalid or expired state');
}
```

### 2. Token Encryption

Always encrypt tokens before storing in database:

```javascript
// utils/encryption.js
const crypto = require('crypto');

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes
const ALGORITHM = 'aes-256-gcm';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedData) {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = { encrypt, decrypt };
```

### 3. Secure OAuth Redirect URI

- Use HTTPS only (required by Meta)
- Whitelist exact redirect URI in Meta App settings
- Validate redirect_uri parameter matches registered URI

### 4. Token Storage

- Never log full access tokens
- Don't send tokens to frontend (use session-based auth)
- Rotate encryption keys periodically
- Use Supabase's built-in encryption features where possible

---

**Last Updated**: January 2025
**OAuth Version**: OAuth 2.0
**Graph API Version**: v22.0
