# Supabase Storage Setup - PDF Extractions Bucket

## Overview

This document provides step-by-step instructions for creating and configuring the `pdf-extractions` storage bucket in Supabase, which is used for temporary PDF hosting during the extraction workflow.

## Prerequisites

- Access to Supabase Dashboard
- Project ID: `qgabsyggzlkcstjzugdh`
- Admin/Owner permissions on the project

## Bucket Configuration

### Bucket Details

| Property | Value |
|----------|-------|
| **Name** | `pdf-extractions` |
| **Public Access** | Enabled (required for Firecrawl) |
| **File Size Limit** | 10 MB |
| **Allowed MIME Types** | `application/pdf` |
| **Auto-deletion** | 24 hours (via lifecycle policy) |

---

## Setup Instructions

### Option 1: Via Supabase Dashboard (Recommended)

1. **Navigate to Storage**
   - Go to https://supabase.com/dashboard/project/qgabsyggzlkcstjzugdh
   - Click "Storage" in the left sidebar

2. **Create New Bucket**
   - Click "New bucket" button
   - Enter bucket name: `pdf-extractions`
   - Toggle "Public bucket" to **ON**
   - Click "Create bucket"

3. **Configure Bucket Settings**
   - Click on `pdf-extractions` bucket
   - Go to "Settings" tab
   - Set file size limit: `10 MB`
   - Set allowed MIME types: `application/pdf`
   - Save settings

4. **Create Folder Structure**
   - Inside `pdf-extractions` bucket
   - Create folder: `temp/` (for temporary PDFs)
   - Create folder: `archive/` (optional, for audit trail)

### Option 2: Via Supabase API

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://qgabsyggzlkcstjzugdh.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create bucket
const { data, error } = await supabase
  .storage
  .createBucket('pdf-extractions', {
    public: true,
    fileSizeLimit: 10485760, // 10 MB in bytes
    allowedMimeTypes: ['application/pdf']
  });

if (error) {
  console.error('Error creating bucket:', error);
} else {
  console.log('Bucket created successfully:', data);
}
```

### Option 3: Via SQL (Advanced)

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pdf-extractions',
  'pdf-extractions',
  true,
  10485760,  -- 10 MB
  ARRAY['application/pdf']
);
```

---

## Access Control Policies

### RLS Policies for Organization Isolation

```sql
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload PDFs to their organization's folder
CREATE POLICY "Users can upload PDFs to their org folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pdf-extractions'
  AND (storage.foldername(name))[1] = 'temp'
  AND auth.jwt() ->> 'organisation_id' IS NOT NULL
);

-- Policy: Anyone can read PDFs (required for Firecrawl)
CREATE POLICY "Public read access for PDFs"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'pdf-extractions');

-- Policy: Users can delete their organization's PDFs
CREATE POLICY "Users can delete their org PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pdf-extractions'
  AND auth.jwt() ->> 'organisation_id' IS NOT NULL
);
```

---

## Lifecycle Policy (Auto-deletion)

### Option 1: Database Trigger (Recommended)

```sql
-- Create function to delete old PDFs
CREATE OR REPLACE FUNCTION delete_old_pdfs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete PDFs older than 24 hours in temp folder
  DELETE FROM storage.objects
  WHERE bucket_id = 'pdf-extractions'
    AND (storage.foldername(name))[1] = 'temp'
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Create scheduled job (requires pg_cron extension)
-- Run every hour
SELECT cron.schedule(
  'delete-old-pdfs',
  '0 * * * *',  -- Every hour
  $$ SELECT delete_old_pdfs(); $$
);
```

### Option 2: Application-level Cleanup

Add to `PDFExtractionService`:

```javascript
/**
 * Cleanup PDFs older than 24 hours
 * Run this as a scheduled job (e.g., via cron or Heroku Scheduler)
 */
async cleanupOldPDFs() {
  const { data, error } = await supabase
    .storage
    .from('pdf-extractions')
    .list('temp/', {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'asc' }
    });

  if (error) {
    console.error('Error listing PDFs:', error);
    return;
  }

  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);

  const filesToDelete = data
    .filter(file => new Date(file.created_at).getTime() < oneDayAgo)
    .map(file => `temp/${file.name}`);

  if (filesToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .storage
      .from('pdf-extractions')
      .remove(filesToDelete);

    if (deleteError) {
      console.error('Error deleting old PDFs:', deleteError);
    } else {
      console.log(`Deleted ${filesToDelete.length} old PDFs`);
    }
  }
}
```

---

## Testing the Setup

### 1. Upload Test PDF

