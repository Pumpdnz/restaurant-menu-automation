# Variable System Architecture

## High-Level Overview

The variable replacement system provides dynamic personalization for messages, emails, and tasks by substituting template variables with restaurant-specific data. The system operates across three layers:

```
┌────────────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │   Message    │  │     Task     │  │   Sequence   │            │
│  │  Templates   │  │  Templates   │  │   Builder    │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                  │                  │                     │
│         └──────────────────┴──────────────────┘                    │
│                            │                                        │
│                  ┌─────────▼─────────┐                            │
│                  │ VariableSelector  │ ◄── NEW COMPONENT          │
│                  │   Component       │                             │
│                  └─────────┬─────────┘                            │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                                 │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │       Variable Replacement Service                            │ │
│  │                                                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │ │
│  │  │   Extract    │  │   Resolve    │  │   Replace    │       │ │
│  │  │  Variables   │  │  Variables   │  │  Variables   │       │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │ │
│  │                                                                │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │           VARIABLE_MAPPINGS (63+ variables)          │   │ │
│  │  │  • Static: Direct field mappings                     │   │ │
│  │  │  • Computed: Function-based transformations          │   │ │
│  │  │  • Dynamic: Database-backed variables (NEW)          │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                             │                                       │
│  ┌──────────────────────────┼─────────────────────────────┐       │
│  │         Tasks Service    │    Sequences Service         │       │
│  │  • Create with variables │  • Create with variables     │       │
│  │  • Update with variables │  • Bulk operations           │       │
│  │  • Store rendered output │  • Pre-render on creation    │       │
│  └──────────────────────────┴─────────────────────────────┘       │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │ restaurants  │  │    tasks     │  │ city_example_        │    │
│  │  (source)    │  │  (storage)   │  │  customers (NEW)     │    │
│  │              │  │              │  │  (dynamic vars)      │    │
│  └──────────────┘  └──────────────┘  └──────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── services/
│   ├── variable-replacement-service.js  ★ Core variable logic
│   │   ├── extractVariables()          - Parse template for variables
│   │   ├── replaceVariables()          - Substitute with values
│   │   ├── getVariableValue()          - Resolve single variable
│   │   ├── getAvailableVariables()     - Get all 63+ variables
│   │   ├── validateVariables()         - Check for unknown vars
│   │   ├── getExampleRestaurants()     - NEW: Fetch dynamic examples
│   │   └── VARIABLE_MAPPINGS           - 63+ variable definitions
│   │
│   ├── tasks-service.js                ★ Task operations
│   │   ├── createTask()                - Line 124: Variable rendering
│   │   └── updateTask()                - Line 272: Re-render on update
│   │
│   ├── sequence-instances-service.js   ★ Sequence operations
│   │   ├── startSequence()             - Line 17: Single restaurant
│   │   └── startSequenceBulk()         - Line 582: Multiple restaurants
│   │
│   └── database-service.js             - Supabase client
│
├── components/
│   ├── ui/                             ★ NEW: Shared components
│   │   ├── variable-selector.tsx       - Main variable picker
│   │   ├── variable-badge.tsx          - Clickable variable
│   │   ├── variable-search.tsx         - Search/filter UI
│   │   └── variable-preview.tsx        - Live preview display
│   │
│   ├── message-templates/
│   │   └── CreateMessageTemplateModal.tsx  ★ UPDATE: Add VariableSelector
│   │       └── Lines 255-269: Current hardcoded list
│   │
│   ├── task-templates/
│   │   └── CreateTaskTemplateModal.tsx     ★ UPDATE: Add VariableSelector
│   │       └── Line 372: Current hardcoded list
│   │
│   ├── tasks/
│   │   └── CreateTaskModal.tsx             ★ UPDATE: Add VariableSelector
│   │       └── Line 535: Current hardcoded list
│   │
│   └── sequences/
│       └── SequenceStepBuilder.tsx         ★ UPDATE: Add VariableSelector
│           └── Lines 484-497: NO variables shown
│
├── hooks/
│   ├── useSequences.ts                 - Sequence CRUD operations
│   └── useVariableInsertion.ts         ★ NEW: Cursor insertion logic
│
├── lib/
│   └── qualification-constants.ts      - Qualification field definitions
│
└── routes/
    └── message-templates-routes.js     - Message template API
        └── POST /api/message-templates/validate - Validation endpoint
```

