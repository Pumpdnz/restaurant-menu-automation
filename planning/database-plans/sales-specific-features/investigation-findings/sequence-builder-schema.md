# Investigation 4: Sequence Builder Database Schema

**Status:** ✅ Complete
**Date:** November 22, 2025
**Time Spent:** 30 minutes
**Files Investigated:**
- `/database-schemas/sequence_steps.sql`
- `/src/components/sequences/SequenceStepBuilder.tsx` (426 lines)

---

## Summary

The `sequence_steps` table **does NOT have a `subject_line` column**. The `SequenceStepBuilder` component **does NOT include `demo_meeting` as a task type**. Both additions are needed for Feature 4. The type constraint check and TypeScript interface both need updating.

---

## 1. Database Schema Analysis

### Current sequence_steps Table (Lines 1-68)
```sql
create table public.sequence_steps (
  id uuid not null default extensions.uuid_generate_v4 (),
  sequence_template_id uuid not null,
  step_order integer not null,
  name text not null,
  description text null,
  task_template_id uuid null,
  type text not null,
  priority text not null default 'medium'::text,
  message_template_id uuid null,
  custom_message text null,                         -- Message content
  delay_value integer not null default 0,
  delay_unit text not null default 'days'::text,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  -- NO subject_line column ❌
);
```

### Missing Column
❌ **`subject_line TEXT NULL`** - Not present in schema

### Current Type Constraint (Lines 23-35)
```sql
constraint sequence_steps_type_check check (
  (
    type = any (
      array[
        'internal_activity'::text,
        'social_message'::text,
        'text'::text,
        'email'::text,
        'call'::text
      ]
    )
  )
)
```

**Missing from constraint:**
❌ `'demo_meeting'::text`

### Existing Constraints
✅ `sequence_steps_pkey` - Primary key on id
✅ `sequence_steps_unique_order` - Unique constraint on (sequence_template_id, step_order)
✅ `sequence_steps_sequence_template_id_fkey` - FK to sequence_templates
✅ `sequence_steps_task_template_id_fkey` - FK to task_templates
✅ `sequence_steps_message_template_id_fkey` - FK to message_templates
✅ `sequence_steps_step_order_check` - step_order > 0
✅ `sequence_steps_type_check` - Type must be in allowed list
✅ `sequence_steps_priority_check` - Priority must be low/medium/high
✅ `sequence_steps_delay_value_check` - delay_value >= 0
✅ `sequence_steps_description_check` - length(description) <= 500
✅ `sequence_steps_name_check` - length(name) between 3 and 100
✅ `sequence_steps_delay_unit_check` - delay_unit must be minutes/hours/days

### Indexes
✅ `idx_sequence_steps_template` - On sequence_template_id
✅ `idx_sequence_steps_template_order` - On (sequence_template_id, step_order)
✅ `idx_sequence_steps_task_template` - On task_template_id (where not null)

### Triggers
✅ `update_sequence_steps_updated_at` - Auto-updates updated_at timestamp

---

## 2. SequenceStepBuilder Component Analysis

### TypeScript Interface (Lines 17-28)
```typescript
export interface StepFormData {
  step_order: number;
  name: string;
  description?: string;
  task_template_id?: string;
  type: 'internal_activity' | 'social_message' | 'text' | 'email' | 'call';
  priority: 'low' | 'medium' | 'high';
  message_template_id?: string;
  custom_message?: string;
  delay_value: number;
  delay_unit: 'minutes' | 'hours' | 'days';

  // NO subject_line property ❌
  // NO demo_meeting in type union ❌
}
```

### Missing from Interface
❌ `subject_line?: string;`
❌ `type: ... | 'demo_meeting'`

### Type Selector UI (Lines 321-338)
```jsx
<Select
  value={step.type}
  onValueChange={handleTypeChange}
>
  <SelectTrigger className="mt-1">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="email">Email</SelectItem>
    <SelectItem value="call">Call</SelectItem>
    <SelectItem value="text">Text</SelectItem>
    <SelectItem value="social_message">Social Message</SelectItem>
    <SelectItem value="internal_activity">Internal Activity</SelectItem>

    {/* NO demo_meeting option ❌ */}
  </SelectContent>
</Select>
```

### Message Template Conditional (Lines 89, 277-317)
```typescript
// Line 89: Which types show message template selector
const showMessageTemplates = ['email', 'text', 'social_message'].includes(step.type);

// Lines 277-317: Message template selector
{showMessageTemplates && (
  <div>
    <Label htmlFor={`step-message-template-${index}`} className="text-xs">
      Message Template (optional)
    </Label>
    <Select
      value={step.message_template_id || 'none'}
      onValueChange={handleMessageTemplateChange}
      disabled={messageTemplatesLoading}
    >
      {/* Message template options */}
    </Select>
  </div>
)}
```

**Note:** `demo_meeting` would need special handling - shows QualificationForm instead of message template

---

## 3. Required Database Migration

### Migration File to Create
**File:** `supabase/migrations/YYYYMMDD_add_subject_line_to_sequence_steps.sql`

