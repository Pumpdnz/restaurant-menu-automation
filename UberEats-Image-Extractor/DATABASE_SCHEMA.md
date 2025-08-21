# Menu Extraction Database Schema

## Overview
This database schema is designed to support a scalable, multi-tenant menu extraction system that can handle multiple restaurants, platforms, and extraction jobs with full version history and price tracking.

## Core Tables

### 1. **platforms**
Stores supported delivery platforms (UberEats, DoorDash, etc.)
- Pre-populated with common platforms
- Extensible for new platforms

### 2. **restaurants**
Main restaurant entity
- `slug`: URL-friendly identifier
- `metadata`: Flexible JSONB for additional data
- `brand_colors`: Store extracted brand colors

### 3. **restaurant_platforms**
Links restaurants to their platform URLs
- Supports multiple platforms per restaurant
- Tracks last scrape time
- Stores platform-specific restaurant IDs

### 4. **extraction_jobs**
Tracks all extraction requests
- Job types: full_menu, categories_only, prices_only, images_only, option_sets
- Status tracking: pending, running, completed, failed
- Progress tracking in JSONB
- Configuration storage for job parameters

### 5. **menus**
Versioned menu storage
- Each extraction creates a new version
- Links to extraction job that created it
- `menu_data`: Stores raw extraction data
- `is_active`: Flag for current active menu

### 6. **categories**
Menu categories (Entrees, Soups, etc.)
- Position tracking for ordering
- CSS selector storage for re-extraction
- Links to parent menu

### 7. **menu_items**
Individual menu items
- Full item details (name, description, price)
- Tags array for attributes
- `dietary_info`: JSONB for dietary restrictions
- Platform-specific item IDs

### 8. **item_images**
Image management
- Multiple images per item (primary, thumbnail, gallery)
- Download tracking
- Local storage path for cached images

### 9. **option_sets** & **options**
Modifiers and customizations
- Supports sizes, add-ons, choices
- Min/max selection rules
- Price adjustments

### 10. **price_history**
Tracks price changes over time
- Links to extraction job that detected change
- Old and new price storage

### 11. **extraction_logs**
Detailed logging system
- Multiple log levels
- JSONB details for structured data

## Key Features

### Version Control
- Every extraction creates a new menu version
- Easy comparison between versions
- Price change tracking

### Multi-Platform Support
- Extract from multiple platforms
- Merge data from different sources
- Platform-specific ID tracking

### Scalability
- UUID primary keys for distributed systems
- Efficient indexes on foreign keys
- JSONB fields for flexible data

### Data Integrity
- Foreign key constraints
- Unique constraints where needed
- Cascade deletes for cleanup

## Helper Functions

### `upsert_restaurant_from_extraction()`
Creates or updates restaurant from extraction data

### `get_latest_menu()`
Returns the most recent active menu for a restaurant

### `compare_menu_versions()`
Compares two menu versions to show changes

## Views

### `v_active_menu_items`
Complete view of all active menu items with joins

### `v_extraction_job_status`
Job monitoring with duration calculations

## Usage Workflow

1. **Start Extraction**
   - Create extraction_job record
   - Get or create restaurant
   - Link restaurant to platform

2. **During Extraction**
   - Update job progress
   - Log extraction details
   - Store intermediate results

3. **Complete Extraction**
   - Create new menu version
   - Insert categories
   - Insert menu items with images
   - Insert option sets
   - Track price changes
   - Mark job as completed

4. **Query Data**
   - Use views for easy access
   - Compare versions for changes
   - Export to CSV as needed

## Security
- Row Level Security enabled on all tables
- Policies need configuration based on auth strategy
- Currently set to permissive for development

## Next Steps
1. Implement authentication strategy
2. Update RLS policies for production
3. Add API endpoints for database operations
4. Implement caching strategy
5. Set up backup and recovery