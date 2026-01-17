# Important Implementation Notes

## Critical Architectural Decisions

### 1. Firecrawl PDF Processing Method

**Discovery:** Firecrawl's scrape endpoint expects a **URL** to the PDF, not direct file upload.

**Impact:** We cannot directly upload PDF buffers to Firecrawl. PDFs must be accessible via URL.

**Solution:** Two-step process:
1. Upload PDF to Supabase Storage (temporary bucket: `pdf-extractions`)
2. Pass public URL to Firecrawl for extraction
3. Delete PDF from storage after successful extraction (or after 24 hours via bucket policy)

**Architecture Decision:** Supabase Storage for PDFs, UploadCare CDN for menu images
- **Supabase Storage:** Temporary PDF hosting (deleted after extraction)
- **UploadCare CDN:** Permanent client menu item images only
- **Reasoning:** Clear separation of concerns, cost optimization, data lifecycle management

**API Documentation:** https://docs.firecrawl.dev/api-reference/endpoint/scrape

**Example Request:**
```javascript
POST https://api.firecrawl.dev/v2/scrape
{
  "url": "https://<project-id>.supabase.co/storage/v1/object/public/pdf-extractions/temp/1729468800000-menu.pdf",
  "parsers": ["pdf"],
  "formats": [{
    "type": "json",
    "schema": { /* menu schema */ }
  }]
}
```

**Pricing:** PDF parsing costs +1 credit per page on top of base scraping cost.

### 2. Sharp Library Status

**Status:** ✅ Already installed (v0.34.3)

**Location:** `UberEats-Image-Extractor/node_modules/sharp`

**No Action Needed:** Skip any "npm install sharp" steps in documentation.

### 3. Chaat Street Success

**Date:** October 20, 2025

**Outcome:** Successfully onboarded manually - New paying customer! 🎉

**Method Used:**
- Manual extraction of menu data from PDF
- Image compression and CDN upload
- CSV generation
- Import via existing automation script

**Validation:** This manual process validated the workflow and confirmed:
- Image compression (6-11MB → ~500KB) works effectively
- UploadCare CDN integration is solid
- CSV import script handles PDF-sourced data
- Manual workflow is viable fallback

**Learnings:**
- PDF structure was parseable (good candidate for automation)
- Image matching to menu items is the trickiest part
- Quality control/review step is essential
- Manual process took ~2 hours (automation target: <15 minutes)

## Technical Requirements - Current Status

| Requirement | Status | Notes |
|------------|--------|-------|
| Firecrawl API | ✅ Available | API key configured |
| UploadCare CDN | ✅ Available | Public + secret keys configured |
| Supabase DB | ✅ Available | Project ID: qgabsyggzlkcstjzugdh |
| Sharp Library | ✅ Installed | v0.34.3 |
| Node.js | ✅ Ready | Current environment |
| Existing Infrastructure | ✅ Ready | All services operational |

## Implementation Priority

Based on Chaat Street success, prioritize:

1. **Phase 1 (Week 1):** Image compression service
   - Leverage existing Sharp installation
   - Build reusable compression utility
   - Test with various image sizes

2. **Phase 2 (Week 2):** PDF extraction with Firecrawl
   - Implement URL-based approach
   - Handle UploadCare temporary storage
   - Test extraction accuracy

3. **Phase 3 (Week 3):** Image-to-item matching
   - This is the manual bottleneck
   - Smart matching algorithms
   - Manual override UI

## API Integration Notes

### Firecrawl Scrape Endpoint

**Endpoint:** `POST https://api.firecrawl.dev/v2/scrape`

**Headers:**
```
Authorization: Bearer <FIRECRAWL_API_KEY>
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "string (required)",
  "formats": ["markdown", "html", "links", "screenshot", {"type": "json", "schema": {}}],
  "parsers": ["pdf"],
  "onlyMainContent": true,
  "timeout": 120000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "json": { /* extracted data matching schema */ },
    "markdown": "...",
    "metadata": { /* page info */ }
  }
}
```

**Rate Limits:** Check Firecrawl plan limits (typically 100 requests/hour for standard plans)

### Supabase Storage for PDF Hosting

**Bucket:** `pdf-extractions` (public bucket with 24-hour TTL)

**Upload Method:**
```javascript
const { data, error } = await supabase
  .storage
  .from('pdf-extractions')
  .upload('temp/1729468800000-menu.pdf', pdfBuffer, {
    contentType: 'application/pdf',
    cacheControl: '3600',
    upsert: false
  });
```

**Get Public URL:**
```javascript
const { data: { publicUrl } } = supabase
  .storage
  .from('pdf-extractions')
  .getPublicUrl('temp/1729468800000-menu.pdf');
```

**URL Format:**
`https://qgabsyggzlkcstjzugdh.supabase.co/storage/v1/object/public/pdf-extractions/temp/1729468800000-menu.pdf`

**Cleanup:**
```javascript
await supabase
  .storage
  .from('pdf-extractions')
  .remove(['temp/1729468800000-menu.pdf']);
```

### UploadCare for Menu Images

**Endpoint:** `POST https://upload.uploadcare.com/base/`

**Usage:** Menu item images only (permanent storage)

**Note:** Do NOT use UploadCare for PDFs - Supabase Storage handles PDF hosting

## Next Developer Handoff

### Before Starting Implementation

1. ✅ Read all documentation in `scalable-implementation/` folder
2. ✅ Review Chaat Street manual process (documented above)
3. ✅ Check Firecrawl API documentation (linked above)
4. ✅ Verify Sharp installation: `npm list sharp`
5. 📋 Review existing services:
   - `src/services/uploadcare-service.js`
   - `src/services/premium-extraction-service.js` (pattern reference)
   - `src/services/rate-limiter-service.js`

### Phase 1 Kickoff

Start with image compression service:
- Create `src/services/image-compression-service.js`
- Use Sharp for compression (already installed)
- Target: 500KB output size
- Maintain aspect ratio and quality
- Write unit tests

**Success Criteria:** Compress Chaat Street test images (13 files, 6-11MB each) to ~500KB in <30 seconds total.

## Questions to Resolve

1. **PDF Cleanup:** ✅ RESOLVED - Use Supabase Storage with automatic cleanup after extraction
2. **Temporary Storage:** ✅ RESOLVED - Supabase Storage for PDFs, UploadCare for images
3. **Storage Bucket Setup:** Need to create `pdf-extractions` bucket with public access and lifecycle policy
4. **Firecrawl Costs:** What's the credit allocation per organization? Need usage monitoring?
5. **Image Matching:** What confidence threshold for auto-matching? (Suggest: 0.8)
6. **Manual Review:** Always required or only for low-confidence extractions?

## Supabase Storage Setup Required

### Create PDF Extractions Bucket

```sql
-- Create bucket via Supabase Dashboard or API
-- Bucket name: pdf-extractions
-- Public: true
-- Allowed MIME types: application/pdf
-- File size limit: 10MB
```

**Lifecycle Policy (Recommended):**
- Auto-delete files older than 24 hours in `temp/` folder
- Keep audit trail of extractions (optional: move to `archive/` instead of delete)

**Access Control:**
- Public read access (required for Firecrawl)
- Authenticated write access only
- RLS policies for organization-level isolation

---

**Last Updated:** October 20, 2025
**Status:** Ready for Phase 1 implementation
**Next Review:** After Phase 1 completion
