# Code Injection Database Persistence - Investigation Summary

## Executive Summary

This document summarizes findings from 5 parallel investigations into migrating code injection storage from filesystem to database. The investigation confirms that database persistence is **feasible and recommended**, with a clear implementation path.

**Recommended Approach:** Add 4 new columns to the `pumpd_restaurants` table to store code injection content directly in the database.

---

## Investigation Findings Summary

### 1. Code Generation Analysis (Subagent 1)

**File Sizes:**
| File | Typical Size | Purpose |
|------|--------------|---------|
| head-injection.html | 18-24 KB | CSS styling, fonts, animations |
| body-injection.html | 9-19 KB | JavaScript functionality |
| configuration.json | ~460 bytes | Generation metadata |
| completion.json | ~500 bytes | Success marker |
| **Total per restaurant** | **28-43 KB** | |

**Key Findings:**
- Script: `ordering-page-customization.js` generates all files via Playwright
- Sanitize function: `name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')`
- Files saved to: `/generated-code/{sanitized-name}/`
- Content includes Google Fonts, Animate.css CDN links, theme-specific styling

---

### 2. API Endpoints Analysis (Subagent 2)

**Generation Endpoint:** `POST /api/registration/generate-code-injections`
- Request: `{ restaurantId, noGradient }`
- Response: `{ success, filePaths: { headInjection, bodyInjection, configuration, completion } }`
- Executes script with colors/theme as CLI arguments
- Polls for completion file (90s dev, 120s prod timeout)

**Configuration Endpoint:** `POST /api/registration/configure-website`
- Request: `{ restaurantId, filePaths, headerConfig, itemsConfig, textColorConfig, ... }`
- Passes file paths as `--head` and `--body` CLI arguments
- Script reads files via `fs.readFile(path.resolve(headPath), 'utf-8')`

**Breaking Changes Required:**
1. API response format: `filePaths` → `codeInjectionId`
2. Script arguments: file paths → content (base64 or stdin)
3. File validation: existence check → database query

---

### 3. Frontend Integration Analysis (Subagent 3)

**Current State Management (RestaurantDetail.jsx):**
```javascript
const [generatedFilePaths, setGeneratedFilePaths] = useState(null);
const [existingHeadPath, setExistingHeadPath] = useState('');
const [existingBodyPath, setExistingBodyPath] = useState('');
```

**Critical Issues:**
- State is **ephemeral** (lost on page refresh)
- Blocks configuration if null
- No persistence between sessions

**Required Changes:**
| Change | Scope | Effort |
|--------|-------|--------|
| Replace state variable | 1 variable | 1 hour |
| Update API response handling | 1 function | 1 hour |
| Update configure website call | 2 locations | 2 hours |
| Batch service context update | 1 location | 2 hours |
| Existing file mode redesign | 1-2 functions | 4-6 hours |
| Testing | All workflows | 4 hours |
| **Total** | | **14-18 hours** |

**Good News:** YoloModeDialog and RegistrationBatchDetail need **minimal changes** - batch service abstracts file paths internally.

---

### 4. Batch Service Analysis (Subagent 4)

**Context Passing Pattern:**
```javascript
const context = {
  codeGenerationFilePaths: null,  // Captured from Phase 1
  // ...
};
```

**Workflow Flow:**
1. Phase 1: `codeGeneration` runs in parallel with account creation
2. Result captured: `context.codeGenerationFilePaths = result.filePaths`
3. Phase 2: `websiteConfig` checks if filePaths exist
4. If missing: `websiteConfig` marked as 'skipped' (not 'failed')

**Error Handling:**
- Code generation failure is **non-blocking**
- Batch can complete with websiteConfig in 'skipped' state
- Resume capability reconstructs context from `sub_step_progress`

**Required Changes:**
- Update `buildSubStepRequest()` to use artifact IDs
- Update `reconstructContext()` to query database
- Store artifact references in phase progress

---

### 5. Database Schema Analysis (Subagent 5)

**Recommended Storage Location:** `pumpd_restaurants` table

**Rationale:**
- Correct ownership model (per restaurant, not per job)
- Natural lifecycle (deleted with restaurant)
- Simple retrieval (single query by restaurant_id)
- PostgreSQL TOAST handles 43 KB efficiently

