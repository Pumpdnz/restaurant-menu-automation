# Investigation: NZ Companies Office Website Structure

## Search Results Page

**URL Pattern:**
```
https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/search?q={name}&entityStatusGroups=REGISTERED&addressKeyword={address}&advancedPanel=true&mode=advanced
```

**Available Data:**
- Company name
- Company registration number
- NZBN
- Entity status (Registered, In liquidation, Removed, etc.)
- Incorporation date
- Registered address
- Link to detail page

**Limitations:**
- Max 1000 results returned
- Pagination support (50 results default, max 200)

## Company Detail Page

**URL Pattern:**
```
https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/{company_number}/detail
```

**Panel Structures:**

### 1. Basic Info
- Company name, number, NZBN
- Status, incorporation date, entity type

### 2. Addresses Panel (addressPanel)
- Registered office address
- Address for service
- Office/delivery addresses
- Contact person names with addresses

### 3. Directors Panel (directorsPanel)
- Director name
- Position/role
- Appointment/cessation dates
- Director address
- Status (Active/Ceased)

### 4. Shareholders Panel (shareholdersPanel)
- Shareholder name (individual/company)
- Share class
- Number of shares
- Percentage ownership
- Status (Active/Ceased)

### 5. NZBN Details Panel (nzbnDetailsPanel)
- GST Number(s)
- Phone Number(s)
- Email Address(es)
- Trading Name
- Website(s)
- Industry Classification(s)

## Step 1: Search Extraction Schema

```json
{
  "type": "object",
  "properties": {
    "companies": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "company_name": { "type": "string", "description": "Full legal company name" },
          "company_number": { "type": "string", "description": "Registration number" },
          "nzbn": { "type": "string", "description": "NZ Business Number" },
          "status": { "type": "string", "description": "Registered/In liquidation/Removed" },
          "incorporation_date": { "type": "string", "description": "Date incorporated" },
          "registered_address": { "type": "string", "description": "Registered office address" }
        },
        "required": ["company_name", "company_number"]
      }
    },
    "total_results": { "type": "integer" }
  }
}
```

## Step 1: Search Extraction Prompt

```
Extract all company search results from this Companies Register page.

For each company, capture:
1. Company name (full legal name)
2. Company registration number
3. NZBN (New Zealand Business Number) if shown
4. Current status (Registered/In liquidation/Removed)
5. Incorporation date
6. Registered address

Count total results found. Only extract data visible on the page.
```

## Step 2: Detail Extraction Schema

```json
{
  "type": "object",
  "properties": {
    "company_info": {
      "type": "object",
      "properties": {
        "company_name": { "type": "string" },
        "company_number": { "type": "string" },
        "nzbn": { "type": "string" },
        "status": { "type": "string" },
        "incorporation_date": { "type": "string" },
        "entity_type": { "type": "string" }
      }
    },
    "addresses": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "address_type": { "type": "string" },
          "full_address": { "type": "string" },
          "contact_name": { "type": "string" }
        }
      }
    },
    "directors": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "full_legal_name": { "type": "string" },
          "position": { "type": "string" },
          "appointment_date": { "type": "string" },
          "address": { "type": "string" },
          "status": { "type": "string" }
        }
      }
    },
    "shareholders": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "shareholder_type": { "type": "string" },
          "shares": { "type": "number" },
          "percentage": { "type": "number" }
        }
      }
    },
    "nzbn_details": {
      "type": "object",
      "properties": {
        "gst_numbers": { "type": "array", "items": { "type": "string" } },
        "phone_numbers": { "type": "array", "items": { "type": "string" } },
        "email_addresses": { "type": "array", "items": { "type": "string" } },
        "trading_name": { "type": "string" },
        "websites": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

## Step 2: Detail Extraction Prompt

```
Extract complete company information from this Companies Register detail page.

Extract from each panel:

1. BASIC INFO: Company name, number, NZBN, status, incorporation date, entity type

2. ADDRESSES (addressPanel): All addresses with type (Registered office, Address for service, etc.) and any contact names listed

3. DIRECTORS (directorsPanel): All directors with name, full legal name if different, position, appointment date, address, status (Active/Ceased)

4. SHAREHOLDERS (shareholdersPanel): All shareholders with name, type (individual/company), number of shares, percentage ownership

5. NZBN DETAILS (nzbnDetailsPanel): GST numbers, phone numbers, email addresses, trading name, websites if shown

IMPORTANT: Extract exactly as displayed. Leave fields empty if not visible.
```

## Technical Considerations

1. **JavaScript Rendering:** Site uses SPA architecture - Firecrawl's JS rendering handles this
2. **Wait Time:** Use `waitFor: 4000` to allow panels to load
3. **Concurrency:** Use conservative limit (3) for Companies Office
4. **Privacy:** Director residential addresses may be hidden; business addresses shown instead
5. **API Alternative:** Official MBIE APIs available for production use (requires registration)

## Data Privacy Notes

- Director residential addresses restricted in some cases
- Shareholder personal details not publicly displayed
- Only business-related information available
- Consider data handling compliance