## Data Flow

### Flow 1: Template Creation with Variables

```
┌─────────────────────────────────────────────────────────────────────┐
│ USER CREATES MESSAGE TEMPLATE                                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ CreateMessageTemplateModal.tsx                                       │
│                                                                       │
│  1. User types message with variables                                │
│     Input: "Hi {first_name}, we'd love to help {restaurant_name}"   │
│                                                                       │
│  2. VariableSelector displays available variables                    │
│     • Shows all 63+ variables from getAvailableVariables()          │
│     • User clicks badge to insert at cursor                          │
│                                                                       │
│  3. Real-time validation (Phase 3)                                   │
│     validateVariables(messageContent) → {isValid, unknownVars}      │
│                                                                       │
│  4. Live preview with sample restaurant                              │
│     replaceVariables(message, previewRestaurant) → rendered         │
│                                                                       │
│  5. Save template                                                    │
│     POST /api/message-templates                                      │
│     Body: { name, type, message_content, subject_line }             │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Database: message_templates table                                    │
│  {                                                                    │
│    id: uuid,                                                          │
│    name: "Demo Follow-up",                                           │
│    type: "email",                                                     │
│    message_content: "Hi {first_name}, we'd love to help...",        │
│    subject_line: "Demo for {restaurant_name}",                      │
│    available_variables: ["first_name", "restaurant_name"],          │
│    is_active: true                                                    │
│  }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 2: Task Creation with Variable Rendering

```
┌─────────────────────────────────────────────────────────────────────┐
│ USER CREATES TASK                                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ CreateTaskModal.tsx                                                  │
│                                                                       │
│  1. Select message template                                          │
│     → Loads template message                                         │
│                                                                       │
│  2. Select restaurant                                                 │
│     → Fetches restaurant data                                        │
│                                                                       │
│  3. Message field populated                                          │
│     message: "Hi {first_name}, we'd love to help {restaurant_name}" │
│                                                                       │
│  4. Create task                                                      │
│     POST /api/tasks                                                  │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ tasks-service.js :: createTask()                                     │
│                                                                       │
│  1. Fetch restaurant data                                            │
│     restaurant = await getRestaurant(taskData.restaurant_id)        │
│                                                                       │
│  2. Render message with variables                                    │
│     message_rendered = await replaceVariables(                      │
│       taskData.message,                                              │
│       restaurant                                                      │
│     )                                                                 │
│                                                                       │
│  3. Store both versions                                              │
│     INSERT INTO tasks (                                              │
│       message: "Hi {first_name}...",        ← Original template     │
│       message_rendered: "Hi John..."        ← Computed output       │
│     )                                                                 │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ variable-replacement-service.js :: replaceVariables()               │
│                                                                       │
│  1. Extract variables                                                │
│     extractVariables("Hi {first_name}, we'd love to help...")       │
│     → ["first_name", "restaurant_name"]                             │
│                                                                       │
│  2. Resolve each variable                                            │
│     first_name = getVariableValue("first_name", restaurant)         │
│       → restaurant.contact_name.split(' ')[0]  → "John"            │
│                                                                       │
│     restaurant_name = getVariableValue("restaurant_name", restaurant)│
│       → restaurant.name  → "Bella Pizza"                            │
│                                                                       │
│  3. Replace in template                                              │
│     result = message                                                 │
│       .replace(/{first_name}/g, "John")                             │
│       .replace(/{restaurant_name}/g, "Bella Pizza")                 │
│                                                                       │
│  4. Return rendered message                                          │
│     → "Hi John, we'd love to help Bella Pizza"                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 3: Sequence Creation with Bulk Variable Rendering

