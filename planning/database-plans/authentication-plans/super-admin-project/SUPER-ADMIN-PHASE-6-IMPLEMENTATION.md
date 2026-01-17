# Super Admin Dashboard - Phase 6: Stripe Billing Integration

## Overview
Phase 6 implements complete Stripe billing integration with subscription management, usage-based billing via Stripe Billing Meters, webhook handling, and customer portal access. This phase enables monetization through usage-based billing while providing organizations with full visibility into their costs and usage.

## Timeline
**Duration**: 2-3 Days (16-24 hours)
**Prerequisites**: Phases 1-5 completed, Stripe account with Billing Meters configured
**Deliverable**: Complete billing system with Stripe integration, customer portal, and payment tracking

## Architecture Overview

### Billing Flow
```
User Action → Feature Flag Check → Track Usage → Record to Stripe Meter
                    ↓                    ↓              ↓
                403 if disabled    Database Event   Stripe Event
                                        ↓              ↓
                              Usage Dashboard    Monthly Invoice
                                                      ↓
                                                 Auto-payment
```

### Webhook Flow
```
Stripe Event → Webhook Endpoint → Verify Signature → Process Event
                                         ↓                 ↓
                                   Security Check    Update Database
                                                           ↓
                                                    Update Org Status
```

## Prerequisites

### Stripe Configuration Required
1. **Stripe Account Setup**
   - Production and Test API keys
   - Webhook endpoint configured
   - Billing Meter created

2. **Billing Meter Setup**
   ```
   Name: API Requests
   Event Name: api_requests
   Unit: Request
   Aggregation: Sum
   ```

3. **Environment Variables**
   ```env
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_BILLING_METER_ID=meter_...
   STRIPE_BILLING_METER_EVENT_NAME=api_requests
   ```

## Task Breakdown

### Task 1: Database Schema for Billing (2 hours)

#### 1.1 Add Stripe Fields to Organizations
**Migration**: `add_stripe_billing_fields.sql`
```sql
-- Add Stripe customer fields to organizations
ALTER TABLE organisations 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trialing',
ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS billing_email TEXT,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days');

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer 
ON organisations(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

-- Subscription status constraint
ALTER TABLE organisations 
ADD CONSTRAINT subscription_status_check 
CHECK (subscription_status IN (
  'trialing', 'active', 'past_due', 
  'canceled', 'incomplete', 'incomplete_expired'
));
```

#### 1.2 Create Subscription History Table
```sql
-- Track subscription changes over time
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL,
  stripe_price_id TEXT,
  status TEXT NOT NULL,
  plan_name TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_sub_history_org (organisation_id),
  INDEX idx_sub_history_stripe (stripe_subscription_id)
);

-- RLS policies
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org subscription history"
  ON subscription_history FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles 
      WHERE id = auth.uid()
    )
  );
```

#### 1.3 Create Payments Table
```sql
-- Track all payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,
  description TEXT,
  invoice_pdf TEXT,
  hosted_invoice_url TEXT,
  paid_at TIMESTAMPTZ,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_payments_org (organisation_id),
  INDEX idx_payments_invoice (stripe_invoice_id),
  INDEX idx_payments_date (paid_at DESC)
);

-- RLS policies
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org payments"
  ON payments FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles 
      WHERE id = auth.uid()
    )
  );
```

#### 1.4 Create Billing Period Usage Summary
```sql
-- Summarize usage for billing periods
CREATE TABLE IF NOT EXISTS billing_period_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_events INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  breakdown JSONB DEFAULT '{}',
  stripe_invoice_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_billing_usage_org (organisation_id),
  INDEX idx_billing_usage_period (period_start, period_end),
  UNIQUE(organisation_id, period_start, period_end)
);
```

### Task 2: Stripe Service Implementation (4 hours)

#### 2.1 Core Stripe Service
**File**: `/src/services/stripe-service.js`
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabase } = require('../lib/supabase-admin');

