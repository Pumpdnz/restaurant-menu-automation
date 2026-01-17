# Variable Replacement System Investigation Report

## Executive Summary

This report documents the current implementation of the variable replacement system used across task templates, message templates, and sequences. The investigation reveals a well-structured core system with several opportunities for UX improvements and feature enhancements.

## Current Architecture

### Core Variable Replacement Service

**Location:** [src/services/variable-replacement-service.js](../../UberEats-Image-Extractor/src/services/variable-replacement-service.js)

The variable replacement system is centralized in a single service that handles:

1. **Variable Extraction** - Identifies variables in template text
2. **Variable Resolution** - Maps variables to restaurant data
3. **Variable Replacement** - Substitutes variables with actual values
4. **Variable Validation** - Checks for unknown/invalid variables

#### Key Functions

```javascript
// Extract variables from message content
extractVariables(messageContent) → string[]

// Replace variables with restaurant data
replaceVariables(messageContent, restaurant) → Promise<string>

// Get variable value from restaurant data
getVariableValue(variableName, restaurant) → string

// Get list of all available variables
getAvailableVariables() → Array<{category, variables}>

// Validate variables in message
validateVariables(messageContent) → {isValid, unknownVariables, totalVariables, knownVariables}
```

#### Variable Format

Variables use the format: `{variable_name}`

Regex pattern: `/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g`

### Variable Mapping System

All variables are defined in the `VARIABLE_MAPPINGS` object with two types of mappings:

1. **Direct field mapping** (string):
   ```javascript
   restaurant_name: 'name'  // Maps to restaurant.name
   ```

2. **Function mapping** (for computed values):
   ```javascript
   first_name: (restaurant) => {
     const parts = restaurant.contact_name.trim().split(/\s+/);
     return parts[0] || '';
   }
   ```

### Variable Categories

The system currently supports **63 variables** across 9 categories:

#### 1. Restaurant Information (7 variables)
- `restaurant_name` - Restaurant name
- `restaurant_email` - Restaurant email
- `restaurant_phone` - Restaurant phone
- `restaurant_address` - Restaurant address
- `restaurant_website` - Restaurant website
- `city` - Restaurant city
- `cuisine` - Cuisine type(s)

#### 2. Contact Information (4 variables)
- `contact_name` - Lead contact name
- `first_name` - Lead contact first name
- `contact_email` - Lead contact email
- `contact_phone` - Lead contact phone

#### 3. Business Information (2 variables)
- `organisation_name` - Organisation name
- `opening_hours_text` - Opening hours text

#### 4. Sales Information (4 variables)
- `lead_stage` - Current lead stage
- `lead_warmth` - Lead warmth level
- `lead_status` - Lead status
- `icp_rating` - ICP fit rating (0-10)

#### 5. Demo Store (2 variables)
- `demo_store_url` - Demo store URL
- `demo_store_built` - Demo store built status (Yes/No)

#### 6. Pumpd URLs (3 variables)
- `subdomain` - Pumpd subdomain
- `ordering_url` - Pumpd ordering URL
- `admin_url` - Pumpd admin portal

#### 7. Platform URLs (4 variables)
- `ubereats_url` - UberEats URL
- `doordash_url` - DoorDash URL
- `instagram_url` - Instagram profile URL
- `facebook_url` - Facebook page URL

#### 8. Date Variables (4 variables)
- `today` - Today's date (short format)
- `current_date` - Current date (long format)
- `current_year` - Current year
- `last_contacted_day` - Last contact date (natural language)

#### 9. Qualification Data (33 variables)
Includes detailed demo meeting information:
- Contact role, number of venues, POS system
- Online ordering platform details
- UberEats metrics (volume, AOV, markup, profitability)
- Marketing and website information
- Sales context (painpoints, selling points, features, objections)
- Meeting details

## Variable Replacement Flow

### 1. Task Creation Flow

