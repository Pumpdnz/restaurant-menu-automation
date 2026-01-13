# Investigation Plan: Code Injection Database Persistence

## Overview

This investigation focuses on migrating code injection file storage from the local filesystem to database persistence. The current system generates HTML code injection files (`head-injection.html` and `body-injection.html`) using Playwright automation, saves them to the local filesystem, and later reads them when configuring website settings. This approach fails in production environments where the filesystem is ephemeral (files are lost on server restart).

### Goal
Implement database persistence for code injection content so that:
1. Generated code injections are stored in Supabase instead of the local filesystem
2. Website configuration scripts can retrieve code injection content from the database
3. The system works reliably in production (Heroku/Railway) where filesystems are ephemeral

---

## Known Information

### Current Architecture

**Code Generation Flow:**
1. User/System triggers code injection generation via one of three methods:
   - Manual step in `RestaurantDetail.tsx`
   - Single restaurant YOLO mode in `RestaurantDetail.tsx`
   - Batch registration from `RegistrationBatchDetail.tsx`

2. All three methods call the API endpoint: `POST /api/registration/generate-code-injections`

3. The endpoint (in `registration-routes.js` lines 1351-1558) executes `ordering-page-customization.js` script which:
   - Uses Playwright to navigate to `manage.pumpd.co.nz`
   - Configures ordering page with restaurant colors and settings
   - Extracts head/body code injections
   - Saves files to `/generated-code/{sanitized-restaurant-name}/`:
     - `head-injection.html`
     - `body-injection.html`
     - `configuration.json`
     - `completion.json`
   - Returns file paths in the API response

4. File paths are stored in frontend state (`generatedFilePaths`) or batch context (`context.codeGenerationFilePaths`)

**Code Usage Flow:**
1. User/System triggers website configuration via `POST /api/registration/configure-website`

2. The endpoint (in `registration-routes.js` lines 1564-2106):
   - Receives file paths in `req.body.filePaths`
   - Selects script based on theme (`edit-website-settings-dark.js` or `edit-website-settings-light.js`)
   - Passes file paths as `--head` and `--body` command-line arguments
   - The script reads files using `fs.readFile(path.resolve(headPath), 'utf-8')`

### Key Files Identified

| File | Purpose |
|------|---------|
| `scripts/ordering-page-customization.js` | Generates and saves code injection files |
| `src/routes/registration-routes.js` | API endpoints for generation and configuration |
| `src/services/registration-batch-service.js` | Orchestrates batch/YOLO mode workflows |
| `src/pages/RestaurantDetail.jsx` | Frontend for manual registration |
| `src/components/registration/YoloModeDialog.tsx` | YOLO mode configuration dialog |
| `scripts/edit-website-settings-dark.js` | Applies dark theme + code injections |
| `scripts/edit-website-settings-light.js` | Applies light theme + code injections |

### Database Tables (Potential Storage Locations)

- `pumpd_restaurants` - Has `setup_completion` JSONB field that could store code injection data
- `restaurants` - Could add new columns for code injection storage
- `registration_jobs` - Could store code injections as part of job data

---

## Instructions

Execute this investigation by spinning up **5 parallel subagents** using the Task tool. Each subagent should:

1. **Only investigate** - Do NOT modify any code
2. Create a detailed investigation document as the deliverable
3. Report findings back to the orchestrator

**After all subagents complete their work:**
1. Read all generated investigation documents
2. Compile findings into a summary report for the user
3. Identify the recommended implementation approach

---

## subagent_1_instructions

### Context
Investigate the code injection **generation** process to understand exactly what data is created and how it's currently stored.

### Instructions
1. Read `scripts/ordering-page-customization.js` thoroughly
2. Document the exact structure of each file generated:
   - `head-injection.html` - typical content structure and size
   - `body-injection.html` - typical content structure and size
   - `configuration.json` - JSON schema
   - `completion.json` - JSON schema
3. Find examples in `generated-code/` directory to understand real data
4. Document the `sanitize()` function behavior for slug generation
5. Identify what metadata should be stored alongside the code injection content

### Deliverable
Create file: `INVESTIGATION_TASK_1_CODE_GENERATION.md` in this directory containing:
- Full analysis of generated file structures
- Sample data from existing generated-code directories
- Recommended database schema for storing this data
- Any edge cases or considerations