class StripeService {
  /**
   * Create or get Stripe customer for organization
   */
  static async ensureStripeCustomer(organisation) {
    try {
      // Check if customer already exists
      if (organisation.stripe_customer_id) {
        try {
          const customer = await stripe.customers.retrieve(
            organisation.stripe_customer_id
          );
          
          // Update customer if needed
          if (customer.deleted) {
            // Customer was deleted, create new one
            organisation.stripe_customer_id = null;
          } else {
            // Update existing customer
            await stripe.customers.update(customer.id, {
              name: organisation.name,
              email: organisation.billing_email || organisation.admin_email,
              metadata: {
                organisation_id: organisation.id,
                environment: process.env.NODE_ENV
              }
            });
            return customer;
          }
        } catch (error) {
          console.error('Error retrieving customer:', error);
          organisation.stripe_customer_id = null;
        }
      }

      // Create new customer
      const customer = await stripe.customers.create({
        name: organisation.name,
        email: organisation.billing_email || organisation.admin_email,
        metadata: {
          organisation_id: organisation.id,
          environment: process.env.NODE_ENV
        }
      });

      // Update organization with Stripe customer ID
      await supabase
        .from('organisations')
        .update({ 
          stripe_customer_id: customer.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', organisation.id);

      console.log(`Created Stripe customer ${customer.id} for org ${organisation.id}`);
      return customer;
    } catch (error) {
      console.error('Stripe customer error:', error);
      throw new Error(`Failed to ensure Stripe customer: ${error.message}`);
    }
  }

  /**
   * Create subscription for organization
   */
  static async createSubscription(organisationId, priceId, trialDays = 14) {
    try {
      // Get organization
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', organisationId)
        .single();

      if (orgError || !org) {
        throw new Error('Organization not found');
      }

      // Ensure customer exists
      const customer = await this.ensureStripeCustomer(org);

      // Check for existing subscription
      if (org.stripe_subscription_id) {
        try {
          const existing = await stripe.subscriptions.retrieve(
            org.stripe_subscription_id
          );
          
          if (!['canceled', 'incomplete_expired'].includes(existing.status)) {
            throw new Error('Organization already has an active subscription');
          }
        } catch (error) {
          // Subscription doesn't exist or is invalid
          console.log('Previous subscription not found or invalid');
        }
      }

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        trial_period_days: trialDays,
        metadata: {
          organisation_id: organisationId
        },
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription'
        },
        expand: ['latest_invoice.payment_intent']
      });

      // Update organization
      await supabase
        .from('organisations')
        .update({
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          subscription_current_period_end: new Date(subscription.current_period_end * 1000),
          trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', organisationId);

      // Log to history
      await supabase
        .from('subscription_history')
        .insert({
          organisation_id: organisationId,
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
          status: subscription.status,
          plan_name: subscription.items.data[0]?.price?.nickname || 'Standard',
          started_at: new Date(subscription.created * 1000),
          metadata: {
            trial_days: trialDays,
            customer_id: customer.id
          }
        });

      console.log(`Created subscription ${subscription.id} for org ${organisationId}`);
      return subscription;
    } catch (error) {
      console.error('Create subscription error:', error);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(organisationId, immediately = false) {
    try {
      const { data: org } = await supabase
        .from('organisations')
        .select('stripe_subscription_id')
        .eq('id', organisationId)
        .single();

      if (!org?.stripe_subscription_id) {
        throw new Error('No subscription found');
      }

      const subscription = immediately
        ? await stripe.subscriptions.cancel(org.stripe_subscription_id)
        : await stripe.subscriptions.update(org.stripe_subscription_id, {
            cancel_at_period_end: true
          });

      // Update organization
      await supabase
        .from('organisations')
        .update({
          subscription_status: immediately ? 'canceled' : subscription.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', organisationId);

      return subscription;
    } catch (error) {
      console.error('Cancel subscription error:', error);
      throw error;
    }
  }

  /**
   * Create customer portal session
   */
  static async createPortalSession(organisationId, returnUrl) {
    try {
      const { data: org } = await supabase
        .from('organisations')
        .select('stripe_customer_id')
        .eq('id', organisationId)
        .single();

      if (!org?.stripe_customer_id) {
        throw new Error('No Stripe customer found for organization');
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: returnUrl,
        configuration: process.env.STRIPE_PORTAL_CONFIG_ID // Optional: custom portal config
      });

      console.log(`Created portal session for org ${organisationId}`);
      return session;
    } catch (error) {
      console.error('Portal session error:', error);
      throw new Error(`Failed to create portal session: ${error.message}`);
    }
  }

  /**
   * Get current usage for billing period
   */
  static async getCurrentUsage(organisationId) {
    try {
      const { data: org } = await supabase
        .from('organisations')
        .select('subscription_current_period_end, stripe_subscription_id')
        .eq('id', organisationId)
        .single();

      if (!org) {
        throw new Error('Organization not found');
      }

      // Calculate period
      const periodEnd = org.subscription_current_period_end 
        ? new Date(org.subscription_current_period_end)
        : new Date();
      
      const periodStart = new Date(periodEnd);
      periodStart.setMonth(periodStart.getMonth() - 1);

      // Get usage events
      const { data: events } = await supabase
        .from('usage_events')
        .select('event_type, quantity, created_at')
        .eq('organisation_id', organisationId)
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString())
        .order('created_at', { ascending: false });

      // Aggregate by event type
      const breakdown = events?.reduce((acc, event) => {
        if (!acc[event.event_type]) {
          acc[event.event_type] = {
            count: 0,
            quantity: 0,
            last_used: event.created_at
          };
        }
        acc[event.event_type].count++;
        acc[event.event_type].quantity += event.quantity;
        return acc;
      }, {}) || {};

      const totalEvents = events?.reduce((sum, e) => sum + e.quantity, 0) || 0;

      return {
        period_start: periodStart,
        period_end: periodEnd,
        total_events: totalEvents,
        event_count: events?.length || 0,
        breakdown,
        subscription_active: !!org.stripe_subscription_id
      };
    } catch (error) {
      console.error('Get usage error:', error);
      throw error;
    }
  }

  /**
   * Get payment history
   */
  static async getPaymentHistory(organisationId, limit = 12) {
    try {
      const { data: payments, error } = await supabase
        .from('payments')
        .select('*')
        .eq('organisation_id', organisationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return payments || [];
    } catch (error) {
      console.error('Get payment history error:', error);
      throw error;
    }
  }
}

module.exports = { StripeService };
```

### Task 3: Webhook Handler Implementation (3 hours)

#### 3.1 Webhook Endpoint and Handler
**File**: `/src/routes/stripe-webhooks.js`
```javascript
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabase } = require('../lib/supabase-admin');

/**
 * Stripe webhook endpoint
 * IMPORTANT: Must use raw body parser for signature verification
 */
router.post('/api/stripe/webhook', 
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`Processing webhook event: ${event.type}`);

    // Handle the event
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpdate(event.data.object);
          break;
          
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;
          
        case 'invoice.created':
          await handleInvoiceCreated(event.data.object);
          break;
          
        case 'invoice.finalized':
          await handleInvoiceFinalized(event.data.object);
          break;
          
        case 'invoice.payment_succeeded':
          await handlePaymentSucceeded(event.data.object);
          break;
          
        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;
          
        case 'billing.meter.error_report':
          console.error('Billing meter error:', event.data.object);
          await handleMeterError(event.data.object);
          break;
          
        case 'customer.deleted':
          await handleCustomerDeleted(event.data.object);
          break;
          
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error(`Webhook handler error for ${event.type}:`, error);
      // Return 200 to acknowledge receipt even if processing fails
      // This prevents Stripe from retrying
      res.status(200).json({ 
        received: true, 
        error: error.message 
      });
    }
  }
);

