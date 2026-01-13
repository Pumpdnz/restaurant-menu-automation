# Code Injection Database Persistence - Implementation Roadmap

## Overview

This roadmap details all changes required to migrate code injection storage from filesystem to database. The implementation is divided into 6 phases with specific tasks, file changes, and code modifications.

---

## Implementation Status

| Phase | Status | Completed Date |
|-------|--------|----------------|
| Phase 1: Database Migration | **COMPLETED** | 2025-12-30 |
| Phase 2: Backend API Updates | **COMPLETED** | 2025-12-30 |
| Phase 3: Playwright Script Updates | **COMPLETED** | 2025-12-30 |
| Phase 4: Frontend Updates | **COMPLETED** | 2025-12-30 |
| Phase 5: Batch Service Updates | **COMPLETED** | 2025-12-30 |
| Phase 6: Testing & Deployment | PENDING | - |

---

## Phase 1: Database Migration

**Duration:** 1 day
**Dependencies:** None
**Risk Level:** Low
**Status:** COMPLETED

### Task 1.1: Run Migration Script

**Location:** Supabase Dashboard → SQL Editor

**Action:** Copy and paste contents of `add_code_injection_columns.sql` and execute.

**Verification:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pumpd_restaurants'
  AND (column_name LIKE 'code_injection%' OR column_name IN ('head_injection', 'body_injection'));
```

**Expected Result:** 4 new columns visible

**Implementation Notes:**
- Migration applied successfully
- Columns added: `head_injection` (TEXT), `body_injection` (TEXT), `code_injection_config` (JSONB), `code_injection_generated_at` (TIMESTAMPTZ)
- Indexes created for efficient querying

### Task 1.2: Generate TypeScript Types

**Command:**
```bash
cd UberEats-Image-Extractor
npx supabase gen types typescript --project-id qgabsyggzlkcstjzugdh > src/types/supabase.ts
```

**Implementation Notes:**
- Types generated via MCP Supabase tool
- New columns confirmed in type definitions

### Task 1.3: Update Type Definitions

**File:** `UberEats-Image-Extractor/src/types/supabase.ts`

**Verify these types are present:**
```typescript
pumpd_restaurants: {
  // ... existing columns ...
  head_injection: string | null
  body_injection: string | null
  code_injection_config: Json | null
  code_injection_generated_at: string | null
}
```

---

## Phase 2: Backend API Updates

**Duration:** 2 days
**Dependencies:** Phase 1 complete
**Risk Level:** Medium
**Status:** COMPLETED

### Task 2.1: Update Code Generation Endpoint

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js`
**Location:** `/api/registration/generate-code-injections`

**Implementation Notes:**
- After file generation, content is read and stored in `pumpd_restaurants` table
- Response now includes `codeInjectionId` and `generatedAt` alongside legacy `filePaths`
- Database storage failure is logged but doesn't fail the request (graceful degradation)

**Actual Code Added (after line 1530):**
```javascript
// Read file contents for database storage
let headContent, bodyContent, configContent;
try {
  [headContent, bodyContent, configContent] = await Promise.all([
    fs.readFile(filePaths.headInjection, 'utf-8'),
    fs.readFile(filePaths.bodyInjection, 'utf-8'),
    fs.readFile(filePaths.configuration, 'utf-8').then(JSON.parse)
  ]);
} catch (readError) {
  console.error('[Code Generation] Failed to read files for database storage:', readError);
}

// Store code injection content in database for production persistence
let codeInjectionId = null;
if (headContent && bodyContent) {
  // ... database storage logic ...
}

res.json({
  success: true,
  message: 'Code injections generated successfully.',
  codeInjectionId,
  generatedAt: new Date().toISOString(),
  filePaths  // Legacy - kept for backward compatibility
});
```

### Task 2.2: Update Website Configuration Endpoint

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js`
**Location:** `/api/registration/configure-website`

**Implementation Notes:**
- Accepts `codeInjectionId` in request body
- Retrieves code injection content from database first
- Falls back to file paths if database content unavailable
- Passes content to scripts via base64-encoded environment variables

**Key Changes:**
1. Extract `codeInjectionId` from request body
2. Query `pumpd_restaurants` for stored content (including `head_injection`, `body_injection`)
3. Set `scriptEnv` with base64-encoded content when using database approach
4. Use `--head-from-env` and `--body-from-env` flags for scripts

### Task 2.3: Add New Endpoint for Content Retrieval

**File:** `UberEats-Image-Extractor/src/routes/registration-routes.js`
**Endpoint:** `GET /api/registration/code-injection/:restaurantId`

**Implementation Notes:**
- New endpoint added to check for existing code injection content
- Returns `hasContent`, `codeInjectionId`, `generatedAt`, and `config`
- Used by frontend to restore state on page load

---

## Phase 3: Playwright Script Updates

**Duration:** 1 day
**Dependencies:** Phase 2 complete
**Risk Level:** Medium
**Status:** COMPLETED

### Task 3.1: Update Dark Theme Script

**File:** `scripts/edit-website-settings-dark.js`

**Implementation Notes:**
- Added `--head-from-env` and `--body-from-env` flag detection
- Added base64 decoding from `HEAD_INJECTION_CONTENT` and `BODY_INJECTION_CONTENT` environment variables
- Updated validation to accept either file paths or env var flags
- Added `contentSource` logging to show where content came from

**Key Code Added:**
```javascript
// Check for environment variable flags (database content approach)
const headFromEnv = args.includes('--head-from-env');
const bodyFromEnv = args.includes('--body-from-env');

