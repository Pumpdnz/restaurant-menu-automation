# Service Layer: Script Job Service

**Last Updated**: 2025-12-09
**Status**: Planned
**File Location**: `UberEats-Image-Extractor/src/services/script-job-service.js`

## Overview

The Script Job Service provides the core business logic for:
1. Creating and managing jobs in the `script_jobs` table
2. Executing Playwright scripts in the background
3. Updating job progress and results
4. Handling retries and error recovery
5. Worker polling for job processing

---

## Service Interface

```javascript
/**
 * Script Job Service
 *
 * Manages async execution of Playwright scripts through a job queue pattern.
 */

class ScriptJobService {
  // Job CRUD Operations
  async createJob(jobType, payload, options)
  async getJob(jobId)
  async getJobByUuid(uuid)
  async updateJobStatus(jobId, status, updates)
  async updateJobProgress(jobId, progress)
  async updateJobResult(jobId, result)
  async markJobFailed(jobId, error, retryable)
  async cancelJob(jobId)

  // Job Queries
  async listJobs(filters, pagination)
  async getJobsByRestaurant(restaurantId, options)
  async getPendingJobs(limit)
  async getRetryableJobs()

  // Worker Operations
  async claimNextJob(workerId)
  async releaseJob(jobId)
  async executeJob(job)
  async processJobQueue()

  // Cleanup Operations
  async cleanupStalledJobs()
  async cleanupOldJobs(olderThanDays)
  async recoverOrphanedJobs()
}
```

---

## Implementation

### Dependencies

```javascript
// script-job-service.js

const { createClient } = require('@supabase/supabase-js');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const execAsync = promisify(exec);

// Configuration
// All scripts have a 5-minute (300000ms) timeout
const JOB_TYPES = {
  'add-item-tags': {
    script: 'scripts/restaurant-registration/add-item-tags.js',
    timeout: 300000,
    maxRetries: 3,
    estimatedDuration: 60000,
  },
  'add-option-sets': {
    script: 'scripts/restaurant-registration/add-option-sets.js',
    timeout: 300000,
    maxRetries: 3,
    estimatedDuration: 60000,
  },
  'import-csv-menu': {
    script: 'scripts/restaurant-registration/import-csv-menu.js',
    timeout: 300000,
    maxRetries: 3,
    estimatedDuration: 90000,
  },
  'register-restaurant': {
    script: 'scripts/restaurant-registration/login-and-register-restaurant.js',
    timeout: 300000,
    maxRetries: 3,
    estimatedDuration: 90000,
  },
  'configure-website-dark': {
    script: 'scripts/edit-website-settings-dark.js',
    timeout: 300000,
    maxRetries: 3,
    estimatedDuration: 90000,
  },
  'configure-website-light': {
    script: 'scripts/edit-website-settings-light.js',
    timeout: 300000,
    maxRetries: 3,
    estimatedDuration: 90000,
  },
  'setup-stripe-payments': {
    script: 'scripts/setup-stripe-payments.js',
    timeout: 300000,
    maxRetries: 3,
    estimatedDuration: 60000,
  },
  'setup-stripe-payments-no-link': {
    script: 'scripts/setup-stripe-payments-no-link.js',
    timeout: 300000,
    maxRetries: 3,
    estimatedDuration: 60000,
  },
  'setup-services': {
    script: 'scripts/setup-services-settings.js',
    timeout: 300000,
    maxRetries: 3,
    estimatedDuration: 60000,
  },
  'setup-system-settings': {
    script: 'scripts/setup-system-settings-user.js',
    timeout: 300000,
    maxRetries: 3,
    estimatedDuration: 60000,
  },
  'create-api-key': {
    script: 'scripts/create-api-key-user.js',
    timeout: 300000,
    maxRetries: 3,
    estimatedDuration: 45000,
  },
  'finalise-onboarding': {
    script: 'scripts/finalise-onboarding-user.js',
    timeout: 300000,
    maxRetries: 3,
    estimatedDuration: 90000,
  },
};

// Error classification for retry logic
const RETRYABLE_ERROR_CODES = [
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'TIMEOUT',
  'NAVIGATION_TIMEOUT',
  'ELEMENT_NOT_FOUND',
  'RATE_LIMITED',
];

const NON_RETRYABLE_ERROR_CODES = [
  'AUTH_FAILED',
  'INVALID_CREDENTIALS',
  'VALIDATION_ERROR',
  'RESTAURANT_NOT_FOUND',
  'PERMISSION_DENIED',
];
```

