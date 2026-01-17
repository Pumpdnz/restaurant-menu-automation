# Task 7: Tasks & Sequences Feature Flagging - Investigation Report

**Task Name**: Tasks & Sequences Feature Flagging  
**Phase**: Super Admin Dashboard Phase 4  
**Investigation Date**: December 8, 2025  
**Status**: **NOT STARTED** (Partial backend infrastructure exists)

---

## Executive Summary

Task 7 requires frontend UI integration with feature flags to conditionally render Tasks and Sequences functionality. While the feature flag infrastructure exists in the super admin panel and is stored in the database, **no frontend hook or conditional rendering logic has been implemented** to check and enforce these feature flags in the user-facing UI.

---

## Current Implementation Status

### What Has Been Implemented

1. **Feature Flag Definition** (COMPLETE)
   - `tasksAndSequences` flag is defined in `FeatureFlagsEditor.tsx`
   - Located at: `/UberEats-Image-Extractor/src/components/super-admin/organizations/FeatureFlagsEditor.tsx`
   - Lines 40 & 82 - Feature label and description defined
   - Super admins can enable/disable this flag per organization
   - Flag is stored in database `organisations.feature_flags` column

2. **Feature Flag Storage** (COMPLETE)
   - Organizations table stores `feature_flags` JSON object
   - Default flags created in `OrganizationCreateModal.tsx`
   - Super admin can edit flags via `FeatureFlagsEditor` component
   - Database persistence verified in OrganizationEditModal and OrganizationCreateModal

3. **Tasks & Sequences Pages/Components** (COMPLETE)
   - `/src/pages/Tasks.tsx` - Fully implemented tasks page
   - `/src/pages/Sequences.tsx` - Fully implemented sequences page
   - `/src/pages/RestaurantDetail.jsx` - Contains Tasks & Sequences tab (line 3047)
   - `/src/components/tasks/` - Multiple task-related components
   - `/src/components/sequences/` - Sequence-related components
   - Navigation sidebar currently shows Tasks/Sequences unconditionally

### What is Missing

#### 1. useFeatureFlags Hook (NOT STARTED)
**Required File**: `/src/hooks/useFeatureFlags.ts`
- Hook does not exist
- Should fetch feature flags from user's organization
- Should provide `isFeatureEnabled(featurePath)` function
- Should have loading state
- Requires AuthContext extension to include organization data

#### 2. Navigation Sidebar Conditional Rendering (NOT STARTED)
**File**: `/src/components/navigation/NavigationItems.jsx`
- **Current Status**: Lines 36-37 show Tasks and Sequences unconditionally
- Tasks menu item: `{ href: '/tasks', label: 'Tasks', icon: CheckSquare }`
- Sequences menu item: `{ href: '/sequences', label: 'Sequences', icon: Workflow }`
- **Required Change**: Wrap these items with conditional logic based on feature flag
- **Missing**: useFeatureFlags hook import and usage

#### 3. Restaurants.jsx Sales Column Filtering (NOT STARTED)
**File**: `/src/pages/Restaurants.jsx`
- **Current Status**: All sales columns visible unconditionally
- Sales-related columns include:
  - Lead Type (line 885)
  - Lead Category (line 886)
  - Lead Status (line 887)
  - Warmth (line 888)
  - Stage (line 889)
  - Tasks (line 890)
  - ICP Rating (line 895)
  - Demo Store (line 898)
  - Last Contact (line 903)
- **Required Change**: Conditionally show/hide these columns based on tasksAndSequences flag
- **Missing**: useFeatureFlags hook integration

#### 4. RestaurantDetail.jsx Tab Conditional Rendering (NOT STARTED)
**File**: `/src/pages/RestaurantDetail.jsx`
- **Current Status**: Tasks & Sequences tab always visible
- Tab trigger at line 3047: `<TabsTrigger value="tasks-sequences" size="full">Tasks and Sequences</TabsTrigger>`
- Tab content at lines 4345-4500: Full Tasks & Sequences section
- **Required Change**: Hide entire tab when feature flag disabled
- **Missing**: useFeatureFlags hook integration

#### 5. RestaurantDetail.jsx Sales Info Card (NOT STARTED)
**File**: `/src/pages/RestaurantDetail.jsx`
- **Current Status**: Sales information always visible on Overview tab
- Need to locate and hide Sales info card when feature disabled
- **Missing**: useFeatureFlags hook integration and card identification

---

## Files Examined

### Core Files
1. `/UberEats-Image-Extractor/src/components/navigation/NavigationItems.jsx` - 94 lines
   - Navigation sidebar component
   - No feature flag logic present

2. `/UberEats-Image-Extractor/src/pages/Restaurants.jsx` - 1,215 lines
   - Sales columns not conditionally rendered
   - Feature flag integration missing

3. `/UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx` - 284.6 KB (large file)
   - Tasks & Sequences tab not conditionally rendered
   - Sales info card location needs identification

4. `/UberEats-Image-Extractor/src/pages/Tasks.tsx` - 100+ lines
   - No feature flag logic needed for this page itself

