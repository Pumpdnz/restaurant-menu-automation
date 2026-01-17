# Issue 3: Limited Column Values - Expandable Rows Implementation

## Status: RESOLVED

## Problem Description
The `ScrapeJobStepDetailModal.tsx` table only showed limited lead information in columns (name, cuisine, city, rating, status, issues). Users had to open the full `LeadDetailModal` to see additional enriched data like address, phone, website, social links, and contact details.

Additionally, step rows in `ScrapeJobStepList.tsx` were not clickable - users had to use specific action buttons to open the step detail modal.

## Solution Implemented

### 1. Expandable Accordion Rows in ScrapeJobStepDetailModal

Added inline expandable rows that show a 3-column details panel when clicked, allowing quick access to lead information without opening the full modal.

**File:** `UberEats-Image-Extractor/src/components/leads/ScrapeJobStepDetailModal.tsx`

#### Changes Made:

**A. New Imports Added (lines 43-52):**
```tsx
ChevronDown,
ChevronRight,
Phone,
Globe,
DollarSign,
Clock,
Mail,
User,
```

**B. New State for Expanded Rows (line 197):**
```tsx
const [expandedLeadIds, setExpandedLeadIds] = useState<Set<string>>(new Set());
```

**C. Toggle Function (lines 203-214):**
```tsx
const toggleExpanded = (leadId: string) => {
  setExpandedLeadIds((prev) => {
    const next = new Set(prev);
    if (next.has(leadId)) {
      next.delete(leadId);
    } else {
      next.add(leadId);
    }
    return next;
  });
};
```

**D. New InfoField Component (lines 91-124):**
Reusable component for displaying labeled fields with icons:
```tsx
function InfoField({
  icon: Icon,
  label,
  value,
  isLink = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null | undefined;
  isLink?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
        {isLink ? (
          <a href={...} target="_blank" className="text-xs text-blue-600 hover:underline break-all">
            {value}
          </a>
        ) : (
          <div className="text-xs break-all">{value}</div>
        )}
      </div>
    </div>
  );
}
```

**E. LeadDetailsPanel Component (lines 126-187):**
3-column grid panel showing all lead details:
```tsx
function LeadDetailsPanel({ lead }: { lead: Lead }) {
  return (
    <div className="grid grid-cols-3 gap-6 p-4 bg-muted/30 border-t">
      {/* Section 1: Location & Business Info */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground mb-2">Location & Business</div>
        <InfoField icon={MapPin} label="Address" value={lead.ubereats_address || lead.google_address} />
        <InfoField icon={MapPin} label="City" value={lead.city} />
        {/* Price rating with $ symbols */}
        {/* Google rating if available */}
      </div>

      {/* Section 2: Contact & Social */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground mb-2">Contact & Social</div>
        <InfoField icon={Phone} label="Phone" value={lead.phone} />
        <InfoField icon={Globe} label="Website" value={lead.website_url} isLink />
        <InfoField icon={Globe} label="Instagram" value={lead.instagram_url} isLink />
        <InfoField icon={Globe} label="Facebook" value={lead.facebook_url} isLink />
      </div>

      {/* Section 3: Business Details */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground mb-2">Business Details</div>
        <InfoField icon={User} label="Contact Person" value={lead.contact_name} />
        <InfoField icon={Mail} label="Contact Email" value={lead.contact_email} />
        <InfoField icon={Phone} label="Contact Phone" value={lead.contact_phone} />
        {/* Opening hours with scrollable text */}
      </div>
    </div>
  );
}
```

**F. Table Structure Changes:**
- Added expand column header (line 446)
- Wrapped each lead in `React.Fragment` for multiple rows
- Added expand/collapse button with chevron icons
- Added expandable details row that renders when lead is expanded
- Changed cell click handlers from `handleLeadClick` to `toggleExpanded`

### 2. Clickable Step Rows in ScrapeJobStepList

Made entire step rows clickable to open the `ScrapeJobStepDetailModal`.

**File:** `UberEats-Image-Extractor/src/components/leads/ScrapeJobStepList.tsx`

#### Changes Made:

**A. TableRow onClick Handler (line 318):**
```tsx
onClick={() => handleOpenStepDetail(step)}
```

**B. Visual Feedback Classes (line 311):**
```tsx
className={`cursor-pointer hover:bg-muted/50 transition-colors ${...}`}
```

**C. Event Propagation Stops:**
- Leads column: `onClick={(e) => e.stopPropagation()}` - preserves LeadPreview popover
- Actions column: `onClick={(e) => e.stopPropagation()}` - preserves button functionality

## Fields Now Visible in Expanded View

| Section | Field | Source Step |
|---------|-------|-------------|
| **Location & Business** | Address | Step 2 (UberEats) / Step 3 (Google) |
| | City | Step 1 |
| | Price Rating | Step 2 |
| | Google Rating | Step 3 |
| **Contact & Social** | Phone | Step 3 |
| | Website | Step 3 |
| | Instagram | Step 4 |
| | Facebook | Step 4 |
| **Business Details** | Contact Person | Step 5 |
| | Contact Email | Step 5 |
| | Contact Phone | Step 5 |
| | Opening Hours | Step 3 |

## User Experience Improvements

1. **Quick Data Access**: Users can expand a row to see all enriched data without leaving the table view
2. **Clickable Steps**: Single click on any step row opens the detail modal
3. **Preserved Interactions**:
   - Checkbox selection still works
   - LeadPreview popover still works on leads column
   - Action buttons (View, External Link) still work
   - Eye button still opens full LeadDetailModal for editing

## Visual Design

- Expand button uses chevron icons (right = collapsed, down = expanded)
- Expanded panel has subtle background (`bg-muted/30`) with top border
- 3-column responsive grid layout
- Compact typography with uppercase labels
- Links are blue and open in new tabs

## Testing Verification

### Expandable Rows
- [ ] Click chevron button expands row
- [ ] Click chevron again collapses row
- [ ] Click on row cells (except checkbox/actions) expands row
- [ ] Expanded panel shows all 3 sections
- [ ] Links open in new tabs
- [ ] Multiple rows can be expanded simultaneously

### Clickable Steps
- [ ] Click on step row opens ScrapeJobStepDetailModal
- [ ] LeadPreview popover still works on leads column
- [ ] Action buttons still work independently
- [ ] Hover shows visual feedback

## Date Completed
2025-12-07
