# Next Features Investigation - Quick Start Guide

**Date:** November 23, 2025
**Status:** 📋 INVESTIGATION PHASE
**Estimated Total Time:** TBD (requires investigation)

---

## Overview

This document outlines three new features to investigate and potentially implement for the sequence management system. Each feature builds on the completed work from Phases 1, 2.1, 2.3, and 2.4.

**Prerequisites:**
- Review [SEQUENCE-ENHANCEMENTS-COMPLETE.md](./SEQUENCE-ENHANCEMENTS-COMPLETE.md) for context
- Review [sequences-page-refactoring-plan.md](./sequences-page-refactoring-plan.md) for recent changes
- Understand current sequence architecture and task management system

---

## Feature 1: Bulk Add Restaurants to a Sequence

### Feature Description

Allow users to start the same sequence for multiple restaurants at once, rather than selecting one restaurant at a time.

### User Story

**As a** sales team member
**I want to** add multiple restaurants to a sequence in one action
**So that** I can efficiently onboard batches of restaurants without repetitive manual work

### Current Behavior

- User clicks "New Sequence" button on Sequences page
- `SelectRestaurantForSequenceModal` opens
- User selects **ONE** restaurant
- `StartSequenceModal` opens for the selected restaurant
- User selects a sequence template
- Sequence starts for that one restaurant
- To add more restaurants, user must repeat the entire process

### Desired Behavior

**Option A: Bulk Selection in SelectRestaurantForSequenceModal**
- User clicks "New Sequence" button
- Modal allows selecting **MULTIPLE** restaurants (checkboxes)
- User clicks "Next" or "Select" button
- `StartSequenceModal` opens showing "X restaurants selected"
- User selects sequence template
- Sequence starts for **ALL** selected restaurants
- Success message: "Sequence started for 5 restaurants"

**Option B: Separate "Bulk Start Sequences" Button**
- New button on Sequences page: "Bulk Start Sequences"
- Opens `BulkStartSequenceModal` with two sections:
  - Left: Restaurant selection with filters (lead stage, warmth, status)
  - Right: Sequence template selection
- Preview shows "Will create X sequences for Y restaurants"
- Confirmation creates all sequences in batch

**Recommended:** Option A (simpler, leverages existing modal)

---

### Investigation Tasks

#### Task 1.1: Review Current Implementation

**Files to examine:**
- `/src/components/sequences/SelectRestaurantForSequenceModal.tsx` (current single-select)
- `/src/components/sequences/StartSequenceModal.tsx` (receives restaurant object)
- `/src/pages/Sequences.tsx` (handleRestaurantSelected flow)
- `/src/hooks/useSequences.ts` (useStartSequence hook)
- `/src/services/sequence-instances-service.js` (startSequence backend)

**Questions to answer:**
1. Can `StartSequenceModal` handle an array of restaurants instead of single restaurant?
2. Does backend support bulk sequence creation, or does it need modification?
3. What should happen if one restaurant fails while others succeed?
4. Should there be a limit on how many restaurants can be selected at once?

#### Task 1.2: UI/UX Design Decisions

**Decisions needed:**
1. How to display multiple selected restaurants in `SelectRestaurantForSequenceModal`?
   - Checkboxes next to each restaurant?
   - "Select All" / "Clear All" buttons?
   - Selected count indicator?

2. How to show progress during bulk creation?
   - Single loading spinner?
   - Progress bar showing "Creating 3 of 10 sequences..."?
   - List showing each restaurant with success/failure icons?

3. Error handling:
   - If 2 out of 10 restaurants fail, show partial success?
   - Allow user to retry failed ones?
   - Show which restaurants succeeded/failed?

4. Should sequence templates have a "max restaurants" limit?

#### Task 1.3: Backend Investigation

**Files to examine:**
- `/src/routes/sequence-instances-routes.js`
- `/src/services/sequence-instances-service.js`

**Questions to answer:**
1. Does `POST /api/sequence-instances` accept array of restaurant_ids?
2. Should bulk creation be a new endpoint (`POST /api/sequence-instances/bulk`)?
3. Should bulk creation be a database transaction (all or nothing)?
4. How to handle concurrent sequence creation (database locks, race conditions)?

#### Task 1.4: Implementation Estimate

After investigation, estimate:
- Frontend changes (modal, progress UI)
- Backend changes (bulk endpoint, error handling)
- Testing requirements
- **Total estimated time**

---

### Success Criteria

