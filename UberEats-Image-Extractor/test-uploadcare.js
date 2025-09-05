/**
 * Test script for UploadCare CDN integration
 * Tests with real menu data from Smokey Ts Cashel Street
 */

require('dotenv').config();
const UploadCareService = require('./src/services/uploadcare-service');
const databaseService = require('./src/services/database-service');

// Initialize database first
databaseService.initializeDatabase();

const MENU_ID = 'df3cb573-720e-4375-ab4c-705adb0aee32';
const RESTAURANT_NAME = 'Smokey Ts Cashel Street';

// Test configuration
const TEST_CONFIG = {
  uploadcare: {
    publicKey: process.env.UPLOADCARE_PUBLIC_KEY || 'demopublickey',
    secretKey: process.env.UPLOADCARE_SECRET_KEY || null
  },
  testMode: false, // Set to false to perform actual uploads
  maxImagesToTest: 1 // Limit for testing - just 1 image for initial test
};

async function testDatabaseMethods() {
  console.log('\n=== Testing Database CDN Methods ===\n');
  
  try {
    // 1. Test getting images for upload
    console.log('1. Testing getMenuImagesForUpload...');
    const imagesToUpload = await databaseService.getMenuImagesForUpload(MENU_ID);
    console.log(`   Found ${imagesToUpload.length} images ready for upload`);
    
    if (imagesToUpload.length > 0) {
      console.log(`   Sample image:`, {
        id: imagesToUpload[0].id,
        url: imagesToUpload[0].url.substring(0, 50) + '...',
        itemName: imagesToUpload[0].itemName,
        categoryName: imagesToUpload[0].categoryName
      });
    }
    
    // 2. Test CDN stats
    console.log('\n2. Testing getMenuCDNStats...');
    const stats = await databaseService.getMenuCDNStats(MENU_ID);
    console.log('   CDN Stats:', stats);
    
    // 3. Test batch creation
    console.log('\n3. Testing createUploadBatch...');
    const batch = await databaseService.createUploadBatch(MENU_ID, imagesToUpload.length);
    console.log('   Created batch:', {
      id: batch?.id,
      total_images: batch?.total_images,
      status: batch?.status
    });
    
    // 4. Test batch retrieval
    if (batch) {
      console.log('\n4. Testing getUploadBatch...');
      const retrievedBatch = await databaseService.getUploadBatch(batch.id);
      console.log('   Retrieved batch:', {
        id: retrievedBatch?.id,
        restaurant: retrievedBatch?.menus?.restaurants?.name
      });
      
      // Clean up test batch
      await databaseService.updateUploadBatch(batch.id, {
        status: 'cancelled',
        metadata: { test: true, cancelled_reason: 'Test run' }
      });
    }
    
    console.log('\n✅ Database methods test completed successfully');
    return imagesToUpload;
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    return [];
  }
}

async function testUploadCareService() {
  console.log('\n=== Testing UploadCare Service ===\n');
  
  const uploadcare = new UploadCareService(
    TEST_CONFIG.uploadcare.publicKey,
    TEST_CONFIG.uploadcare.secretKey
  );
  
  try {
    // 1. Test filename sanitization
    console.log('1. Testing filename sanitization...');
    const testUrl = 'https://example.com/image.jpeg';
    const sanitized = uploadcare.sanitizeFilename(testUrl, 'Buffalo Wings', 'Sides');
    console.log(`   Sanitized filename: ${sanitized}`);
    
    // 2. Test with a real image URL (dry run)
    const sampleImageUrl = 'https://tb-static.uber.com/prod/image-proc/processed_images/84a6e4b25bb154fb1059a0d57d4e4785/5143f1e218c67c20fe5a4cd33d90b07b.jpeg';
    
    if (!TEST_CONFIG.testMode) {
      console.log('\n2. Testing actual upload (LIVE MODE)...');
      const result = await uploadcare.uploadImageFromUrl(
        sampleImageUrl,
        'southern-fried-chicken.jpeg',
        {
          itemName: 'Southern Fried Chicken',
          categoryName: 'Sides',
          restaurantName: RESTAURANT_NAME,
          test: true
        }
      );
      
      console.log('   Upload result:', {
        success: result.success,
        cdnId: result.cdnId,
        cdnUrl: result.cdnUrl,
        duration: result.uploadDuration
      });
      
      // If successful, try to get file info
      if (result.success && result.cdnId) {
        const fileInfo = await uploadcare.getFileInfo(result.cdnId);
        console.log('   File info retrieved:', fileInfo.success);
        
        // Clean up test upload
        const deleteResult = await uploadcare.deleteImage(result.cdnId);
        console.log('   Test image deleted:', deleteResult.success);
      }
    } else {
      console.log('\n2. Skipping actual upload (TEST MODE)...');
      console.log('   Would upload:', {
        url: sampleImageUrl.substring(0, 50) + '...',
        filename: 'southern-fried-chicken.jpeg'
      });
    }
    
    console.log('\n✅ UploadCare service test completed successfully');
    
  } catch (error) {
    console.error('❌ UploadCare test failed:', error);
  }
}

