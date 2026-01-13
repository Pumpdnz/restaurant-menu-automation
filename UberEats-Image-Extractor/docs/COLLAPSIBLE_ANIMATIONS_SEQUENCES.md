# Collapsible Animations - Sequences Feature

## Overview

Investigation of collapsible/expandable components in the Sequences feature that need animation class improvements.

---

## All Components Updated ✅

### 1. SequenceTaskList.tsx ✅

**File Path:** `src/components/sequences/SequenceTaskList.tsx`

**Status:** Completed

**Changes Made:**
- Lines 398-522: Uses `Collapsible` wrapper with proper animation classes
- Line 414: Has `CollapsibleContent` with animation classes: `data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden`
- Lines 405-410: ChevronDown icon uses transition-transform with conditional rotation

### 2. SequenceProgressCard.tsx ✅

**File Path:** `src/components/sequences/SequenceProgressCard.tsx`

**Status:** No changes needed - delegates to SequenceTaskList

### 3. SequenceStepBuilder.tsx ✅

**File Path:** `src/components/sequences/SequenceStepBuilder.tsx`

**Status:** Completed

**Changes Made:**
- Added imports for `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`, and `cn`
- Removed `ChevronRight` import (now using single ChevronDown with rotation)
- Wrapped component with `Collapsible` using `open={!isCollapsed}` state
- Added `CollapsibleTrigger` for the chevron button
- Added clickable collapsed summary that also triggers expand
- Wrapped form fields in `CollapsibleContent` with animation classes
- ChevronDown now uses `transition-transform duration-200` with `-rotate-90` when collapsed

### 4. SequenceTemplateCard.tsx ✅

**File Path:** `src/components/sequences/SequenceTemplateCard.tsx`

**Status:** Completed

**Changes Made:**
- Added imports for `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`, and `cn`
- Removed `ChevronRight` import (now using single ChevronDown with rotation)
- Wrapped Card with `Collapsible` component
- Added `CollapsibleTrigger` around the expand button
- ChevronDown now uses `transition-transform duration-200` with `-rotate-90` when collapsed
- Replaced conditional `{expanded && (...)}` with `CollapsibleContent` with animation classes

---

## Components Not Needing Changes

| Component | File | Reason |
|-----------|------|--------|
| EditSequenceTemplateModal.tsx | src/components/sequences/ | Form modal - no collapsible components |
| CreateSequenceTemplateModal.tsx | src/components/sequences/ | Form modal - no collapsible components |
| SequenceDetailModal.tsx | src/components/sequences/ | Static display only |
| BulkStartSequenceModal.tsx | src/components/sequences/ | Conditional rendering for operation states only |
| StartSequenceModal.tsx | src/components/sequences/ | Static modal layout |
| FinishSequenceDialog.tsx | src/components/sequences/ | Uses RadioGroup, not collapsible |
| SelectRestaurantForSequenceModal.tsx | src/components/sequences/ | List selection interface |

---

## Summary

| Component | Status |
|-----------|--------|
| SequenceTaskList.tsx | ✅ Completed |
| SequenceProgressCard.tsx | ✅ No changes needed |
| SequenceStepBuilder.tsx | ✅ Completed |
| SequenceTemplateCard.tsx | ✅ Completed |
