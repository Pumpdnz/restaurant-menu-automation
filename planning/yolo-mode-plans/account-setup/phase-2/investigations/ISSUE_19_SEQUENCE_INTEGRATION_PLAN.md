# Investigation Plan: Issue 19 - Sequence Enrollment Integration

## Overview

This investigation plan covers the implementation of **Issue 19: Sequence Enrollment Integration** for the Registration Batch Detail page. The goal is to integrate full sequence management functionality directly into the batch progress view, allowing users to manage sequences without navigating to RestaurantDetail.

**Key Objectives:**
1. Full sequence task management in the batch detail view (identical to RestaurantDetail Tasks & Sequences tab)
2. Integrate SequenceProgressCard into the RestaurantRow collapsible dropdown
3. Implement "Drop and Recreate" sequences feature to regenerate tasks with updated restaurant data (contact_name, etc.)

---

## Known Information

### Current System Architecture

**Sequence Components (src/components/sequences/):**
- `SequenceProgressCard.tsx` - Displays sequence progress, tasks, and action buttons
- `SequenceTaskList.tsx` - Full task management table with status, priority, due date editing
- `StartSequenceModal.tsx` - Modal to start sequence for a single restaurant
- `BulkStartSequenceModal.tsx` - Modal to start sequences for multiple restaurants
- `TaskTypeQuickView.tsx` (tasks/) - Popover for task preview and quick actions

**Sequence Hooks (src/hooks/useSequences.ts):**
- `useRestaurantSequences(restaurantId)` - Fetches sequences for a restaurant
- `useStartSequence()` - Starts a new sequence
- `usePauseSequence()`, `useResumeSequence()` - Pause/resume controls
- `useCancelSequence()`, `useFinishSequence()` - Cancel/finish controls
- `useDeleteSequenceInstance()` - Deletes a sequence and its tasks

**Backend Services (src/services/):**
- `sequence-instances-service.js` - `startSequence()`, `startSequenceBulk()`, `deleteSequenceInstance()`
- `variable-replacement-service.js` - Handles `{variable_name}` replacement in templates

**Current Target File:**
- `src/pages/RegistrationBatchDetail.tsx` - Contains `RestaurantRow` component where sequences should be integrated

### The Variable Replacement Problem

When sequences are started during lead conversion (via PendingLeadsTable), the restaurant data may be incomplete:
- `contact_name` often missing (extracted later in Step 4)
- `contact_email`, `contact_phone` may be incomplete
- Message templates render with empty/missing variables

After registration completes (Step 6), all restaurant data is available. Users need to be able to:
1. Delete the existing sequence (with all its tasks)
2. Recreate the same sequence type from the template
3. Have variables properly replaced with now-available data

### UI Integration Requirements

The sequence section should appear in RestaurantRow's expanded content, below the existing:
- 6-step progress grid
- Yolo Mode Sub-Steps badges (for Step 6)

New section should include:
- "Active Sequences" header
- SequenceProgressCard for each enrolled sequence
- "Start Sequence" button if no sequences exist
- "Recreate Sequences" bulk action for selected restaurants

---

## Instructions for Next Session

Use the **Task tool** to spin up **5 parallel subagents** to investigate each area simultaneously. Each subagent should:
1. Only investigate (read files, analyze patterns) - **DO NOT modify code**
2. Create a deliverable investigation document in the `investigations/` folder
3. Report findings for synthesis

**Execution Command:**
```
Use the Task tool to launch 5 subagents in parallel with subagent_type='Explore':
1. INVESTIGATION_TASK_1_SEQUENCE_UI.md - Sequence UI component analysis
2. INVESTIGATION_TASK_2_DATA_REQUIREMENTS.md - Data fetching and state requirements
3. INVESTIGATION_TASK_3_TASK_MANAGEMENT.md - Task management functionality
4. INVESTIGATION_TASK_4_RECREATE_FEATURE.md - Recreate sequences backend
5. INVESTIGATION_TASK_5_BATCH_SELECTION.md - Batch selection UX patterns
```

