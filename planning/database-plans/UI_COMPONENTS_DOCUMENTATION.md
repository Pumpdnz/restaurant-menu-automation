# UI Components Documentation - UberEats Image Extractor

## Overview
This document provides a comprehensive description of all UI components and styles in the UberEats Image Extractor application. The application has undergone a significant migration from a single-page vanilla JavaScript application to a modern React-based multi-page dashboard with database integration.

## Current Architecture (Post-Database Migration)

### Technology Stack
- **Frontend Framework**: React 18.2.0 with React Router v6
- **State Management**: 
  - Zustand for client state
  - Tanstack Query (React Query) for server state
- **Styling**: Tailwind CSS 3.4.17
- **Icons**: @heroicons/react 2.2.0
- **Build Tool**: Webpack 5.101.3
- **Development Server**: webpack-dev-server on port 5007
- **API Proxy**: Configured to forward /api calls to backend on port 3007

### Entry Points

#### `/src/index.js`
- Main entry point for the React application
- Renders the App component into the DOM
- Imports global styles from index.css

#### `/src/App.jsx`
- Root component with routing configuration
- Wraps entire app in QueryClientProvider for data fetching
- Defines all routes using React Router v6
- Routes include:
  - `/` - Dashboard (default)
  - `/restaurants` - Restaurant list
  - `/restaurants/:id` - Restaurant detail
  - `/extractions` - Extraction jobs list
  - `/extractions/new` - New extraction form
  - `/extractions/:jobId` - Extraction detail view
  - `/menus` - Menu management
  - `/menus/:id` - Menu detail
  - `/analytics` - Analytics dashboard
  - `/history` - Historical data
  - `/settings` - Application settings

### Active UI Components

#### Layout Components (`/src/components/layout/`)

##### `Layout.jsx`
- Main layout wrapper component
- Contains the sidebar navigation and main content area
- Manages responsive behavior for mobile/desktop
- Uses Outlet from React Router for nested routing
- Includes hamburger menu for mobile navigation

##### `Sidebar.jsx`
- Fixed sidebar navigation component
- Contains logo/brand section "PumpdMenu Manager"
- Search bar for restaurants/menus
- Navigation menu items with icons:
  - Dashboard
  - Restaurants  
  - Extractions
  - Menus
  - Analytics
  - History
  - Settings
- User section at bottom
- Responsive: hidden on mobile, toggleable via hamburger
- Uses Tailwind classes for styling and transitions

##### `Header.jsx`
- Top header bar component
- Contains page title and breadcrumbs
- Action buttons for page-specific actions
- User menu dropdown
- Notification bell icon

### Page Components (`/src/pages/`)

##### `Dashboard.jsx`
- Main dashboard overview page
- Displays key metrics in stat cards:
  - Total Restaurants
  - Active Menus
  - Recent Extractions
  - Total Menu Items
- Recent activity feed
- Quick action buttons
- Chart widgets for data visualization
- Uses grid layout for responsive design

##### `Restaurants.jsx`
- Restaurant listing page
- Table view with columns:
  - Name
  - Platform
  - Status
  - Last Updated
  - Actions
- Search and filter functionality
- Add new restaurant button
- Pagination controls

##### `RestaurantDetail.jsx`
- Individual restaurant detail view
- Restaurant information card
- Associated menus list
- Extraction history
- Edit restaurant details form
- Delete restaurant option

##### `Extractions.jsx` (Active - Recently Updated)
- Lists all extraction jobs in a table format
- Columns:
  - Job ID (truncated)
  - Restaurant name
  - Status with color-coded icons
  - Item count
  - Started timestamp
  - Action buttons
- Features:
  - Auto-refresh every 5 seconds for live updates
  - Status indicators (completed/failed/running/pending)
  - Action buttons for completed extractions:
    - View details (eye icon)
    - Download CSV (document icon)
    - Retry failed extractions (refresh icon)
  - "New Extraction" button to create new jobs
- Uses Heroicons for all icons
- Responsive table with horizontal scroll on mobile

