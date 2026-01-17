# Implementation Roadmap

## Overview

This roadmap breaks down the variable system enhancements into 5 phases, each deliverable independently and building upon the previous phase.

**Total Estimated Timeline:** 8-12 weeks
**Current Status:** Phase 1, 2 & 4 COMPLETE - 2025-11-26
**Next Phase:** Phase 5 (Enhanced Picker UI) - Optional

---

## Progress Summary

| Phase | Status | Completed Date |
|-------|--------|----------------|
| Phase 1: Standardize Variable Display | ✅ COMPLETE | 2025-11-26 |
| Phase 2: Click-to-Insert Functionality | ✅ COMPLETE | 2025-11-26 |
| Phase 3: Real-time Validation | ⏸️ DEFERRED | - |
| Phase 4: Dynamic Variables | ✅ COMPLETE | 2025-11-26 |
| Phase 5: Enhanced Picker UI | ⏳ PENDING | - |

---

## Prerequisites

### Technical Requirements
- ✅ Node.js environment configured
- ✅ React + TypeScript setup
- ✅ Supabase client configured
- ✅ Existing service layer (`variable-replacement-service.js`)
- ✅ UI component library (shadcn/ui)

### Knowledge Requirements
- Understanding of React hooks and refs
- Familiarity with variable-replacement-service.js
- Knowledge of Supabase queries and RLS
- Understanding of component patterns in existing codebase

### Development Environment
- Local development server running
- Access to Supabase dashboard
- Testing restaurant data available
- Sample city example customers for testing

---

## Phase 1: Standardize Variable Display ✅ COMPLETE

**Goal:** Replace all hardcoded variable lists with centralized VariableSelector component

**Priority:** HIGH
**Effort:** LOW (1 week)
**Dependencies:** None
**Status:** ✅ COMPLETE - 2025-11-26

### Tasks

#### 1.1: Create VariableSelector Component ✅
- [x] Create file: `src/components/ui/variable-selector.tsx`
- [x] Import `getAvailableVariables()` from client service
- [x] Implement basic rendering with categories
- [x] Use existing Badge and Label components
- [x] Add prop: `onVariableSelect` (for click-to-insert)
- [x] Add collapsible categories with chevron icons
- [x] Show variable count per category

**Code Location:**
```
src/components/ui/variable-selector.tsx (NEW)
src/services/variable-replacement-client.ts (NEW - frontend service)
```

#### 1.2: Update CreateMessageTemplateModal ✅
- [x] Import VariableSelector component
- [x] Remove hardcoded `availableVariables` array
- [x] Add VariableSelector in "Available Variables" section
- [x] Test modal opens and displays all variables

**Code Location:**
```
src/components/message-templates/CreateMessageTemplateModal.tsx (UPDATE)
```

#### 1.3: Update CreateTaskTemplateModal ✅
- [x] Import VariableSelector component
- [x] Replace hardcoded 6 variables text
- [x] Add VariableSelector below default message textarea

**Code Location:**
```
src/components/task-templates/CreateTaskTemplateModal.tsx (UPDATE)
```

#### 1.4: Update CreateTaskModal ✅
- [x] Import VariableSelector component
- [x] Replace hardcoded 6 variables text
- [x] Position below message textarea

**Code Location:**
```
src/components/tasks/CreateTaskModal.tsx (UPDATE)
```

#### 1.5: Update SequenceStepBuilder ✅
- [x] Import VariableSelector component
- [x] Add VariableSelector after custom message textarea
- [x] **CRITICAL FIX:** Variables now visible (was showing 0)

**Code Location:**
```
src/components/sequences/SequenceStepBuilder.tsx (UPDATE)
```

### Deliverables ✅

- ✅ VariableSelector component (reusable)
- ✅ variable-replacement-client.ts (frontend service)
- ✅ 4 components updated with standardized variables
- ✅ Collapsible categories for better organization
- ✅ Zero hardcoded variable lists

### Additional Improvements Made

**Variable List Optimized:**
- Reduced from 63 variables to ~30 useful variables
- Removed unused variables (address, phone, email, etc.)
- Organized into 7 logical categories