// Validate required arguments - support either file paths or environment variable flags
const hasHeadContent = headPath || (headFromEnv && process.env.HEAD_INJECTION_CONTENT);
const hasBodyContent = bodyPath || (bodyFromEnv && process.env.BODY_INJECTION_CONTENT);

// Read the injection content from environment variables or files
if (headFromEnv && process.env.HEAD_INJECTION_CONTENT) {
  headCode = Buffer.from(process.env.HEAD_INJECTION_CONTENT, 'base64').toString('utf-8');
  bodyCode = Buffer.from(process.env.BODY_INJECTION_CONTENT, 'base64').toString('utf-8');
  contentSource = 'database (env vars)';
} else {
  headCode = await fs.readFile(path.resolve(headPath), 'utf-8');
  bodyCode = await fs.readFile(path.resolve(bodyPath), 'utf-8');
}
```

### Task 3.2: Update Light Theme Script

**File:** `scripts/edit-website-settings-light.js`

**Implementation Notes:**
- Same changes as dark theme script applied
- Both scripts now support dual content source

---

## Phase 4: Frontend Updates

**Duration:** 2 days
**Dependencies:** Phase 2 complete
**Risk Level:** Medium
**Status:** COMPLETED

### Task 4.1: Update RestaurantDetail State Management

**File:** `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`

**Implementation Notes:**
- Added new state variables: `codeInjectionId`, `codeInjectionGeneratedAt`
- Added `Check` icon to imports for status indicator
- Legacy `generatedFilePaths` state retained for backward compatibility

### Task 4.2: Update handleGenerateCodeInjections

**Implementation Notes:**
- Now captures `codeInjectionId` and `generatedAt` from response
- Shows different success message when content stored in database

### Task 4.3: Update handleConfigureWebsite

**Implementation Notes:**
- Updated validation guard to check for either `codeInjectionId` OR `generatedFilePaths`
- Request payload now includes `codeInjectionId`

### Task 4.4: Add useEffect for Existing Content Check

**Implementation Notes:**
- Added useEffect that calls `GET /api/registration/code-injection/:id` on mount
- Restores `codeInjectionId`, `codeInjectionGeneratedAt`, and `codeGenerated` state
- Enables page refresh persistence

### Task 4.5: Update UI Status Indicator

**Implementation Notes:**
- Shows "Code stored in database - persists across sessions" when `codeInjectionId` exists
- Displays generation timestamp
- Uses green checkmark icon for visual confirmation

---

## Phase 5: Batch Service Updates

**Duration:** 1 day
**Dependencies:** Phase 4 complete
**Risk Level:** Medium
**Status:** COMPLETED

### Task 5.1: Update Context Object

**File:** `UberEats-Image-Extractor/src/services/registration-batch-service.js`

**Implementation Notes:**
- Added `codeInjectionId` and `codeInjectionGeneratedAt` to context initialization
- Updated in both `executeYoloModeForJob()` and `executeYoloModeForSingleRestaurantInternal()`

### Task 5.2: Update Phase 1 Result Handling

**Implementation Notes:**
- Now extracts `codeInjectionId` and `generatedAt` from code generation result
- Stores in context for use by website configuration step

### Task 5.3: Update Website Config Payload

**Implementation Notes:**
- `buildSubStepRequest()` now includes `codeInjectionId` in websiteConfig payload

### Task 5.4: Update Website Config Conditional

**Implementation Notes:**
- Changed from `if (context.codeGenerationFilePaths)` to `if (context.codeInjectionId || context.codeGenerationFilePaths)`
- Updated skip reason message

### Task 5.5: Update Context Reconstruction

**Implementation Notes:**
- `reconstructContext()` now restores `codeInjectionId` and `codeInjectionGeneratedAt` from phase progress
- Enables proper resume after partial failure

---

## Phase 6: Testing & Deployment

**Duration:** 2 days
**Dependencies:** All phases complete
**Risk Level:** Medium
**Status:** PENDING

### Task 6.1: Unit Tests

Create test file: `UberEats-Image-Extractor/src/tests/code-injection-persistence.test.js`

```javascript
describe('Code Injection Persistence', () => {
  describe('Generation Endpoint', () => {
    it('should store code injection content in database');
    it('should return codeInjectionId in response');
    it('should handle database storage failure gracefully');
  });

  describe('Configuration Endpoint', () => {
    it('should retrieve code injection from database');
    it('should fall back to file paths if database empty');
    it('should work with base64 encoded environment variables');
  });

  describe('Playwright Scripts', () => {
    it('should read content from environment variables');
    it('should fall back to file paths');
  });
});
```

### Task 6.2: Integration Tests

**Test Scenarios:**

1. **Manual Generation Flow:**
   - Generate code injections for a restaurant
   - Verify content stored in `pumpd_restaurants`
   - Configure website using stored content
   - Verify success

2. **YOLO Mode Flow:**
   - Execute YOLO mode for single restaurant
   - Verify code injection stored
   - Verify website configuration succeeds

3. **Batch Registration Flow:**
   - Run batch with multiple restaurants
   - Verify all code injections stored
   - Verify resume uses database content

4. **Page Refresh Persistence:**
   - Generate code, refresh page
   - Verify code injection ID restored
   - Configure website without re-generating

5. **Error Recovery:**
   - Generate code, simulate DB write failure
   - Verify file-based fallback works

### Task 6.3: Staging Deployment Checklist

```markdown
- [x] Database migration applied to staging
- [x] TypeScript types regenerated
- [x] Backend deployed with new endpoints
- [x] Scripts deployed with env var support
- [x] Frontend deployed with new state management
- [x] Batch service deployed with context updates
```

### Task 6.4: Production Deployment Checklist

```markdown
- [x] Database migration applied to production
- [x] Verify migration successful (check columns exist)
- [ ] Deploy backend (with backward compatibility)
- [ ] Deploy scripts
- [ ] Deploy frontend
- [ ] Deploy batch service
- [ ] Monitor error logs for 24 hours
- [ ] Verify new registrations use database storage
```

### Task 6.5: Post-Deployment Verification

```sql
-- Verify code injections being stored
SELECT
  r.name,
  pr.code_injection_generated_at,
  LENGTH(pr.head_injection) as head_size,
  LENGTH(pr.body_injection) as body_size
