# CSV Menu Upload Implementation Plan

## Overview
This document outlines the implementation plan for adding a CSV menu upload feature to the Pumpd Registration tab in the RestaurantDetail page. This feature will allow users to upload a CSV menu file and automatically import it to their registered Pumpd restaurant using the updated `import-csv-menu.js` script with smart restaurant matching.

## Current State Analysis

### Existing Registration Implementation
1. **Frontend**: RestaurantDetail.jsx has a Pumpd Registration tab with account and restaurant registration features
2. **Backend**: registration-routes.js handles script execution via `execAsync`
3. **Authentication**: Routes require organisation context via `req.user?.organisationId`
4. **Script Execution**: Scripts are run with command-line arguments
5. **Database**: Stores registration status, credentials, and logs in pumpd_accounts and pumpd_restaurants tables

### Key Components
- **Database Service**: Uses Supabase with RLS, requires organisation_id for queries
- **Registration Routes**: Execute Playwright scripts and handle responses
- **Frontend Integration**: React components with status tracking and action dialogs

## Requirements

### Functional Requirements
1. Remove log display from main tab view (keep View Registration Logs dialog)
2. Add new CSV Upload section below existing registration components
3. Allow file selection from local filesystem
4. Run updated import-csv-menu.js script with smart matching
5. Display upload status and results
6. No database logging required (simpler than registration)

### Technical Requirements
1. Use existing authentication and organisation context
2. Get credentials from pumpd_accounts table
3. Get restaurant name from restaurants table
4. Handle file upload and temporary storage
5. Execute script with proper arguments: email, password, restaurant name, CSV file path

## Implementation Design

### Frontend Changes (RestaurantDetail.jsx)

#### 1. Remove Log Display from Main Tab
```javascript
// Remove the registration logs section from the main tab view
// Keep the View Registration Logs dialog functionality
```

#### 2. Add CSV Upload Section
```javascript
// New section structure:
<Card className="mb-4">
  <CardHeader>
    <h3 className="text-lg font-semibold flex items-center gap-2">
      <FileSpreadsheet className="h-5 w-5" />
      Menu CSV Upload
    </h3>
    <p className="text-sm text-gray-600">
      Upload a CSV file to import menu items to your Pumpd restaurant
    </p>
  </CardHeader>
  <CardContent>
    {/* Status display */}
    {/* File upload input */}
    {/* Upload button */}
    {/* Progress/result display */}
  </CardContent>
</Card>
```

#### 3. State Management
```javascript
const [csvFile, setCsvFile] = useState(null);
const [uploadStatus, setUploadStatus] = useState(null);
const [uploadProgress, setUploadProgress] = useState(null);
const [isUploading, setIsUploading] = useState(false);
```

#### 4. File Upload Handler
```javascript
const handleCsvFileSelect = (event) => {
  const file = event.target.files[0];
  if (file && file.type === 'text/csv') {
    setCsvFile(file);
  } else {
    alert('Please select a valid CSV file');
  }
};

const handleCsvUpload = async () => {
  if (!csvFile || !registrationStatus?.account) {
    alert('Please select a CSV file and ensure account is registered');
    return;
  }
  
  setIsUploading(true);
  const formData = new FormData();
  formData.append('csvFile', csvFile);
  formData.append('restaurantId', restaurant.id);
  
  try {
    const response = await fetch('/api/registration/upload-csv-menu', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
      },
      body: formData
    });
    
    const result = await response.json();
    setUploadStatus(result);
  } catch (error) {
    setUploadStatus({ success: false, error: error.message });
  } finally {
    setIsUploading(false);
  }
};
```

### Backend Implementation

#### 1. New Route: /api/registration/upload-csv-menu
```javascript
// In registration-routes.js

const multer = require('multer');
const upload = multer({ dest: '/tmp/csv-uploads/' });

router.post('/upload-csv-menu', upload.single('csvFile'), async (req, res) => {
  const { restaurantId } = req.body;
  const organisationId = req.user?.organisationId;
  const csvFile = req.file;
  
  if (!organisationId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Organisation context required' 
    });
  }
  
  if (!csvFile) {
    return res.status(400).json({
      success: false,
      error: 'CSV file is required'
    });
  }
  
  try {
    const { supabase } = require('../services/database-service');
    
    // Get restaurant details
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    // Get account credentials
    const { data: account } = await supabase
      .from('pumpd_accounts')
      .select('email, user_password_hint')
      .eq('restaurant_id', restaurantId)
      .eq('organisation_id', organisationId)
      .single();
    
    if (!account || !account.email || !account.user_password_hint) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant account not found or incomplete credentials'
      });
    }
    
    // Execute updated import-csv-menu.js script
    const scriptPath = '/Users/giannimunro/Desktop/cursor-projects/automation/scripts/restaurant-registration/import-csv-menu.js';
    const command = `node ${scriptPath} --email="${account.email}" --password="${account.user_password_hint}" --name="${restaurant.name}" --csvFile="${csvFile.path}"`;
    
    console.log('[CSV Upload] Executing:', command);
    
    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, DEBUG_MODE: 'false' },
      timeout: 120000 // 2 minute timeout
    });
    
    // Clean up uploaded file
    await fs.unlink(csvFile.path);
    
    // Parse results from stdout
    const success = stdout.includes('CSV import completed successfully') || 
                   stdout.includes('✅');
    
    res.json({
      success,
      message: success ? 'Menu uploaded successfully' : 'Upload failed',
      output: stdout,
      error: stderr || null
    });
    
  } catch (error) {
    console.error('[CSV Upload] Error:', error);
    
    // Clean up file on error
    if (csvFile?.path) {
      try {
        await fs.unlink(csvFile.path);
      } catch (unlinkError) {
        console.error('[CSV Upload] Failed to clean up file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

#### 2. Update import-csv-menu.js Script
The script needs to be updated to:
1. Accept password as an argument (not use admin password)
2. Accept restaurant name for smart matching
3. Use the matching logic from MIGRATION_GUIDE_RESTAURANT_MATCHING.md

Key changes:
```javascript
// Parse arguments
const email = getArg('email');
const password = getArg('password');  // NEW: User password
const restaurantName = getArg('name'); // NEW: For matching
const csvFile = getArg('csvFile');