##### `ExtractionDetail.jsx` (Active - Recently Created)
- Detailed view for individual extraction job
- Three main sections:
  1. **Job Information Card**:
     - Job ID
     - Status badge
     - Total items count
     - Platform info
     - Creation timestamp
     - Download buttons (CSV & Images)
  2. **Category Sidebar**:
     - List of all menu categories
     - Item count per category
     - Click to navigate between categories
  3. **Menu Items Display**:
     - Item images (with fallback handling)
     - Item names and prices
     - Descriptions
     - Tags/badges
     - Grid layout for items
- Back navigation to extractions list
- Fully responsive design

##### `NewExtraction.jsx` (Active)
- Form for creating new extraction jobs
- Fields:
  - Restaurant URL (required)
  - Restaurant name (auto-detected from URL)
  - Platform auto-detection (UberEats/DoorDash)
- Advanced options section:
  - Include images checkbox
  - Generate CSV checkbox
- Start extraction button
- URL validation
- Loading states during submission

##### `Menus.jsx`
- Menu management interface
- List view of all menus
- Version control display
- Active/inactive status
- Compare menus functionality
- Export options

##### `MenuDetail.jsx`
- Individual menu detail view
- Category breakdown
- Item management
- Price editing
- Bulk operations
- Version history

##### `Analytics.jsx`
- Analytics dashboard
- Extraction success rates
- Processing time metrics
- Popular restaurants
- Error analysis
- Trend charts

##### `History.jsx`
- Historical data view
- Extraction timeline
- Change logs
- Audit trail
- Data export options

##### `Settings.jsx`
- Application settings page
- API configuration
- User preferences
- System settings
- Integration options

### Service Layer (`/src/services/`)

##### `api.js`
- Axios-based API client
- Base URL configuration
- Request/response interceptors
- Error handling
- Token management
- Exports default axios instance

##### `database-service.js`
- Supabase client integration
- Database operations abstraction
- CRUD operations for:
  - Restaurants
  - Extraction jobs
  - Menus
  - Categories
  - Menu items
- Real-time subscriptions
- Error handling and retry logic

### Store Management (`/src/stores/`)

##### `extractionStore.js`
- Zustand store for extraction state
- Manages current extraction progress
- Stores extraction results
- Handles extraction queue

##### `restaurantStore.js`
- Zustand store for restaurant data
- Caches restaurant list
- Manages selected restaurant
- Handles restaurant CRUD operations

##### `uiStore.js`
- Zustand store for UI state
- Sidebar open/closed state
- Modal visibility
- Loading states
- Error messages
- Success notifications

### Styling

##### `/src/index.css`
- Global styles and Tailwind imports
- Custom CSS variables
- Base typography styles
- Utility classes
- Animation keyframes

##### `/src/styles/index.css`
- Additional component styles
- Custom Tailwind configurations
- Responsive breakpoints
- Color palette definitions

## Legacy Components (Pre-Migration - Still Present but Unused)

### Original Single-Page Application (`/dist/`)

The original application was a single-page vanilla JavaScript application that operated without a database. These files are still present but no longer actively used:

##### `/dist/index.html`
- Original HTML template
- Inline styles and scripts
- Single-page layout with:
  - URL input form
  - Category selection
  - Progress indicators
  - Results display area
- No routing or navigation

##### `/dist/bundle.js`
- Webpack-bundled JavaScript
- Contains all original logic:
  - Direct Firecrawl API integration
  - In-memory data storage
  - CSV generation
  - Image downloading
- Event handlers for UI interactions
- No component structure

### Original Source Files (Legacy)

##### `/src/index.js` (Original version)
- Simple DOM manipulation
- Direct API calls
- Event listener setup
- No React components

##### `/src/App.js` (Original version)
- Main application logic
- Extraction workflow
- Progress tracking
- Results formatting

## Migration Context

### What Changed
1. **Architecture**: Moved from single-page vanilla JS to React-based multi-page application
2. **Data Persistence**: Added Supabase database integration instead of in-memory storage
3. **Navigation**: Implemented React Router for multiple pages/views
4. **State Management**: Added Zustand and React Query for proper state management
5. **Component Structure**: Broke down monolithic code into reusable React components
6. **Styling**: Migrated from inline styles to Tailwind CSS utility classes
7. **API Structure**: Separated frontend and backend with proper API endpoints

