# Lead Contact QuickView Investigation

## Overview

This document details the investigation for creating a quickview popup for the Lead Contact column on the Restaurants page, similar to the existing `TaskTypeQuickView.tsx` component.

**Goal**: Create a `LeadContactQuickView` component that displays lead contact information in a popover when hovering/clicking the Lead Contact cell.

---

## Current State Analysis

### Lead Contact Column (Restaurants.jsx lines 940-964)

**Current Implementation**:
```tsx
<TableCell>
  <div className="space-y-1">
    {restaurant.contact_name && (
      <div className="flex items-center gap-1 text-xs">
        <User className="h-3 w-3 text-muted-foreground" />
        <span>{restaurant.contact_name}</span>
      </div>
    )}
    {restaurant.contact_email && (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Mail className="h-3 w-3" />
        {restaurant.contact_email}
      </div>
    )}
    {restaurant.contact_phone && (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Phone className="h-3 w-3" />
        {restaurant.contact_phone}
      </div>
    )}
    {!restaurant.contact_name && !restaurant.contact_phone && !restaurant.contact_email && (
      <span className="text-xs text-muted-foreground">No contact</span>
    )}
  </div>
</TableCell>
```

**Current Behavior**:
- Simple inline display of contact information
- No interactive elements (no copy, no popover)
- Shows contact name, email, phone with icons
- Shows "No contact" placeholder when empty

---

## Reference Component: TaskTypeQuickView.tsx

**Location**: `UberEats-Image-Extractor/src/components/tasks/TaskTypeQuickView.tsx` (795 lines)

**Key Features to Reuse**:

### 1. Popover Structure
```tsx
<Popover open={isOpen} onOpenChange={setIsOpen}>
  <PopoverTrigger asChild>
    {children}
  </PopoverTrigger>
  <PopoverContent className="w-96 max-h-[500px] overflow-y-auto" align="start">
    {/* Content */}
  </PopoverContent>
</Popover>
```

### 2. ContactField Component Pattern
```tsx
const ContactField = ({ icon: Icon, label, value, field, copyable = true }: any) => {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 group">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
      {copyable && <CopyButton text={value} field={field} />}
    </div>
  );
};
```

### 3. CopyButton Component Pattern
```tsx
const CopyButton = ({ text, field }: { text: string; field: string }) => (
  <Button
    variant="ghost"
    size="sm"
    className="h-6 w-6 p-0 ml-auto shrink-0"
    onClick={(e) => {
      e.stopPropagation();
      copyToClipboard(text, field);
    }}
  >
    {copiedField === field ? (
      <Check className="h-3 w-3 text-green-600" />
    ) : (
      <Copy className="h-3 w-3" />
    )}
  </Button>
);
```

### 4. Copy to Clipboard Logic
```tsx
const copyToClipboard = async (text: string, field: string) => {
  try {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({
      title: "Copied!",
      description: `${field} copied to clipboard`,
    });
    setTimeout(() => setCopiedField(null), 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
    toast({
      title: "Error",
      description: "Failed to copy to clipboard",
      variant: "destructive"
    });
  }
};
```

---

## Database Schema Analysis

### Relevant Fields from `restaurants` Table

| Column | Data Type | Description |
|--------|-----------|-------------|
| contact_name | text | Primary contact person name |
| contact_email | text | Contact email address |
| contact_phone | text | Contact phone number |
| contact_role | text | Contact's role (e.g., owner, manager) |
| weekly_sales_range | text | Text-based sales range (e.g., "$5k-10k") |
| weekly_uber_sales_volume | numeric | Numeric weekly sales volume |
| lead_created_at | timestamp with time zone | When the lead was created |
| created_at | timestamp with time zone | Record creation timestamp |
| city | text | City location |
| address | text | Full street address |
| cuisine | ARRAY | Array of cuisine types |
| ubereats_url | text | UberEats store URL |
| demo_store_url | text | Demo store URL |
| website_url | text | Restaurant website URL |
| online_ordering_platform | text | Current online ordering platform |