```
┌─────────────────────────────────────────────────────────────────────┐
│ USER STARTS SEQUENCE FOR MULTIPLE RESTAURANTS (Bulk Mode)           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BulkStartSequenceModal.tsx                                           │
│                                                                       │
│  1. Select sequence template                                         │
│  2. Select 10 restaurants                                            │
│  3. Click "Start Sequence"                                           │
│     POST /api/sequence-instances/bulk                                │
│     Body: {                                                           │
│       sequence_template_id: uuid,                                    │
│       restaurant_ids: [uuid1, uuid2, ..., uuid10]                   │
│     }                                                                 │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ sequence-instances-service.js :: startSequenceBulk()                │
│                                                                       │
│  1. Fetch template with steps                                        │
│     template = await getSequenceTemplateById(templateId)            │
│     steps = template.sequence_steps (e.g., 5 steps)                │
│                                                                       │
│  2. Bulk fetch all restaurants (optimization)                        │
│     restaurants = await fetchRestaurants([uuid1..uuid10])           │
│                                                                       │
│  3. For each restaurant:                                             │
│     ┌───────────────────────────────────────────────────┐          │
│     │ a. Create sequence instance                        │          │
│     │    INSERT INTO sequence_instances                  │          │
│     │                                                     │          │
│     │ b. For each step in template:                      │          │
│     │    ┌─────────────────────────────────────────┐    │          │
│     │    │ • Get message from template hierarchy   │    │          │
│     │    │ • Render variables for THIS restaurant  │    │          │
│     │    │   messageRendered = replaceVariables(   │    │          │
│     │    │     step.message,                        │    │          │
│     │    │     restaurant                           │    │          │
│     │    │   )                                      │    │          │
│     │    │                                          │    │          │
│     │    │ • Create task with rendered message     │    │          │
│     │    │   INSERT INTO tasks (                   │    │          │
│     │    │     message: "{first_name}...",         │    │          │
│     │    │     message_rendered: "John...",        │    │          │
│     │    │     restaurant_id: uuid                 │    │          │
│     │    │   )                                      │    │          │
│     │    └─────────────────────────────────────────┘    │          │
│     │                                                     │          │
│     │ c. Result: 5 tasks created for this restaurant    │          │
│     └───────────────────────────────────────────────────┘          │
│                                                                       │
│  4. Summary: 10 restaurants × 5 steps = 50 tasks created            │
│     Each task has personalized message for its restaurant           │
└─────────────────────────────────────────────────────────────────────┘
```

### Flow 4: Dynamic Variable Resolution (Phase 4 - NEW)