**Categories:**
1. Restaurant & Contact (6 vars) - expanded by default
2. Example Restaurants (4 vars) - expanded by default
3. Sales & Timing (1 var) - expanded by default
4. Qualification: Contact & Business (4 vars) - collapsed by default
5. Qualification: Tech & Operations (4 vars) - collapsed by default
6. Qualification: UberEats Metrics (5 vars) - collapsed by default
7. Qualification: Sales Strategy (6 vars) - collapsed by default

---

## Phase 2: Click-to-Insert Functionality ✅ COMPLETE

**Goal:** Enable clicking variables to insert them at cursor position

**Priority:** HIGH
**Effort:** MEDIUM (1-2 weeks)
**Dependencies:** Phase 1 complete
**Status:** ✅ COMPLETE - 2025-11-26

### Implementation Note

Instead of creating a separate `useVariableInsertion` hook as originally planned, we implemented click-to-insert directly in each component using refs. This approach:
- Reduces complexity
- Avoids an extra abstraction layer
- Works better with each component's specific state management

### Tasks

#### 2.1: Update VariableSelector for Click ✅
- [x] Add onClick handler to variable badges
- [x] Update badge styling for clickable appearance (hover:bg-primary)
- [x] Add cursor pointer on hover
- [x] Add "Click to insert" label when callback provided
- [x] Pass full variable syntax `{variable_name}` to callback

**Code Location:**
```
src/components/ui/variable-selector.tsx (UPDATE)
```

#### 2.2: Integrate in CreateMessageTemplateModal ✅
- [x] Add `useRef` import
- [x] Create ref for message_content textarea
- [x] Create `handleInsertVariable` function
- [x] Pass `onVariableSelect={handleInsertVariable}` to VariableSelector
- [x] Cursor repositions after insert

**Code Location:**
```
src/components/message-templates/CreateMessageTemplateModal.tsx (UPDATE)
```

#### 2.3: Integrate in CreateTaskTemplateModal ✅
- [x] Add `useRef` import
- [x] Create ref for default_message textarea
- [x] Create `handleInsertVariable` function
- [x] Wire up onVariableSelect

**Code Location:**
```
src/components/task-templates/CreateTaskTemplateModal.tsx (UPDATE)
```

#### 2.4: Integrate in CreateTaskModal ✅
- [x] Add `useRef` import
- [x] Create ref for message textarea
- [x] Create `handleInsertVariable` function
- [x] Wire up onVariableSelect

**Code Location:**
```
src/components/tasks/CreateTaskModal.tsx (UPDATE)
```

#### 2.5: Integrate in SequenceStepBuilder ✅
- [x] Add `useRef` import
- [x] Create ref for custom_message textarea
- [x] Create `handleInsertVariable` function
- [x] Wire up onVariableSelect
- [x] Works per-step correctly

**Code Location:**
```
src/components/sequences/SequenceStepBuilder.tsx (UPDATE)
```

### Deliverables ✅

- ✅ Click-to-insert in all 4 components
- ✅ Intuitive UX with hover states
- ✅ Cursor repositioning after insert
- ✅ "Click to insert" label when clickable

---

## Phase 3: Real-time Validation ⏸️ DEFERRED

**Goal:** Show real-time feedback on variable validity

**Priority:** MEDIUM → LOW (deferred)
**Effort:** LOW (1 week)
**Dependencies:** Phase 2 complete
**Status:** ⏸️ DEFERRED - Focus on Phase 4 first

### Reason for Deferral

Real-time validation is less critical now because:
1. Variable list is curated to only useful variables
2. Click-to-insert prevents typos
3. Phase 4 (dynamic variables) provides more immediate value

### Tasks (When Resumed)

#### 3.1: Add validateVariablesRealtime to Service
- [ ] Implement validateVariablesRealtime function in backend service
- [ ] Add hasVariables flag to result
- [ ] Export new function

#### 3.2: Add Validation UI to VariableSelector
- [ ] Add currentMessage prop
- [ ] Add showValidation prop
- [ ] Display validation status
- [ ] Highlight used variables
- [ ] Show unknown variables warning

#### 3.3-3.5: Enable Validation in Components
- [ ] Update all 4 components to pass currentMessage
- [ ] Test validation feedback

---

