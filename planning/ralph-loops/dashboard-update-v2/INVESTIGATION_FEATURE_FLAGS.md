# Feature Flag Implementation Investigation

## Summary

The feature flag system is implemented via the `AuthContext` and stored per-organisation in the `organisations.feature_flags` JSONB column.

---

## Feature Flag System Overview

### Primary Access Method: `useAuth()` Hook

The recommended approach for accessing feature flags in components is via the `useAuth()` hook:

```tsx
import { useAuth } from '@/context/AuthContext';

const MyComponent = () => {
  const { isFeatureEnabled } = useAuth();

  // Check if feature is enabled
  if (isFeatureEnabled('leadScraping')) {
    // Feature is enabled
  }

  return (
    <>
      {isFeatureEnabled('tasksAndSequences') && (
        <TasksSection />
      )}
    </>
  );
};
```

### Alternative: `useFeatureFlags()` Hook

For additional functionality like getting the full flag object or loading states:

```tsx
import { useFeatureFlags, FEATURE_FLAG_PATHS } from '@/hooks/useFeatureFlags';

const MyComponent = () => {
  const { isFeatureEnabled, getFeatureFlag, loading } = useFeatureFlags();

  // Use predefined path constants
  if (isFeatureEnabled(FEATURE_FLAG_PATHS.LEAD_SCRAPING)) {
    // ...
  }

  // Get the full flag object (for accessing metadata like ratePerItem)
  const flag = getFeatureFlag<{ enabled: boolean; ratePerItem?: number }>('premiumExtraction');

  return null;
};
```

---

## Feature Flag Keys for Dashboard Features

Based on the codebase analysis, here are the required feature flag keys:

| Feature | Flag Path | Description |
|---------|-----------|-------------|
| Lead Scraping | `leadScraping` | Enables Lead Scraping page/section |
| Tasks & Sequences | `tasksAndSequences` | Enables Tasks and Sequences pages |
| Registration Batches | `registrationBatches` | Enables Automation/Registration Batches page |

### Predefined Constants (from `useFeatureFlags.ts`)

```typescript
export const FEATURE_FLAG_PATHS = {
  // Lead scraping features
  LEAD_SCRAPING: 'leadScraping',
  LEAD_SCRAPING_JOBS: 'leadScraping.scrapeJobs',
  LEAD_SCRAPING_CONVERSION: 'leadScraping.leadConversion',
  LEAD_SCRAPING_ENRICHMENT: 'leadScraping.stepEnrichment',

  // Tasks and sequences
  TASKS_AND_SEQUENCES: 'tasksAndSequences',

  // Registration batches
  REGISTRATION_BATCHES: 'registrationBatches',

  // ... other flags
} as const;
```

---

## Implementation Patterns from Existing Code

### Pattern 1: Simple Conditional Rendering (Most Common)

From `/UberEats-Image-Extractor/src/components/navigation/NavigationItems.jsx`:

```jsx
import { useAuth } from '@/context/AuthContext';

const NavigationItems = () => {
  const { user } = useAuth();

  // Access feature flags from user's organisation
  const featureFlags = useMemo(() => {
    return user?.organisation?.feature_flags || {};
  }, [user?.organisation?.feature_flags]);

  // Local helper function
  const isFeatureEnabled = (flagPath) => {
    const parts = flagPath.split('.');
    let current = featureFlags;
    for (const part of parts) {
      if (current === undefined || current === null) return false;
      current = current[part];
    }
    if (current === undefined || current === null) return false;
    if (typeof current === 'object') {
      return current.enabled === true;
    }
    return current === true;
  };

  const items = [];

  // Conditionally add items based on feature flags
  if (isFeatureEnabled('tasksAndSequences')) {
    items.push({ href: '/tasks', label: 'Tasks', icon: CheckSquare });
    items.push({ href: '/sequences', label: 'Sequences', icon: Workflow });
  }

  if (isFeatureEnabled('leadScraping')) {
    items.push({ href: '/leads', label: 'Lead Scraping', icon: Users });
  }

  if (isFeatureEnabled('registrationBatches')) {
    items.push({ href: '/registration-batches', label: 'Automation', icon: Zap });
  }

  return (/* ... */);
};
```

### Pattern 2: Using useAuth() Directly (Simplest)

From `/UberEats-Image-Extractor/src/pages/Extractions.jsx`:

```jsx
import { useAuth } from '../context/AuthContext';

export default function Extractions() {
  const { isFeatureEnabled } = useAuth();

  return (
    <div>
      {isFeatureEnabled('csvDownload') && (
        <Button>Download CSV</Button>
      )}
      {isFeatureEnabled('imageZipDownload') && (
        <Button>Download Images</Button>
      )}
    </div>
  );
}
```

### Pattern 3: Route Protection

From `/UberEats-Image-Extractor/src/components/FeatureProtectedRoute.tsx`:

