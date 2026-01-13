# Collapsible Animations - Registration Batches Feature

## Overview

Investigation of collapsible/expandable components in the Registration Batches feature that need animation class improvements.

---

## Components Already Correct

### 1. RegistrationBatchDetail.tsx - Progress Overview Section ✅

**File Path:** `src/pages/RegistrationBatchDetail.tsx`

**Lines:** 345-382

**Current Implementation:**
```tsx
<Collapsible open={isProgressOpen} onOpenChange={setIsProgressOpen}>
  <Card className="bg-card/50">
    <CollapsibleTrigger asChild>
      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
        {/* ... header content ... */}
        <ChevronsUpDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform duration-200",
          !isProgressOpen && "rotate-180"
        )} />
      </CardHeader>
    </CollapsibleTrigger>
    <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
      {/* ... content ... */}
    </CollapsibleContent>
  </Card>
</Collapsible>
```

**Status:** Correctly implemented with animations

---

## Components Needing Updates

### 1. RegistrationBatchDetail.tsx - Restaurant Table Row Expansion - HIGH PRIORITY

**File Path:** `src/pages/RegistrationBatchDetail.tsx`

**Lines:** 66-204 (RestaurantRow component)

**Current Implementation:**
```tsx
<TableRow className={cn('cursor-pointer', isExpanded && 'bg-muted/50')}>
  <TableCell onClick={onToggle}>
    {isExpanded ? (
      <ChevronDown className="h-4 w-4" />
    ) : (
      <ChevronRight className="h-4 w-4" />
    )}
  </TableCell>
  {/* ... other cells ... */}
</TableRow>

{/* Expanded details */}
{isExpanded && (
  <TableRow className="bg-muted/30">
    {/* ... expanded content ... */}
  </TableRow>
)}
```

**Issues:**
- Uses conditional rendering `{isExpanded && (...)}` - no animation
- Chevron icon uses conditional ChevronDown/ChevronRight instead of rotation
- Expanded row appears/disappears instantly

**Required Changes:**
- Wrap with `Collapsible` component using `asChild` prop for table structure
- Add animation classes to `CollapsibleContent`
- Use single ChevronDown with `transition-transform duration-200` and `-rotate-90`

---

### 2. ContactSearchRetryView.tsx - Restaurant Retry Row Expansion - HIGH PRIORITY

**File Path:** `src/components/registration-batch/ContactSearchRetryView.tsx`

**Lines:** 125-491 (RestaurantRetryRow component)

**Current Implementation:**
```tsx
<TableRow className="cursor-pointer" onClick={onToggleExpand}>
  <TableCell>
    {isExpanded ? (
      <ChevronDown className="h-4 w-4" />
    ) : (
      <ChevronRight className="h-4 w-4" />
    )}
  </TableCell>
  {/* ... other cells ... */}
</TableRow>

{/* Expanded retry panel */}
{isExpanded && (
  <TableRow className="bg-yellow-50/50">
    {/* ... form fields and buttons ... */}
  </TableRow>
)}
```

**Issues:**
- Uses conditional rendering `{isExpanded && (...)}` - no animation
- Chevron icon uses conditional rendering
- Contains nested conditional for `showManualEntry` state

**Required Changes:**
- Wrap expanded content in `Collapsible` component
- Add animation classes `data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden`
- Use rotation transform on chevron icon

---

### 3. CompanySelectionView.tsx - Restaurant Selection Row Expansion - HIGH PRIORITY

**File Path:** `src/components/registration-batch/CompanySelectionView.tsx`

**Lines:** 217-1022 (RestaurantSelectionRow component)

**Current Implementation:**
```tsx
<TableRow className={cn(isExpandable && 'cursor-pointer')}>
  <TableCell onClick={isExpandable ? onToggleExpand : undefined}>
    {isExpandable && (
      isExpanded ? (
        <ChevronDown className="h-4 w-4" />
      ) : (
        <ChevronRight className="h-4 w-4" />
      )
    )}
  </TableCell>
  {/* ... other cells ... */}
</TableRow>

{/* Expanded selection panel - Multiple candidates */}
{isExpanded && hasMultipleCandidates && (
  <TableRow className="bg-muted/30">
    {/* ... candidate cards ... */}
  </TableRow>
)}

{/* Expanded panel for single candidate */}
{isExpanded && hasSingleCandidate && (selection === 'skip' || selection === 'retry') && (
  <TableRow className={cn(...)}>
    {/* ... form content ... */}
  </TableRow>
)}

{/* Expanded retry panel - when no candidates found */}
{isExpanded && noCandidates && (
  <TableRow className="bg-yellow-50/50">
    {/* ... retry form ... */}
  </TableRow>
)}
```

**Issues:**
- Uses conditional rendering with multiple conditions for three different expanded states
- Chevron icon uses conditional ChevronDown/ChevronRight
- Complex nested conditionals for different states

**Required Changes:**
- Replace each conditional rendering block with `Collapsible` component
- Add animation classes to each expanded panel
- Use rotation transform on chevron icon

---

## Implementation Pattern

The correctly implemented pattern (from Progress Overview) should be replicated for table rows:

```tsx
<Collapsible open={isExpanded} asChild>
  <TableRow className="cursor-pointer">
    <TableCell>
      <ChevronDown className={cn(
        "h-4 w-4 transition-transform duration-200",
        !isExpanded && "-rotate-90"
      )} />
    </TableCell>
    {/* ... visible content ... */}
  </TableRow>
</Collapsible>

<Collapsible open={isExpanded} asChild>
  <TableRow className="border-0">
    <TableCell colSpan={X} className="p-0">
      <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
        {/* ... expanded content ... */}
      </CollapsibleContent>
    </TableCell>
  </TableRow>
</Collapsible>
```

---

## Summary

| Component | File | Priority | Action Required |
|-----------|------|----------|-----------------|
| Progress Overview | RegistrationBatchDetail.tsx | - | Already correct ✅ |
| Restaurant Row | RegistrationBatchDetail.tsx | HIGH | Convert to Collapsible |
| Retry Row | ContactSearchRetryView.tsx | HIGH | Convert to Collapsible |
| Selection Row | CompanySelectionView.tsx | HIGH | Convert to Collapsible |