- [ ] Users can select multiple restaurants from SelectRestaurantForSequenceModal
- [ ] Selected restaurants counter displayed (e.g., "5 restaurants selected")
- [ ] Bulk sequence creation creates sequences for all selected restaurants
- [ ] Progress indicator shows during bulk creation
- [ ] Success/failure feedback for each restaurant
- [ ] Partial success handled gracefully (some succeed, some fail)
- [ ] Error messages clear and actionable
- [ ] Performance acceptable for 10, 50, 100+ restaurants

---

## Feature 2: Complete and Begin Sequence from TaskDetailModal

### Feature Description

Add a "Complete & Start Sequence" option to `TaskDetailModal.tsx` that allows users to complete the current task and immediately start a sequence for the restaurant.

### User Story

**As a** sales team member
**I want to** complete a standalone task and immediately start a follow-up sequence
**So that** I can maintain workflow momentum without navigating between pages

### Current Behavior

- User views task in `TaskDetailModal`
- User has "Complete" and "Complete & Set Follow-Up" options
- "Complete & Set Follow-Up" opens `CreateTaskModal` for creating one follow-up task
- No option to start a sequence after task completion
- To start sequence, user must:
  1. Close modal
  2. Navigate to restaurant detail page
  3. Click "Start Sequence"
  4. Select sequence template

### Desired Behavior

**Add third quick complete option:**
- "Complete" - Just complete the task
- "Complete & Set Follow-Up" - Complete + create follow-up task (existing)
- **"Complete & Start Sequence" - Complete + start sequence for restaurant (NEW)**

**Flow:**
1. User clicks task to open `TaskDetailModal`
2. User expands quick complete dropdown
3. User selects "Complete & Start Sequence"
4. Task is marked complete
5. `StartSequenceModal` opens pre-filled with task's restaurant
6. User selects sequence template
7. Sequence starts
8. Modal closes, data refreshes

---

### Investigation Tasks

#### Task 2.1: Review Current Implementation

**Files to examine:**
- `/src/components/tasks/TaskDetailModal.tsx` (current implementation)
- `/src/components/tasks/EditTaskModal.tsx` (similar quick complete logic)
- `/src/components/sequences/SequenceTaskList.tsx` (has "Complete & Set Follow-up")
- `/src/components/sequences/StartSequenceModal.tsx`

**Questions to answer:**
1. Where is the quick complete dropdown in `TaskDetailModal`?
2. Does `TaskDetailModal` have access to restaurant data?
3. Can we open `StartSequenceModal` from `TaskDetailModal`?
4. Should this feature work for ALL tasks or only specific types?
5. Should this be available for sequence tasks or only standalone tasks?

#### Task 2.2: UI/UX Design Decisions

**Decisions needed:**
1. Where to place the "Complete & Start Sequence" option?
   - In the quick complete dropdown (like "Complete & Set Follow-Up")?
   - As a separate button in the modal?

2. Should there be a confirmation step?
   - "Task will be completed and sequence will start. Continue?"
   - Or directly open `StartSequenceModal`?

3. What if task is not associated with a restaurant?
   - Hide the option?
   - Show disabled option with tooltip "No restaurant associated"?

4. Should this work for tasks of all types or just certain types (e.g., demo_meeting)?

#### Task 2.3: Component Integration

**Files to modify:**
- `/src/components/tasks/TaskDetailModal.tsx`
- `/src/pages/Tasks.tsx` (if modal opened from here)
- `/src/pages/RestaurantDetail.jsx` (if modal opened from here)

**Questions to answer:**
1. How to pass `StartSequenceModal` state up to parent?
2. Should `TaskDetailModal` manage `StartSequenceModal` state internally?
3. How to refresh task list after completion + sequence start?
4. Should modal close immediately or wait for sequence to start?

#### Task 2.4: Implementation Estimate

After investigation, estimate:
- TaskDetailModal changes
- State management changes
- Modal integration
- Testing requirements
- **Total estimated time**

---

### Success Criteria

- [ ] "Complete & Start Sequence" option visible in TaskDetailModal
- [ ] Option only shown when task has associated restaurant
- [ ] Clicking option completes task successfully
- [ ] StartSequenceModal opens with restaurant pre-filled
- [ ] Sequence creation works as expected
- [ ] Task list refreshes after completion
- [ ] Sequence appears in restaurant's sequence list
- [ ] Works from both Tasks page and RestaurantDetail page
- [ ] Error handling for completion failures
- [ ] No duplicate task completion requests

---

## Feature 3: Start Sequence Option in Restaurants Page Tasks Column

### Feature Description

When a restaurant has no active tasks, the Tasks column in the Restaurants page currently only shows a "+" button to create a new task. Add an option to start a sequence instead.