```
┌─────────────────────────────────────────────────────────────────────┐
│ USER CREATES MESSAGE WITH DYNAMIC VARIABLES                          │
│ "Check out what we did for {example_restaurant_1} in {city}"        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ variable-replacement-service.js :: replaceVariables()               │
│                                                                       │
│  1. Extract variables                                                │
│     → ["example_restaurant_1", "city"]                              │
│                                                                       │
│  2. Resolve standard variable                                        │
│     city = getVariableValue("city", restaurant)                     │
│       → restaurant.city  → "Auckland"                                │
│                                                                       │
│  3. Resolve DYNAMIC variable (NEW)                                   │
│     example_restaurant_1 = getVariableValue(                        │
│       "example_restaurant_1",                                        │
│       restaurant                                                      │
│     )                                                                 │
│                                                                       │
│     ┌─────────────────────────────────────────────────┐            │
│     │ VARIABLE_MAPPINGS["example_restaurant_1"]       │            │
│     │   = async (restaurant) => {                      │            │
│     │       const examples =                           │            │
│     │         await getExampleRestaurants(             │            │
│     │           restaurant.city                        │            │
│     │         );                                        │            │
│     │       return examples[0]?.display_name || '';    │            │
│     │     }                                             │            │
│     └─────────────────────┬───────────────────────────┘            │
│                           │                                           │
│                           ▼                                           │
│     ┌─────────────────────────────────────────────────┐            │
│     │ getExampleRestaurants("Auckland") (NEW)         │            │
│     │                                                  │            │
│     │ SELECT * FROM city_example_customers            │            │
│     │ WHERE city = 'Auckland'                         │            │
│     │   AND is_active = true                          │            │
│     │ ORDER BY display_order ASC                      │            │
│     │ LIMIT 2;                                         │            │
│     │                                                  │            │
│     │ → [                                              │            │
│     │     {                                            │            │
│     │       display_name: "Burger King",              │            │
│     │       store_url: "https://burgerking.pumpd.nz"  │            │
│     │     },                                           │            │
│     │     {                                            │            │
│     │       display_name: "Pizza Hut",                │            │
│     │       store_url: "https://pizzahut.pumpd.nz"    │            │
│     │     }                                            │            │
│     │   ]                                              │            │
│     └─────────────────────┬───────────────────────────┘            │
│                           │                                           │
│                           ▼                                           │
│     example_restaurant_1 = "Burger King"                             │
│     example_restaurant_1_url = "https://burgerking.pumpd.nz"        │
│                                                                       │
│  4. Format as link (for email type)                                  │
│     if (messageType === 'email') {                                   │
│       formatted = formatVariableAsLink(                              │
│         "Burger King",                                               │
│         "https://burgerking.pumpd.nz",                              │
│         "html"                                                        │
│       )                                                               │
│       → '<a href="https://burgerking.pumpd.nz">Burger King</a>'    │
│     }                                                                 │
│                                                                       │
│  5. Replace in template                                              │
│     result = "Check out what we did for Burger King in Auckland"    │
│     (or with HTML link for emails)                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Service Layer Architecture

### Variable Replacement Service

**Purpose:** Core engine for variable extraction, resolution, and substitution

**Responsibility Boundaries:**
- ✅ Parse templates for variables
- ✅ Map variable names to data sources
- ✅ Transform/format values
- ✅ Substitute variables with values
- ❌ Does NOT create tasks/sequences (handled by tasks-service, sequence-instances-service)
- ❌ Does NOT persist data (handled by database-service)

**Key Design Patterns:**

1. **Strategy Pattern** - Variable resolution
   ```javascript
   // Each variable can use different resolution strategy
   VARIABLE_MAPPINGS = {
     // Strategy 1: Direct field mapping
     restaurant_name: 'name',

     // Strategy 2: Computed from function
     first_name: (restaurant) => {
       return restaurant.contact_name.split(' ')[0];
     },

     // Strategy 3: Async database query (NEW)
     example_restaurant_1: async (restaurant) => {
       const examples = await getExampleRestaurants(restaurant.city);
       return examples[0]?.display_name;
     }
   };
   ```

2. **Template Method Pattern** - replaceVariables flow
   ```javascript
   async function replaceVariables(messageContent, restaurant) {
     // 1. Extract (template step)
     const variables = extractVariables(messageContent);

     // 2. Resolve (subclass-specific)
     let result = messageContent;
     for (const variable of variables) {
       const value = await getVariableValue(variable, restaurant);

       // 3. Replace (template step)
       result = result.replace(
         new RegExp(`{${variable}}`, 'g'),
         value
       );
     }

     return result;
   }
   ```

3. **Factory Pattern** - Value formatting
   ```javascript
   function getFormattedValue(value, type) {
     const formatters = {
       number: formatNumber,
       currency: formatCurrency,
       percentage: formatPercentage,
       boolean: formatBoolean,
       array: formatArray,
       date: formatRelativeDate
     };

     return formatters[type]?.(value) ?? value;
   }
   ```

### Tasks Service Integration

**File:** `src/services/tasks-service.js`

**Variable Rendering Points:**

1. **Task Creation** (Line 173-196)
   ```javascript
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

2. **Task Update** (Line 314-328)
   - Re-renders variables when message changes
   - Uses existing restaurant data from task