```sql
-- Add subject_line column to sequence_steps table
ALTER TABLE public.sequence_steps
  ADD COLUMN subject_line TEXT NULL;

COMMENT ON COLUMN public.sequence_steps.subject_line IS
  'Email subject line for email type sequence steps (supports variable replacement)';

-- Update the type constraint to include demo_meeting
ALTER TABLE public.sequence_steps
  DROP CONSTRAINT sequence_steps_type_check;

ALTER TABLE public.sequence_steps
  ADD CONSTRAINT sequence_steps_type_check CHECK (
    (
      type = any (
        array[
          'internal_activity'::text,
          'social_message'::text,
          'text'::text,
          'email'::text,
          'call'::text,
          'demo_meeting'::text
        ]
      )
    )
  );
```

### Migration Risk Assessment
✅ **Low Risk Migration**
- Adding nullable column (won't break existing rows)
- Dropping and recreating constraint is safe
- No data transformation needed
- Backward compatible (existing rows get NULL)

---

## 4. Required Frontend Changes

### 1. Update StepFormData Interface
```typescript
// /src/components/sequences/SequenceStepBuilder.tsx (Line 17-28)
export interface StepFormData {
  step_order: number;
  name: string;
  description?: string;
  task_template_id?: string;
  type: 'internal_activity' | 'social_message' | 'text' | 'email' | 'call' | 'demo_meeting';
  priority: 'low' | 'medium' | 'high';
  message_template_id?: string;
  custom_message?: string;
  subject_line?: string; // NEW
  delay_value: number;
  delay_unit: 'minutes' | 'hours' | 'days';
}
```

### 2. Add demo_meeting to Type Selector
```jsx
// Line 331-338
<SelectContent>
  <SelectItem value="email">Email</SelectItem>
  <SelectItem value="call">Call</SelectItem>
  <SelectItem value="text">Text</SelectItem>
  <SelectItem value="social_message">Social Message</SelectItem>
  <SelectItem value="internal_activity">Internal Activity</SelectItem>
  <SelectItem value="demo_meeting">Demo Meeting</SelectItem> {/* NEW */}
</SelectContent>
```

### 3. Add Subject Line Input (Conditional on email type)
```jsx
// Insert after Message Template selector (after line 317)
{step.type === 'email' && (
  <div>
    <Label htmlFor={`step-subject-${index}`} className="text-xs">
      Email Subject (optional)
    </Label>
    <Input
      id={`step-subject-${index}`}
      placeholder="e.g., Demo booking confirmation (supports variables)"
      value={step.subject_line || ''}
      onChange={(e) => onChange(index, 'subject_line', e.target.value)}
      className="mt-1"
    />
    <p className="text-xs text-muted-foreground mt-1">
      Supports variables like {'{restaurant_name}'}, {'{contact_name}'}
    </p>
  </div>
)}
```

### 4. Update Message Template Conditional
```typescript
// Line 89 - Add check for demo_meeting qualification form vs message template
const showMessageTemplates = ['email', 'text', 'social_message'].includes(step.type);
const showQualificationForm = step.type === 'demo_meeting';
```

### 5. Add Qualification Form for demo_meeting Type
```jsx
// Insert after message template selector section
{showQualificationForm && (
  <div className="col-span-full">
    <Label className="text-xs mb-2 block">Demo Qualification Details</Label>
    <div className="p-4 border rounded-md bg-muted/30">
      <p className="text-xs text-muted-foreground mb-3">
        Qualification data will be collected when this step is executed during sequence.
        Leave blank to skip qualification for this demo booking.
      </p>
      <p className="text-xs text-muted-foreground">
        Note: Qualification fields can be pre-filled in the task template if needed.
      </p>
    </div>
  </div>
)}
```

**Alternatively:** Include mini QualificationForm in sequence step builder
```jsx
{showQualificationForm && (
  <div className="col-span-full">
    <Label className="text-xs mb-2 block">Demo Qualification (Optional)</Label>
    <QualificationForm
      data={step.qualification_metadata || {}}
      onChange={(field, value) => {
        // Store qualification data in metadata JSONB field
        onChange(index, 'metadata', {
          ...step.metadata,
          qualification: {
            ...(step.metadata?.qualification || {}),
            [field]: value
          }
        });
      }}
    />
  </div>
)}
```

---

## 5. Backend Service Changes

### sequence-templates-service.js Updates Needed
**Ensure subject_line is included in:**
1. `createSequenceTemplate()` - Include subject_line in step insertion
2. `updateSequenceTemplate()` - Include subject_line in step updates
3. `getSequenceTemplateById()` - Return subject_line in step data

### sequence-instances-service.js Updates Needed
**When executing sequence steps:**
1. Apply variable replacement to `subject_line` (if email type)
2. Pass subject_line to task creation
3. Handle demo_meeting type qualification sync

**Example:**
```javascript
// When creating task from sequence step
if (step.type === 'email' && step.subject_line) {
  taskData.subject_line = replaceVariables(step.subject_line, {
    restaurant: restaurant,
    sequence: sequenceInstance
  });
}

// When creating demo_meeting task
if (step.type === 'demo_meeting' && step.metadata?.qualification) {
  // Sync qualification data to restaurant record
  await updateRestaurantQualification(restaurantId, step.metadata.qualification);
}
```

---

## 6. Data Flow for demo_meeting Type

### Sequence Template Creation
```
1. User creates sequence template
2. Adds demo_meeting step
3. (Optional) Fills qualification form
4. Qualification data stored in step.metadata.qualification
5. Step saved with type='demo_meeting'
```

### Sequence Execution
```
1. Sequence instance started for restaurant
2. demo_meeting step reached
3. Task created with type='demo_meeting'
4. If step.metadata.qualification exists:
   - Sync to restaurant qualification fields
   - Mark fields as pre-filled
5. Task assigned to sales rep
6. Sales rep opens task
7. TaskTypeQuickView shows QualificationForm
8. Sales rep completes/updates qualification
9. Data synced back to restaurant on task completion
```

---

## 7. Alternative: Use metadata Field for subject_line

### Option: Store subject_line in metadata JSONB
**Instead of adding column, could use existing `metadata` field:**

```typescript
// In sequence step
step.metadata = {
  subject_line: "Demo booking confirmation",
  qualification: { /* qual data */ }
}
```

**Pros:**
- No migration needed
- Flexible structure
- Can add more fields later

**Cons:**
- Less explicit in schema
- Harder to query/filter
- Inconsistent with other tables (tasks, task_templates, message_templates all have subject_line column)

**Recommendation:** ❌ Do NOT use metadata
- Use dedicated column for consistency with other tables
- Migration is low-risk
- Better type safety and documentation

---

## 8. Testing Scenarios

**Test 1: Add subject_line to sequence step**
- Create new sequence template
- Add email step
- Enter subject line
- Save template
- Verify subject_line stored in database

**Test 2: Execute sequence with subject**
- Start sequence instance
- Wait for email step
- Check task created
- Verify task.subject_line populated
- Verify variables replaced

**Test 3: Add demo_meeting step**
- Create sequence template
- Add demo_meeting step
- Fill qualification form (optional)
- Save template
- Start sequence
- Verify demo_meeting task created
- Verify qualification data synced

**Test 4: Backward compatibility**
- Load existing sequence template (created before migration)
- Verify no errors
- Add new step with subject
- Save successfully
- Old steps have subject_line=null

**Test 5: Type constraint**
- Try to insert invalid type in database directly
- Expect constraint violation
- Verify demo_meeting allowed
- Verify invalid values rejected

---

## 9. Implementation Checklist

### Database (30 minutes)
- [ ] Create migration file
- [ ] Add subject_line column
- [ ] Update type constraint to include demo_meeting
- [ ] Test migration on dev environment
- [ ] Apply migration to production

### Frontend (2 hours)
- [ ] Update StepFormData interface
- [ ] Add demo_meeting to type selector
- [ ] Add subject_line input (conditional on email type)
- [ ] Add QualificationForm for demo_meeting type
- [ ] Update onChange handlers
- [ ] Test all field combinations

### Backend (1 hour)
- [ ] Update sequence-templates-service.js
- [ ] Update sequence-instances-service.js
- [ ] Add variable replacement for subject_line
- [ ] Add qualification sync for demo_meeting
- [ ] Test sequence execution

### Testing (1 hour)
- [ ] Test subject_line creation
- [ ] Test subject_line in sequence execution
- [ ] Test demo_meeting step creation
- [ ] Test demo_meeting execution
- [ ] Test qualification sync
- [ ] Test backward compatibility

**Total Estimated Time:** 4-5 hours

---

## 10. Gotchas & Edge Cases

⚠️ **Type constraint update** - Must DROP constraint before ADD (can't just ALTER)
⚠️ **Existing sequences** - Will have subject_line=NULL (safe, handled gracefully)
⚠️ **Variable replacement** - Must handle subject_line in sequence execution
⚠️ **demo_meeting without qualification** - Must handle empty qualification gracefully
⚠️ **Qualification form in builder** - May be too complex, consider placeholder text instead
⚠️ **metadata JSONB** - Existing metadata values must be preserved when adding qualification
⚠️ **Type selector** - Adding demo_meeting may confuse users if not well labeled
⚠️ **Message template filter** - demo_meeting shouldn't show message template selector

---

## 11. Recommended Implementation Order

1. **Database Migration** (30 min)
   - Create and apply migration
   - Test on dev environment

2. **Interface Update** (15 min)
   - Update StepFormData interface
   - Add demo_meeting to type options

3. **Subject Line UI** (30 min)
   - Add conditional subject input
   - Wire up onChange
   - Test input/save/load

4. **demo_meeting Handling** (1 hour)
   - Add conditional rendering for demo_meeting
   - Decide on qualification approach (placeholder vs full form)
   - Implement chosen approach

5. **Backend Integration** (1 hour)
   - Update service files
   - Add variable replacement
   - Add qualification sync

6. **Testing** (1 hour)
   - End-to-end testing
   - Backward compatibility
   - Edge cases

**Total:** 4-5 hours

---

**Investigation Complete:** ✅
**Findings Documented:** ✅
**Ready for Implementation:** After all investigations complete
