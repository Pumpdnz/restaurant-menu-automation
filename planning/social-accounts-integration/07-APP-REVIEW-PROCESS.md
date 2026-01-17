# Meta App Review Process Guide

## Overview

To publish content to Instagram and Facebook on behalf of users, your Meta app must go through the App Review process to obtain permission to use certain API features.

## Required Permissions

### Must Request

| Permission | Purpose | Platform |
|------------|---------|----------|
| `instagram_basic` | Read Instagram account info | Instagram |
| `instagram_content_publish` | Publish content to Instagram | Instagram |
| `pages_show_list` | List Facebook Pages user manages | Facebook |
| `pages_read_engagement` | Read post engagement metrics | Facebook |
| `pages_manage_posts` | Create and manage posts on Pages | Facebook |

### Optional (Phase 3 - Analytics)

| Permission | Purpose |
|------------|---------|
| `instagram_manage_insights` | Read Instagram analytics |
| `read_insights` | Read Facebook Page insights |

## Prerequisites

### 1. Business Information

You must provide:

- ✅ **Privacy Policy URL** (publicly accessible)
- ✅ **Terms of Service URL** (publicly accessible)
- ✅ **Data Deletion Instructions URL** (required by GDPR)
- ✅ **App Icon** (1024x1024px, PNG/JPG)
- ✅ **Business Verification** (optional for <10k posts/day)

### Privacy Policy Must Include

Your privacy policy must clearly state:

1. What data you collect from Facebook/Instagram
2. How you use the data
3. How long you retain the data
4. How users can delete their data
5. Third-party data sharing (if any)
6. Contact information

**Example Privacy Policy Section**:

```markdown
## Social Media Integration

When you connect your Instagram Business or Facebook Page to Pumpd:

- **Data Collected**: Instagram username, profile picture, Facebook Page name,
  post engagement metrics (likes, comments, shares, reach).
- **Purpose**: To enable you to publish AI-generated content directly to your
  social media accounts and view content performance analytics.
- **Storage**: Access tokens are encrypted and stored securely. Post analytics
  are stored for historical comparison.
- **Retention**: Tokens and data are retained until you disconnect your account
  or delete your Pumpd account.
- **Third-Party Sharing**: We do not share your social media data with any
  third parties.
- **Deletion**: You can disconnect your social media accounts at any time from
  Settings. Upon account deletion, all associated data is permanently removed.
```

### Data Deletion Instructions URL

Create a dedicated page (e.g., `https://pumpd.co.nz/data-deletion`) with:

```markdown
# Data Deletion Instructions

To delete your data from Pumpd:

## Method 1: Through the App
1. Log into your Pumpd account
2. Go to Settings > Social Accounts
3. Click "Disconnect" next to your Instagram/Facebook account
4. Go to Settings > Account
5. Click "Delete Account" (this will delete all your data)

## Method 2: Request via Email
Email us at privacy@pumpd.co.nz with:
- Your registered email address
- Instagram username or Facebook Page name
- Request to delete specific social media connection or entire account

We will process your request within 30 days and send confirmation once complete.
```

### 2. Test Users

Create test users for Meta reviewers:

1. Go to Roles > Test Users in Meta App dashboard
2. Create 2-3 test users
3. Assign appropriate permissions
4. Provide credentials to reviewers during submission

## Submission Requirements

### For Each Permission

You must provide for EACH permission you're requesting:

1. **Detailed Description** (200-500 words)
   - What your app does
   - Why you need this specific permission
   - How users benefit

2. **Screen Recording / Screenshots**
   - Show complete user flow
   - Demonstrate permission in action
   - Must be clear and high quality
   - 30-120 seconds for video

3. **Step-by-Step Instructions**
   - How reviewer can test the feature
   - Test user credentials
   - Any special setup required

### Example: instagram_content_publish

**Description**:
```
Pumpd is a restaurant social media management platform that generates
AI-powered video and image content for restaurant marketing. We need
the instagram_content_publish permission to allow restaurant owners to
publish their AI-generated content directly to their Instagram Business
accounts from within our platform.

User Flow:
1. Restaurant owner generates a promotional video using our AI tools
2. User clicks "Post to Instagram" button
3. User selects Instagram account (previously connected via OAuth)
4. User adds caption and hashtags
5. User clicks "Publish"
6. Our app uses the instagram_content_publish permission to create and
   publish the video to the user's Instagram feed or Reels

This saves restaurant owners time by eliminating the need to download
content and manually upload to Instagram, streamlining their social
media marketing workflow.
```

**Screen Recording Checklist**:
- ✅ Show logging into your app
- ✅ Show generating or selecting content
- ✅ Show clicking "Post to Instagram"
- ✅ Show account selection UI
- ✅ Show caption/hashtag input
- ✅ Show "Publish" button click
- ✅ Show success message
- ✅ Show post appearing on Instagram (open Instagram app/web)

