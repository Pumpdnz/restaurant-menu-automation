me# Contact Details Extraction - Fixes Batch 1

## Overview

This document outlines fixes for 4 remaining issues in the Companies Office extraction dialog after initial implementation.

**Last Updated:** 2025-12-16

**Status:** COMPLETED

---

## Issue Summary

| Issue | Problem | Solution |
|-------|---------|----------|
| 1 | Name selection auto-picks one name, no user choice | Show all names from selected company, let user pick |
| 2 | Address search uses full address string | Parse street from address, use city field directly, make Step 1 editable |
| 3 | Multi-company selection only shows one company's data | Show comparison cards, user selects ONE company, then select data from it |
| 4 | Metadata display shows generic text | Show counts and expandable details for the selected company |

---

## Issue 1: Name Selection UX

### Problem
In `handleExtractDetails()`, the code auto-selects names without user input:
- Uses `firstCompany.directors?.find(d => d.status === 'Active')` for full_legal_name
- Uses `firstCompany.addresses?.find(a => a.contact_name)?.contact_name` for contact_name
- No UI allows user to select from all available names

### Solution
Add a dedicated name selection section that:
1. Collects all unique names from the SELECTED company (directors, shareholders, address contacts)
2. Shows each name with its source context (e.g., "John Smith - Director")
3. Allows selecting which name to save as `full_legal_name` and `contact_name`

### Implementation

**New State Variables:**
```javascript
const [availableNames, setAvailableNames] = useState([]);
const [selectedFullLegalName, setSelectedFullLegalName] = useState(null);
const [selectedContactName, setSelectedContactName] = useState(null);
```

**New Helper Function:**
```javascript
const collectNamesFromCompany = (company) => {
  const namesMap = new Map();

  // Collect from directors
  company.directors?.forEach(director => {
    const name = director.full_legal_name || director.name;
    if (name) {
      const key = name.toLowerCase().trim();
      if (!namesMap.has(key)) {
        namesMap.set(key, {
          name,
          source: 'Director',
          position: director.position,
          status: director.status,
          originalData: director
        });
      }
    }
  });

  // Collect from shareholders (individuals only)
  company.shareholders?.forEach(shareholder => {
    if (shareholder.name && shareholder.shareholder_type === 'Individual') {
      const key = shareholder.name.toLowerCase().trim();
      if (!namesMap.has(key)) {
        namesMap.set(key, {
          name: shareholder.name,
          source: 'Shareholder',
          percentage: shareholder.percentage,
          originalData: shareholder
        });
      }
    }
  });

  // Collect from addresses
  company.addresses?.forEach(address => {
    if (address.contact_name) {
      const key = address.contact_name.toLowerCase().trim();
      if (!namesMap.has(key)) {
        namesMap.set(key, {
          name: address.contact_name,
          source: 'Address Contact',
          addressType: address.address_type,
          originalData: address
        });
      }
    }
  });

  return Array.from(namesMap.values());
};
```

