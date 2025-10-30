/**
 * Test Script for Social Media Video Generation Services
 *
 * This script tests all three video generation modes:
 * - Mode 1: Database Image → Video
 * - Mode 2: Text → Video
 * - Mode 3: Generated Image → Video
 *
 * PREREQUISITES:
 * 1. Add API keys to .env file:
 *    - OPENAI_API_KEY=sk-proj-...
 *    - GOOGLE_GENAI_API_KEY=AI...
 *
 * 2. Install required packages:
 *    npm install openai @google/generative-ai axios
 *
 * USAGE:
 *    node test-social-media-services.js [mode]
 *    - mode: 1, 2, or 3 (defaults to 2 for simplest test)
 */

require('dotenv').config();
const VideoGenerationService = require('./src/services/social-media/video-generation-service');

// Test configuration
const TEST_ORG_ID = process.env.TEST_ORG_ID || '00000000-0000-0000-0000-000000000000';
const TEST_USER_ID = process.env.TEST_USER_ID || '00000000-0000-0000-0000-000000000000';

async function testMode1() {
  console.log('\n========================================');
  console.log('Testing Mode 1: Database Image → Video');
  console.log('========================================\n');

  const service = new VideoGenerationService();

  try {
    // You need to provide a valid image ID from your database
    const TEST_IMAGE_ID = process.env.TEST_IMAGE_ID;

    if (!TEST_IMAGE_ID) {
      console.error('ERROR: TEST_IMAGE_ID environment variable not set');
      console.log('Please set TEST_IMAGE_ID to a valid menu item image ID from your database');
      return;
    }

    const request = {
      mode: 'image-to-video',
      prompt: 'The burger slowly rotates, steam rises from the hot patty, camera slowly zooms in',
      inputSource: {
        type: 'database',
        imageId: TEST_IMAGE_ID
      },
      organisationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      soraModel: 'sora-2',
      videoConfig: {
        size: '1280x720',
        seconds: 4  // Short duration for testing
      }
    };

    console.log('Creating video generation job...');
    const job = await service.generateVideo(request);

    console.log('\n✅ Video generation started successfully!');
    console.log('Job Details:', {
      jobId: job.id,
      soraVideoId: job.sora_video_id,
      status: job.status,
      progress: job.progress
    });

    console.log('\nThe video is being generated in the background.');
    console.log('You can check the status with:');
    console.log(`  SELECT * FROM social_media_videos WHERE id = '${job.id}';`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function testMode2() {
  console.log('\n========================================');
  console.log('Testing Mode 2: Text → Video');
  console.log('========================================\n');

  const service = new VideoGenerationService();

  try {
    const request = {
      mode: 'text-to-video',
      prompt: 'A cozy restaurant interior with warm ambient lighting, wooden tables and chairs, soft shadows, camera slowly pans across the dining room',
      organisationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      soraModel: 'sora-2',
      videoConfig: {
        size: '1280x720',
        seconds: 4  // Short duration for testing
      }
    };

    console.log('Creating video generation job...');
    console.log('Prompt:', request.prompt);
    console.log('');

    const job = await service.generateVideo(request);

    console.log('\n✅ Video generation started successfully!');
    console.log('Job Details:', {
      jobId: job.id,
      soraVideoId: job.sora_video_id,
      status: job.status,
      progress: job.progress
    });

    console.log('\nThe video is being generated in the background.');
    console.log('This typically takes 2-5 minutes for sora-2 model.');
    console.log('\nYou can check the status with:');
    console.log(`  SELECT * FROM social_media_videos WHERE id = '${job.id}';`);

    console.log('\nTo check status programmatically:');
    console.log(`  const status = await service.getJobStatus('${job.id}');`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function testMode3() {
  console.log('\n========================================');
  console.log('Testing Mode 3: AI Generated Image → Video');
  console.log('========================================\n');

  const service = new VideoGenerationService();

  try {
    const request = {
      mode: 'generated-image-to-video',
      imagePrompt: 'Professional food photography of a gourmet burger on a wooden board, with fresh ingredients, warm lighting, shallow depth of field',
      prompt: 'The burger slowly rotates, steam rises from the hot patty, camera orbits around the dish',
      organisationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      soraModel: 'sora-2',
      videoConfig: {
        size: '1280x720',
        seconds: 4  // Short duration for testing
      }
    };

    console.log('Creating video generation job...');
    console.log('Image Prompt:', request.imagePrompt);
    console.log('Video Prompt:', request.prompt);
    console.log('');

    const job = await service.generateVideo(request);

    console.log('\n✅ Video generation started successfully!');
    console.log('Job Details:', {
      jobId: job.id,
      soraVideoId: job.sora_video_id,
      status: job.status,
      progress: job.progress
    });

    console.log('\nThe video is being generated in the background.');
    console.log('This mode takes longer:');
    console.log('  1. Image generation: 10-30 seconds');
    console.log('  2. Video generation: 2-5 minutes');
    console.log('\nYou can check the status with:');
    console.log(`  SELECT * FROM social_media_videos WHERE id = '${job.id}';`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function testGetStatus() {
  console.log('\n========================================');
  console.log('Testing Get Job Status');
  console.log('========================================\n');

  const jobId = process.argv[3];

  if (!jobId) {
    console.error('ERROR: Please provide a job ID');
    console.log('Usage: node test-social-media-services.js status <job-id>');
    return;
  }

  const service = new VideoGenerationService();

  try {
    console.log('Fetching status for job:', jobId);

    const status = await service.getJobStatus(jobId);

    console.log('\n✅ Job Status:', {
      id: status.id,
      status: status.status,
      progress: status.progress + '%',
      soraVideoId: status.sora_video_id,
      videoUrl: status.video_url || 'Not available yet',
      thumbnailUrl: status.thumbnail_url || 'Not available yet',
      errorMessage: status.error_message || 'None',
      createdAt: status.created_at,
      completedAt: status.completed_at || 'Not completed yet'
    });

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

async function testListVideos() {
  console.log('\n========================================');
  console.log('Testing List Videos');
  console.log('========================================\n');

  const service = new VideoGenerationService();

  try {
    console.log('Fetching videos for organisation:', TEST_ORG_ID);

    const videos = await service.listVideos({
      organisationId: TEST_ORG_ID,
      limit: 10
    });

    console.log(`\n✅ Found ${videos.length} videos:\n`);

    videos.forEach((video, index) => {
      console.log(`${index + 1}. ${video.mode} - ${video.status}`);
      console.log(`   ID: ${video.id}`);
      console.log(`   Progress: ${video.progress}%`);
      console.log(`   Created: ${new Date(video.created_at).toLocaleString()}`);
      if (video.video_url) {
        console.log(`   Video: ${video.video_url}`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

async function printHelp() {
  console.log('\n========================================');
  console.log('Social Media Video Generation Test Script');
  console.log('========================================\n');
  console.log('Usage: node test-social-media-services.js [command]\n');
  console.log('Commands:');
  console.log('  mode1          Test Mode 1: Database Image → Video');
  console.log('  mode2          Test Mode 2: Text → Video (default, simplest)');
  console.log('  mode3          Test Mode 3: AI Generated Image → Video');
  console.log('  status <id>    Check status of a specific job');
  console.log('  list           List all videos for test organization');
  console.log('  help           Show this help message');
  console.log('\nExamples:');
  console.log('  node test-social-media-services.js mode2');
  console.log('  node test-social-media-services.js status abc-123-def-456');
  console.log('  node test-social-media-services.js list\n');
  console.log('Prerequisites (add to .env file):');
  console.log('  1. SUPABASE_URL - Your Supabase project URL');
  console.log('  2. SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key');
  console.log('  3. OPENAI_API_KEY - Your OpenAI API key (for Sora 2)');
  console.log('  4. GOOGLE_GENAI_API_KEY - Your Google Gemini API key (for Mode 3)');
  console.log('  5. (Optional) TEST_ORG_ID and TEST_USER_ID\n');
}

// Main execution
async function main() {
  const command = process.argv[2] || 'mode2';

  // Verify database connection
  if (!process.env.SUPABASE_URL && command !== 'help') {
    console.error('\n❌ ERROR: SUPABASE_URL not found in environment variables');
    console.log('Please add SUPABASE_URL to your .env file\n');
    process.exit(1);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY && command !== 'help') {
    console.error('\n❌ ERROR: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY not found');
    console.log('Please add SUPABASE_SERVICE_ROLE_KEY to your .env file\n');
    process.exit(1);
  }

  // Verify API keys
  if (!process.env.OPENAI_API_KEY && command !== 'help') {
    console.error('\n❌ ERROR: OPENAI_API_KEY not found in environment variables');
    console.log('Please add OPENAI_API_KEY to your .env file\n');
    process.exit(1);
  }

  if (!process.env.GOOGLE_GENAI_API_KEY && (command === 'mode3')) {
    console.error('\n❌ ERROR: GOOGLE_GENAI_API_KEY not found in environment variables');
    console.log('Please add GOOGLE_GENAI_API_KEY to your .env file (required for Mode 3)\n');
    process.exit(1);
  }

  switch (command) {
    case 'mode1':
      await testMode1();
      break;
    case 'mode2':
      await testMode2();
      break;
    case 'mode3':
      await testMode3();
      break;
    case 'status':
      await testGetStatus();
      break;
    case 'list':
      await testListVideos();
      break;
    case 'help':
      await printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      await printHelp();
      break;
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});
