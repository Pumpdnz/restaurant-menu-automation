# Investigation: RestaurantDetail Page UI Structure

## File Information
- **File:** `UberEats-Image-Extractor/src/pages/RestaurantDetail.jsx`
- **Size:** ~390KB

## Contact & Lead Info Card

**Location:** Lines 3773-3848

**Current Fields:**
- Contact Name
- Contact Email
- Contact Phone
- Weekly Sales Range
- Lead Created (read-only)

**Insertion Point for "Get Contacts" Button:** After CardHeader (line 3777)

## Restaurant Info Card

**Location:** Lines 3691-3771

**Current Fields:**
- Restaurant Name
- Organisation Name
- City
- Address
- Restaurant Phone
- Restaurant Email

**Insertion Point for "Find Email/Phone" Buttons:** Next to each field

## Button Pattern Example (Find URL)

```jsx
{!urlValue && isFeatureEnabled('googleSearchExtraction') && (
  <Button
    size="sm"
    variant="outline"
    onClick={() => handleFindUrl(platform)}
    disabled={isSearching || extractingDetails}
  >
    {isSearching ? (
      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
    ) : (
      <SearchIcon className="h-3 w-3 mr-1" />
    )}
    Find URL
  </Button>
)}
```

## Dialog Pattern (Process Logo)

```jsx
<Dialog open={processLogoDialogOpen} onOpenChange={setProcessLogoDialogOpen}>
  <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Process Restaurant Logo</DialogTitle>
      <DialogDescription>Choose how to add your logo</DialogDescription>
    </DialogHeader>

    <div className="space-y-4">
      {/* Content */}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setProcessLogoDialogOpen(false)}>Cancel</Button>
      <Button onClick={handleProcessLogo} disabled={processingLogo}>
        {processingLogo ? <RefreshCw className="animate-spin" /> : 'Process'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## State Variables Pattern

```javascript
// Dialog state
const [contactExtractionDialogOpen, setContactExtractionDialogOpen] = useState(false);
// Processing state
const [extractingContacts, setExtractingContacts] = useState(false);
// Mode state
const [extractionMode, setExtractionMode] = useState('auto'); // 'auto' | 'manual'
```

## UI Component Imports

```javascript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input, Label } from '../components/ui/input';
import { RefreshCw, SearchIcon, ExternalLink } from 'lucide-react';
```

## New Fields to Add to UI

**Restaurant Info Card:**
- NZBN (with label)
- Company Number
- GST Number

**Contact & Lead Info Card:**
- Full Legal Name
- Contact Instagram
- Contact Facebook
- Contact LinkedIn
- Additional Contacts (JSONB display)
