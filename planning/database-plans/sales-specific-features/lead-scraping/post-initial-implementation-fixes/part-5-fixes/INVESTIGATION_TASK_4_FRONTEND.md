## Frontend Components Investigation Findings

### Progress Display

**ScrapeJobProgressCard.tsx:178**
- Code: `{job.total_steps || 5}` - Shows "of 5" as default fallback
- Status: Uses dynamic `total_steps` field with fallback

**LeadScrapeDetail.tsx:340**
- Code: `{job.total_steps || 5}` - Shows "of 5" as default fallback
- Status: Uses dynamic `total_steps` field with fallback

### Progress Calculation Logic

**ScrapeJobProgressCard.tsx (lines 70-77)**:
```typescript
function calculateProgress(job: LeadScrapeJob): number {
  if (!job.steps || job.steps.length === 0) return 0;
  if (job.total_steps === 0) return 0;
  const completedSteps = job.steps.filter((s: any) => s.status === 'completed').length;
  return Math.round((completedSteps / job.total_steps) * 100);
}
```
- Uses `job.total_steps` dynamically - NOT hardcoded
- Safe for variable step counts

**LeadScrapeDetail.tsx (lines 102-109)**:
- Identical logic using `total_steps`

### Step 5 References

**No hardcoded Step 5 references found in frontend components.**

The frontend does NOT contain:
- Any hardcoded "Step 5" labels or descriptions
- Any conditional logic based on `step_number === 5`
- Any step-specific UI for Step 5 (Contact Enrichment)
- Any assumptions that Step 5 will execute

### Contact Fields Display

Contact fields are displayed in **THREE** locations and are NOT tied to Step 5:

1. **ScrapeJobStepDetailModal.tsx (lines 194-196)**
   - Shows in expanded lead details panel
   - Displays: `contact_name`, `contact_email`, `contact_phone`
   - Condition: Always shown if fields have values

2. **LeadDetailModal.tsx (lines 870-901 in view mode)**
   - Shows "Contact Person" section
   - Displays: `contact_name` (with role), `contact_email`, `contact_phone`
   - Condition: Only shown if any of these fields are populated

3. **LeadDetailModal.tsx (lines 525-572 in edit mode)**
   - Full edit form for contact fields
   - Condition: Always editable

**Impact**: Contact fields will remain visible and editable even if Step 5 is not executed. They can be populated via manual entry or other means.

### Required Changes

**MINIMAL CHANGES NEEDED:**

1. **ScrapeJobProgressCard.tsx:178**
   - FROM: `${job.total_steps || 5}`
   - TO: `${job.total_steps || 4}` (or remove fallback entirely)

2. **LeadScrapeDetail.tsx:340**
   - FROM: `${job.total_steps || 5}`
   - TO: `${job.total_steps || 4}` (or remove fallback entirely)

**NO CHANGES NEEDED FOR:**
- Contact field displays (they're independent)
- Progress calculations (already use `total_steps` dynamically)
- Step list rendering (uses actual `steps` array length)
- Lead detail modals (no step 5 specific logic)
