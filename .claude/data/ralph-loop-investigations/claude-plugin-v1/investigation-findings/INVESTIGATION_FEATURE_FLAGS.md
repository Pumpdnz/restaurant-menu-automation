# Investigation: Feature Flags

## Overview
Feature flags are stored in the `organisations` table in the `feature_flags` JSON column. They control access to features at both route and UI level.

## Feature Flag Structure

```typescript
interface FeatureFlags {
  [key: string]: boolean | { enabled: boolean; ratePerItem?: number } | FeatureFlags;
}
```

- Simple flags: `{ enabled: boolean }`
- Flags with pricing: `{ enabled: boolean, ratePerItem?: number }`
- Nested flags: Parent can have sub-features

## Exact Flag Names

### Required for Dashboard

| Feature | Flag Name | Description |
|---------|-----------|-------------|
| Lead Scraping | `leadScraping` | Top-level with nested `scrapeJobs`, `stepEnrichment`, `leadConversion` |
| Tasks & Sequences | `tasksAndSequences` | Sales tasks and sequence management |
| Registration Batches | `registrationBatches` | Batch registration processing |

### Other Available Flags
- `socialMedia` - Social media features
- `analytics` - Analytics dashboard
- `integrations.cloudwaitressIntegration` - CloudWaitress integration
- `registration.onboardingSync` - Onboarding sync feature
- `registration.onboardingUserManagement` - User management

## Pattern for Conditional Rendering

### Pattern 1: Route-Level Protection (App.tsx)
```tsx
<Route path="leads" element={
  <FeatureProtectedRoute featurePath="leadScraping" featureName="Lead Scraping">
    <LeadScrapes />
  </FeatureProtectedRoute>
} />
```

### Pattern 2: Inline UI Gating (Components)
```tsx
const { isFeatureEnabled } = useAuth();

if (isFeatureEnabled('tasksAndSequences')) {
  // Render component
}
```

### Pattern 3: Navigation-Level Gating (NavigationItems.jsx)
```jsx
if (isFeatureEnabled('leadScraping')) {
  items.push({ href: '/leads', label: 'Lead Scraping', icon: Users });
}
```

## Context Provider

**Provider:** `AuthProvider` (in `src/context/AuthContext.tsx`)
- Wraps entire app in App.tsx
- Loads feature flags from organisation record on login
- Fetches from `organisations` table

**Hook:** `useAuth()`
- Returns: `{ featureFlags, isFeatureEnabled }`
- `isFeatureEnabled(path)` supports dot-notation for nested flags

## isFeatureEnabled Implementation

```typescript
const isFeatureEnabled = (path: string): boolean => {
  if (!featureFlags) return false;

  const parts = path.split('.');
  let current = featureFlags;

  for (const part of parts) {
    if (current === undefined) return false;
    current = current[part];
  }

  if (typeof current === 'boolean') return current;
  if (typeof current === 'object' && 'enabled' in current) return current.enabled;
  if (typeof current === 'object') return true;

  return false;
};
```

## Examples of Feature-Gated UI Sections

### Navigation Sidebar (NavigationItems.jsx lines 62-87)
```jsx
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
```

## FeatureProtectedRoute Component

**Location:** `src/components/FeatureProtectedRoute.tsx`

**Props:**
- `featurePath` (required) - Dot-notation path to feature
- `fallbackPath` (optional) - Redirect path if disabled (default: "/dashboard")
- `featureName` (optional) - Human-readable name for display
- `children` (required) - Component to render if enabled

**Behavior:**
1. Checks authentication (redirects to /login if not)
2. Checks if featureFlags loaded (shows spinner if not)
3. If disabled: Shows "Feature Not Available" UI
4. If enabled: Renders children

## Dashboard Integration Pattern

For wrapping Dashboard sections:
```tsx
const { isFeatureEnabled } = useAuth();

return (
  <>
    {isFeatureEnabled('leadScraping') && (
      <ReportsSection />
    )}
    {isFeatureEnabled('registrationBatches') && (
      <BatchesPreview />
    )}
    {isFeatureEnabled('tasksAndSequences') && (
      <TasksList />
    )}
  </>
);
```