### Fields Requested by User

**Contact Information Section:**
1. **Contact Name** - `contact_name`
2. **Contact Email** - `contact_email`
3. **Contact Phone** - `contact_phone`

**Location Section:**
4. **City** - `city`
5. **Address** - `address`

**Business Information Section:**
6. **Cuisine** - `cuisine` (array, display as comma-separated or badges)
7. **Weekly Sales Range** - `weekly_sales_range` (primary) or format `weekly_uber_sales_volume`
8. **Online Ordering Platform** - `online_ordering_platform`

**Links Section:**
9. **UberEats URL** - `ubereats_url` (clickable link + copy)
10. **Demo Store URL** - `demo_store_url` (clickable link + copy)
11. **Website URL** - `website_url` (clickable link + copy)

**Meta Section:**
12. **Lead Created** - `lead_created_at` (if null, fall back to `created_at`)

---

## Proposed Component Design

### Component: LeadContactQuickView

**File Location**: `UberEats-Image-Extractor/src/components/restaurants/LeadContactQuickView.tsx`

**Props Interface**:
```typescript
interface LeadContactQuickViewProps {
  restaurant: {
    id: string;
    name: string;
    // Contact Information
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    // Location
    city?: string;
    address?: string;
    // Business Information
    cuisine?: string[];
    weekly_sales_range?: string;
    weekly_uber_sales_volume?: number;
    online_ordering_platform?: string;
    // Links
    ubereats_url?: string;
    demo_store_url?: string;
    website_url?: string;
    // Meta
    lead_created_at?: string;
    created_at?: string;
  };
  children: React.ReactNode;
}
```

### Visual Design

```
┌──────────────────────────────────────┐
│ Lead Contact                         │
├──────────────────────────────────────┤
│ CONTACT INFORMATION                  │
├──────────────────────────────────────┤
│ 👤 Contact Name                      │
│    John Smith                    [📋]│
│ 📧 Contact Email                     │
│    john@restaurant.com           [📋]│
│ 📞 Contact Phone                     │
│    +64 21 123 4567               [📋]│
├──────────────────────────────────────┤
│ LOCATION                             │
├──────────────────────────────────────┤
│ 📍 City                              │
│    Auckland                          │
│ 🏠 Address                           │
│    123 Queen Street, Auckland    [📋]│
├──────────────────────────────────────┤
│ BUSINESS INFORMATION                 │
├──────────────────────────────────────┤
│ 🍽️ Cuisine                           │
│    [Italian] [Pizza] [Pasta]         │
│ 💰 Weekly Sales Range                │
│    $5,000 - $10,000                  │
│ 🛒 Online Ordering Platform          │
│    Mobi2Go                           │
├──────────────────────────────────────┤
│ LINKS                                │
├──────────────────────────────────────┤
│ 🔗 UberEats                          │
│    Open Link ↗                   [📋]│
│ 🏪 Demo Store                        │
│    Open Link ↗                   [📋]│
│ 🌐 Website                           │
│    Open Link ↗                   [📋]│
├──────────────────────────────────────┤
│ 📅 Lead Created                      │
│    Dec 3, 2024                       │
└──────────────────────────────────────┘
```

### Trigger Element (Compact Display)

The trigger should be the existing Lead Contact cell content, wrapped in the popover trigger:

```tsx
<LeadContactQuickView restaurant={restaurant}>
  <div className="space-y-1 cursor-pointer hover:bg-muted/30 p-1 rounded transition-colors">
    {restaurant.contact_name && (
      <div className="flex items-center gap-1 text-xs">
        <User className="h-3 w-3 text-muted-foreground" />
        <span>{restaurant.contact_name}</span>
      </div>
    )}
    {/* ... rest of existing content ... */}
  </div>
</LeadContactQuickView>
```

---

## Implementation Plan

### Phase 1: Create Component