/**
 * Handle subscription creation/update
 */
async function handleSubscriptionUpdate(subscription) {
  try {
    const orgId = subscription.metadata.organisation_id;
    
    if (!orgId) {
      console.error('No organisation_id in subscription metadata');
      return;
    }

    // Update organization
    const { error: updateError } = await supabase
      .from('organisations')
      .update({
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        subscription_current_period_end: new Date(subscription.current_period_end * 1000),
        trial_ends_at: subscription.trial_end 
          ? new Date(subscription.trial_end * 1000) 
          : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', orgId);

    if (updateError) {
      console.error('Failed to update organization:', updateError);
      throw updateError;
    }

    // Log to history
    await supabase
      .from('subscription_history')
      .insert({
        organisation_id: orgId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: subscription.items.data[0]?.price?.id,
        status: subscription.status,
        plan_name: subscription.items.data[0]?.price?.nickname || 'Default',
        started_at: new Date(subscription.created * 1000),
        metadata: {
          customer_id: subscription.customer,
          trial_end: subscription.trial_end,
          cancel_at_period_end: subscription.cancel_at_period_end
        }
      });

    console.log(`Updated subscription ${subscription.id} for org ${orgId}`);
  } catch (error) {
    console.error('handleSubscriptionUpdate error:', error);
    throw error;
  }
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(subscription) {
  try {
    const orgId = subscription.metadata.organisation_id;
    
    if (!orgId) return;

    // Update organization
    await supabase
      .from('organisations')
      .update({
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', orgId);

    // Update subscription history
    await supabase
      .from('subscription_history')
      .update({
        ended_at: new Date(),
        status: 'canceled'
      })
      .eq('stripe_subscription_id', subscription.id)
      .is('ended_at', null);

    // Disable feature flags (optional - depends on business logic)
    await supabase
      .from('organisations')
      .update({
        feature_flags: {
          standardExtraction: { enabled: false },
          premiumExtraction: { enabled: false },
          logoExtraction: { enabled: false },
          googleSearch: { enabled: false },
          platformDetails: { enabled: false },
          csvExport: { enabled: false },
          imageDownload: { enabled: false },
          bulkOperations: { enabled: false }
        }
      })
      .eq('id', orgId);

    console.log(`Subscription deleted for org ${orgId}`);
  } catch (error) {
    console.error('handleSubscriptionDeleted error:', error);
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice) {
  try {
    // Find organization by customer ID
    const { data: org } = await supabase
      .from('organisations')
      .select('id')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (!org) {
      console.error(`No organization found for customer ${invoice.customer}`);
      return;
    }

    // Record payment
    const { error } = await supabase
      .from('payments')
      .insert({
        organisation_id: org.id,
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: invoice.payment_intent,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'paid',
        description: invoice.description || `Payment for ${invoice.period_start} to ${invoice.period_end}`,
        invoice_pdf: invoice.invoice_pdf,
        hosted_invoice_url: invoice.hosted_invoice_url,
        paid_at: new Date(invoice.status_transitions.paid_at * 1000),
        period_start: new Date(invoice.period_start * 1000),
        period_end: new Date(invoice.period_end * 1000)
      });

    if (error) {
      console.error('Failed to record payment:', error);
      throw error;
    }

    // Create usage summary for the period
    const periodStart = new Date(invoice.period_start * 1000);
    const periodEnd = new Date(invoice.period_end * 1000);

    const { data: events } = await supabase
      .from('usage_events')
      .select('event_type, quantity')
      .eq('organisation_id', org.id)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString());

    const breakdown = events?.reduce((acc, event) => {
      acc[event.event_type] = (acc[event.event_type] || 0) + event.quantity;
      return acc;
    }, {});

    await supabase
      .from('billing_period_usage')
      .upsert({
        organisation_id: org.id,
        period_start: periodStart,
        period_end: periodEnd,
        total_events: events?.reduce((sum, e) => sum + e.quantity, 0) || 0,
        total_cost: invoice.amount_paid / 100, // Convert cents to dollars
        breakdown,
        stripe_invoice_id: invoice.id
      });

    console.log(`Payment recorded for org ${org.id}: $${invoice.amount_paid / 100}`);
  } catch (error) {
    console.error('handlePaymentSucceeded error:', error);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice) {
  try {
    const { data: org } = await supabase
      .from('organisations')
      .select('id, name, billing_email')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (!org) return;

    // Update subscription status
    await supabase
      .from('organisations')
      .update({
        subscription_status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('id', org.id);

    // Record failed payment
    await supabase
      .from('payments')
      .insert({
        organisation_id: org.id,
        stripe_invoice_id: invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: 'failed',
        description: 'Payment failed',
        period_start: new Date(invoice.period_start * 1000),
        period_end: new Date(invoice.period_end * 1000)
      });

    // TODO: Send notification email to organization
    console.log(`Payment failed for org ${org.id}`);
  } catch (error) {
    console.error('handlePaymentFailed error:', error);
  }
}

/**
 * Handle meter errors
 */
async function handleMeterError(errorReport) {
  console.error('Stripe Meter Error Report:', {
    meter_id: errorReport.meter_id,
    error_count: errorReport.error_count,
    sample_errors: errorReport.sample_errors
  });
  
  // TODO: Send alert to admin
  // Could store in database for monitoring
}

/**
 * Handle customer deletion
 */
async function handleCustomerDeleted(customer) {
  try {
    // Find and update organization
    await supabase
      .from('organisations')
      .update({
        stripe_customer_id: null,
        stripe_subscription_id: null,
        subscription_status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_customer_id', customer.id);

    console.log(`Customer ${customer.id} deleted`);
  } catch (error) {
    console.error('handleCustomerDeleted error:', error);
  }
}

module.exports = router;
```

### Task 4: Billing API Endpoints (2 hours)

#### 4.1 Billing Management Endpoints
**File**: `/server.js` (additions)
```javascript
const { StripeService } = require('./src/services/stripe-service');

// Get subscription status
app.get('/api/billing/subscription', authMiddleware, async (req, res) => {
  try {
    const { supabase } = req;
    const organisationId = req.user.organisationId;

    const { data: org, error } = await supabase
      .from('organisations')
      .select(`
        id,
        name,
        stripe_customer_id,
        stripe_subscription_id,
        subscription_status,
        subscription_current_period_end,
        trial_ends_at
      `)
      .eq('id', organisationId)
      .single();

    if (error) throw error;

    // Get current usage
    const usage = await StripeService.getCurrentUsage(organisationId);

    res.json({
      organisation: {
        id: org.id,
        name: org.name
      },
      subscription: {
        status: org.subscription_status,
        current_period_end: org.subscription_current_period_end,
        trial_ends_at: org.trial_ends_at,
        is_trialing: org.subscription_status === 'trialing'
      },
      usage
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ 
      error: 'Failed to get subscription',
      message: error.message 
    });
  }
});

// Create subscription
app.post('/api/billing/subscribe', authMiddleware, async (req, res) => {
  try {
    const { priceId } = req.body;
    const organisationId = req.user.organisationId;

    if (!req.user.role === 'admin' && !req.user.role === 'super_admin') {
      return res.status(403).json({ 
        error: 'Only admins can manage subscriptions' 
      });
    }

    const subscription = await StripeService.createSubscription(
      organisationId,
      priceId
    );

    res.json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        trial_end: subscription.trial_end
      },
      client_secret: subscription.latest_invoice?.payment_intent?.client_secret
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ 
      error: 'Failed to create subscription',
      message: error.message 
    });
  }
});

// Cancel subscription
app.post('/api/billing/cancel', authMiddleware, async (req, res) => {
  try {
    const { immediately } = req.body;
    const organisationId = req.user.organisationId;

    if (!req.user.role === 'admin' && !req.user.role === 'super_admin') {
      return res.status(403).json({ 
        error: 'Only admins can manage subscriptions' 
      });
    }

    const subscription = await StripeService.cancelSubscription(
      organisationId,
      immediately
    );

    res.json({
      message: immediately 
        ? 'Subscription canceled immediately' 
        : 'Subscription will be canceled at period end',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at
      }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ 
      error: 'Failed to cancel subscription',
      message: error.message 
    });
  }
});

// Create customer portal session
app.post('/api/billing/portal', authMiddleware, async (req, res) => {
  try {
    const { returnUrl } = req.body;
    const organisationId = req.user.organisationId;

    const session = await StripeService.createPortalSession(
      organisationId,
      returnUrl || `${process.env.FRONTEND_URL}/settings/billing`
    );

    res.json({ url: session.url });
  } catch (error) {
    console.error('Portal session error:', error);
    res.status(500).json({ 
      error: 'Failed to create portal session',
      message: error.message 
    });
  }
});

// Get current usage
app.get('/api/billing/usage', authMiddleware, async (req, res) => {
  try {
    const organisationId = req.user.organisationId;
    const usage = await StripeService.getCurrentUsage(organisationId);
    
    res.json(usage);
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ 
      error: 'Failed to get usage',
      message: error.message 
    });
  }
});

// Get payment history
app.get('/api/billing/payments', authMiddleware, async (req, res) => {
  try {
    const organisationId = req.user.organisationId;
    const { limit = 12 } = req.query;
    
    const payments = await StripeService.getPaymentHistory(
      organisationId,
      parseInt(limit)
    );
    
    res.json(payments);
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ 
      error: 'Failed to get payment history',
      message: error.message 
    });
  }
});

// Super Admin: Create customer for organization
app.post('/api/super-admin/billing/create-customer', 
  superAdminMiddleware, 
  async (req, res) => {
    try {
      const { organisationId } = req.body;
      const { supabase } = req;

      const { data: org } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', organisationId)
        .single();

      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const customer = await StripeService.ensureStripeCustomer(org);

      res.json({
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name
        }
      });
    } catch (error) {
      console.error('Create customer error:', error);
      res.status(500).json({ 
        error: 'Failed to create customer',
        message: error.message 
      });
    }
  }
);
```

### Task 5: Frontend Billing Components (4 hours)

#### 5.1 Billing Dashboard Component
**File**: `/src/components/BillingDashboard.tsx`
```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  CreditCard, 
  TrendingUp, 
  FileText, 
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useToast } from './ui/use-toast';
import { Loader2 } from 'lucide-react';