**Design Principle:** Separation of concerns
- Tasks service handles CRUD operations
- Variable service handles rendering
- Database service handles persistence

### Sequence Instances Service Integration

**File:** `src/services/sequence-instances-service.js`

**Variable Rendering Points:**

1. **Single Sequence Start** (Line 86-116)
   - Renders each step's message once per sequence
   - Creates tasks with pre-rendered messages

2. **Bulk Sequence Start** (Line 690-732)
   - Optimizes with bulk restaurant fetch
   - Renders variables per restaurant
   - Handles errors gracefully (continues on failure)

**Performance Optimization:**
```javascript
// Bulk fetch restaurants (1 query for 100 restaurants)
const restaurants = await fetchRestaurantsInBulk(restaurantIds);

// Map for O(1) lookups
const restaurantMap = new Map(restaurants.map(r => [r.id, r]));

// Process each restaurant
for (const restaurantId of restaurantIds) {
  const restaurant = restaurantMap.get(restaurantId);

  // Render variables for THIS restaurant
  const messageRendered = await replaceVariables(
    message,
    restaurant
  );
}
```

## Error Handling

### Variable Not Found

**Behavior:** Return variable unchanged (e.g., `{unknown_var}`)

```javascript
function getVariableValue(variableName, restaurant) {
  const mapping = VARIABLE_MAPPINGS[variableName];

  if (!mapping) {
    // Log warning but don't fail
    console.warn(`Unknown variable: ${variableName}`);

    // Return unchanged so user can see the error
    return `{${variableName}}`;
  }

  // ... resolve variable
}
```

**Rationale:**
- Non-blocking: Message still sends/displays
- Visible: User can see what went wrong
- Debuggable: Unknown variables stand out in rendered output

### Phase 3 Enhancement: Real-time Validation

```javascript
// In UI component
const [validation, setValidation] = useState({
  isValid: true,
  unknownVariables: []
});

useEffect(() => {
  const result = validateVariables(formData.message);
  setValidation(result);
}, [formData.message]);

// Display warnings
{!validation.isValid && (
  <Alert variant="warning">
    Unknown variables: {validation.unknownVariables.join(', ')}
  </Alert>
)}
```

### Async Variable Resolution Errors

**Phase 4 Enhancement:** Handle database query failures

```javascript
example_restaurant_1: async (restaurant) => {
  try {
    const examples = await getExampleRestaurants(restaurant.city);
    return examples[0]?.display_name || '';
  } catch (error) {
    console.error('Failed to fetch example restaurants:', error);

    // Graceful fallback
    return '[example restaurant]';
  }
}
```

## Security Considerations

### 1. Variable Content Sanitization

**Risk:** User-generated content in variables could contain XSS

**Mitigation:**
```javascript
// For HTML email rendering
function sanitizeForHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Apply when rendering for email
if (messageType === 'email') {
  value = sanitizeForHtml(value);
}
```

**Note:** Restaurant data is trusted (admin-entered), but caution with:
- User-submitted qualification data
- External API data (if added later)

### 2. SQL Injection Protection

**Risk:** Dynamic variables query database with city parameter

**Mitigation:** Use parameterized queries (Supabase handles this)
```javascript
// SAFE: Supabase parameterizes automatically
const { data } = await getSupabaseClient()
  .from('city_example_customers')
  .eq('city', restaurant.city)  // ← Parameterized
  .select();

// NEVER do this:
// const query = `SELECT * FROM city_example_customers WHERE city = '${restaurant.city}'`;
```

### 3. Permission Checks

**Requirement:** Ensure users can only access their organization's data

**Implementation:**
```javascript
// All services use getCurrentOrganizationId() filter
.eq('organisation_id', getCurrentOrganizationId())

// city_example_customers must also filter by org
const { data } = await getSupabaseClient()
  .from('city_example_customers')
  .eq('city', restaurant.city)
  .eq('organisation_id', getCurrentOrganizationId())  // ← Security
  .select();
```

## Performance Considerations

### 1. Variable Resolution Caching