1. Create new file `LeadContactQuickView.tsx` in `components/restaurants/`
2. Copy Popover pattern from TaskTypeQuickView
3. Implement ContactField helper component
4. Implement CopyButton helper component
5. Add copy-to-clipboard functionality
6. Display all requested fields

### Phase 2: Integrate into Restaurants Page

1. Import LeadContactQuickView in Restaurants.jsx
2. Wrap Lead Contact TableCell content with the new component
3. Pass restaurant data to component

### Phase 3: Testing

1. Test copy functionality for each field
2. Test empty state (no contact info)
3. Test partial data (some fields missing)
4. Verify tooltip/popover positioning in table

---

## Files to Create

| File | Purpose |
|------|---------|
| `UberEats-Image-Extractor/src/components/restaurants/LeadContactQuickView.tsx` | New quickview component |

## Files to Modify

| File | Changes Required |
|------|------------------|
| `UberEats-Image-Extractor/src/pages/Restaurants.jsx` | Import and use LeadContactQuickView |

---

## Dependencies

### Required Imports
```typescript
import React, { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '../../hooks/use-toast';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Home,
  UtensilsCrossed,
  DollarSign,
  ShoppingCart,
  Link2,
  Store,
  Globe,
  Calendar,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
```

### Component Dependencies
- `@/components/ui/popover` - Popover component
- `@/components/ui/button` - Button component
- `@/components/ui/badge` - Badge component (for cuisine tags)
- `@/hooks/use-toast` - Toast notifications
- `lucide-react` - Icons

### Additional Component Pattern: LinkField
```tsx
const LinkField = ({ icon: Icon, label, url, field }: any) => {
  if (!url) return null;
  return (
    <div className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 group">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <a
          href={url.startsWith('http') ? url : `https://${url}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-medium text-brand-blue hover:underline flex items-center gap-1"
        >
          Open Link
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <CopyButton text={url} field={field} />
    </div>
  );
};
```

### CuisineField Component Pattern
```tsx
const CuisineField = ({ cuisine }: { cuisine?: string[] }) => {
  if (!cuisine || cuisine.length === 0) return null;
  return (
    <div className="p-2 rounded">
      <div className="flex items-center gap-2 mb-2">
        <UtensilsCrossed className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="text-xs text-muted-foreground">Cuisine</div>
      </div>
      <div className="flex flex-wrap gap-1 ml-6">
        {cuisine.map((item, index) => (
          <Badge key={index} variant="secondary" className="text-xs">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
};
```

---

## Formatting Utilities

### Date Formatting
```typescript
const formatLeadCreatedDate = (dateString?: string) => {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};
```

### Sales Volume Formatting (if displaying numeric value)
```typescript
const formatCurrency = (value?: number) => {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};
```

---

## Edge Cases to Handle

1. **All fields empty** - Show "No information available" message
2. **Partial data** - Only show sections/fields that have values
3. **Long email addresses** - Truncate with ellipsis, full value on hover/copy
4. **Long URLs** - Truncate display, full value copied
5. **Null vs undefined** - Handle both for all optional fields
6. **Date fallback** - Use `created_at` if `lead_created_at` is null
7. **Empty cuisine array** - Don't show cuisine section if empty
8. **Invalid URLs** - Handle URLs that don't start with http/https (prepend `https://`)
9. **Section visibility** - Only show section headers if at least one field in section has data
10. **Link behavior** - All external links open in new tab (`target="_blank"`) with security attributes (`rel="noopener noreferrer"`)

---

## Risk Assessment

### Low Risk
- Creating new component (no existing functionality affected)
- Using established patterns from TaskTypeQuickView
- Non-destructive change to Restaurants page

### Considerations
- Ensure popover doesn't interfere with table scrolling
- Popover positioning in table cells may need adjustment
- Mobile responsiveness of popover

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Create LeadContactQuickView component | Low |
| Integrate into Restaurants.jsx | Low |
| Testing | Low |

**Total**: Low complexity feature

---

## Next Steps

1. Review this investigation document
2. Confirm the proposed field list and design
3. Implement the component
4. Test and deploy