5. `/UberEats-Image-Extractor/src/context/AuthContext.tsx` - 420 lines
   - Currently only provides user/role/organization info
   - Does not provide organization's feature_flags
   - Extension needed to include feature flags

### Feature Flag Infrastructure
6. `/UberEats-Image-Extractor/src/components/super-admin/organizations/FeatureFlagsEditor.tsx` - 330 lines
   - Feature flag UI editor
   - Defines `tasksAndSequences` flag (lines 40, 82)
   - Shows flag can be toggled per organization

7. `/UberEats-Image-Extractor/src/components/super-admin/organizations/OrganizationCreateModal.tsx` - 300+ lines
   - Creates organizations with feature flags
   - Flag values stored in database

8. `/UberEats-Image-Extractor/src/components/super-admin/organizations/OrganizationEditModal.tsx`
   - Allows editing organization feature flags

### Reference Documentation
9. `/planning/database-plans/authentication-plans/super-admin-project/SUPER-ADMIN-PHASE-4-IMPLEMENTATION.md` - Lines 1382-1540+
   - Complete specifications for Task 7
   - Contains hook interface definitions
   - Shows implementation examples

---

## Required Implementations

### Step 1: Create useFeatureFlags Hook
**File**: `/src/hooks/useFeatureFlags.ts`

Should implement:
- Fetch feature flags from user's organization via Supabase
- Provide `isFeatureEnabled(featurePath)` function supporting dot notation
- Handle loading state
- Cache results appropriately

Requires AuthContext to expose `user.organisation?.feature_flags` or similar

### Step 2: Update AuthContext
**File**: `/src/context/AuthContext.tsx`

Should be extended to:
- Include full organization object in UserProfile type
- Or specifically include `feature_flags` in organization data
- Fetch organization feature_flags when loading profile

### Step 3: Update Navigation Sidebar
**File**: `/src/components/navigation/NavigationItems.jsx`

Required changes:
- Import useFeatureFlags hook
- Wrap Tasks item with `{isFeatureEnabled('tasksAndSequences') && ...}`
- Wrap Sequences item with `{isFeatureEnabled('tasksAndSequences') && ...}`
- Handle loading state appropriately

### Step 4: Update Restaurants Page
**File**: `/src/pages/Restaurants.jsx`

Required changes:
- Import useFeatureFlags hook
- Create utility function to determine which columns to show
- Conditionally render/hide sales columns when flag disabled
- Update column headers and table cell rendering logic
- Update min-width calculations to accommodate dynamic columns

### Step 5: Update RestaurantDetail Tab
**File**: `/src/pages/RestaurantDetail.jsx`

Required changes:
- Import useFeatureFlags hook
- Conditionally render TabsTrigger for Tasks & Sequences (line 3047)
- Conditionally render TabsContent for Tasks & Sequences (lines 4345-4500)
- Locate and hide Sales Info card on Overview tab when flag disabled

---

## Dependencies & Blockers

1. **AuthContext Enhancement Required**
   - Current AuthContext doesn't expose organization feature_flags
   - useFeatureFlags hook depends on this being available
   - May need to modify UserProfile type definition

2. **Performance Consideration**
   - Feature flags could be cached at app startup
   - Consider avoiding per-component refetching

3. **Loading States**
   - Navigation sidebar needs to handle loading state gracefully
   - May show loading skeleton while flags load

---

## Implementation Complexity

- **useFeatureFlags Hook**: LOW (straightforward Supabase query)
- **Navigation Sidebar**: LOW (simple conditional rendering)
- **Restaurants Page**: MEDIUM (multiple columns to conditionally hide)
- **RestaurantDetail Tab**: LOW (simple conditional rendering)
- **RestaurantDetail Sales Card**: LOW-MEDIUM (depends on card location)

**Total Estimated Effort**: 3-4 hours (matching original estimate)

---

## Testing Recommendations

1. Create test organization with `tasksAndSequences` disabled
2. Verify Tasks/Sequences don't appear in sidebar
3. Verify sales columns hidden on Restaurants page
4. Verify Tasks & Sequences tab hidden on RestaurantDetail
5. Verify Sales info card hidden on RestaurantDetail Overview
6. Test with feature enabled to ensure everything shows correctly
7. Test loading states during flag fetch

---

## Recommendation for Next Steps

1. **First Priority**: Create useFeatureFlags hook and extend AuthContext
   - This unblocks all other UI components
   - Simple, isolated change
   - Can be tested independently

2. **Second Priority**: Update Navigation Sidebar
   - Most visible change
   - Lowest complexity
   - Validates hook is working

3. **Third Priority**: Update Restaurants page
   - More complex due to multiple columns
   - Can leverage hook from Step 1

4. **Fourth Priority**: Update RestaurantDetail
   - Most complex file due to size
   - May need to identify exact locations of Sales card
   - Can be done in two sub-tasks (tab + card)

---

## Notes

- The tasksAndSequences feature flag is described as "UI only" in the plan (line 1385)
- No usage tracking or billing calculations needed
- Focus is purely on showing/hiding UI elements based on flag state
- Feature flag infrastructure is solid; only UI integration is missing