interface SubscriptionData {
  organisation: {
    id: string;
    name: string;
  };
  subscription: {
    status: string;
    current_period_end: string;
    trial_ends_at: string | null;
    is_trialing: boolean;
  };
  usage: {
    period_start: string;
    period_end: string;
    total_events: number;
    event_count: number;
    breakdown: Record<string, any>;
  };
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  invoice_pdf: string;
  hosted_invoice_url: string;
  paid_at: string;
  period_start: string;
  period_end: string;
}

export function BillingDashboard() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      
      // Get session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Load subscription status
      const subResponse = await fetch('/api/billing/subscription', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!subResponse.ok) throw new Error('Failed to load subscription');
      const subData = await subResponse.json();
      setSubscription(subData);

      // Load payment history
      const paymentsResponse = await fetch('/api/billing/payments', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        setPayments(paymentsData);
      }
    } catch (error: any) {
      console.error('Failed to load billing data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load billing information',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    try {
      setPortalLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          returnUrl: window.location.href 
        })
      });
      
      if (!response.ok) throw new Error('Failed to create portal session');
      
      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error('Failed to open customer portal:', error);
      toast({
        title: 'Error',
        description: 'Failed to open billing portal',
        variant: 'destructive'
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      'active': { variant: 'default', icon: CheckCircle, label: 'Active' },
      'trialing': { variant: 'secondary', icon: Clock, label: 'Trial' },
      'past_due': { variant: 'destructive', icon: AlertTriangle, label: 'Past Due' },
      'canceled': { variant: 'outline', icon: null, label: 'Canceled' },
      'incomplete': { variant: 'warning', icon: AlertTriangle, label: 'Incomplete' }
    };

    const config = variants[status] || variants.canceled;
    
    return (
      <Badge variant={config.variant as any}>
        {config.icon && <config.icon className="h-3 w-3 mr-1" />}
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100); // Convert cents to dollars
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Subscription</CardTitle>
              <CardDescription>
                Manage your subscription and billing settings
              </CardDescription>
            </div>
            <Button
              onClick={openCustomerPortal}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage Billing
                  <ExternalLink className="ml-2 h-3 w-3" />
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              {subscription && getStatusBadge(subscription.subscription.status)}
            </div>

            {/* Trial End Date */}
            {subscription?.subscription.is_trialing && subscription.subscription.trial_ends_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Trial Ends</span>
                <span className="text-sm font-medium">
                  {formatDistanceToNow(new Date(subscription.subscription.trial_ends_at), { 
                    addSuffix: true 
                  })}
                </span>
              </div>
            )}

            {/* Next Billing Date */}
            {subscription?.subscription.current_period_end && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {subscription.subscription.status === 'active' ? 'Next Billing' : 'Expires'}
                </span>
                <span className="text-sm font-medium">
                  {format(new Date(subscription.subscription.current_period_end), 'MMM d, yyyy')}
                </span>
              </div>
            )}

            {/* Trial Alert */}
            {subscription?.subscription.is_trialing && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You're currently on a free trial. Add a payment method to continue after your trial ends.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Current Period Usage</CardTitle>
          <CardDescription>
            {subscription?.usage.period_start && subscription?.usage.period_end && (
              <>
                {format(new Date(subscription.usage.period_start), 'MMM d')} - 
                {format(new Date(subscription.usage.period_end), 'MMM d, yyyy')}
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Total Events */}
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-purple-600" />
                <span className="font-medium">Total API Requests</span>
              </div>
              <span className="text-2xl font-bold">
                {subscription?.usage.total_events || 0}
              </span>
            </div>

            {/* Breakdown by Type */}
            {subscription?.usage.breakdown && Object.keys(subscription.usage.breakdown).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500 mb-3">Breakdown by Type</p>
                {Object.entries(subscription.usage.breakdown).map(([type, data]: [string, any]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <span className="font-mono">{data.quantity || data}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>
            Recent payments and invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length > 0 ? (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div 
                  key={payment.id} 
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {formatCurrency(payment.amount, payment.currency)}
                      </p>
                      <Badge 
                        variant={payment.status === 'paid' ? 'success' : 'destructive'}
                        className="text-xs"
                      >
                        {payment.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(payment.paid_at || payment.period_start), 'MMM d, yyyy')}
                      {payment.period_start && payment.period_end && (
                        <span className="ml-2">
                          ({format(new Date(payment.period_start), 'MMM d')} - 
                          {format(new Date(payment.period_end), 'MMM d')})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {payment.invoice_pdf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a 
                          href={payment.invoice_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {payment.hosted_invoice_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a 
                          href={payment.hosted_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FileText className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">
              No payment history yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Task 6: Testing and Integration (2 hours)

#### 6.1 Testing Checklist

**Stripe Configuration**:
- [ ] Stripe API keys configured in environment
- [ ] Webhook endpoint registered in Stripe Dashboard
- [ ] Webhook secret configured
- [ ] Billing Meter created and configured
- [ ] Test mode enabled for development

**Customer Management**:
- [ ] Organization can be linked to Stripe customer
- [ ] Duplicate customers are not created
- [ ] Customer metadata includes organization ID
- [ ] Customer updates sync name and email

**Subscription Flow**:
- [ ] Subscription can be created with trial
- [ ] Payment method collection works
- [ ] Trial period is applied correctly
- [ ] Subscription status updates in database
- [ ] Multiple subscriptions prevented

**Webhook Processing**:
- [ ] Webhook signature verification works
- [ ] Subscription events update database
- [ ] Payment succeeded creates payment record
- [ ] Payment failed updates status
- [ ] Invoice events are processed
- [ ] Meter errors are logged

**Customer Portal**:
- [ ] Portal session creation works
- [ ] Return URL is respected
- [ ] Users can update payment methods
- [ ] Users can cancel subscriptions
- [ ] Users can download invoices

**Usage Recording**:
- [ ] Usage events record to database
- [ ] Usage events record to Stripe Meter
- [ ] Meter recording handles failures gracefully
- [ ] Usage summary calculates correctly

**Frontend Components**:
- [ ] Billing dashboard loads data
- [ ] Subscription status displays correctly
- [ ] Usage breakdown shows all event types
- [ ] Payment history lists invoices
- [ ] Portal button opens Stripe portal
- [ ] Loading states work
- [ ] Error states display

**Security**:
- [ ] Only admins can manage subscriptions
- [ ] RLS policies protect billing data
- [ ] Webhook endpoint validates signatures
- [ ] API endpoints require authentication

#### 6.2 Testing Commands

```bash
# Test webhook locally with Stripe CLI
stripe listen --forward-to localhost:3007/api/stripe/webhook

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_succeeded

# Test meter event recording
stripe billing meter-events create \
  --meter meter_xxx \
  --identifier test_event_123 \
  --value 100 \
  --stripe-customer-id cus_xxx
```

## Environment Setup

### Required Environment Variables
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...  # Use test key for development
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BILLING_METER_ID=meter_...
STRIPE_BILLING_METER_EVENT_NAME=api_requests
STRIPE_PORTAL_CONFIG_ID=bpc_... # Optional: Custom portal configuration

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:5007

# Supabase Configuration
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
```

## Migration Rollout Plan

### Step 1: Database Setup
```sql
-- Run migrations in order:
1. Add Stripe fields to organizations
2. Create subscription_history table
3. Create payments table
4. Create billing_period_usage table
5. Apply RLS policies
```

### Step 2: Stripe Configuration
1. Create products and prices in Stripe Dashboard
2. Create Billing Meter for usage tracking
3. Configure webhook endpoint
4. Set up customer portal configuration
5. Enable test mode for development

### Step 3: Deploy Backend
1. Add Stripe service
2. Add webhook handler
3. Update server.js with billing endpoints
4. Test webhook processing with Stripe CLI
5. Verify usage recording to meter

### Step 4: Deploy Frontend
1. Add billing dashboard component
2. Integrate into settings/admin area
3. Test subscription creation flow
4. Test portal access
5. Verify usage display

## Common Issues & Solutions

### Issue 1: Webhook Signature Verification Fails
**Solution**: Ensure raw body parser is used for webhook endpoint:
```javascript
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
```

### Issue 2: Meter Events Not Recording
**Solution**: Check meter configuration and customer ID:
```javascript
console.log('Recording to meter:', {
  meter_id: process.env.STRIPE_BILLING_METER_ID,
  customer_id: org.stripe_customer_id,
  event_name: process.env.STRIPE_BILLING_METER_EVENT_NAME
});
```

### Issue 3: Portal Session Creation Fails
**Solution**: Ensure customer exists in Stripe:
```javascript
// Check if customer exists before creating portal
const customer = await stripe.customers.retrieve(stripe_customer_id);
if (customer.deleted) {
  // Re-create customer
}
```

## Success Criteria

Phase 6 is complete when:
1. ✅ Organizations can be linked to Stripe customers
2. ✅ Subscriptions can be created with trials
3. ✅ Webhook events update database correctly
4. ✅ Usage events record to Stripe Meters
5. ✅ Customer portal is accessible
6. ✅ Payment history is tracked
7. ✅ Billing dashboard displays all data
8. ✅ Feature flags disable when subscription ends
9. ✅ All security checks pass
10. ✅ Test coverage > 80%

## Next Steps

After Phase 6 completion:
1. **Production Deployment**
   - Switch to live Stripe keys
   - Configure production webhook endpoint
   - Set up monitoring and alerts

2. **Advanced Features**
   - Usage alerts and notifications
   - Multiple subscription tiers
   - Team billing (seats)
   - Annual billing discounts
   - Custom pricing for enterprise

3. **Analytics & Reporting**
   - Revenue dashboards
   - Churn analysis
   - Usage trends
   - Cost optimization recommendations

---

**Phase 6 Complete**: Full Stripe billing integration with usage-based billing