**Step-by-Step Instructions for Reviewer**:
```
1. Log in using test credentials:
   Email: reviewer@test.pumpd.co.nz
   Password: [provided securely]

2. Navigate to "Social Media" > "Videos" tab

3. Click "Post to Instagram" on any video

4. If not connected, click "Connect Instagram Account"
   - Use Test Instagram account: @pumpd_test
   - Password: [provided securely]
   - This is a Business account linked to a Facebook Page

5. Select @pumpd_test account from dropdown

6. Add caption: "Test post from Pumpd - please ignore"

7. Select post type: "Feed Post"

8. Click "Publish Now"

9. Verify post appears on Instagram:
   - Open Instagram app or instagram.com
   - Log in as @pumpd_test
   - Verify new post appears in feed

10. Return to Pumpd app and verify success message displayed
```

## App Review Dashboard

### Navigate to App Review

1. Log into Meta for Developers
2. Select your app
3. Left sidebar: App Review > Permissions and Features

### Submit for Review

1. Click "+ Request" next to each permission
2. Fill out required fields
3. Upload screen recordings
4. Provide test credentials
5. Click "Submit"

### Review Timeline

| Stage | Duration | Status |
|-------|----------|--------|
| **Submission** | Immediate | You'll receive confirmation email |
| **In Review** | 3-7 business days | Average 5 days |
| **Approved** | Immediate activation | Email notification |
| **Rejected** | 1-2 days to resubmit | Review feedback provided |

## Common Rejection Reasons

### 1. Incomplete Screen Recording

❌ **Problem**: Screen recording doesn't show complete flow
✅ **Solution**: Record from login to final Instagram post verification

### 2. Poor Video Quality

❌ **Problem**: Blurry, too fast, or unclear audio/captions
✅ **Solution**: Use 1080p recording, slow down actions, add clear captions

### 3. Missing Permission Usage

❌ **Problem**: Screen recording doesn't actually use the permission
✅ **Solution**: Ensure you demonstrate the exact API call being made

### 4. Insufficient Description

❌ **Problem**: Generic description, doesn't explain specific use case
✅ **Solution**: Provide detailed, specific explanation with business context

### 5. Privacy Policy Issues

❌ **Problem**: Privacy policy doesn't mention Facebook/Instagram data
✅ **Solution**: Add specific section on social media integration

### 6. Test User Problems

❌ **Problem**: Test credentials don't work, or account not Business type
✅ **Solution**: Verify test account is Business type, credentials valid

### 7. Missing Data Deletion

❌ **Problem**: No clear data deletion instructions
✅ **Solution**: Create dedicated page with multiple deletion methods

## Best Practices

### Screen Recording Tips

1. **Use Professional Recording Software**
   - Mac: QuickTime, ScreenFlow, Camtasia
   - Windows: OBS Studio, Camtasia
   - Chrome Extension: Loom

2. **Recording Checklist**
   - ✅ 1080p resolution minimum
   - ✅ Show mouse cursor
   - ✅ Slow down actions (pause 2 seconds between clicks)
   - ✅ Add text captions for clarity
   - ✅ Keep video 30-120 seconds
   - ✅ Show URL bar to prove it's your app
   - ✅ No background noise

3. **Content Checklist**
   - ✅ Start from logged-out state
   - ✅ Show login process
   - ✅ Show complete feature flow
   - ✅ Show permission dialog (if first-time OAuth)
   - ✅ Show final result on Instagram/Facebook
   - ✅ Return to your app to show success state

### Description Tips

1. **Structure Your Description**
   ```
   [App Overview - 1-2 sentences]
   [Permission Purpose - 1-2 sentences]
   [User Flow - numbered steps]
   [User Benefit - 1-2 sentences]
   ```

2. **Use Clear Language**
   - Avoid jargon
   - Be specific about data usage
   - Explain business value

3. **Highlight User Control**
   - Mention user can revoke access
   - Explain data retention
   - Note privacy protections

## Example Complete Submission

### Permission: instagram_content_publish

**Title**: Publish AI-Generated Content to Instagram

**Detailed Description**:
```
Pumpd is a B2B SaaS platform that helps restaurant owners create and publish
AI-generated marketing content. We require the instagram_content_publish
permission to enable our users (restaurant owners) to publish promotional
videos and images directly to their Instagram Business accounts.

User Flow:
1. Restaurant owner creates an AI-generated video using our video generation tools
2. User reviews the video and clicks "Post to Instagram"
3. User selects their connected Instagram Business account from a dropdown
4. User writes a caption, adds hashtags, and chooses post type (Feed/Reels/Stories)
5. User clicks "Publish Now" or schedules for later
6. Pumpd uses the instagram_content_publish API to create a container and
   publish the content to the user's Instagram account
7. User receives confirmation and can view the post on Instagram

This streamlines the content creation and publishing workflow, saving restaurant
owners 10-15 minutes per post by eliminating manual download and upload steps.
Users maintain full control and can disconnect their Instagram account at any
time from Settings > Social Accounts.
```