// Add smart matching logic for finding correct restaurant
// Copy the matching functions from test-get-restaurant-id.js
```

### UI/UX Design

#### Component Layout
```
┌─────────────────────────────────────────────┐
│ Menu CSV Upload                              │
├─────────────────────────────────────────────┤
│ Upload a CSV file to import menu items       │
│                                              │
│ Status: ✓ Account registered                 │
│         ✓ Restaurant registered              │
│                                              │
│ [Choose File] menu_items.csv                 │
│                                              │
│ [Upload Menu] button                         │
│                                              │
│ Progress/Results:                            │
│ - Uploading file...                         │
│ - Running import script...                   │
│ - ✓ Menu imported successfully              │
└─────────────────────────────────────────────┘
```

#### Status States
1. **Ready**: Account and restaurant registered, ready for upload
2. **Not Ready**: Missing account or restaurant registration
3. **Uploading**: File upload in progress
4. **Processing**: Script execution in progress
5. **Success**: Menu imported successfully
6. **Error**: Display error message

### Security Considerations

1. **Authentication**: Require valid user session and organisation context
2. **File Validation**: 
   - Check file type (CSV only)
   - Limit file size (e.g., 10MB max)
   - Scan for malicious content
3. **Path Sanitization**: Ensure file paths are properly sanitized
4. **Temporary File Cleanup**: Always delete uploaded files after processing
5. **Script Execution**: Run with limited permissions and timeout

### Error Handling

1. **Missing Prerequisites**:
   - No account registered
   - No restaurant registered
   - Missing credentials in database

2. **File Issues**:
   - Invalid file type
   - File too large
   - File upload failed

3. **Script Execution**:
   - Script timeout
   - Login failed
   - Restaurant not found
   - Import failed

4. **User Feedback**:
   - Clear error messages
   - Actionable suggestions
   - Option to retry

## Implementation Steps

### Phase 1: Frontend Updates
1. Remove registration logs from main tab view
2. Add CSV upload section UI
3. Implement file selection and validation
4. Add upload state management

### Phase 2: Backend Route
1. Add multer for file upload handling
2. Create upload-csv-menu route
3. Add database queries for credentials
4. Implement script execution

### Phase 3: Script Updates
1. Update import-csv-menu.js with new arguments
2. Add smart matching logic from migration guide
3. Test with various restaurant names
4. Ensure proper error handling

### Phase 4: Integration Testing
1. Test full upload flow
2. Test error scenarios
3. Test with multiple restaurants
4. Verify file cleanup

### Phase 5: Polish
1. Add loading animations
2. Improve error messages
3. Add success confirmations
4. Optional: Show import progress

## Dependencies

### NPM Packages
- multer: For file upload handling
- Already have: express, child_process, fs

### Scripts
- import-csv-menu.js: Needs updates per migration guide
- test-get-restaurant-id.js: Reference for matching logic

### Database Tables
- pumpd_accounts: For email and password
- restaurants: For restaurant name
- No new tables needed

## Testing Checklist

- [ ] File upload works with valid CSV
- [ ] File upload rejects non-CSV files
- [ ] Upload requires registered account
- [ ] Upload requires registered restaurant
- [ ] Script finds correct restaurant with fuzzy matching
- [ ] Script handles apostrophes and case differences
- [ ] Temporary files are cleaned up
- [ ] Errors display helpful messages
- [ ] Success shows confirmation
- [ ] Works with multiple restaurants per account

## Future Enhancements

1. **Progress Tracking**: Show real-time import progress
2. **CSV Preview**: Show preview of CSV data before upload
3. **Batch Upload**: Support multiple CSV files
4. **Import History**: Track previous uploads
5. **Rollback**: Option to undo last import
6. **Validation**: Pre-validate CSV format before upload
7. **Download Template**: Provide CSV template for users

## Notes

- This feature intentionally does not log to the database to keep it simple
- The script execution is synchronous but wrapped in async/await for consistency
- File cleanup happens in both success and error cases
- The 2-minute timeout should be sufficient for most menu sizes
- Consider adding webhook support for long-running imports in the future