### Why Legacy Components Remain
- Backward compatibility during transition
- Reference for feature parity checks
- Fallback option if database is unavailable
- Historical context for development

### New Features Added
- Multi-restaurant support
- User authentication (prepared but not implemented)
- Extraction job tracking
- Menu versioning
- Analytics and reporting
- Bulk operations
- Real-time updates via polling

## Component Interaction Flow

### Data Flow
1. **User Action** → Page Component → API Service → Backend Server → Database
2. **Database Update** → Backend Response → API Service → Zustand/Query Update → UI Re-render

### Navigation Flow
1. **Sidebar** → React Router → Page Component Load
2. **Page Actions** → Navigate programmatically or via Link components
3. **Back Navigation** → Browser history or explicit navigation

### State Management Flow
1. **Server State**: React Query handles caching, refetching, and synchronization
2. **UI State**: Zustand stores manage local UI state
3. **Form State**: Controlled components with local React state

## Responsive Design Patterns

### Breakpoints
- Mobile: < 640px (sm)
- Tablet: 640px - 1024px (md)
- Desktop: > 1024px (lg)

### Mobile Adaptations
- Sidebar becomes drawer with overlay
- Tables become cards or horizontal scroll
- Stacked layouts for forms
- Bottom navigation for key actions

### Desktop Optimizations
- Fixed sidebar always visible
- Multi-column layouts
- Hover states and tooltips
- Keyboard shortcuts enabled

## Performance Considerations

### Code Splitting
- Routes are not currently code-split but could be
- Large components could be lazy-loaded

### Caching Strategy
- React Query caches API responses
- 5-minute stale time for most data
- 10-minute cache time
- Manual invalidation on mutations

### Optimization Opportunities
- Virtualization for long lists
- Image lazy loading
- Memoization of expensive computations
- Debounced search inputs

## Future Enhancements Prepared

### Authentication
- Components ready for user context
- Protected route wrapper prepared
- Login/signup pages scaffolded

### Real-time Updates
- WebSocket connection points identified
- Subscription handlers in place
- Live update UI patterns established

### Internationalization
- String extraction points identified
- Locale switching UI prepared
- RTL support considerations

## Testing Considerations

### Component Testing
- Each component is isolated and testable
- Props are well-defined
- Side effects are contained

### Integration Points
- API mocking strategy defined
- Database service can be stubbed
- Store actions are testable

## Accessibility Features

### Current Implementation
- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus management in modals

### Areas for Improvement
- Screen reader announcements
- High contrast mode
- Reduced motion support
- Skip navigation links

## Bundle Structure

### Dependencies Included
- React ecosystem (react, react-dom, react-router)
- State management (zustand, @tanstack/react-query)
- UI utilities (clsx, @heroicons/react)
- API client (axios)
- Database client (@supabase/supabase-js)
- Styling (tailwindcss)

### Build Output
- Single bundle.js file (currently ~2.15MB)
- Index.html with root mount point
- CSS extracted and injected
- Source maps for development

## Configuration Files

### `tailwind.config.js`
- Custom color palette
- Extended animations
- Plugin configurations
- Purge settings for production

### `webpack.config.js`
- Entry points
- Module rules for JSX, CSS
- Dev server configuration
- Proxy settings for API

### `postcss.config.js`
- Tailwind CSS processing
- Autoprefixer settings
- Production optimizations

## Development Workflow

### Hot Module Replacement
- Enabled for development
- Preserves component state
- Fast refresh for React components

### Development Tools
- React DevTools compatible
- Redux DevTools for Zustand
- Network tab for API debugging

## Deployment Considerations

### Environment Variables
- API URLs
- Feature flags
- Third-party service keys

### Build Process
- Production webpack build
- CSS purging
- JavaScript minification
- Asset optimization

---

This documentation represents the complete UI component structure as of the database migration completion. The application has evolved from a simple single-page tool to a comprehensive multi-tenant restaurant menu management system while maintaining the original extraction capabilities.