### User Story

**As a** sales team member
**I want to** quickly start a sequence from the restaurants list
**So that** I don't have to create individual tasks for restaurants with no active tasks

### Current Behavior

**Restaurants Page (`/restaurants`):**
- Has a "Tasks" column showing task count or quick preview
- When restaurant has **no active tasks**, shows:
  - **"+" button** → Opens `CreateTaskModal`
- When restaurant has **active tasks**, shows:
  - Task count with link to restaurant detail

**Missing:**
- No way to start sequence from restaurants list
- Must navigate to RestaurantDetail page → Sequences tab → Start Sequence

### Desired Behavior

**When restaurant has no active tasks:**
- Show **dropdown button** or **split button** instead of simple "+" button
- Options:
  - "New Task" → Opens `CreateTaskModal`
  - "Start Sequence" → Opens `StartSequenceModal` with restaurant pre-filled

**When restaurant has active tasks:**
- Keep current behavior (show task count/preview)
- Consider adding sequence count badge (e.g., "2 tasks • 1 sequence")

---

### Investigation Tasks

#### Task 3.1: Locate Restaurants Page Implementation

**Files to find:**
- `/src/pages/Restaurants.jsx` (or `.tsx`)
- Related components for restaurant table/list
- Any custom columns components

**Questions to answer:**
1. Where is the Tasks column rendered?
2. Is it a component or inline JSX?
3. How is the "+" button currently implemented?
4. Does column have access to restaurant data needed for sequence?
5. How much space is available in the column?

#### Task 3.2: Review Tasks Column Logic

**Questions to answer:**
1. What defines "no active tasks"? (task count === 0? No tasks with status 'active'?)
2. Is task data fetched per restaurant or in bulk?
3. Is sequence data available in restaurants list query?
4. Would showing sequence count impact performance?
5. Should "no active tasks" consider sequence tasks or only standalone tasks?

#### Task 3.3: UI/UX Design Decisions

**Decisions needed:**
1. Button design for no active tasks:
   - **Option A:** Dropdown button (▼) showing "New Task" and "Start Sequence"
   - **Option B:** Split button ("+" for task | "▼" for sequence)
   - **Option C:** Icon buttons (📝 for task | 📋 for sequence)

2. When to show sequence option:
   - Always (even if restaurant has active tasks)?
   - Only when no active tasks?
   - Only for certain lead stages?

3. Space constraints:
   - Tasks column might be narrow
   - Need to fit both options without crowding

4. Should sequence count be shown?
   - "2 tasks • 1 sequence"
   - Or keep it simple with just task count?

#### Task 3.4: Modal Integration

**Questions to answer:**
1. Where should `StartSequenceModal` state live?
   - In Restaurants page component?
   - In a wrapper component for the table?
   - In the column cell component?

2. How to pass restaurant data to modal?
   - Already available in row data?
   - Need to fetch additional data?

3. After sequence starts:
   - Should tasks column update immediately?
   - Should sequence count appear?
   - Should row refresh?

#### Task 3.5: Implementation Estimate

After investigation, estimate:
- Restaurants page changes
- Tasks column component changes
- Modal integration
- Styling/responsive design
- Testing requirements
- **Total estimated time**

---

### Success Criteria

- [ ] When restaurant has no active tasks, multiple options visible
- [ ] "New Task" option opens CreateTaskModal (existing behavior preserved)
- [ ] "Start Sequence" option opens StartSequenceModal
- [ ] StartSequenceModal pre-filled with correct restaurant data
- [ ] Sequence creation works from restaurants list
- [ ] Tasks column updates after sequence starts (optional: shows sequence count)
- [ ] UI fits cleanly in available space
- [ ] Responsive design works on mobile/tablet
- [ ] Performance not impacted by additional buttons/logic
- [ ] Works consistently for all lead stages/statuses

---

## Investigation Workflow

### Phase 1: Quick Research (1-2 hours total)

**For each feature:**
1. Read files mentioned in investigation tasks
2. Take notes on current implementation
3. Identify potential blockers
4. Draft rough implementation approach

**Deliverable:** Initial findings summary for all three features

---

### Phase 2: Detailed Investigation (2-4 hours total)

**For each feature:**
1. Create proof-of-concept code snippets
2. Test current components with dev tools (inspect props, state)
3. Review database schema if needed
4. Identify all files that need changes

**Deliverable:** Detailed implementation plan with time estimates

---

### Phase 3: Implementation Planning (1 hour)

1. Prioritize features based on:
   - User impact
   - Implementation complexity
   - Dependencies
   - Risk