**Proposed Migration:**
```sql
ALTER TABLE public.pumpd_restaurants
  ADD COLUMN head_injection TEXT NULL,
  ADD COLUMN body_injection TEXT NULL,
  ADD COLUMN code_injection_config JSONB NULL DEFAULT '{}'::jsonb,
  ADD COLUMN code_injection_generated_at TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX idx_pumpd_restaurants_code_injection_config
  ON pumpd_restaurants USING gin (code_injection_config);

CREATE INDEX idx_pumpd_restaurants_code_injection_timestamp
  ON pumpd_restaurants USING btree (code_injection_generated_at);
```

**Migration Risk:** LOW
- Additive (no data loss)
- Nullable (backward compatible)
- Easy rollback
- No historical data to migrate

---

## Recommended Implementation Approach

### Phase 1: Database Layer (Day 1)
1. Create migration adding 4 columns to `pumpd_restaurants`
2. Run migration on development database
3. Generate TypeScript types

### Phase 2: Backend API Updates (Days 2-3)
1. **Generation Endpoint:**
   - After script execution, read file content
   - Store in `pumpd_restaurants.head_injection` and `body_injection`
   - Store config in `code_injection_config` JSONB
   - Return `{ success, codeInjectionId: restaurant.pumpd_restaurant_id }`

2. **Configuration Endpoint:**
   - Query `pumpd_restaurants` by restaurant_id
   - Retrieve `head_injection` and `body_injection` content
   - Pass content to script (see Phase 3)

### Phase 3: Playwright Script Updates (Day 3)
1. Modify `edit-website-settings-dark.js` and `edit-website-settings-light.js`
2. Accept content via environment variables or stdin:
   ```bash
   HEAD_CONTENT="base64..." BODY_CONTENT="base64..." node script.js
   ```
3. Decode and use content directly (no `fs.readFile`)

### Phase 4: Frontend Updates (Days 4-5)
1. Replace `generatedFilePaths` state with `codeInjectionId`
2. Update `handleGenerateCodeInjections()` response handling
3. Update `handleConfigureWebsite()` request payload
4. Update batch service context passing

### Phase 5: Batch Service Updates (Day 5)
1. Update `context.codeGenerationFilePaths` → `context.codeInjectionId`
2. Modify `reconstructContext()` for database lookup
3. Update phase progress storage

### Phase 6: Testing & Deployment (Days 6-7)
1. Test manual generation workflow
2. Test YOLO mode (single restaurant)
3. Test batch registration
4. Test resume/retry scenarios
5. Deploy to staging
6. Production deployment

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Script argument change breaks automation | Medium | High | Test thoroughly in staging |
| Large content slows API responses | Low | Medium | PostgreSQL TOAST optimizes storage |
| Resume capability breaks | Medium | Medium | Comprehensive integration tests |
| Existing file mode unusable | High | Low | Redesign as file upload or validate-and-store |

---

## Key Integration Points

### Files to Modify

| File | Changes |
|------|---------|
| `scripts/ordering-page-customization.js` | No changes (still generates files) |
| `scripts/edit-website-settings-dark.js` | Accept content via env vars |
| `scripts/edit-website-settings-light.js` | Accept content via env vars |
| `src/routes/registration-routes.js` | Store/retrieve from database |
| `src/services/registration-batch-service.js` | Context passing updates |
| `src/pages/RestaurantDetail.jsx` | State management updates |

### API Contract Changes

**Before:**
```json
// Generation Response
{ "success": true, "filePaths": { "headInjection": "/path/...", "bodyInjection": "/path/..." } }

// Configuration Request
{ "restaurantId": "...", "filePaths": { "headInjection": "...", "bodyInjection": "..." } }
```

**After:**
```json
// Generation Response
{ "success": true, "codeInjectionId": "uuid", "generatedAt": "ISO-8601" }

// Configuration Request
{ "restaurantId": "...", "codeInjectionId": "uuid" }
```

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Database Migration | 1 day | None |
| Backend API Updates | 2 days | Phase 1 |
| Playwright Script Updates | 1 day | Phase 2 |
| Frontend Updates | 2 days | Phase 2 |
| Batch Service Updates | 1 day | Phase 4 |
| Testing & Deployment | 2 days | All phases |
| **Total** | **~7 working days** | |

---

## Conclusion

The investigation confirms that migrating code injection storage to the database is:
- **Technically feasible** with well-understood changes
- **Low risk** using additive, nullable columns
- **High value** for production reliability
- **Moderate effort** (~7 days implementation)

The recommended approach stores content in `pumpd_restaurants` for correct ownership semantics and simple retrieval patterns. The main complexity is coordinating changes across backend, Playwright scripts, and frontend state management.

---

*Generated: 2025-12-30*
*Investigation completed by 5 parallel subagents*
