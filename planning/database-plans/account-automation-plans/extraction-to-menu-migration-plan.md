# ExtractionDetail to MenuDetail Migration Plan

## Investigation Summary

### Current Architecture

#### 1. Extraction Flow
- When an extraction is initiated, it creates an extraction job with a unique `job_id`
- The extraction runs asynchronously, processing menu data from delivery platforms
- Upon completion, the extraction automatically creates a menu in the database
- The menu gets a unique `menu_id` and is linked to the extraction via `extraction_job_id`

#### 2. Data Flow Timeline
```
Extraction Started → Running → Completed → Menu Created
   (job_id only)              (job_id)     (job_id + menu_id)
```

#### 3. Current Page Routing
- **ExtractionDetail**: `/extractions/:jobId` - Shows extraction results and allows editing
- **MenuDetail**: `/menus/:menuId` - Shows menu data and allows editing
- Both pages have nearly identical functionality for viewing/editing menu items

### Key Findings

#### 1. Menu Creation Timing
- Menu is created **automatically** when extraction completes successfully
- The `menu_id` becomes available in the extraction job record once completed
- Confirmed in `premium-extraction-service.js`: Menu is saved with `databaseService.saveExtractionResults()`

#### 2. Existing Navigation Logic
- **Extractions.jsx (line 104)**: Already checks for `menu_id` and redirects to MenuDetail
- This logic is currently working for completed extractions
- Legacy extractions without `menu_id` fall back to ExtractionDetail

#### 3. ExtractionDetail vs MenuDetail Comparison

| Feature | ExtractionDetail | MenuDetail | Notes |
|---------|------------------|------------|-------|
| View menu items | ✅ | ✅ | Identical UI |
| Edit menu items | ✅ | ✅ | Same components |
| Option sets management | ✅ | ✅ | Same functionality |
| Download CSV | ✅ | ✅ | Both support CDN |
| Upload images to CDN | ✅ | ✅ | Same API |
| Download images | ✅ | ✅ | Same endpoints |
| Delete items/categories | ✅ | ✅ | Same logic |
| Save changes | ✅ Uses menu_id | ✅ | Both save to menu |

#### 4. Unique ExtractionDetail Features
- **Polling for completion**: Checks extraction status while running
- **Premium extraction progress**: Shows detailed progress for premium extractions
- These features are only needed **before** menu creation

### Migration Strategy

#### Phase 1: Redirect Completed Extractions (Safe & Easy)
1. **Update all navigation to ExtractionDetail**:
   - When extraction is completed AND has `menu_id` → Redirect to MenuDetail
   - When extraction is running → Keep on ExtractionDetail for polling
   - Legacy extractions without `menu_id` → Show warning/migration message

2. **Implementation Points**:
   - `Extractions.jsx` handleViewResults - ✅ Already done
   - `App.tsx` route handler - Add redirect logic
   - Any other references to ExtractionDetail

#### Phase 2: Handle Running Extractions
1. **Create a lightweight polling page** for running extractions
2. **Auto-redirect on completion** to MenuDetail when menu_id becomes available
3. **Show progress** without the full editing interface

#### Phase 3: Deprecate ExtractionDetail
1. **Remove route** from App.tsx
2. **Delete ExtractionDetail.jsx** file
3. **Update imports** and references

### Implementation Plan

#### Step 1: Add Redirect Logic to App.tsx
```jsx
// In App.tsx route for ExtractionDetail
<Route path="extractions/:jobId" element={<ExtractionRedirect />} />

// New component
function ExtractionRedirect() {
  const { jobId } = useParams();
  const [checking, setChecking] = useState(true);
  
  useEffect(() => {
    checkExtractionStatus();
  }, [jobId]);
  
  const checkExtractionStatus = async () => {
    try {
      const response = await api.get(`/extractions/${jobId}`);
      if (response.data.job?.menuId) {
        // Redirect to MenuDetail
        navigate(`/menus/${response.data.job.menuId}`, { replace: true });
      } else if (response.data.job?.state === 'running') {
        // Show polling view
        // Could reuse parts of ExtractionDetail or create new component
      } else {
        // Legacy extraction without menu - show message
      }
    } catch (error) {
      // Handle error
    }
  };
}
```

#### Step 2: Update All References
- NewExtraction component redirect after submission
- Any admin tools or scripts
- Documentation

#### Step 3: Create Polling Component (Optional)
- Minimal UI just for showing extraction progress
- Auto-redirect on completion
- No editing capabilities

### Benefits of Migration

1. **Code Reduction**: ~1500 lines of duplicate code removed
2. **Maintenance**: Single source of truth for menu editing
3. **Consistency**: Users always interact with menus the same way
4. **Simplicity**: Clearer mental model - extractions create menus, menus are edited

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Legacy extractions break | Low | Medium | Keep fallback for extractions without menu_id |
| Running extractions need UI | Medium | Low | Create simple polling component |
| User confusion | Low | Low | Clear messaging during transition |
| Data loss | Very Low | High | All data already in menu table |

### Recommended Approach

1. **Start with soft redirect** - Keep ExtractionDetail but redirect completed extractions
2. **Monitor for issues** - Log when ExtractionDetail is still used
3. **Gradual deprecation** - Remove after confirming all flows work
4. **Keep polling logic** - Extract to separate component for running jobs

### Timeline

- **Phase 1**: Immediate - Add redirects (1 hour)
- **Phase 2**: Next sprint - Create polling component (2-3 hours)
- **Phase 3**: After validation - Remove ExtractionDetail (1 hour)

Total effort: ~5 hours

### Conclusion

The migration is **safe and recommended**. The ExtractionDetail page is redundant for completed extractions since they already have menus. The only unique value it provides is polling for running extractions, which can be handled by a much simpler component.

The existing code in Extractions.jsx already implements the correct logic - we just need to ensure all paths lead to MenuDetail for completed extractions.