**Location:** [src/services/tasks-service.js:173-196](../../UberEats-Image-Extractor/src/services/tasks-service.js#L173-L196)

```javascript
// When creating a task
if (taskData.restaurant_id && (taskData.message || taskData.subject_line)) {
  const restaurant = await fetchRestaurant(taskData.restaurant_id);

  if (taskData.message) {
    taskData.message_rendered = await variableReplacementService.replaceVariables(
      taskData.message,
      restaurant
    );
  }

  if (taskData.subject_line) {
    taskData.subject_line_rendered = await variableReplacementService.replaceVariables(
      taskData.subject_line,
      restaurant
    );
  }
}
```

**Key Points:**
- Original template stored in `message` field
- Rendered version stored in `message_rendered` field
- Both versions persisted to database
- Allows editing template while preserving rendered output

### 2. Task Update Flow

**Location:** [src/services/tasks-service.js:314-328](../../UberEats-Image-Extractor/src/services/tasks-service.js#L314-L328)

```javascript
// When updating message or subject_line
if (task.restaurant_id) {
  if (updates.message) {
    updates.message_rendered = await variableReplacementService.replaceVariables(
      updates.message,
      task.restaurants
    );
  }
  if (updates.subject_line) {
    updates.subject_line_rendered = await variableReplacementService.replaceVariables(
      updates.subject_line,
      task.restaurants
    );
  }
}
```

### 3. Sequence Instance Creation Flow

**Location:** [src/services/sequence-instances-service.js:86-116](../../UberEats-Image-Extractor/src/services/sequence-instances-service.js#L86-L116)

```javascript
for (const step of template.sequence_steps) {
  let message = step.custom_message;

  // Get message from template if referenced
  if (step.message_template_id && step.message_templates) {
    message = step.message_templates.message_content;
  }

  // Render message with variables
  let messageRendered = null;
  if (message) {
    messageRendered = await variableReplacementService.replaceVariables(
      message,
      restaurant
    );
  }

  // Similar for subject_line
  if (step.type === 'email' && subjectLine) {
    subjectLineRendered = await variableReplacementService.replaceVariables(
      subjectLine,
      restaurant
    );
  }
}
```

**Key Points:**
- Variables replaced when sequence starts
- Each task gets pre-rendered message based on restaurant data
- Supports inheritance: sequence step → message template → custom message

## User Interface Components

### 1. CreateMessageTemplateModal

**Location:** [src/components/message-templates/CreateMessageTemplateModal.tsx](../../UberEats-Image-Extractor/src/components/message-templates/CreateMessageTemplateModal.tsx)

**Current Implementation:**

✅ **Working Well:**
- Displays available variables in a grid (lines 406-417)
- Categorizes variables for easy reference
- Shows detected variables from message content (lines 392-403)
- Live preview with variable replacement (lines 143-203)
- Restaurant selector for preview testing

❌ **Limitations:**
- Variables displayed as static text (NOT clickable)
- Limited to 13 hardcoded variables (lines 255-269)
- Missing many available variables from the full list
- No cursor insertion functionality

**Current Variables Shown:**
```javascript
const availableVariables = [
  { name: 'restaurant_name', description: 'Restaurant name' },
  { name: 'contact_name', description: 'Contact person name' },
  { name: 'first_name', description: 'Contact first name' },
  { name: 'contact_email', description: 'Contact email' },
  { name: 'contact_phone', description: 'Contact phone' },
  { name: 'city', description: 'Restaurant city' },
  { name: 'cuisine', description: 'Cuisine type(s)' },
  { name: 'organisation_name', description: 'Organisation name' },
  { name: 'demo_store_url', description: 'Demo store URL' },
  { name: 'subdomain', description: 'Pumpd subdomain' },
  { name: 'phone', description: 'Restaurant phone' },
  { name: 'email', description: 'Restaurant email' },
  { name: 'address', description: 'Restaurant address' }
];
```

**Missing Variables:** 50+ variables from the full VARIABLE_MAPPINGS

### 2. CreateTaskTemplateModal

**Location:** [src/components/task-templates/CreateTaskTemplateModal.tsx](../../UberEats-Image-Extractor/src/components/task-templates/CreateTaskTemplateModal.tsx)

**Current Implementation:**

✅ **Working Well:**
- Shows message template selector
- Subject line support for email tasks
- Default message field

❌ **Limitations:**
- Variables shown as plain text at bottom (line 372)
- Only shows 6 variables: `{restaurant_name}`, `{contact_name}`, `{first_name}`, `{city}`, `{cuisine}`, `{demo_store_url}`
- No categorization
- No click-to-insert functionality
- Variables only shown when no message template is selected

### 3. CreateTaskModal

**Location:** [src/components/tasks/CreateTaskModal.tsx](../../UberEats-Image-Extractor/src/components/tasks/CreateTaskModal.tsx)

**Current Implementation:**

✅ **Working Well:**
- Supports message templates
- Subject line for email tasks
- Qualification form for demo meetings

❌ **Limitations:**
- Same 6 variables shown as plain text (line 535)
- No click-to-insert functionality
- Variables hidden in small text below message field

### 4. SequenceStepBuilder

**Location:** [src/components/sequences/SequenceStepBuilder.tsx](../../UberEats-Image-Extractor/src/components/sequences/SequenceStepBuilder.tsx)

**Current Implementation:**

✅ **Working Well:**
- Task template selection
- Message template selection
- Custom message field
- Subject line support for email steps

❌ **Critical Limitations:**
- **NO variable reference shown at all**
- No way to see available variables
- Users must memorize variable names
- Highest friction point for users

**Custom Message Field (lines 484-497):**
```jsx
<Textarea
  id={`step-message-${index}`}
  placeholder="Custom message for this step (supports variables like {{restaurant_name}})"
  value={step.custom_message || ''}
  onChange={(e) => onChange(index, 'custom_message', e.target.value)}
  rows={2}
  className="mt-1"
/>
```

**Note:** Placeholder uses incorrect double-brace syntax `{{restaurant_name}}` instead of single-brace `{restaurant_name}`

## Data Formatting Helpers

The service includes specialized formatters for different data types:

### 1. Number Formatting
```javascript
formatNumber(value, suffix) → "1,234 orders"
```

### 2. Currency Formatting
```javascript
formatCurrency(value) → "$32.50"
```

### 3. Percentage Formatting
```javascript
formatPercentage(value) → "25.0%"
```

### 4. Boolean Formatting
```javascript
formatBoolean(value) → "Yes" | "No" | "Unknown"
```

### 5. Array Formatting
```javascript
formatArray([{value: 'High fees'}, {value: 'Poor support'}])
  → "High fees, Poor support"
```

### 6. Relative Date Formatting
```javascript
formatRelativeDate(date) → "yesterday" | "last Tuesday" | "3 weeks ago"
```

## Variable Resolution Hierarchy

### For Sequence Steps

1. **Step's custom_message** (highest priority)
2. **Message template's message_content** (if message_template_id set)
3. **Task template's message_templates.message_content** (if task_template_id has linked message template)
4. **Task template's default_message** (fallback)

### For Subject Lines (Email Only)

1. **Step's subject_line**
2. **Message template's subject_line** (if message_template_id set)
3. **Task template's subject_line** (fallback)

## Gap Analysis

### 1. Inconsistent Variable Lists

**Problem:** Three different hardcoded variable lists across components

- **CreateMessageTemplateModal:** 13 variables
- **CreateTaskTemplateModal:** 6 variables
- **CreateTaskModal:** 6 variables
- **SequenceStepBuilder:** 0 variables shown
- **Actual Available:** 63 variables

**Impact:** Users cannot discover or use most available variables

### 2. No Click-to-Insert Functionality

**Problem:** All variable displays are static text/badges

**User Pain Points:**
- Must manually type `{variable_name}` with exact spelling
- Risk of typos causing variable not to resolve
- Slows down template creation
- Poor discoverability

### 3. Missing Variables from Display

**Critical Missing Variables:**
- All qualification data variables (33 total)
- Sales information (lead_stage, lead_warmth, lead_status, icp_rating)
- Platform URLs (ubereats_url, doordash_url, instagram_url, facebook_url)
- Business info (organisation_name, opening_hours_text)
- Date variables (today, current_date, current_year, last_contacted_day)
- Pumpd URLs (subdomain, ordering_url, admin_url)

### 4. No Variable Assistance in SequenceStepBuilder

**Problem:** Most critical component has zero variable support

**Impact:**
- Users creating multi-step sequences have no reference
- Leads to inconsistent variable usage across steps
- Highest barrier to adoption

### 5. No Validation Feedback

**Problem:** No real-time validation as users type

**Current Behavior:**
- Unknown variables silently remain as `{unknown_var}` in output
- No warning until message is sent/previewed
- `validateVariables()` function exists but not used in UI

### 6. No Support for Computed/Dynamic Variables

**Problem:** All variables are static mappings to restaurant data

**Requested Features:**
- `{example_restaurant_1}` - First example customer in same city
- `{example_restaurant_2}` - Second example customer in same city
- Need to include customer name AND link to their Pumpd store

**Requirements:**
- Filter existing customers by city
- Return customer names and store URLs
- Insert as formatted links in rendered messages

## Recommendations

### Phase 1: Standardize Variable Display

**Priority:** HIGH
**Effort:** LOW

1. Create centralized `VariableSelector` component
2. Use `getAvailableVariables()` from service (already returns all 63 variables)
3. Replace all hardcoded variable lists
4. Ensure consistent display across all modals

**Files to Update:**
- CreateMessageTemplateModal.tsx
- CreateTaskTemplateModal.tsx
- CreateTaskModal.tsx
- SequenceStepBuilder.tsx (ADD component)

### Phase 2: Add Click-to-Insert Functionality

**Priority:** HIGH
**Effort:** MEDIUM

1. Make variable badges clickable
2. Insert variable at cursor position in textarea
3. Maintain textarea focus and cursor position
4. Add keyboard shortcuts (e.g., Ctrl+Space to open variable picker)

**Technical Approach:**
```javascript
const insertVariable = (variableName: string) => {
  const textarea = textareaRef.current;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  const newValue =
    formData.message.substring(0, start) +
    `{${variableName}}` +
    formData.message.substring(end);

  setFormData({ ...formData, message: newValue });

  // Restore cursor position after insert
  setTimeout(() => {
    textarea.focus();
    const newPosition = start + variableName.length + 2;
    textarea.setSelectionRange(newPosition, newPosition);
  }, 0);
};
```

### Phase 3: Add Real-time Validation

**Priority:** MEDIUM
**Effort:** LOW

1. Use existing `validateVariables()` function
2. Show warnings for unknown variables
3. Highlight invalid variables in textarea
4. Display validation status near variable list

**UI Mockup:**
```
⚠️ Unknown variables: {invalid_var}, {typo_name}
✓ Valid variables: {restaurant_name}, {contact_name}
```

### Phase 4: Implement Dynamic Variables

**Priority:** MEDIUM
**Effort:** HIGH

**New Variables to Add:**
- `{example_restaurant_1}` - First example customer in city
- `{example_restaurant_2}` - Second example customer in city
- `{example_restaurant_1_url}` - Link to first example store
- `{example_restaurant_2_url}` - Link to second example store

**Database Schema Addition:**

Create new table: `city_example_customers`
```sql
CREATE TABLE city_example_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city TEXT NOT NULL,
  restaurant_id UUID REFERENCES restaurants(id),
  display_name TEXT NOT NULL,
  store_url TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_city_example_customers_city ON city_example_customers(city);
```

**Service Implementation:**

Add to variable-replacement-service.js:
```javascript
async function getExampleRestaurants(city) {
  const { data, error } = await getSupabaseClient()
    .from('city_example_customers')
    .select('*')
    .eq('city', city)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .limit(2);

  return data || [];
}

// Add to VARIABLE_MAPPINGS
example_restaurant_1: async (restaurant) => {
  const examples = await getExampleRestaurants(restaurant.city);
  return examples[0]?.display_name || '';
},

example_restaurant_2: async (restaurant) => {
  const examples = await getExampleRestaurants(restaurant.city);
  return examples[1]?.display_name || '';
},

example_restaurant_1_url: async (restaurant) => {
  const examples = await getExampleRestaurants(restaurant.city);
  return examples[0]?.store_url || '';
},

example_restaurant_2_url: async (restaurant) => {
  const examples = await getExampleRestaurants(restaurant.city);
  return examples[1]?.store_url || '';
},
```

**Rendering Enhancement:**

For HTML email rendering, support link insertion:
```javascript
// Replace {example_restaurant_1} with linked name
const exampleName = await getVariableValue('example_restaurant_1', restaurant);
const exampleUrl = await getVariableValue('example_restaurant_1_url', restaurant);

if (exampleUrl) {
  result = result.replace(
    `{example_restaurant_1}`,
    `<a href="${exampleUrl}" target="_blank">${exampleName}</a>`
  );
}
```

### Phase 5: Enhanced Variable Picker UI

**Priority:** LOW
**Effort:** MEDIUM

1. Searchable variable picker
2. Category filters
3. Variable preview (shows what it will resolve to)
4. Recently used variables
5. Favorite/pin frequently used variables

## Technical Considerations

### 1. Async Variable Resolution

**Current:** `replaceVariables()` is async but most variables resolve synchronously

**Future:** Dynamic variables (example_restaurant_1/2) will require async database queries

**Impact:**
- Need to handle loading states
- Consider caching example restaurants per city
- Maintain performance for bulk operations (sequence creation)

### 2. Variable Rendering Context

**Email vs. Text vs. Social:**
- Email: Can use HTML links (`<a href="">`)
- Text/SMS: Must use plain text with URLs
- Social: Platform-specific formatting

**Solution:** Add rendering hints to variable mappings
```javascript
{
  name: 'example_restaurant_1',
  resolveValue: async (restaurant) => { ... },
  renderHtml: (value, url) => `<a href="${url}">${value}</a>`,
  renderText: (value, url) => `${value} (${url})`
}
```

### 3. Preview Performance

**Challenge:** Real-time preview with many async variables

**Solutions:**
- Debounce preview updates
- Cache variable resolutions per restaurant
- Show loading skeleton for slow variables
- Limit preview to selected restaurant (already implemented)

### 4. Migration Path

**Backward Compatibility:**
- Existing messages with old variable names must continue working
- New variables should be additive only
- No breaking changes to `VARIABLE_MAPPINGS` keys

**Database:**
- `message` field: Keep original template
- `message_rendered` field: Pre-computed output
- Both fields remain unchanged

## Success Metrics

### User Experience
- ✅ Time to create message template (target: -50%)
- ✅ Variable usage rate (target: +100%)
- ✅ Variable errors in sent messages (target: -90%)
- ✅ User satisfaction with template system (target: 4.5/5)

### Technical
- ✅ All 63 variables accessible in all components
- ✅ Zero hardcoded variable lists
- ✅ Real-time validation in all forms
- ✅ Click-to-insert working in all textareas

### Business
- ✅ Example restaurant variables used in 50%+ of messages
- ✅ Increased message personalization
- ✅ Reduced time from lead to demo booking

## Appendix A: Complete Variable List

### Restaurant Information (7)
1. `restaurant_name` - Restaurant name
2. `restaurant_email` - Restaurant email
3. `restaurant_phone` - Restaurant phone
4. `restaurant_address` - Restaurant address
5. `restaurant_website` - Restaurant website
6. `city` - Restaurant city
7. `cuisine` - Cuisine type(s)

### Contact Information (4)
8. `contact_name` - Lead contact name
9. `first_name` - Lead contact first name
10. `contact_email` - Lead contact email
11. `contact_phone` - Lead contact phone

### Business Information (2)
12. `organisation_name` - Organisation name
13. `opening_hours_text` - Opening hours text

### Sales Information (4)
14. `lead_stage` - Current lead stage
15. `lead_warmth` - Lead warmth level
16. `lead_status` - Lead status
17. `icp_rating` - ICP fit rating (0-10)

### Demo Store (2)
18. `demo_store_url` - Demo store URL
19. `demo_store_built` - Demo store built status

### Pumpd URLs (3)
20. `subdomain` - Pumpd subdomain
21. `ordering_url` - Pumpd ordering URL
22. `admin_url` - Pumpd admin portal

### Platform URLs (4)
23. `ubereats_url` - UberEats URL
24. `doordash_url` - DoorDash URL
25. `instagram_url` - Instagram profile URL
26. `facebook_url` - Facebook page URL

### Date Variables (4)
27. `today` - Today's date (short)
28. `current_date` - Current date (long)
29. `current_year` - Current year
30. `last_contacted_day` - Last contact (relative)

### Qualification Data (33)
31. `contact_role` - Contact person's role
32. `number_of_venues` - Number of venues
33. `point_of_sale` - POS system used
34. `online_ordering_platform` - Online ordering platform
35. `online_ordering_handles_delivery` - Ordering handles delivery
36. `self_delivery` - Self-delivery capability
37. `weekly_uber_sales_volume` - Weekly UberEats orders
38. `uber_aov` - Average order value
39. `uber_markup` - UberEats menu markup %
40. `uber_profitability` - UberEats profitability %
41. `uber_profitability_description` - Profitability notes
42. `current_marketing_description` - Current marketing
43. `qualification_details` - Qualification notes
44. `painpoints` - Customer pain points
45. `core_selling_points` - Core selling points
46. `features_to_highlight` - Features to highlight
47. `possible_objections` - Possible objections
48. `meeting_link` - Meeting/demo link
49. `website_type` - Website type

### Proposed New Variables (4+)
50. `example_restaurant_1` - First example customer
51. `example_restaurant_2` - Second example customer
52. `example_restaurant_1_url` - First example URL
53. `example_restaurant_2_url` - Second example URL

**Total:** 63 existing + 4 proposed = 67 variables

## Appendix B: File Reference Map

### Core Services
- Variable logic: `src/services/variable-replacement-service.js`
- Task creation: `src/services/tasks-service.js`
- Sequence creation: `src/services/sequence-instances-service.js`

### UI Components
- Message templates: `src/components/message-templates/CreateMessageTemplateModal.tsx`
- Task templates: `src/components/task-templates/CreateTaskTemplateModal.tsx`
- Tasks: `src/components/tasks/CreateTaskModal.tsx`
- Sequence steps: `src/components/sequences/SequenceStepBuilder.tsx`

### Supporting Files
- Qualification constants: `src/lib/qualification-constants.ts`
- Sequence hooks: `src/hooks/useSequences.ts`
- Message template routes: `src/routes/message-templates-routes.js`
- Sequences page: `src/pages/Sequences.tsx`

## Conclusion

The variable replacement system has a solid foundation with comprehensive variable coverage and clean architecture. The main opportunities are:

1. **Standardize** variable display across all components
2. **Enable** click-to-insert for better UX
3. **Add** real-time validation feedback
4. **Implement** dynamic example restaurant variables
5. **Enhance** SequenceStepBuilder with variable support

These improvements will significantly reduce friction in template creation and increase variable adoption across the sales workflow.