async function testIntegration() {
  console.log('\n=== Testing Full Integration ===\n');
  
  try {
    // Get images from database
    const images = await databaseService.getMenuImagesForUpload(MENU_ID);
    
    if (images.length === 0) {
      console.log('No images to test with. All images may already be uploaded.');
      return;
    }
    
    // Limit images for testing
    const testImages = images.slice(0, TEST_CONFIG.maxImagesToTest);
    console.log(`Testing with ${testImages.length} images...`);
    
    const uploadcare = new UploadCareService(
      TEST_CONFIG.uploadcare.publicKey,
      TEST_CONFIG.uploadcare.secretKey
    );
    
    // Create batch record
    const batch = await databaseService.createUploadBatch(MENU_ID, testImages.length);
    console.log(`Created batch ${batch?.id}`);
    
    // Process images
    let successCount = 0;
    let failCount = 0;
    
    for (const image of testImages) {
      const filename = uploadcare.sanitizeFilename(
        image.url,
        image.itemName,
        image.categoryName
      );
      
      console.log(`\nProcessing: ${image.itemName}`);
      
      if (!TEST_CONFIG.testMode) {
        // Actual upload
        const result = await uploadcare.uploadImageWithRetry(
          image.url,
          filename,
          {
            menuItemId: image.menu_item_id,
            itemName: image.itemName,
            categoryName: image.categoryName,
            restaurantName: RESTAURANT_NAME,
            batchId: batch?.id
          }
        );
        
        if (result.success) {
          // Update database with CDN info
          await databaseService.updateImageCDNInfo(image.id, {
            cdnId: result.cdnId,
            cdnUrl: result.cdnUrl,
            filename: result.filename,
            metadata: result.metadata
          });
          successCount++;
          console.log(`  ✅ Uploaded successfully: ${result.cdnUrl}`);
        } else {
          // Mark as failed
          await databaseService.markImageUploadFailed(image.id, result.error);
          failCount++;
          console.log(`  ❌ Upload failed: ${result.error}`);
        }
      } else {
        // Simulated upload
        console.log(`  📦 Would upload: ${filename}`);
        successCount++;
      }
    }
    
    // Update batch status
    if (batch) {
      await databaseService.updateUploadBatch(batch.id, {
        uploaded_count: successCount,
        failed_count: failCount,
        status: successCount === testImages.length ? 'completed' : 'partial',
        metadata: { 
          test_run: TEST_CONFIG.testMode,
          test_date: new Date().toISOString()
        }
      });
    }
    
    // Get final stats
    const finalStats = await databaseService.getMenuCDNStats(MENU_ID);
    console.log('\nFinal CDN Stats:', finalStats);
    
    console.log('\n✅ Integration test completed');
    console.log(`   Processed: ${testImages.length} images`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }
}

async function runTests() {
  console.log('========================================');
  console.log('    UploadCare CDN Integration Test');
  console.log('========================================');
  console.log(`Menu ID: ${MENU_ID}`);
  console.log(`Restaurant: ${RESTAURANT_NAME}`);
  console.log(`Mode: ${TEST_CONFIG.testMode ? 'TEST (no actual uploads)' : 'LIVE (will upload to CDN)'}`);
  console.log('========================================');
  
  // Run tests
  await testDatabaseMethods();
  await testUploadCareService();
  await testIntegration();
  
  console.log('\n========================================');
  console.log('           Test Suite Complete');
  console.log('========================================');
  
  // Close database connection
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

// Run tests
runTests();