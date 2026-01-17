# Implementation Plan: Sequence Builder Enhancements

**Feature:** Feature 4 - Sequence Builder Updates (demo_meeting + subject_line)
**Priority:** P3 (Low)
**Estimated Time:** 4-5 hours
**Dependencies:** Feature 1 (subject_line must be added to tasks/task_templates/message_templates first)

---

## Overview

Add two enhancements to the Sequence Builder:
1. **demo_meeting task type** support with optional qualification form
2. **subject_line field** for email type sequence steps

---

## Table of Contents

1. [Phase 1: Database Migration (30 minutes)](#phase-1-database-migration)
2. [Phase 2: TypeScript Interface Updates (15 minutes)](#phase-2-typescript-interface-updates)
3. [Phase 3: Frontend UI Updates (2 hours)](#phase-3-frontend-ui-updates)
4. [Phase 4: Backend Service Updates (1 hour)](#phase-4-backend-service-updates)
5. [Phase 5: Testing (1 hour)](#phase-5-testing)
6. [Testing Scenarios](#testing-scenarios)
7. [Rollback Plan](#rollback-plan)

---

## Phase 1: Database Migration

**Time:** 30 minutes

### Step 1.1: Create Migration File (15 minutes)

**File:** `supabase/migrations/YYYYMMDD_add_subject_line_demo_meeting_to_sequence_steps.sql`

```sql
-- ============================================================
-- Migration: Add subject_line and demo_meeting type support
-- Description: Adds subject_line column for email steps and
--              adds demo_meeting to allowed task types
-- ============================================================

-- Add subject_line column to sequence_steps
ALTER TABLE public.sequence_steps
  ADD COLUMN subject_line TEXT NULL;

COMMENT ON COLUMN public.sequence_steps.subject_line IS
  'Email subject line for email type sequence steps (supports variable replacement)';

-- Update the type constraint to include demo_meeting
ALTER TABLE public.sequence_steps
  DROP CONSTRAINT IF EXISTS sequence_steps_type_check;

ALTER TABLE public.sequence_steps
  ADD CONSTRAINT sequence_steps_type_check CHECK (
    (
      type = ANY (
        ARRAY[
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

-- No need for indexes on subject_line (text search not required)
-- subject_line will be included in SELECT * queries automatically
```

**Verify migration is safe:**
```sql
-- Test on local environment first
-- Check no existing data violates new constraint
SELECT COUNT(*)
FROM sequence_steps
WHERE type NOT IN ('internal_activity', 'social_message', 'text', 'email', 'call', 'demo_meeting');
-- Should return 0

-- Verify constraint update
\d sequence_steps
-- Should show subject_line column and updated type constraint
```

### Step 1.2: Apply Migration (15 minutes)

**Local testing:**
```bash
cd /Users/giannimunro/Desktop/cursor-projects/automation
supabase db reset --local
supabase db push --local
```

**Production (after testing):**
```bash
supabase db push
```

**Rollback script (if needed):**
```sql
-- File: supabase/migrations/YYYYMMDD_rollback_sequence_steps_changes.sql
ALTER TABLE public.sequence_steps
  DROP COLUMN IF EXISTS subject_line;

ALTER TABLE public.sequence_steps
  DROP CONSTRAINT IF EXISTS sequence_steps_type_check;

ALTER TABLE public.sequence_steps
  ADD CONSTRAINT sequence_steps_type_check CHECK (
    (
      type = ANY (
        ARRAY[
          'internal_activity'::text,
          'social_message'::text,
          'text'::text,
          'email'::text,
          'call'::text
        ]
      )
    )
  );
```

---

## Phase 2: TypeScript Interface Updates

**Time:** 15 minutes

### Step 2.1: Update StepFormData Interface (15 minutes)

**File:** `/src/components/sequences/SequenceStepBuilder.tsx`

**Location:** Lines 17-28

**Current:**
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
}
```

**New:**
```typescript
export interface StepFormData {
  step_order: number;
  name: string;
  description?: string;
  task_template_id?: string;
  type: 'internal_activity' | 'social_message' | 'text' | 'email' | 'call' | 'demo_meeting';
  priority: 'low' | 'medium' | 'high';
  message_template_id?: string;
  custom_message?: string;
  subject_line?: string;  // NEW
  delay_value: number;
  delay_unit: 'minutes' | 'hours' | 'days';
}
```

**Changes:**
1. Add `'demo_meeting'` to type union
2. Add `subject_line?: string;` field

---

## Phase 3: Frontend UI Updates

**Time:** 2 hours

### Step 3.1: Add demo_meeting to Type Selector (15 minutes)

**File:** `/src/components/sequences/SequenceStepBuilder.tsx`

**Location:** Lines 324-338

**Current:**
```jsx
<Select value={step.type} onValueChange={handleTypeChange}>
  <SelectTrigger className="mt-1">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="email">Email</SelectItem>
    <SelectItem value="call">Call</SelectItem>
    <SelectItem value="text">Text</SelectItem>
    <SelectItem value="social_message">Social Message</SelectItem>
    <SelectItem value="internal_activity">Internal Activity</SelectItem>
  </SelectContent>
</Select>
```

**New:**
```jsx
<Select value={step.type} onValueChange={handleTypeChange}>
  <SelectTrigger className="mt-1">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="email">Email</SelectItem>
    <SelectItem value="call">Call</SelectItem>
    <SelectItem value="text">Text</SelectItem>
    <SelectItem value="social_message">Social Message</SelectItem>
    <SelectItem value="demo_meeting">Demo Meeting</SelectItem>
    <SelectItem value="internal_activity">Internal Activity</SelectItem>
  </SelectContent>
</Select>
```

### Step 3.2: Add Subject Line Input (30 minutes)

**File:** `/src/components/sequences/SequenceStepBuilder.tsx`

**Location:** After message template section, before Type/Priority/Delay row (after line 317)

**Add:**
```jsx
{/* Subject Line - Only for Email type */}
{step.type === 'email' && (
  <div>
    <Label htmlFor={`step-subject-${index}`} className="text-xs">
      Email Subject (optional)
    </Label>
    <Input
      id={`step-subject-${index}`}
      placeholder="e.g., Demo booking confirmation - {restaurant_name}"
      value={step.subject_line || ''}
      onChange={(e) => onChange(index, 'subject_line', e.target.value)}
      className="mt-1 font-mono text-sm"
    />
    <p className="text-xs text-muted-foreground mt-1">
      Supports variables like {'{restaurant_name}'}, {'{contact_name}'}
    </p>
  </div>
)}
```

### Step 3.3: Update Message Template Conditional Logic (15 minutes)

**File:** `/src/components/sequences/SequenceStepBuilder.tsx`

**Location:** Line 89

**Current:**
```typescript
const showMessageTemplates = ['email', 'text', 'social_message'].includes(step.type);
```

**Update to exclude demo_meeting:**
```typescript
const showMessageTemplates = ['email', 'text', 'social_message'].includes(step.type);
const showQualificationInfo = step.type === 'demo_meeting';
```

**Note:** demo_meeting doesn't use message templates, uses QualificationForm instead

### Step 3.4: Add Qualification Info for demo_meeting (45 minutes)

**File:** `/src/components/sequences/SequenceStepBuilder.tsx`

**Location:** After message template section, before subject line (around line 317)

**Add:**
```jsx
{/* Qualification Info for Demo Meeting */}
{showQualificationInfo && (
  <div className="col-span-full">
    <Label className="text-xs mb-2 block">Demo Qualification Details</Label>
    <div className="p-4 border rounded-md bg-blue-50 space-y-2">
      <p className="text-sm text-blue-900 font-medium">
        📝 Demo Meeting Task
      </p>
      <p className="text-xs text-blue-800">
        When this step executes, a demo meeting task will be created for the sales rep.
        The task will include the QualificationForm for collecting demo details.
      </p>
      <p className="text-xs text-blue-800">
        <strong>Tip:</strong> You can pre-fill qualification data in the task template
        if you want default values for this sequence.
      </p>
    </div>
  </div>
)}
```

**Alternative (Advanced): Embed Mini QualificationForm**

If you want to allow pre-filling qualification in the sequence template:

```jsx
{showQualificationInfo && (
  <div className="col-span-full">
    <Label className="text-xs mb-2 block">
      Pre-fill Qualification Data (Optional)
    </Label>
    <div className="p-4 border rounded-md bg-muted/30 space-y-3">
      <p className="text-xs text-muted-foreground">
        Set default values for qualification fields. Sales rep can update these when executing the task.
      </p>

      {/* Simple fields only - not full QualificationForm */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Meeting Link (optional)</Label>
          <Input
            placeholder="https://calendly.com/..."
            value={step.metadata?.meeting_link || ''}
            onChange={(e) => {
              onChange(index, 'metadata', {
                ...step.metadata,
                meeting_link: e.target.value
              });
            }}
            className="mt-1 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Notes (optional)</Label>
          <Input
            placeholder="Additional context..."
            value={step.metadata?.qualification_notes || ''}
            onChange={(e) => {
              onChange(index, 'metadata', {
                ...step.metadata,
                qualification_notes: e.target.value
              });
            }}
            className="mt-1 text-xs"
          />
        </div>
      </div>
    </div>
  </div>
)}
```

**Recommended:** Use simple info banner (first option) to avoid complexity.

### Step 3.5: Update handleTypeChange (15 minutes)

**File:** `/src/components/sequences/SequenceStepBuilder.tsx`

**Location:** Lines 155-168

**Current logic:**
```typescript
const handleTypeChange = (newType: string) => {
  onChange(index, 'type', newType);

  // Clear task template if type doesn't match
  if (step.task_template_id) {
    const selectedTaskTemplate = taskTemplates?.find((t: any) => t.id === step.task_template_id);

    if (selectedTaskTemplate && selectedTaskTemplate.type !== newType) {
      onChange(index, 'task_template_id', undefined);
    }
  }
};
```

**Add subject_line clearing when changing away from email:**
```typescript
const handleTypeChange = (newType: string) => {
  onChange(index, 'type', newType);

  // Clear subject line if changing away from email
  if (step.type === 'email' && newType !== 'email') {
    onChange(index, 'subject_line', '');
  }

  // Clear task template if type doesn't match
  if (step.task_template_id) {
    const selectedTaskTemplate = taskTemplates?.find((t: any) => t.id === step.task_template_id);

    if (selectedTaskTemplate && selectedTaskTemplate.type !== newType) {
      onChange(index, 'task_template_id', undefined);
    }
  }
};
```

---

## Phase 4: Backend Service Updates

**Time:** 1 hour

### Step 4.1: Update sequence-templates-service.js (30 minutes)

**File:** `/src/services/sequence-templates-service.js`

**Functions to update:**

#### 1. createSequenceTemplate (include subject_line in INSERT)

**Location:** Find INSERT INTO sequence_steps

**Current (assumed):**
```javascript
const { data: step, error: stepError } = await supabase
  .from('sequence_steps')
  .insert({
    sequence_template_id: templateId,
    step_order: step.step_order,
    name: step.name,
    description: step.description,
    task_template_id: step.task_template_id,
    type: step.type,
    priority: step.priority,
    message_template_id: step.message_template_id,
    custom_message: step.custom_message,
    delay_value: step.delay_value,
    delay_unit: step.delay_unit,
    metadata: step.metadata || {}
  });
```

**Add subject_line:**
```javascript
const { data: step, error: stepError } = await supabase
  .from('sequence_steps')
  .insert({
    sequence_template_id: templateId,
    step_order: step.step_order,
    name: step.name,
    description: step.description,
    task_template_id: step.task_template_id,
    type: step.type,
    priority: step.priority,
    message_template_id: step.message_template_id,
    custom_message: step.custom_message,
    subject_line: step.subject_line || null,  // NEW
    delay_value: step.delay_value,
    delay_unit: step.delay_unit,
    metadata: step.metadata || {}
  });
```

#### 2. updateSequenceTemplate (include subject_line in UPDATE)

Same pattern - add `subject_line: step.subject_line || null` to UPDATE statement.

#### 3. getSequenceTemplateById (ensure subject_line returned)

**Current (assumed):**
```javascript
const { data: steps } = await supabase
  .from('sequence_steps')
  .select('*')
  .eq('sequence_template_id', templateId)
  .order('step_order');
```

**No changes needed** - `SELECT *` will include subject_line automatically.

**But verify frontend receives it:**
```javascript
// Add logging during development
console.log('Sequence step:', step);
// Should include subject_line: "..." or subject_line: null
```

### Step 4.2: Update sequence-instances-service.js (30 minutes)

**File:** `/src/services/sequence-instances-service.js`

**Functions to update:**

#### executeSequenceStep - Apply variable replacement to subject_line

**Location:** Find where tasks are created from sequence steps

**Current (assumed):**
```javascript
// Create task from sequence step
const taskData = {
  restaurant_id: sequenceInstance.restaurant_id,
  name: replaceVariables(step.name, variableContext),
  description: replaceVariables(step.description, variableContext),
  type: step.type,
  priority: step.priority,
  due_date: calculateDueDate(step.delay_value, step.delay_unit),
  status: 'active'
};

if (step.custom_message) {
  taskData.message_content = replaceVariables(step.custom_message, variableContext);
}

const { data: task } = await supabase.from('tasks').insert(taskData);
```

**Add subject_line handling:**
```javascript
// Create task from sequence step
const taskData = {
  restaurant_id: sequenceInstance.restaurant_id,
  name: replaceVariables(step.name, variableContext),
  description: replaceVariables(step.description, variableContext),
  type: step.type,
  priority: step.priority,
  due_date: calculateDueDate(step.delay_value, step.delay_unit),
  status: 'active'
};

if (step.custom_message) {
  taskData.message_content = replaceVariables(step.custom_message, variableContext);
}

// NEW: Handle subject line for email types
if (step.type === 'email' && step.subject_line) {
  taskData.subject_line = replaceVariables(step.subject_line, variableContext);
}

// NEW: Handle demo_meeting qualification sync
if (step.type === 'demo_meeting' && step.metadata?.meeting_link) {
  // Optionally pre-populate restaurant qualification fields
  await supabase
    .from('restaurants')
    .update({ meeting_link: step.metadata.meeting_link })
    .eq('id', sequenceInstance.restaurant_id);
}

const { data: task } = await supabase.from('tasks').insert(taskData);
```

**Variable Context:**
Ensure variableContext includes:
- Restaurant data (name, contact_name, etc.)
- Sequence instance data
- Any other context needed for variable replacement

---

## Phase 5: Testing

**Time:** 1 hour

### Step 5.1: Unit Tests (30 minutes)

**Test 1: Create sequence with email step and subject**
```javascript
const sequenceData = {
  name: 'Demo Follow-up Sequence',
  steps: [
    {
      step_order: 1,
      name: 'Send confirmation email',
      type: 'email',
      priority: 'high',
      subject_line: 'Demo booked for {restaurant_name}',
      custom_message: 'Hi {contact_name}, ...',
      delay_value: 0,
      delay_unit: 'minutes'
    }
  ]
};

const result = await createSequenceTemplate(sequenceData);
expect(result.steps[0].subject_line).toBe('Demo booked for {restaurant_name}');
```

**Test 2: Create sequence with demo_meeting step**
```javascript
const sequenceData = {
  steps: [
    {
      type: 'demo_meeting',
      name: 'Book demo call',
      priority: 'high',
      delay_value: 1,
      delay_unit: 'days'
    }
  ]
};

const result = await createSequenceTemplate(sequenceData);
expect(result.steps[0].type).toBe('demo_meeting');
```

**Test 3: Execute sequence with subject_line**
```javascript
// Create sequence instance
const instance = await startSequence(sequenceTemplateId, restaurantId);

// Execute first step
await executeSequenceStep(instance.id, step1.id);

// Check created task
const { data: task } = await supabase
  .from('tasks')
  .select('*')
  .eq('sequence_instance_id', instance.id)
  .single();

expect(task.subject_line).toContain(restaurant.name); // Variable replaced
expect(task.subject_line).not.toContain('{restaurant_name}'); // No variable placeholders
```

### Step 5.2: Integration Tests (30 minutes)

**Test 4: End-to-end sequence with demo_meeting**
1. Create sequence template with demo_meeting step
2. Start sequence for a restaurant
3. Wait for step execution
4. Verify task created with type='demo_meeting'
5. Open task in UI
6. Verify QualificationForm displays

**Test 5: Subject line variable replacement**
1. Create sequence with email step: subject = "Demo for {restaurant_name}"
2. Start sequence for restaurant "ABC Pizza"
3. Execute step
4. Check task.subject_line = "Demo for ABC Pizza"

**Test 6: Type constraint validation**
1. Try to insert sequence step with invalid type: "invalid_type"
2. Expect database constraint error
3. Try to insert step with type: "demo_meeting"
4. Expect success

---

## Testing Scenarios

### Scenario 1: Create Sequence with Email Subject
**Steps:**
1. Navigate to Sequence Templates page
2. Click "Create Sequence"
3. Add email step
4. Enter subject line: "Demo for {restaurant_name}"
5. Save
6. Verify subject_line saved

**Expected:**
- Subject input visible for email type
- Variables work in subject
- Save succeeds

### Scenario 2: Create Sequence with demo_meeting
**Steps:**
1. Create new sequence template
2. Add step, select type: "Demo Meeting"
3. Verify info banner appears
4. Save
5. Start sequence for restaurant
6. Execute demo_meeting step
7. Check task created

**Expected:**
- demo_meeting option available in type dropdown
- Info banner shows qualification note
- Task created with type='demo_meeting'
- Task opens with QualificationForm

### Scenario 3: Type Change Clears Subject
**Steps:**
1. Create sequence step, type: Email
2. Enter subject line: "Test subject"
3. Change type to "Call"
4. Check subject line field

**Expected:**
- Subject line hidden when not email type
- Subject line value cleared
- No errors

### Scenario 4: Subject Line with Variables
**Steps:**
1. Create email step with subject: "{restaurant_name} - {contact_name}"
2. Save sequence
3. Start for restaurant "Pizza Place" with contact "John"
4. Execute step
5. Check created task subject_line

**Expected:**
- subject_line = "Pizza Place - John"
- No variable placeholders remain

### Scenario 5: demo_meeting with Metadata
**Steps:**
1. Create demo_meeting step
2. Add meeting_link in metadata
3. Execute sequence
4. Check if restaurant.meeting_link updated

**Expected:**
- Metadata saved with step
- Restaurant field updated (if implemented)

### Scenario 6: Backward Compatibility
**Steps:**
1. Load old sequence template (created before migration)
2. Verify loads without errors
3. Edit and save
4. Verify subject_line NULL in database

**Expected:**
- Old templates load fine
- subject_line defaults to NULL
- No breaking changes

### Scenario 7: Message Template Auto-fill
**Steps:**
1. Create email step
2. Select message template with subject_line
3. Check if subject auto-fills

**Expected:**
- If message template has subject, consider auto-filling
- User can override

### Scenario 8: Mixed Step Types
**Steps:**
1. Create sequence with:
   - Step 1: Email (with subject)
   - Step 2: Call (no subject)
   - Step 3: Demo Meeting
   - Step 4: Email (with subject)
2. Save and execute
3. Verify each step creates correct task

**Expected:**
- Email tasks have subject_line
- Call task has no subject_line
- Demo task has type='demo_meeting'
- All execute correctly

---

## Rollback Plan

### If Phase 1 Fails (Migration)

**Rollback migration:**
```bash
# Apply rollback migration
supabase db push # with rollback migration file
```

**Or manually:**
```sql
ALTER TABLE sequence_steps DROP COLUMN subject_line;

ALTER TABLE sequence_steps DROP CONSTRAINT sequence_steps_type_check;

ALTER TABLE sequence_steps ADD CONSTRAINT sequence_steps_type_check CHECK (
  type = ANY (ARRAY['internal_activity', 'social_message', 'text', 'email', 'call']::text[])
);
```

### If Phase 2 Fails (TypeScript)

**Revert interface:**
```typescript
// Remove 'demo_meeting' from type union
// Remove subject_line?: string;
```

**No runtime impact** - TypeScript only

### If Phase 3 Fails (Frontend UI)

**Revert SequenceStepBuilder.tsx:**
1. Remove demo_meeting from SelectContent
2. Remove subject_line input section
3. Remove showQualificationInfo logic
4. Restore original handleTypeChange

**No data loss** - UI only

### If Phase 4 Fails (Backend)

**Revert service files:**
1. Remove subject_line from INSERT statements
2. Remove subject_line from UPDATE statements
3. Remove demo_meeting handling logic

**Database migration can stay** - extra column won't hurt

---

## Dependencies Checklist

**Before starting, verify:**
- [ ] Feature 1 completed (subject_line in tasks/task_templates/message_templates)
- [ ] QualificationForm component exists and works
- [ ] Variable replacement service handles qualification variables
- [ ] Tasks page supports demo_meeting type
- [ ] TaskTypeQuickView handles demo_meeting type

**If demo_meeting support in tasks isn't ready:**
- Implement Phase 1-2 (database + interface)
- Skip Phase 3.4 (qualification info)
- Skip demo_meeting handling in Phase 4
- Come back later when tasks support demo_meeting

---

## Performance Considerations

### Database
- **subject_line column:** TEXT type, nullable, no index needed
- **Type constraint:** Updated check constraint, no performance impact
- **Migration:** Adds column with NULL values, instant operation

### Frontend
- **Conditional rendering:** No performance impact (<1ms)
- **Type selector:** One additional option, negligible
- **Form state:** One additional field, minimal memory

### Backend
- **Variable replacement:** Same as message_content, no additional overhead
- **INSERT/UPDATE:** One additional field, ~50 bytes per row

**Overall:** Zero performance impact

---

## Success Criteria

✅ Migration applied successfully
✅ subject_line column added to sequence_steps table
✅ demo_meeting added to type constraint
✅ TypeScript interface updated
✅ demo_meeting option in type selector
✅ Subject line input shows for email type
✅ Subject line hides for non-email types
✅ Qualification info banner shows for demo_meeting
✅ Backend services include subject_line
✅ Variable replacement works on subject_line
✅ demo_meeting tasks created correctly
✅ Backward compatibility maintained
✅ All tests pass
✅ No console errors

---

## Estimated Timeline

| Phase | Task | Time | Complexity |
|-------|------|------|------------|
| 1.1 | Create migration file | 15 min | Low |
| 1.2 | Apply migration | 15 min | Low |
| 2.1 | Update TypeScript interface | 15 min | Low |
| 3.1 | Add demo_meeting to selector | 15 min | Low |
| 3.2 | Add subject line input | 30 min | Low |
| 3.3 | Update message template logic | 15 min | Low |
| 3.4 | Add qualification info | 45 min | Medium |
| 3.5 | Update handleTypeChange | 15 min | Low |
| 4.1 | Update templates service | 30 min | Low |
| 4.2 | Update instances service | 30 min | Medium |
| 5.1 | Unit tests | 30 min | - |
| 5.2 | Integration tests | 30 min | - |
| **Total** | | **4-5 hours** | **Low-Medium** |

---

**Risk Level:** Low
**Parallel Development:** Depends on Feature 1 (must be complete first)
**Breaking Changes:** None (backward compatible)
**Database Migrations:** 1 (safe - adds column + updates constraint)