FROM pumpd_restaurants pr
JOIN restaurants r ON r.id = pr.restaurant_id
WHERE pr.code_injection_generated_at > NOW() - INTERVAL '24 hours'
ORDER BY pr.code_injection_generated_at DESC;
```

---

## Rollback Plan

If issues arise after deployment:

### Immediate Rollback (Frontend Only)
1. Revert frontend to use only `generatedFilePaths`
2. Backend still returns file paths for compatibility

### Full Rollback
1. Revert frontend changes
2. Revert batch service changes
3. Revert API endpoints (remove database storage)
4. Revert script changes
5. Keep database columns (no data loss)

### Database Rollback (If Needed)
```sql
-- Only run if migration caused issues
DROP INDEX IF EXISTS idx_pumpd_restaurants_code_injection_config;
DROP INDEX IF EXISTS idx_pumpd_restaurants_code_injection_generated_at;
ALTER TABLE public.pumpd_restaurants DROP COLUMN IF EXISTS head_injection;
ALTER TABLE public.pumpd_restaurants DROP COLUMN IF EXISTS body_injection;
ALTER TABLE public.pumpd_restaurants DROP COLUMN IF EXISTS code_injection_config;
ALTER TABLE public.pumpd_restaurants DROP COLUMN IF EXISTS code_injection_generated_at;
```

---

## Summary

| Phase | Tasks | Files Modified | Status |
|-------|-------|----------------|--------|
| 1. Database | 3 | Supabase migration | COMPLETED |
| 2. Backend API | 3 | registration-routes.js | COMPLETED |
| 3. Scripts | 2 | edit-website-settings-*.js | COMPLETED |
| 4. Frontend | 5 | RestaurantDetail.jsx | COMPLETED |
| 5. Batch Service | 5 | registration-batch-service.js | COMPLETED |
| 6. Testing | 5 | Test files, deployment | PENDING |

---

## Files Modified

| File | Changes |
|------|---------|
| `add_code_injection_columns.sql` | Migration script for new columns |
| `UberEats-Image-Extractor/src/routes/registration-routes.js` | DB storage in generate endpoint, DB retrieval in configure endpoint, new GET endpoint |
| `scripts/edit-website-settings-dark.js` | Environment variable support for code injection content |
| `scripts/edit-website-settings-light.js` | Environment variable support for code injection content |
| `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` | New state variables, API updates, UI indicator, useEffect for existing content |
| `UberEats-Image-Extractor/src/services/registration-batch-service.js` | Context updates, result handling, resume support |

---

## Key Implementation Details

### Content Transfer Method
- **Database approach**: Base64 encoding via environment variables (`HEAD_INJECTION_CONTENT`, `BODY_INJECTION_CONTENT`)
- **Script flags**: `--head-from-env` and `--body-from-env` trigger env var reading
- **Avoids**: CLI argument size limits, filesystem dependencies

### Backward Compatibility
- API returns both `codeInjectionId` AND legacy `filePaths`
- Scripts accept both env var flags AND file path arguments
- Frontend stores both `codeInjectionId` AND `generatedFilePaths`
- Batch service checks for either source

### Data Flow
1. **Generation**: Files created → Content read → Stored in DB → ID returned
2. **Configuration**: Check DB for content → Fall back to files → Pass via env vars
3. **Resume**: Reconstruct context from phase progress → Use stored IDs

---

*Document Version: 2.0*
*Created: 2025-12-30*
*Last Updated: 2025-12-30*
*Implementation Status: Phases 1-5 COMPLETED, Phase 6 PENDING*