**Step-by-Step Testing Instructions**:
```
Test Account Credentials:
- Pumpd App: reviewer@test.pumpd.co.nz / TestPass123!
- Instagram: @pumpd_test_restaurant / TestPass123!

Steps:
1. Open https://admin.pumpd.co.nz in Chrome/Firefox
2. Log in with reviewer@test.pumpd.co.nz / TestPass123!
3. Click "Social Media" in left sidebar
4. Click "Videos" tab
5. Click "Post to Instagram" on any video with green checkmark
6. If prompted, click "Connect Instagram Account"
   a. Log in with @pumpd_test_restaurant / TestPass123!
   b. This is an Instagram Business account linked to a Facebook Page
   c. Grant all requested permissions
7. Select @pumpd_test_restaurant from account dropdown
8. Add caption: "Test post - App Review"
9. Select "Feed Post" as post type
10. Click "Publish Now"
11. Wait 5-10 seconds for publishing
12. Verify success message appears
13. Open instagram.com in new tab
14. Log in with @pumpd_test_restaurant / TestPass123!
15. Verify new post appears at top of feed
16. Return to Pumpd tab and click "View on Instagram" link

Expected Result: Video successfully published to Instagram feed with caption
```

**Screen Recording**: (Upload your recording showing the above flow)

## After Approval

### 1. Update Environment

```bash
# Mark app as production-ready
META_APP_MODE=production
META_APP_ID=your_approved_app_id
META_APP_SECRET=your_app_secret
```

### 2. Monitor Usage

Meta monitors apps for:
- Compliance with policies
- API usage patterns
- User reports
- Data handling practices

### 3. Annual Data Use Checkup

Meta requires annual confirmation of data usage:
- Review occurs once per year
- Confirm how you use each permission
- Update if anything changed
- Usually auto-approved if no changes

## Resubmission After Rejection

### 1. Review Feedback

Meta provides specific feedback:
```
"Your screen recording does not show the user granting permission
for your app to publish to Instagram. Please resubmit with a video
that shows the complete OAuth flow."
```

### 2. Fix Issues

Address all feedback points:
- Re-record video showing OAuth flow
- Update description if needed
- Verify test accounts work

### 3. Resubmit

- Click "Resubmit" on rejected permission
- Add note explaining changes made
- Typical resubmission review: 1-2 days

## Development vs Production Mode

### Development Mode

- App is in development mode by default
- Only works for test users, admins, developers
- No app review needed
- Good for testing implementation

### Production Mode (Live)

- Available after app review approval
- Works for all users
- Required for public launch
- Can still add test users for QA

## Checklist Before Submission

### Documentation

- [ ] Privacy Policy published and accessible
- [ ] Terms of Service published and accessible
- [ ] Data Deletion Instructions page created
- [ ] All URLs use HTTPS
- [ ] Privacy policy mentions Facebook/Instagram data

### App Configuration

- [ ] App icon uploaded (1024x1024px)
- [ ] App domain verified
- [ ] OAuth redirect URIs configured
- [ ] Valid redirect URIs use HTTPS
- [ ] Business verification (if needed)

### Test Environment

- [ ] Test users created with valid credentials
- [ ] Test Instagram account is Business type
- [ ] Test Instagram linked to Facebook Page
- [ ] Test Facebook Page created
- [ ] All features working in development mode

### For Each Permission

- [ ] Detailed description written (200-500 words)
- [ ] Screen recording completed (30-120 seconds, 1080p)
- [ ] Recording shows complete flow
- [ ] Recording shows final result on Instagram/Facebook
- [ ] Step-by-step instructions written
- [ ] Test credentials provided
- [ ] Special setup notes included

### Quality Checks

- [ ] Screen recording is clear and smooth
- [ ] Actions are slow enough to follow
- [ ] Captions/annotations added where helpful
- [ ] Test credentials verified working
- [ ] Test account has appropriate permissions
- [ ] All links in submission are clickable
- [ ] No spelling/grammar errors in submission

## Estimated Timeline

```
Day 0:  Prepare documentation and test accounts
Day 1:  Configure app settings
Day 2:  Record screen recordings
Day 3:  Write descriptions and instructions
Day 4:  Submit for review
Day 5-11: Meta reviews (3-7 business days)
Day 12: Approval (or resubmission if rejected)
Day 13: Go live in production mode
```

**Total: 2 weeks** (including buffer for potential resubmission)

---

**Last Updated**: January 2025
**Process**: Meta App Review
**Success Rate**: ~85% first submission (if following this guide)
**Average Review Time**: 5 business days