### Report
Report back with a summary of findings, especially the typical size of code injection files and recommended storage approach.

---

## subagent_2_instructions

### Context
Investigate the API endpoints that handle code injection generation and consumption to understand the data flow.

### Instructions
1. Read `src/routes/registration-routes.js` focusing on:
   - `/api/registration/generate-code-injections` endpoint (lines 1351-1558)
   - `/api/registration/configure-website` endpoint (lines 1564-2106)
2. Document:
   - Request/response payload structures
   - How file paths are constructed and passed
   - Error handling for missing files
   - How the route distinguishes between dark/light themes
3. Identify all places where file paths are used vs where content could be used directly
4. Map the data flow from generation to consumption

### Deliverable
Create file: `INVESTIGATION_TASK_2_API_ENDPOINTS.md` in this directory containing:
- Detailed API endpoint analysis
- Request/response schemas
- Data flow diagram (text-based)
- Required changes to support database storage

### Report
Report back with the key integration points that need modification and any breaking changes to consider.

---

## subagent_3_instructions

### Context
Investigate how the frontend components trigger and use code injection generation to understand UI integration requirements.

### Instructions
1. Read `src/pages/RestaurantDetail.jsx` focusing on:
   - `handleGenerateCodeInjections()` function
   - `handleConfigureWebsite()` function
   - State management for `generatedFilePaths`
2. Read `src/components/registration/YoloModeDialog.tsx`:
   - How code generation fits into the YOLO mode flow
   - How file paths are passed between steps
3. Read `src/pages/RegistrationBatchDetail.tsx`:
   - How batch processing handles code generation
4. Document all places that store or use file path references

### Deliverable
Create file: `INVESTIGATION_TASK_3_FRONTEND_INTEGRATION.md` in this directory containing:
- Component interaction analysis
- State management patterns for code injection data
- Required frontend changes to support database storage
- Impact assessment for existing functionality

### Report
Report back with the scope of frontend changes needed and any UX considerations.

---

## subagent_4_instructions

### Context
Investigate the registration batch service to understand how code injection fits into automated workflows.

### Instructions
1. Read `src/services/registration-batch-service.js` focusing on:
   - `executeYoloModeForJob()` function
   - `executeYoloModeForSingleRestaurant()` function
   - How `context.codeGenerationFilePaths` is captured and used
   - The `codeGeneration` sub-step definition
   - The `websiteConfig` sub-step that consumes code injections
2. Document:
   - The exact flow of data through batch processing
   - How errors in code generation affect subsequent steps
   - The relationship between code generation and website configuration steps

### Deliverable
Create file: `INVESTIGATION_TASK_4_BATCH_SERVICE.md` in this directory containing:
- Batch workflow analysis
- Context passing patterns
- Required service changes for database integration
- Error handling considerations

### Report
Report back with how the batch service orchestrates these steps and what changes are needed.

---

## subagent_5_instructions

### Context
Investigate the database schema and determine the best storage strategy for code injection content.

### Instructions
1. Query the current schema for relevant tables:
   - `pumpd_restaurants` - examine `setup_completion` JSONB structure
   - `restaurants` - current columns and potential for new ones
   - `registration_jobs` - job data structure
2. Analyze which table is most appropriate for storing code injections
3. Consider:
   - Data ownership (per restaurant vs per registration attempt)
   - Data lifecycle (when should old code injections be cleaned up?)
   - Query patterns (how will code injections be retrieved?)
   - Size constraints for JSONB vs TEXT columns
4. Design the database migration needed

### Deliverable
Create file: `INVESTIGATION_TASK_5_DATABASE_SCHEMA.md` in this directory containing:
- Current schema analysis
- Recommended storage location and structure
- Migration SQL script (draft)
- Index recommendations
- Data retention considerations

### Report
Report back with the recommended database changes and any migration concerns.

---

## Execution Command

```
Use the Task tool to launch 5 parallel subagents with the following prompts:

1. subagent_type: "Explore", prompt: [subagent_1_instructions content]
2. subagent_type: "Explore", prompt: [subagent_2_instructions content]
3. subagent_type: "Explore", prompt: [subagent_3_instructions content]
4. subagent_type: "Explore", prompt: [subagent_4_instructions content]
5. subagent_type: "general-purpose", prompt: [subagent_5_instructions content] (needs database access)
```

After all subagents complete, read the 5 investigation documents and compile a summary for the user.