2. Create implementation timeline
3. Identify testing requirements
4. Document any breaking changes

**Deliverable:** Final implementation plan with timeline

---

## Key Files Reference

### Completed Work (Context)

**Sequence Components:**
- `/src/components/sequences/SequenceProgressCard.tsx` - Sequence instance card
- `/src/components/sequences/SequenceTaskList.tsx` - Task list within sequence
- `/src/components/sequences/SequenceDetailModal.tsx` - Detailed sequence view
- `/src/components/sequences/FinishSequenceDialog.tsx` - Finish sequence with options
- `/src/components/sequences/SelectRestaurantForSequenceModal.tsx` - Restaurant picker
- `/src/components/sequences/StartSequenceModal.tsx` - Start sequence for restaurant

**Task Components:**
- `/src/components/tasks/TaskDetailModal.tsx` - **KEY for Feature 2**
- `/src/components/tasks/CreateTaskModal.tsx`
- `/src/components/tasks/EditTaskModal.tsx`
- `/src/components/tasks/RestaurantTasksList.tsx`

**Pages:**
- `/src/pages/Sequences.tsx` - Main sequences page (tab-based)
- `/src/pages/RestaurantDetail.jsx` - Restaurant detail with tasks and sequences
- `/src/pages/Restaurants.jsx` - **KEY for Feature 3** - Restaurant list page
- `/src/pages/Tasks.tsx` - Tasks page

**Services:**
- `/src/services/sequence-instances-service.js` - **KEY for Feature 1** - Backend logic
- `/src/routes/sequence-instances-routes.js` - **KEY for Feature 1** - API routes

**Hooks:**
- `/src/hooks/useSequences.ts` - Sequence-related hooks
- `/src/hooks/useRestaurants.ts` - Restaurant data hook

---

## Questions to Answer Before Implementation

### General Architecture
1. Should all three features be implemented together or separately?
2. Are there shared components that could be created?
3. Are there database schema changes needed?
4. Are there breaking changes to existing APIs?

### Performance
1. Will bulk sequence creation impact database performance?
2. Should there be rate limiting for bulk operations?
3. How to handle very large bulk operations (100+ restaurants)?

### UX Consistency
1. Should all "Start Sequence" flows look identical?
2. Should success/error messaging be consistent across features?
3. Should modals have the same design language?

### Testing
1. Unit tests for new components?
2. Integration tests for bulk flows?
3. E2E tests for modal interactions?
4. Manual testing checklist?

---

## Risk Assessment

### Feature 1: Bulk Add Restaurants
**Complexity:** HIGH
**Risk:** MEDIUM
**Reason:** Requires backend changes, error handling for partial failures, complex UI for progress tracking

**Mitigation:**
- Start with limit of 10-20 restaurants
- Implement robust error handling
- Add progress feedback
- Consider transaction rollback strategy

---

### Feature 2: Complete & Start Sequence
**Complexity:** MEDIUM
**Risk:** LOW
**Reason:** Mostly frontend changes, leverages existing modals, clear user flow

**Mitigation:**
- Ensure modal state management is clean
- Test with various task types
- Verify restaurant data always available

---

### Feature 3: Start Sequence from Restaurants List
**Complexity:** LOW-MEDIUM
**Risk:** LOW
**Reason:** UI addition to existing page, leverages existing StartSequenceModal

**Mitigation:**
- Design for limited space
- Test responsive behavior
- Ensure performance not impacted

---

## Recommended Investigation Order

1. **Feature 3** - Start with easiest (low complexity, low risk)
2. **Feature 2** - Medium complexity, builds on Feature 3 learnings
3. **Feature 1** - Highest complexity, tackle last after understanding patterns

---

## Next Steps

1. **Read this document completely**
2. **Review prerequisite documents:**
   - SEQUENCE-ENHANCEMENTS-COMPLETE.md
   - sequences-page-refactoring-plan.md
3. **Start Phase 1 investigation** (quick research)
4. **Document findings** in this file or separate investigation notes
5. **Create detailed implementation plan** for chosen feature(s)
6. **Get approval** before starting implementation
7. **Implement** chosen feature(s)
8. **Test thoroughly**
9. **Update documentation**

---

## Investigation Notes

Use this section to document findings as you investigate:

### Feature 1 Findings

```
[Add notes here]
```

### Feature 2 Findings

```
[Add notes here]
```

### Feature 3 Findings

```
[Add notes here]
```

---

**Status:** 📋 **INVESTIGATION PHASE**
**Date Created:** November 23, 2025
**Last Updated:** November 23, 2025

---

**End of Investigation Guide**