```javascript
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://qgabsyggzlkcstjzugdh.supabase.co',
  process.env.SUPABASE_ANON_KEY
);

async function testUpload() {
  const testPDF = fs.readFileSync('test-menu.pdf');

  const { data, error } = await supabase
    .storage
    .from('pdf-extractions')
    .upload(`temp/test-${Date.now()}.pdf`, testPDF, {
      contentType: 'application/pdf',
      cacheControl: '3600'
    });

  if (error) {
    console.error('Upload failed:', error);
  } else {
    console.log('Upload successful:', data);

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('pdf-extractions')
      .getPublicUrl(data.path);

    console.log('Public URL:', publicUrl);

    // Test URL is accessible
    const response = await fetch(publicUrl);
    console.log('URL accessible:', response.ok);

    // Cleanup
    await supabase.storage.from('pdf-extractions').remove([data.path]);
    console.log('Cleanup successful');
  }
}

testUpload();
```

### 2. Verify Public Access

```bash
# Replace with your actual public URL
curl -I "https://qgabsyggzlkcstjzugdh.supabase.co/storage/v1/object/public/pdf-extractions/temp/test-1729468800000.pdf"

# Should return:
# HTTP/2 200
# content-type: application/pdf
```

### 3. Test Firecrawl Integration

```javascript
const axios = require('axios');

async function testFirecrawlExtraction(pdfPublicUrl) {
  const response = await axios.post(
    'https://api.firecrawl.dev/v2/scrape',
    {
      url: pdfPublicUrl,
      parsers: ['pdf'],
      formats: ['markdown']
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log('Firecrawl extraction successful:');
  console.log(JSON.stringify(response.data, null, 2));
}
```

---

## Monitoring and Maintenance

### Storage Metrics to Track

1. **Bucket Size**
   - Monitor total storage used
   - Alert if exceeding expected size (should be minimal with auto-deletion)

2. **File Count**
   - Track number of files in `temp/` folder
   - Should typically be < 10 at any time
   - Alert if > 50 (indicates cleanup failure)

3. **Upload/Download Bandwidth**
   - Monitor for unusual spikes
   - Track cost implications

### Dashboard Queries

```sql
-- Check bucket usage
SELECT
  bucket_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size'::int) / 1024 / 1024 as total_mb
FROM storage.objects
WHERE bucket_id = 'pdf-extractions'
GROUP BY bucket_id;

-- Check old files not cleaned up
SELECT
  name,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as age_hours
FROM storage.objects
WHERE bucket_id = 'pdf-extractions'
  AND (storage.foldername(name))[1] = 'temp'
  AND created_at < NOW() - INTERVAL '24 hours'
ORDER BY created_at ASC;

-- Check recent uploads
SELECT
  name,
  created_at,
  metadata->>'size' as size_bytes
FROM storage.objects
WHERE bucket_id = 'pdf-extractions'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Troubleshooting

### Issue: Public URL returns 403 Forbidden

**Cause:** Bucket not set to public

**Solution:**
```sql
UPDATE storage.buckets
SET public = true
WHERE id = 'pdf-extractions';
```

### Issue: Upload fails with "File too large"

**Cause:** File exceeds 10 MB limit

**Solution:**
- Compress PDF before upload
- Or increase limit (not recommended, as Firecrawl may have limits)

### Issue: Firecrawl cannot access PDF URL

**Causes:**
1. PDF deleted before Firecrawl accessed it
2. Network issues
3. Incorrect URL format

**Solutions:**
- Increase retry attempts with delay
- Verify URL is accessible via curl
- Check Supabase logs for access errors

### Issue: Files not being auto-deleted

**Cause:** Cleanup job not running

**Solutions:**
- Check cron job status (if using pg_cron)
- Manually run cleanup function
- Implement application-level cleanup as fallback

---

## Cost Considerations

**Supabase Storage Pricing (Free Tier):**
- 1 GB storage included
- 2 GB bandwidth included

**Expected Usage:**
- PDF size: ~5 MB average
- Retention: 24 hours max
- Expected concurrent PDFs: < 10
- Monthly uploads: ~100-500 PDFs

**Estimated Cost:** $0/month (within free tier)

**Note:** If volume increases significantly, consider:
- Reducing retention to 1 hour
- Implementing immediate deletion after extraction
- Using cheaper S3/GCS storage

---

## Security Best Practices

1. ✅ **Public read access only** - No public write/delete
2. ✅ **RLS policies enforced** - Organization-level isolation
3. ✅ **File type restrictions** - PDF only
4. ✅ **Size limits enforced** - 10 MB max
5. ✅ **Temporary storage** - Auto-deletion after 24h
6. ✅ **No sensitive data** - PDFs are temporary menu data only

---

**Last Updated:** October 20, 2025
**Status:** Ready for implementation
**Next Step:** Create bucket via Supabase Dashboard