After all subagents complete, read all investigation files and synthesize findings into a unified implementation plan.

---

## subagent_1_instructions (Sequence UI Component Analysis)

### Context
We need to understand how SequenceProgressCard and related components work so we can integrate them into RestaurantRow.

### Instructions
1. Read and analyze these files:
   - `src/components/sequences/SequenceProgressCard.tsx`
   - `src/components/sequences/SequenceTaskList.tsx`
   - `src/components/sequences/StartSequenceModal.tsx`
   - `src/components/tasks/TaskTypeQuickView.tsx`
   - `src/components/tasks/TaskDetailModal.tsx`

2. Document:
   - All props required by SequenceProgressCard
   - All callback handlers (onPause, onResume, onCancel, onFinish, onDelete, etc.)
   - How SequenceTaskList integrates with TaskTypeQuickView
   - Any modal/dialog dependencies

3. Analyze how these components are used in RestaurantDetail.jsx (lines 5117-5230)

### Deliverable
Create `INVESTIGATION_TASK_1_SEQUENCE_UI.md` with:
- Component dependency tree
- Required props interface
- Callback handler specifications
- Integration pattern from RestaurantDetail

### Report
Summarize which components need to be imported and what callbacks must be wired up.

---

## subagent_2_instructions (Data Fetching and State Requirements)

### Context
We need to understand what data is required to render sequences and how to fetch it within the batch context.

### Instructions
1. Read and analyze:
   - `src/hooks/useSequences.ts` (especially `useRestaurantSequences`)
   - `src/hooks/useRegistrationBatch.ts` (current data structure)
   - `src/services/registration-batch-service.js` - `getRegistrationBatchJob()` function

2. Document:
   - Current RegistrationJob data structure
   - What sequence data is needed per restaurant
   - Options for fetching sequence data:
     - A) Expand `getRegistrationBatchJob()` to include sequences
     - B) Fetch sequences separately per restaurant using `useRestaurantSequences`
     - C) Batch fetch all sequences for all restaurants in one query

3. Analyze performance implications of each approach

### Deliverable
Create `INVESTIGATION_TASK_2_DATA_REQUIREMENTS.md` with:
- Current vs required data structures
- Data fetching options with pros/cons
- Recommended approach
- TypeScript interface additions needed

### Report
Summarize the recommended data fetching strategy and required backend changes.

---

## subagent_3_instructions (Task Management Functionality)

### Context
Users should be able to manage tasks (change status, priority, due date, complete with actions) from the batch view exactly as they can from RestaurantDetail.

### Instructions
1. Read and analyze:
   - `src/components/sequences/SequenceTaskList.tsx` (full analysis)
   - `src/components/tasks/TaskTypeQuickView.tsx`
   - `src/services/tasks-service.js` (if exists) or relevant task endpoints
   - `src/pages/RestaurantDetail.jsx` - Tasks & Sequences tab implementation

2. Document:
   - All task operations supported (status change, priority change, due date update)
   - Complete action variants (complete only, complete + follow-up, complete + start sequence)
   - API endpoints used for task operations
   - State refresh patterns after task updates

3. Identify any differences needed for batch context vs single restaurant context

### Deliverable
Create `INVESTIGATION_TASK_3_TASK_MANAGEMENT.md` with:
- Complete task operations inventory
- API endpoints required
- State management patterns
- Any context-specific adaptations needed

### Report
Summarize the task management features and any adaptations needed for batch context.

---

## subagent_4_instructions (Recreate Sequences Backend)

### Context
We need to implement a "recreate sequence" feature that deletes an existing sequence and creates a new one from the same template, so variables are replaced with updated restaurant data.

### Instructions
1. Read and analyze:
   - `src/services/sequence-instances-service.js` - `startSequence()`, `deleteSequenceInstance()`
   - `src/services/variable-replacement-service.js`
   - Supabase schema for `sequence_instances` table