**New Component:**
```jsx
function NameSelectionList({ names, selectedName, onSelect, label }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="space-y-1 max-h-[150px] overflow-y-auto pr-2">
        {names.map((nameObj, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
              selectedName?.name === nameObj.name
                ? 'bg-primary/10 border border-primary'
                : 'hover:bg-muted/50 border border-transparent'
            }`}
            onClick={() => onSelect(nameObj)}
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{nameObj.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                <Badge variant="outline" className="text-xs">{nameObj.source}</Badge>
                {nameObj.position && <span>• {nameObj.position}</span>}
                {nameObj.percentage && <span>• {nameObj.percentage}% shares</span>}
                {nameObj.status && <Badge variant={nameObj.status === 'Active' ? 'default' : 'secondary'} className="text-xs">{nameObj.status}</Badge>}
              </div>
            </div>
            {selectedName?.name === nameObj.name && (
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Issue 2: Address Search Query

### Problem
The `buildAddressSearchUrl()` function sends the full address (e.g., "363 Colombo Street Christchurch Canterbury 8023") which returns poor search results.

### Solution
1. Parse the address to extract only the street portion (up to and including street type words)
2. Use the `city` field directly from the restaurant record
3. Make Step 1 fields editable so users can override for edge cases

### Implementation

**Backend - Parse Street Helper:**
```javascript
/**
 * Parse address to extract only street portion
 * Input: "363 Colombo Street Christchurch Canterbury 8023"
 * Output: "363 Colombo Street"
 */
function parseStreetFromAddress(address) {
  if (!address) return '';

  const streetTypes = [
    'street', 'road', 'avenue', 'lane', 'place', 'way',
    'crescent', 'drive', 'terrace', 'boulevard', 'court',
    'close', 'parade', 'highway', 'grove', 'rise', 'mews'
  ];

  const addressLower = address.toLowerCase();
  let earliestIndex = -1;
  let matchedType = '';

  for (const streetType of streetTypes) {
    const index = addressLower.indexOf(streetType);
    if (index !== -1 && (earliestIndex === -1 || index < earliestIndex)) {
      earliestIndex = index;
      matchedType = streetType;
    }
  }

  if (earliestIndex !== -1) {
    return address.substring(0, earliestIndex + matchedType.length).trim();
  }

  // Fallback: return first 3 words
  const words = address.split(/\s+/);
  return words.slice(0, 3).join(' ');
}
```

**Backend - Updated Search URL Builder:**
```javascript
function buildAddressSearchUrl(street, city) {
  const searchQuery = city ? `${street} ${city}` : street;
  const encodedQuery = encodeURIComponent(searchQuery);
  console.log(`[CompaniesOffice] Address search query: "${searchQuery}"`);
  return `https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/search?q=&entityStatusGroups=REGISTERED&addressKeyword=${encodedQuery}&advancedPanel=true&mode=advanced#results`;
}
```

**Frontend - Editable Step 1 State:**
```javascript
const [searchName, setSearchName] = useState('');
const [searchStreet, setSearchStreet] = useState('');
const [searchCity, setSearchCity] = useState('');

// Initialize when dialog opens
useEffect(() => {
  if (open && restaurant) {
    setSearchName(restaurant.name || '');
    setSearchCity(restaurant.city || '');
    setSearchStreet(parseStreetFromAddress(restaurant.address || ''));
  }
}, [open, restaurant]);
```

**Frontend - Editable Step 1 UI:**
```jsx
const renderStep1 = () => (
  <div className="space-y-4 py-4">
    <div className="space-y-2">
      <Label>Restaurant Name</Label>
      <Input
        value={searchName}
        onChange={(e) => setSearchName(e.target.value)}
        placeholder="Enter restaurant name to search"
      />
    </div>

    <div className="space-y-2">
      <Label>Street Address</Label>
      <Input
        value={searchStreet}
        onChange={(e) => setSearchStreet(e.target.value)}
        placeholder="e.g., 363 Colombo Street"
      />
      <p className="text-xs text-muted-foreground">
        Street number and name only
      </p>
    </div>

    <div className="space-y-2">
      <Label>City</Label>
      <Input
        value={searchCity}
        onChange={(e) => setSearchCity(e.target.value)}
        placeholder="e.g., Christchurch"
      />
    </div>

    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        We'll search by restaurant name and by address. Edit fields above if needed.
      </AlertDescription>
    </Alert>
  </div>
);
```

---

## Issue 3: Multi-Company Display

### Problem
When multiple companies are extracted, only the first company's data is displayed. Users need to see ALL companies' data to identify the correct match.

### Clarification
The multi-company view is for **identification**, not mixing data:
1. Users view details from multiple companies to identify the correct one
2. Users select ONE company as the match
3. Then users select data (director name, etc.) from that single company to save

### Solution
Split Step 4 into two phases:
- **Step 4a (Company Comparison):** Show cards for each company, user clicks "Select This Company"
- **Step 4b (Data Selection):** Show data selection UI for the selected company only

### Implementation

**New State:**
```javascript
const [selectedCompanyNumber, setSelectedCompanyNumber] = useState(null);
```

**CompanyCard Component:**
```jsx
function CompanyCard({ company, onSelect }) {
  const activeDirectors = company.directors?.filter(d => d.status === 'Active') || [];

  return (
    <Card className="hover:border-primary transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-medium">{company.company_info?.company_name}</div>
            <div className="text-xs text-muted-foreground space-x-2">
              <span>#{company.company_info?.company_number}</span>
              {company.company_info?.nzbn && <span>NZBN: {company.company_info?.nzbn}</span>}
            </div>
          </div>
          <a href={company.detail_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="text-xs space-y-1 mb-3">
          {activeDirectors.length > 0 && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>Directors: {activeDirectors.map(d => d.name).join(', ')}</span>
            </div>
          )}
          {company.addresses?.[0] && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{company.addresses[0].full_address}</span>
            </div>
          )}
        </div>

        <Button onClick={onSelect} className="w-full" size="sm">
          <Check className="h-4 w-4 mr-2" />
          Select This Company
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Updated renderStep4 Flow:**
```jsx
const renderStep4 = () => {
  const validCompanies = companyDetails?.companies?.filter(c => !c.error) || [];

  // If no company selected yet, show comparison view
  if (!selectedCompanyNumber) {
    return (
      <div className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground">
          Review the extracted data and select the correct company.
        </p>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {validCompanies.map((company) => (
              <CompanyCard
                key={company.company_number}
                company={company}
                onSelect={() => {
                  setSelectedCompanyNumber(company.company_number);
                  initializeSelectionsFromCompany(company);
                }}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Company selected - show data selection UI
  const selectedCompany = validCompanies.find(c => c.company_number === selectedCompanyNumber);
  return renderDataSelection(selectedCompany, validCompanies.length > 1);
};
```

---

## Issue 4: Metadata Display

### Problem
The "Store Full Extraction Data" section shows only generic text: "Save all directors, shareholders, and addresses for future reference Value: Additional contacts metadata"

### Solution
Create a dedicated component that shows:
1. Summary badges (X directors, Y shareholders, Z addresses)
2. Expandable section to view all details before saving

### Implementation

**MetadataStorageSection Component:**
```jsx
function MetadataStorageSection({ company, checked, onChange }) {
  const [expanded, setExpanded] = useState(false);

  const activeDirectors = company.directors?.filter(d => d.status === 'Active') || [];
  const shareholders = company.shareholders || [];
  const addresses = company.addresses || [];
  const gstNumbers = company.nzbn_details?.gst_numbers || [];
  const phones = company.nzbn_details?.phone_numbers || [];
  const emails = company.nzbn_details?.email_addresses || [];

  return (
    <div className="space-y-2">
      <div
        className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors ${
          checked ? 'bg-primary/5 border border-primary' : 'hover:bg-muted/50 border border-transparent'
        }`}
        onClick={() => onChange(!checked)}
      >
        <Checkbox checked={checked} onChange={() => {}} className="mt-0.5" />
        <div className="flex-1">
          <span className="text-sm font-medium">Store Full Extraction Data</span>
          <p className="text-xs text-muted-foreground mt-1">
            Save all extracted data for future reference
          </p>

          <div className="flex flex-wrap gap-1 mt-2">
            {activeDirectors.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {activeDirectors.length} director{activeDirectors.length > 1 ? 's' : ''}
              </Badge>
            )}
            {shareholders.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {shareholders.length} shareholder{shareholders.length > 1 ? 's' : ''}
              </Badge>
            )}
            {addresses.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {addresses.length} address{addresses.length > 1 ? 'es' : ''}
              </Badge>
            )}
            {gstNumbers.length > 0 && <Badge variant="outline" className="text-xs">{gstNumbers.length} GST#</Badge>}
            {phones.length > 0 && <Badge variant="outline" className="text-xs">{phones.length} phone{phones.length > 1 ? 's' : ''}</Badge>}
            {emails.length > 0 && <Badge variant="outline" className="text-xs">{emails.length} email{emails.length > 1 ? 's' : ''}</Badge>}
          </div>
        </div>
      </div>

      {checked && (
        <div className="ml-8">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
            {expanded ? 'Hide details' : 'Show details'}
          </Button>

          {expanded && (
            <div className="mt-2 text-xs space-y-2 p-2 bg-muted rounded-md max-h-[200px] overflow-y-auto">
              {activeDirectors.map((d, i) => (
                <div key={`d-${i}`}>• Director: {d.full_legal_name || d.name}</div>
              ))}
              {shareholders.map((s, i) => (
                <div key={`s-${i}`}>• Shareholder: {s.name} ({s.percentage}%)</div>
              ))}
              {gstNumbers.map((g, i) => <div key={`g-${i}`}>• GST: {g}</div>)}
              {phones.map((p, i) => <div key={`p-${i}`}>• Phone: {p}</div>)}
              {emails.map((e, i) => <div key={`e-${i}`}>• Email: {e}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## User Flow (Updated)

```
Step 1: Editable Search
├── User can edit: Restaurant Name, Street, City
└── Click "Search"

Step 2: Select Companies to Extract
├── Checkboxes to select which to extract details for
└── Click "Extract Details"

Step 4a: Company Comparison (if multiple companies)
├── View cards for each company with summary info
├── Click "Select This Company" on the correct one
└── (Can change selection later with "Change Company" button)

Step 4b: Data Selection (single company)
├── Company info fields (company_number, nzbn, gst)
├── Name selection list from THIS company's directors/shareholders/addresses
├── Metadata storage option with summary badges + expandable details
└── Click "Save Selected"
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `UberEats-Image-Extractor/src/routes/companies-office-routes.js` | Add `parseStreetFromAddress()`, update `buildAddressSearchUrl()`, update search endpoint |
| `UberEats-Image-Extractor/src/components/dialogs/CompaniesOfficeDialog.jsx` | Add new state, helper functions, components, update Step 1 and Step 4 |

---

## Testing Checklist

- [x] Step 1 fields are editable
- [x] Address search uses parsed street + city (e.g., "363 Colombo Street Christchurch")
- [x] Multiple companies show as comparison cards
- [x] "Select This Company" sets the active company
- [x] "Change Company" button appears and works when multiple companies
- [x] Name selection shows all names from selected company only
- [x] User can select different names for full_legal_name and contact_name
- [x] Metadata section shows counts (X directors, Y shareholders, etc.)
- [x] Expanding metadata shows all details
- [x] Saving works correctly with selections from single company
- [x] Dialog resets properly when closed
- [x] Full legal name field is editable in RestaurantDetail edit mode
- [x] Contact name saves full name (not just first name)

## Additional Changes Made

- Increased dialog dimensions (max-width: 800px, max-height: 95vh)
- Increased ScrollArea heights for better content viewing
- Made full_legal_name editable in RestaurantDetail.jsx