**Problem:** Same variables resolved multiple times per request

**Solution:** Memoization at service call level
```javascript
// Cache within single replaceVariables call
async function replaceVariables(messageContent, restaurant) {
  const cache = new Map();

  for (const variable of variables) {
    // Check cache first
    if (!cache.has(variable)) {
      cache.set(variable, await getVariableValue(variable, restaurant));
    }

    const value = cache.get(variable);
    result = result.replace(regex, value);
  }
}
```

### 2. Bulk Operations Optimization

**Current Implementation:** Sequence bulk start already optimizes
- Single query to fetch all restaurants
- Map for O(1) lookups
- Continues on individual failures

**Phase 4 Enhancement:** Cache example restaurants per city
```javascript
// At bulk operation level
const cityExamplesCache = new Map();

async function getExampleRestaurantsWithCache(city) {
  if (!cityExamplesCache.has(city)) {
    const examples = await getExampleRestaurants(city);
    cityExamplesCache.set(city, examples);
  }

  return cityExamplesCache.get(city);
}
```

### 3. Preview Performance

**Challenge:** Real-time preview with async variables

**Solution:** Debounce + loading states
```javascript
const [previewLoading, setPreviewLoading] = useState(false);
const [previewContent, setPreviewContent] = useState('');

const debouncedPreview = useMemo(
  () => debounce(async (message, restaurant) => {
    setPreviewLoading(true);
    const rendered = await replaceVariables(message, restaurant);
    setPreviewContent(rendered);
    setPreviewLoading(false);
  }, 500),
  []
);

useEffect(() => {
  if (formData.message && previewRestaurant) {
    debouncedPreview(formData.message, previewRestaurant);
  }
}, [formData.message, previewRestaurant]);
```

## Integration Points

### 1. Authentication System

**Integration:** Uses existing auth context

```javascript
// Services get organization ID from auth context
import { getCurrentOrganizationId } from './database-service';

// All queries filtered by organization
.eq('organisation_id', getCurrentOrganizationId())
```

**Impact:** Variable system is multi-tenant by default

### 2. Database Service

**Integration:** All database access through Supabase client

```javascript
import { getSupabaseClient } from './database-service';

const client = getSupabaseClient();
const { data, error } = await client
  .from('city_example_customers')
  .select();
```

**New Dependency:** Phase 4 adds new table access

### 3. Message Template System

**Integration:** Variable service consumed by message templates

```javascript
// Message template preview
const rendered = await variableReplacementService.replaceVariables(
  template.message_content,
  previewRestaurant
);
```

**Validation Endpoint:** `POST /api/message-templates/validate`
```javascript
router.post('/validate', async (req, res) => {
  const validation = await messageTemplatesService.validateTemplate(
    req.body.message_content
  );

  res.json({ success: true, validation });
});
```

### 4. UI Framework (React + Tailwind)

**Integration:** Components use existing UI patterns

```javascript
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
```

**New Components:** VariableSelector follows established patterns
- Uses shadcn/ui components
- Follows Tailwind styling
- Implements loading states with Loader2 icon

## Testing Strategy

### Unit Tests