2. Document:
   - Current delete sequence flow
   - Current start sequence flow and how variables are replaced
   - What data is stored in sequence_instances (especially `sequence_template_id`)
   - Requirements for a "recreate" operation:
     - Get template_id from existing instance
     - Delete existing instance and all tasks
     - Start new instance from same template
     - Ensure variable replacement uses fresh restaurant data

3. Design the backend endpoint:
   - `POST /api/sequence-instances/:id/recreate` or similar
   - Bulk recreate: `POST /api/sequence-instances/bulk-recreate`

### Deliverable
Create `INVESTIGATION_TASK_4_RECREATE_FEATURE.md` with:
- Current sequence lifecycle flows
- Recreate feature specification
- API endpoint design
- Service function pseudocode
- React Query mutation hook design

### Report
Summarize the recreate feature design and required backend/frontend additions.

---

## subagent_5_instructions (Batch Selection UX Patterns)

### Context
Users should be able to select multiple restaurants in the batch view and perform bulk sequence actions (start, recreate).

### Instructions
1. Read and analyze:
   - `src/pages/RegistrationBatchDetail.tsx` - Current RestaurantRow implementation
   - `src/components/registration-batch/YoloConfigBatchView.tsx` - Uses selection pattern
   - `src/components/sequences/BulkStartSequenceModal.tsx`
   - `src/components/leads/PendingLeadsTable.tsx` - Another selection pattern

2. Document:
   - Existing selection patterns in the codebase
   - How YoloConfigBatchView handles "Select All", "Select None", individual selection
   - Current table structure in RegistrationBatchDetail
   - How to add selection checkboxes to RestaurantRow

3. Design the batch actions UX:
   - Where to place action buttons (table header? floating action bar?)
   - "Start Sequences" button for selected restaurants without sequences
   - "Recreate Sequences" button for selected restaurants with sequences
   - Confirmation dialogs

### Deliverable
Create `INVESTIGATION_TASK_5_BATCH_SELECTION.md` with:
- Existing selection patterns analysis
- Recommended selection state management
- Batch actions UI placement recommendations
- Component integration plan

### Report
Summarize the selection UX pattern and recommended batch actions implementation.

---

## Post-Investigation Synthesis

After all 5 subagent investigations complete:

1. Read all investigation files:
   - `INVESTIGATION_TASK_1_SEQUENCE_UI.md`
   - `INVESTIGATION_TASK_2_DATA_REQUIREMENTS.md`
   - `INVESTIGATION_TASK_3_TASK_MANAGEMENT.md`
   - `INVESTIGATION_TASK_4_RECREATE_FEATURE.md`
   - `INVESTIGATION_TASK_5_BATCH_SELECTION.md`

2. Create unified implementation plan: `ISSUE_19_IMPLEMENTATION_PLAN.md` with:
   - Ordered implementation steps
   - Files to modify
   - New files to create
   - Backend changes
   - Frontend changes
   - TypeScript interface updates
   - Testing checklist

3. Report synthesized findings to user with:
   - Summary of all investigation discoveries
   - Recommended implementation order
   - Estimated complexity per task
   - Any blockers or dependencies identified

---

## Files Reference

**Primary Files to Modify:**
- `src/pages/RegistrationBatchDetail.tsx` - Add sequence section to RestaurantRow
- `src/services/registration-batch-service.js` - Add sequence data to batch query (optional)

**New Files to Create:**
- None expected (reuse existing components)

**Backend Changes:**
- `src/services/sequence-instances-service.js` - Add `recreateSequence()`, `recreateSequenceBulk()`
- `src/routes/sequence-instances-routes.js` - Add recreate endpoints

**Hooks Updates:**
- `src/hooks/useSequences.ts` - Add `useRecreateSequence()`, `useRecreateSequenceBulk()` mutations