## Phase 4: Dynamic Variables ✅ COMPLETE

**Goal:** Implement {example_restaurant_1} and {example_restaurant_2} variables

**Priority:** HIGH
**Effort:** LOW (simplified to hardcoded approach)
**Dependencies:** Phase 2 complete
**Status:** ✅ COMPLETE - 2025-11-26

### Implementation Note

Originally planned to use a database table for managing example restaurants per city. **Simplified to hardcoded approach** for faster implementation:
- No database migration needed
- No admin UI needed
- No API routes needed
- Examples stored directly in `variable-replacement-service.js`

### Tasks ✅

#### 4.1: Add CITY_EXAMPLE_RESTAURANTS Constant ✅
- [x] Added hardcoded example restaurants for 7 major NZ cities
- [x] Each city has 2 example restaurants with name and URL

**Cities covered:**
- Auckland (Sidart, Depot Eatery)
- Wellington (Logan Brown, Charley Noble)
- Christchurch (Inati, Twenty Seven Steps)
- Hamilton (Palate, Gothenburg)
- Tauranga (Harbourside, Macau)
- Dunedin (Plato, No 7 Balmac)
- Queenstown (Rata, Botswana Butchery)

#### 4.2: Add getExampleRestaurantsForCity Function ✅
- [x] Case-insensitive city matching
- [x] Falls back to Auckland if city not found

#### 4.3: Add Variable Mappings ✅
- [x] `example_restaurant_1` - Returns first example restaurant name
- [x] `example_restaurant_1_url` - Returns first example restaurant URL
- [x] `example_restaurant_2` - Returns second example restaurant name
- [x] `example_restaurant_2_url` - Returns second example restaurant URL

#### 4.4: Update getAvailableVariables ✅
- [x] Added "Example Restaurants" category to backend function

**Code Location:**
```
src/services/variable-replacement-service.js (UPDATE)
```

### Deliverables ✅

- ✅ 4 new dynamic variables working
- ✅ City-based example lookup
- ✅ Graceful fallback (Auckland) for unknown cities
- ✅ No database required - simple code change

### Future Enhancement (Optional)

If admin needs to manage examples dynamically in the future:
1. Create `city_example_customers` database table
2. Build admin UI for CRUD operations
3. Replace `CITY_EXAMPLE_RESTAURANTS` constant with database lookups

---

## Phase 5: Enhanced Picker UI ⏳ PENDING

**Goal:** Add search, category filters, and favorites

**Priority:** LOW
**Effort:** MEDIUM (2 weeks)
**Dependencies:** Phase 4 complete
**Status:** ⏳ PENDING

### Partially Implemented

Some features from Phase 5 were already implemented during Phase 1:
- ✅ Collapsible categories
- ✅ Variable count per category
- ✅ Better organization

### Remaining Tasks

#### 5.1: Add Search Functionality
- [ ] Add search input at top of VariableSelector
- [ ] Filter variables by name and description
- [ ] Debounce search for performance

#### 5.2: Add Recent Variables
- [ ] Track last 10 used variables
- [ ] Show "Recent" section at top
- [ ] Persist in local storage

#### 5.3: Add Favorites
- [ ] Add star icon to each variable
- [ ] Toggle favorite on click
- [ ] Show "Favorites" section at top
- [ ] Persist in local storage

---

## Files Modified/Created Summary

### New Files Created
```
src/components/ui/variable-selector.tsx
src/services/variable-replacement-client.ts
```

### Files Updated
```
src/components/message-templates/CreateMessageTemplateModal.tsx
src/components/task-templates/CreateTaskTemplateModal.tsx
src/components/tasks/CreateTaskModal.tsx
src/components/sequences/SequenceStepBuilder.tsx
```

---

## Next Steps

### Optional (Phase 5)
1. Add search to variable picker
2. Add recent/favorites tracking
3. (Deferred) Real-time validation

### Future Enhancement
If dynamic management of example restaurants is needed:
1. Create `city_example_customers` database table
2. Build admin UI
3. Migrate from hardcoded to database

---

**Last Updated:** 2025-11-26
**Current Phase:** Complete (Phases 1, 2, 4)
**Remaining:** Phase 3 (Deferred), Phase 5 (Optional)