### Core Service Class

```javascript
class ScriptJobService {
  constructor(supabaseClient, options = {}) {
    this.supabase = supabaseClient;
    this.workerId = options.workerId || `worker_${process.pid}_${Date.now()}`;
    this.maxConcurrentJobs = options.maxConcurrentJobs || 2;
    this.activeJobs = new Map();
    this.isProcessing = false;
  }

  // ============================================================
  // JOB CRUD OPERATIONS
  // ============================================================

  /**
   * Create a new job in the queue
   */
  async createJob(jobType, payload, options = {}) {
    // Validate job type
    if (!JOB_TYPES[jobType]) {
      throw new Error(`Invalid job type: ${jobType}`);
    }

    const jobConfig = JOB_TYPES[jobType];

    const jobData = {
      job_type: jobType,
      status: 'pending',
      input_payload: payload,
      max_retries: options.maxRetries ?? jobConfig.maxRetries,
      retry_delay_ms: options.retryDelayMs ?? 5000,
      priority: options.priority ?? 0,
      organisation_id: options.organisationId,
      restaurant_id: options.restaurantId,
      created_by: options.createdBy,
      metadata: options.metadata ?? {},
      total_steps: this.estimateTotalSteps(jobType),
    };

    const { data, error } = await this.supabase
      .from('script_jobs')
      .insert(jobData)
      .select()
      .single();

    if (error) {
      console.error('[ScriptJobService] Failed to create job:', error);
      throw error;
    }

    console.log(`[ScriptJobService] Created job: ${data.job_id} (type: ${jobType})`);

    return {
      id: data.id,
      jobId: data.job_id,
      jobType: data.job_type,
      status: data.status,
      createdAt: data.created_at,
      estimatedDuration: jobConfig.estimatedDuration,
    };
  }

  /**
   * Get job by human-readable job_id
   */
  async getJob(jobId) {
    const { data, error } = await this.supabase
      .from('script_jobs')
      .select('*')
      .eq('job_id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return this.formatJobResponse(data);
  }

  /**
   * Get job by UUID
   */
  async getJobByUuid(uuid) {
    const { data, error } = await this.supabase
      .from('script_jobs')
      .select('*')
      .eq('id', uuid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return this.formatJobResponse(data);
  }

  /**
   * Update job status
   */
  async updateJobStatus(jobId, status, updates = {}) {
    const updateData = {
      status,
      ...updates,
    };

    const { data, error } = await this.supabase
      .from('script_jobs')
      .update(updateData)
      .eq('job_id', jobId)
      .select()
      .single();

    if (error) {
      console.error(`[ScriptJobService] Failed to update job ${jobId}:`, error);
      throw error;
    }

    console.log(`[ScriptJobService] Updated job ${jobId} status to: ${status}`);
    return this.formatJobResponse(data);
  }

  /**
   * Update job progress
   */
  async updateJobProgress(jobId, progress) {
    const updateData = {
      progress_percent: progress.percent,
      progress_message: progress.message,
      current_step: progress.currentStep,
      total_steps: progress.totalSteps,
    };

    const { error } = await this.supabase
      .from('script_jobs')
      .update(updateData)
      .eq('job_id', jobId);

    if (error) {
      console.error(`[ScriptJobService] Failed to update progress for ${jobId}:`, error);
    }
  }

  /**
   * Update job with successful result
   */
  async updateJobResult(jobId, result) {
    const { data, error } = await this.supabase
      .from('script_jobs')
      .update({
        status: 'completed',
        result,
        progress_percent: 100,
        progress_message: 'Completed successfully',
      })
      .eq('job_id', jobId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log(`[ScriptJobService] Job ${jobId} completed successfully`);
    return this.formatJobResponse(data);
  }

  /**
   * Mark job as failed
   */
  async markJobFailed(jobId, error, retryable = null) {
    // Auto-detect if retryable based on error code
    if (retryable === null) {
      const errorCode = error.code || this.classifyError(error.message);
      retryable = RETRYABLE_ERROR_CODES.includes(errorCode);
    }

    // Get current job to check retry count
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const shouldRetry = retryable && job.retryCount < job.maxRetries;

    const updateData = {
      status: shouldRetry ? 'pending' : 'failed',
      error_message: error.message,
      error_code: error.code || this.classifyError(error.message),
      error_stack: error.stack,
      retry_count: job.retryCount + 1,
      next_retry_at: shouldRetry
        ? new Date(Date.now() + job.retryDelayMs * Math.pow(2, job.retryCount)).toISOString()
        : null,
      worker_id: null,
      process_pid: null,
    };

    const { data, dbError } = await this.supabase
      .from('script_jobs')
      .update(updateData)
      .eq('job_id', jobId)
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    if (shouldRetry) {
      console.log(`[ScriptJobService] Job ${jobId} failed, will retry (${job.retryCount + 1}/${job.maxRetries})`);
    } else {
      console.log(`[ScriptJobService] Job ${jobId} failed permanently: ${error.message}`);
    }

    return this.formatJobResponse(data);
  }

  /**
   * Cancel a pending/queued job
   */
  async cancelJob(jobId) {
    const job = await this.getJob(jobId);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (!['pending', 'queued'].includes(job.status)) {
      throw new Error(`Cannot cancel job in status: ${job.status}`);
    }

    const { data, error } = await this.supabase
      .from('script_jobs')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('job_id', jobId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log(`[ScriptJobService] Job ${jobId} cancelled`);
    return this.formatJobResponse(data);
  }

  // ============================================================
  // JOB QUERIES
  // ============================================================

  /**
   * List jobs with filtering and pagination
   */
  async listJobs(filters = {}, pagination = {}) {
    let query = this.supabase
      .from('script_jobs')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters.jobType) {
      query = query.eq('job_type', filters.jobType);
    }

    if (filters.restaurantId) {
      query = query.eq('restaurant_id', filters.restaurantId);
    }

    if (filters.organisationId) {
      query = query.eq('organisation_id', filters.organisationId);
    }

    if (filters.since) {
      query = query.gte('created_at', filters.since);
    }

    // Apply ordering
    const orderBy = pagination.orderBy || 'created_at';
    const orderDir = pagination.orderDir === 'asc' ? true : false;
    query = query.order(orderBy, { ascending: orderDir });

    // Apply pagination
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = pagination.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return {
      jobs: data.map(job => this.formatJobResponse(job)),
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + data.length < count,
      },
    };
  }

  /**
   * Get pending jobs ready for processing
   */
  async getPendingJobs(limit = 10) {
    const { data, error } = await this.supabase
      .from('script_jobs')
      .select('*')
      .in('status', ['pending', 'queued'])
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data;
  }

  // ============================================================
  // WORKER OPERATIONS
  // ============================================================

  /**
   * Claim the next available job for processing
   */
  async claimNextJob() {
    // Use a transaction-like pattern to prevent race conditions
    const { data: jobs, error: fetchError } = await this.supabase
      .from('script_jobs')
      .select('*')
      .in('status', ['pending', 'queued'])
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .is('worker_id', null)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError) {
      throw fetchError;
    }

    if (!jobs || jobs.length === 0) {
      return null;
    }

    const job = jobs[0];

    // Try to claim the job atomically
    const { data: claimed, error: claimError } = await this.supabase
      .from('script_jobs')
      .update({
        status: 'in_progress',
        worker_id: this.workerId,
        started_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .is('worker_id', null) // Only claim if still unclaimed
      .select()
      .single();

    if (claimError) {
      // Another worker claimed it, try again
      console.log('[ScriptJobService] Job already claimed by another worker, retrying...');
      return this.claimNextJob();
    }

    console.log(`[ScriptJobService] Claimed job: ${claimed.job_id}`);
    return claimed;
  }

  /**
   * Release a job (on error or shutdown)
   */
  async releaseJob(jobId) {
    const { error } = await this.supabase
      .from('script_jobs')
      .update({
        status: 'pending',
        worker_id: null,
        process_pid: null,
      })
      .eq('job_id', jobId)
      .eq('worker_id', this.workerId);

    if (error) {
      console.error(`[ScriptJobService] Failed to release job ${jobId}:`, error);
    }
  }

  /**
   * Execute a single job
   */
  async executeJob(job) {
    const jobConfig = JOB_TYPES[job.job_type];

    if (!jobConfig) {
      throw new Error(`Unknown job type: ${job.job_type}`);
    }

    console.log(`[ScriptJobService] Executing job: ${job.job_id} (type: ${job.job_type})`);

    // Create temporary payload file
    const payloadPath = path.join('/tmp', `job_${job.job_id}_payload.json`);
    const fs = require('fs').promises;
    await fs.writeFile(payloadPath, JSON.stringify(job.input_payload));

    try {
      // Build command
      const scriptPath = path.resolve(__dirname, '../../..', jobConfig.script);
      const command = `node "${scriptPath}" --payload="${payloadPath}"`;

      // Update progress
      await this.updateJobProgress(job.job_id, {
        percent: 10,
        message: 'Starting script execution...',
        currentStep: 1,
        totalSteps: job.total_steps || 5,
      });

      // Execute script
      const { stdout, stderr } = await execAsync(command, {
        timeout: jobConfig.timeout,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          HEADLESS: 'true',
        },
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      // Parse result from stdout
      const result = this.parseScriptOutput(stdout, stderr, job.job_type);

      // Update job with result
      await this.updateJobResult(job.job_id, result);

      return result;

    } catch (error) {
      // Classify and handle error
      const classifiedError = {
        message: error.message,
        code: error.code || this.classifyError(error.message),
        stack: error.stack,
      };

      await this.markJobFailed(job.job_id, classifiedError);

      throw error;

    } finally {
      // Cleanup payload file
      try {
        await fs.unlink(payloadPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Main worker loop - process jobs continuously
   */
  async processJobQueue() {
    if (this.isProcessing) {
      console.log('[ScriptJobService] Already processing queue');
      return;
    }

    this.isProcessing = true;
    console.log(`[ScriptJobService] Worker ${this.workerId} starting queue processing`);

    while (this.isProcessing) {
      try {
        // Check if we have capacity
        if (this.activeJobs.size >= this.maxConcurrentJobs) {
          await this.sleep(1000);
          continue;
        }

        // Try to claim a job
        const job = await this.claimNextJob();

        if (!job) {
          // No jobs available, wait before polling again
          await this.sleep(2000);
          continue;
        }

        // Execute job in background (don't await)
        this.activeJobs.set(job.job_id, job);

        this.executeJob(job)
          .catch(error => {
            console.error(`[ScriptJobService] Job ${job.job_id} failed:`, error.message);
          })
          .finally(() => {
            this.activeJobs.delete(job.job_id);
          });

      } catch (error) {
        console.error('[ScriptJobService] Error in queue processing:', error);
        await this.sleep(5000);
      }
    }

    console.log('[ScriptJobService] Queue processing stopped');
  }

  /**
   * Stop processing jobs
   */
  stopProcessing() {
    this.isProcessing = false;
  }

  // ============================================================
  // CLEANUP OPERATIONS
  // ============================================================

  /**
   * Find and handle stalled jobs (in_progress but timed out)
   */
  async cleanupStalledJobs() {
    const { data: stalledJobs, error } = await this.supabase
      .from('script_jobs')
      .select('*')
      .eq('status', 'in_progress')
      .lt('timeout_at', new Date().toISOString());

    if (error) {
      console.error('[ScriptJobService] Failed to find stalled jobs:', error);
      return;
    }

    for (const job of stalledJobs) {
      console.log(`[ScriptJobService] Cleaning up stalled job: ${job.job_id}`);

      await this.markJobFailed(job.job_id, {
        message: 'Job timed out',
        code: 'TIMEOUT',
      }, true);
    }

    return stalledJobs.length;
  }

  /**
   * Delete old completed/failed jobs
   */
  async cleanupOldJobs(olderThanDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await this.supabase
      .from('script_jobs')
      .delete()
      .in('status', ['completed', 'failed', 'cancelled', 'timed_out'])
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('[ScriptJobService] Failed to cleanup old jobs:', error);
      return 0;
    }

    console.log(`[ScriptJobService] Cleaned up ${data.length} old jobs`);
    return data.length;
  }

  /**
   * Recover orphaned jobs (worker died mid-execution)
   */
  async recoverOrphanedJobs() {
    // Find jobs that have been in_progress for too long without updates
    const staleTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes

    const { data: orphanedJobs, error } = await this.supabase
      .from('script_jobs')
      .select('*')
      .eq('status', 'in_progress')
      .lt('updated_at', staleTime.toISOString());

    if (error) {
      console.error('[ScriptJobService] Failed to find orphaned jobs:', error);
      return;
    }

    for (const job of orphanedJobs) {
      console.log(`[ScriptJobService] Recovering orphaned job: ${job.job_id}`);

      await this.markJobFailed(job.job_id, {
        message: 'Job orphaned - worker process died',
        code: 'WORKER_DIED',
      }, true);
    }

    return orphanedJobs.length;
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  /**
   * Format database row to API response
   */
  formatJobResponse(row) {
    return {
      id: row.id,
      jobId: row.job_id,
      jobType: row.job_type,
      status: row.status,
      progress: {
        percent: row.progress_percent || 0,
        message: row.progress_message,
        currentStep: row.current_step,
        totalSteps: row.total_steps,
      },
      result: row.result,
      error: row.error_message ? {
        code: row.error_code,
        message: row.error_message,
      } : null,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      retryDelayMs: row.retry_delay_ms,
      nextRetryAt: row.next_retry_at,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      updatedAt: row.updated_at,
      organisationId: row.organisation_id,
      restaurantId: row.restaurant_id,
      createdBy: row.created_by,
      metadata: row.metadata,
    };
  }

  /**
   * Parse script output to extract result
   */
  parseScriptOutput(stdout, stderr, jobType) {
    // Look for JSON result in stdout
    const jsonMatch = stdout.match(/\{[\s\S]*"success"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        // Not valid JSON, continue
      }
    }

    // Check for success indicators
    const successIndicators = [
      '✅',
      'successfully',
      'completed',
      'Success',
    ];

    const hasSuccess = successIndicators.some(ind =>
      stdout.toLowerCase().includes(ind.toLowerCase())
    );

    return {
      success: hasSuccess,
      message: hasSuccess ? 'Script completed' : 'Script finished with unknown status',
      stdout: stdout.slice(-2000), // Last 2000 chars
      stderr: stderr ? stderr.slice(-1000) : null,
    };
  }

  /**
   * Classify error message to error code
   */
  classifyError(message) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('timeout')) return 'TIMEOUT';
    if (lowerMessage.includes('etimedout')) return 'ETIMEDOUT';
    if (lowerMessage.includes('econnreset')) return 'ECONNRESET';
    if (lowerMessage.includes('econnrefused')) return 'ECONNREFUSED';
    if (lowerMessage.includes('login') || lowerMessage.includes('credential')) return 'AUTH_FAILED';
    if (lowerMessage.includes('not found')) return 'NOT_FOUND';
    if (lowerMessage.includes('permission') || lowerMessage.includes('forbidden')) return 'PERMISSION_DENIED';
    if (lowerMessage.includes('validation')) return 'VALIDATION_ERROR';

    return 'UNKNOWN_ERROR';
  }

  /**
   * Estimate total steps for a job type
   */
  estimateTotalSteps(jobType) {
    const stepCounts = {
      'add-item-tags': 5,
      'add-option-sets': 6,
      'import-csv-menu': 4,
      'upload-menu-images': 5,
      'register-restaurant': 8,
      'configure-website': 7,
      'configure-payments': 5,
      'configure-services': 5,
      'configure-system-settings': 4,
      'configure-api-keys': 3,
      'onboarding-user-create': 4,
      'uber-integration': 6,
    };

    return stepCounts[jobType] || 5;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { ScriptJobService, JOB_TYPES };
```