```tsx
import { FeatureProtectedRoute } from '@/components/FeatureProtectedRoute';

// In router configuration
<Route path="/leads" element={
  <FeatureProtectedRoute featurePath="leadScraping" featureName="Lead Scraping">
    <LeadScrapes />
  </FeatureProtectedRoute>
} />
```

---

## Feature Flag Data Structure

Feature flags are stored in the `organisations.feature_flags` JSONB column with this structure:

```typescript
interface FeatureFlags {
  // Simple boolean flags
  csvDownload: boolean | { enabled: boolean };
  tasksAndSequences: boolean | { enabled: boolean };
  registrationBatches: boolean | { enabled: boolean };

  // Nested feature flags
  leadScraping: {
    enabled: boolean;
    scrapeJobs: { enabled: boolean };
    leadConversion: { enabled: boolean };
    stepEnrichment: { enabled: boolean };
  };

  registration: {
    enabled: boolean;
    userAccountRegistration: { enabled: boolean };
    restaurantRegistration: { enabled: boolean };
    menuUploading: { enabled: boolean };
    // ... more sub-features
  };
}
```

---

## Copy-Paste Ready Implementation for Dashboard

### Step 1: Import and Access Feature Flags

```tsx
import { useAuth } from '@/context/AuthContext';

const Dashboard = () => {
  const { isFeatureEnabled, featureFlags, user } = useAuth();

  // ...
};
```

### Step 2: Conditional Rendering Template

```tsx
// For Lead Scraping section
{isFeatureEnabled('leadScraping') && (
  <DashboardCard
    title="Lead Scraping"
    description="Manage lead scraping jobs"
    // ... other props
  />
)}

// For Tasks & Sequences section
{isFeatureEnabled('tasksAndSequences') && (
  <DashboardCard
    title="Tasks"
    description="View and manage tasks"
    // ... other props
  />
)}

// For Registration Batches section
{isFeatureEnabled('registrationBatches') && (
  <DashboardCard
    title="Automation"
    description="Registration batch management"
    // ... other props
  />
)}
```

### Step 3: Complete Dashboard Component Template

```tsx
import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Dashboard = () => {
  const { isFeatureEnabled, user } = useAuth();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Always visible cards */}
        <Card>
          <CardHeader>
            <CardTitle>Restaurants</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Restaurants overview */}
          </CardContent>
        </Card>

        {/* Feature-flagged: Lead Scraping */}
        {isFeatureEnabled('leadScraping') && (
          <Card>
            <CardHeader>
              <CardTitle>Lead Scraping</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Lead scraping overview */}
            </CardContent>
          </Card>
        )}

        {/* Feature-flagged: Tasks & Sequences */}
        {isFeatureEnabled('tasksAndSequences') && (
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Tasks overview */}
            </CardContent>
          </Card>
        )}

        {/* Feature-flagged: Registration Batches */}
        {isFeatureEnabled('registrationBatches') && (
          <Card>
            <CardHeader>
              <CardTitle>Automation</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Registration batches overview */}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
```

---

## Feature Flag Lookup Reference

| Dashboard Section | Feature Flag Path | Check Code |
|-------------------|-------------------|------------|
| Lead Scraping Overview | `leadScraping` | `isFeatureEnabled('leadScraping')` |
| Tasks Overview | `tasksAndSequences` | `isFeatureEnabled('tasksAndSequences')` |
| Sequences Overview | `tasksAndSequences` | `isFeatureEnabled('tasksAndSequences')` |
| Automation/Registration Batches | `registrationBatches` | `isFeatureEnabled('registrationBatches')` |
| Analytics | `analytics` | `isFeatureEnabled('analytics')` |
| Social Media | `socialMedia` | `isFeatureEnabled('socialMedia')` |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `/UberEats-Image-Extractor/src/context/AuthContext.tsx` | Main auth context with `isFeatureEnabled` function |
| `/UberEats-Image-Extractor/src/hooks/useFeatureFlags.ts` | Alternative hook with `FEATURE_FLAG_PATHS` constants |
| `/UberEats-Image-Extractor/src/types/auth.ts` | TypeScript types for `FeatureFlags` interface |
| `/UberEats-Image-Extractor/src/components/FeatureProtectedRoute.tsx` | Route-level feature protection component |
| `/UberEats-Image-Extractor/src/components/super-admin/organizations/FeatureFlagsEditor.tsx` | Feature flag configuration UI |

---

## Notes

1. **Flag Resolution**: The `isFeatureEnabled` function supports both simple boolean flags (`true/false`) and object flags (`{ enabled: true }`).

2. **Nested Flags**: Use dot notation for nested flags: `isFeatureEnabled('leadScraping.scrapeJobs')`.

3. **Default Behavior**: If a flag doesn't exist or is null/undefined, `isFeatureEnabled` returns `false`.

4. **Loading State**: Feature flags are loaded with the user's organisation. Check `featureFlags === null` if you need to show a loading state.