**variable-replacement-service.js:**
```javascript
describe('Variable Replacement Service', () => {
  describe('extractVariables', () => {
    it('should extract single variable', () => {
      const result = extractVariables('Hello {restaurant_name}');
      expect(result).toEqual(['restaurant_name']);
    });

    it('should extract multiple variables', () => {
      const result = extractVariables('{first_name} from {city}');
      expect(result).toEqual(['first_name', 'city']);
    });

    it('should deduplicate variables', () => {
      const result = extractVariables('{name} and {name}');
      expect(result).toEqual(['name']);
    });
  });

  describe('getVariableValue', () => {
    const mockRestaurant = {
      name: 'Bella Pizza',
      contact_name: 'John Smith',
      city: 'Auckland'
    };

    it('should resolve direct mapping', () => {
      const result = getVariableValue('restaurant_name', mockRestaurant);
      expect(result).toBe('Bella Pizza');
    });

    it('should resolve computed variable', () => {
      const result = getVariableValue('first_name', mockRestaurant);
      expect(result).toBe('John');
    });

    it('should return variable unchanged if not found', () => {
      const result = getVariableValue('unknown_var', mockRestaurant);
      expect(result).toBe('{unknown_var}');
    });
  });

  describe('replaceVariables', () => {
    it('should replace all variables', async () => {
      const message = 'Hi {first_name} from {restaurant_name}';
      const restaurant = {
        name: 'Bella Pizza',
        contact_name: 'John Smith'
      };

      const result = await replaceVariables(message, restaurant);
      expect(result).toBe('Hi John from Bella Pizza');
    });
  });

  describe('validateVariables', () => {
    it('should validate known variables', () => {
      const result = validateVariables('{restaurant_name} {city}');
      expect(result.isValid).toBe(true);
      expect(result.unknownVariables).toEqual([]);
    });

    it('should detect unknown variables', () => {
      const result = validateVariables('{invalid_var}');
      expect(result.isValid).toBe(false);
      expect(result.unknownVariables).toEqual(['invalid_var']);
    });
  });
});
```

### Integration Tests

**tasks-service.js:**
```javascript
describe('Tasks Service - Variable Rendering', () => {
  it('should render variables when creating task', async () => {
    const taskData = {
      name: 'Follow up',
      type: 'email',
      restaurant_id: 'test-uuid',
      message: 'Hi {first_name}'
    };

    const task = await createTask(taskData);

    expect(task.message).toBe('Hi {first_name}');
    expect(task.message_rendered).toBe('Hi John');
  });

  it('should re-render variables when updating message', async () => {
    const updates = {
      message: 'Hello {restaurant_name}'
    };

    const task = await updateTask('task-uuid', updates);

    expect(task.message).toBe('Hello {restaurant_name}');
    expect(task.message_rendered).toBe('Hello Bella Pizza');
  });
});
```

### Component Tests

**VariableSelector.tsx:**
```javascript
describe('VariableSelector', () => {
  it('should display all available variables', () => {
    render(<VariableSelector onVariableSelect={jest.fn()} />);

    const variables = getAvailableVariables();
    variables.forEach(category => {
      category.variables.forEach(variable => {
        expect(screen.getByText(`{${variable.name}}`)).toBeInTheDocument();
      });
    });
  });

  it('should insert variable at cursor position', () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <VariableSelector onVariableSelect={onSelect} />
    );

    fireEvent.click(getByText('{restaurant_name}'));

    expect(onSelect).toHaveBeenCalledWith('restaurant_name');
  });

  it('should filter variables by category', () => {
    const { getByLabelText, queryByText } = render(
      <VariableSelector onVariableSelect={jest.fn()} />
    );

    fireEvent.click(getByLabelText('Contact Information'));

    expect(queryByText('{contact_name}')).toBeInTheDocument();
    expect(queryByText('{demo_store_url}')).not.toBeInTheDocument();
  });
});
```

### End-to-End Tests

**Sequence creation flow:**
```javascript
describe('Sequence Creation with Variables', () => {
  it('should create sequence with rendered variables', async () => {
    // 1. Navigate to sequences page
    await page.goto('/sequences?tab=instances');

    // 2. Click new sequence
    await page.click('text=New Sequence');

    // 3. Select restaurant
    await page.click('text=Bella Pizza');

    // 4. Select template
    await page.selectOption('select[name="template"]', 'Demo Follow-up');

    // 5. Start sequence
    await page.click('button:has-text("Start Sequence")');

    // 6. Verify tasks created with rendered variables
    const task = await db.tasks.findFirst({
      where: { sequence_instance_id: { not: null } }
    });

    expect(task.message).toContain('{first_name}');
    expect(task.message_rendered).toContain('John');
    expect(task.message_rendered).not.toContain('{');
  });
});
```

---

**Last Updated:** 2025-01-26
**Version:** 1.0