---

## Usage Examples

### Creating the Service

```javascript
const { createClient } = require('@supabase/supabase-js');
const { ScriptJobService } = require('./services/script-job-service');

// Use service role for worker operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const jobService = new ScriptJobService(supabase, {
  workerId: `worker_${process.pid}`,
  maxConcurrentJobs: 2,
});
```

### Creating a Job (from API route)

```javascript
router.post('/api/jobs', async (req, res) => {
  try {
    const { jobType, payload, priority, metadata, restaurantId } = req.body;

    const job = await jobService.createJob(jobType, payload, {
      priority,
      metadata,
      restaurantId,
      organisationId: req.user.organisationId,
      createdBy: req.user.id,
    });

    res.status(202).json({
      success: true,
      job,
      links: {
        status: `/api/jobs/${job.jobId}/status`,
        details: `/api/jobs/${job.jobId}`,
        cancel: `/api/jobs/${job.jobId}`,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_FAILED', message: error.message },
    });
  }
});
```

### Starting the Worker

```javascript
// worker.js - Run as separate process or on server startup

const jobService = new ScriptJobService(supabase, {
  maxConcurrentJobs: 2,
});

// Start processing
jobService.processJobQueue();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  jobService.stopProcessing();

  // Release any active jobs
  for (const [jobId] of jobService.activeJobs) {
    await jobService.releaseJob(jobId);
  }

  process.exit(0);
});
```

### Periodic Cleanup

```javascript
// Run every hour
setInterval(async () => {
  await jobService.cleanupStalledJobs();
  await jobService.recoverOrphanedJobs();
}, 60 * 60 * 1000);

// Run daily
setInterval(async () => {
  await jobService.cleanupOldJobs(30);
}, 24 * 60 * 60 * 1000);
```

---

## File Location

Create at: `UberEats-Image-Extractor/src/services/script-job-service.js`
