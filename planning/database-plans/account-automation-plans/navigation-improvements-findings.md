# Navigation Improvements - Investigation Findings

## Investigation Complete - Ready for Implementation

### 1. Menus Page (Menus.jsx)

**Current State:**
- Restaurant names displayed at line 384 but NOT clickable
- Both View (line 445) and Edit (line 454) buttons route to same MenuDetail page (`/menus/${menuId}`)
- Data available: `menu.restaurants` object with id, name, address

**Implementation Plan:**
```jsx
// Line 383-391: Make restaurant name clickable
<div 
  className="font-medium cursor-pointer hover:text-brand-blue"
  onClick={() => navigate(`/restaurants/${menu.restaurants?.id}`)}
>
  {menu.restaurants?.name || 'Unknown Restaurant'}
</div>

// Line 445: Change View button to show all menus for restaurant
onClick={() => navigate(`/menus?restaurant=${menu.restaurants?.id}`)}
```

---

### 2. MenuDetail Page (MenuDetail.jsx)

**Current State:**
- Restaurant info available at line 761: `menu.restaurants?.name`
- Menu object includes restaurant data with ID
- No navigation buttons to parent restaurant or other menus

**Implementation Plan:**
Add buttons in the Card component (after line 767):
```jsx
<div className="flex gap-2">
  <Button
    variant="outline"
    onClick={() => navigate(`/restaurants/${menu.restaurants?.id}`)}
    className="flex items-center gap-2"
  >
    <BuildingStorefrontIcon className="h-4 w-4" />
    Manage Restaurant
  </Button>
  <Button
    variant="outline"
    onClick={() => navigate(`/menus?restaurant=${menu.restaurants?.id}`)}
    className="flex items-center gap-2"
  >
    <FileText className="h-4 w-4" />
    View All Menus
  </Button>
</div>
```

---

### 3. Extractions Page (Extractions.jsx)

**Current State:**
- Restaurant name displayed at line 318 but NOT clickable
- View button (line 340) routes to ExtractionDetail page
- Data available: `extraction.restaurants` object with id and name
- Also has `extraction.menu_id` for database-driven extractions

**Implementation Plan:**
```jsx
// Line 317-319: Make restaurant name clickable
<TableCell 
  className="text-muted-foreground cursor-pointer hover:text-brand-blue"
  onClick={() => navigate(`/restaurants/${extraction.restaurants?.id}`)}
>
  {extraction.restaurants?.name || 'Unknown'}
</TableCell>

// Line 340: Change View button to route to MenuDetail
onClick={() => {
  if (extraction.menu_id) {
    navigate(`/menus/${extraction.menu_id}`);
  } else {
    handleViewResults(extraction.job_id); // Fallback for legacy
  }
}}
```

---

### 4. RestaurantDetail Page - Workflow Tab

**Current State:**
- Displays recent menus (lines 3144-3163) but they're NOT clickable
- Only shows basic info: version, platform, active status, date
- Has "View All Menus" button (line 3167) that works correctly

**Implementation Plan:**
```jsx
// Lines 3146-3163: Add action buttons for each menu
{restaurant.menus.slice(0, 5).map((menu) => (
  <div key={menu.id} className="flex items-center justify-between p-3 border rounded">
    <div className="flex-1">
      <span className="text-sm font-medium">Version {menu.version}</span>
      <span className="text-xs text-muted-foreground ml-2">
        {menu.platforms?.name || 'Unknown'}
      </span>
      {menu.is_active && (
        <Badge className="ml-2 bg-green-100 text-green-800">Active</Badge>
      )}
    </div>
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => navigate(`/menus/${menu.id}`)}
      >
        <Eye className="h-4 w-4 mr-1" />
        View Menu
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleUploadImagesToCDN(menu.id)}
      >
        <Upload className="h-4 w-4 mr-1" />
        Upload Images
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleDownloadCSVWithCDN(menu.id)}
      >
        <Download className="h-4 w-4 mr-1" />
        Download CSV
      </Button>
      <span className="text-xs text-muted-foreground ml-2">
        {new Date(menu.created_at).toLocaleDateString()}
      </span>
    </div>
  </div>
))}
```

**Required Helper Functions:**
```javascript
// Add these functions to RestaurantDetail.jsx
const handleUploadImagesToCDN = async (menuId) => {
  try {
    toast({ title: "Uploading images to CDN...", description: "This may take a moment" });
    const response = await api.post(`/menus/${menuId}/upload-images`);
    if (response.data.success) {
      toast({ 
        title: "Success", 
        description: `Uploaded ${response.data.uploadedCount || response.data.stats?.uploadedCount} images to CDN` 
      });
    }
  } catch (error) {
    toast({ 
      title: "Upload failed", 
      description: error.response?.data?.error || "Failed to upload images",
      variant: "destructive"
    });
  }
};

const handleDownloadCSVWithCDN = async (menuId) => {
  try {
    const response = await api.get(`/menus/${menuId}/csv-with-cdn`, {
      params: { download: 'true' },
      responseType: 'text'
    });
    
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `menu_${menuId}_cdn_export.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    toast({ 
      title: "CSV exported", 
      description: "Downloaded menu with CDN image URLs" 
    });
  } catch (error) {
    toast({ 
      title: "Export failed", 
      description: error.response?.data?.error || "Failed to export CSV",
      variant: "destructive"
    });
  }
};
```

---

## Data Flow Summary

### Available Data in Each Component:
1. **Menus.jsx**: `menu.restaurants` object with id, name, address
2. **MenuDetail.jsx**: `menu.restaurants` object with full restaurant data
3. **Extractions.jsx**: `extraction.restaurants` object with id and name, plus `extraction.menu_id`
4. **RestaurantDetail.jsx**: Full restaurant object with `restaurant.menus` array

### Routing Patterns:
- Restaurant detail: `/restaurants/${restaurantId}`
- Menu detail: `/menus/${menuId}`
- Filtered menus: `/menus?restaurant=${restaurantId}`
- All use React Router's `useNavigate()` hook

### Required Imports:
```javascript
// Common imports needed
import { useNavigate } from 'react-router-dom';
import { Eye, Upload, Download, FileText, Building2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from '../hooks/use-toast';
import api from '../services/api';
```

---

## Implementation Priority & Effort Estimate

### Phase 1 (Quick Wins - 1 hour):
1. Make restaurant names clickable in Menus.jsx
2. Make restaurant names clickable in Extractions.jsx
3. Fix View button in Menus.jsx to show all menus

### Phase 2 (Medium - 2 hours):
1. Add navigation buttons to MenuDetail.jsx
2. Change Extractions View button to route to MenuDetail

### Phase 3 (Complex - 3 hours):
1. Enhance RestaurantDetail Workflow tab with action buttons
2. Implement upload/download handlers
3. Test all navigation paths

**Total Estimated Time: 6 hours**

---

## Testing Checklist

- [ ] Restaurant name clicks work from Menus page
- [ ] Restaurant name clicks work from Extractions page
- [ ] View button in Menus shows filtered menu list
- [ ] MenuDetail has working navigation buttons
- [ ] Extractions View button routes to MenuDetail
- [ ] RestaurantDetail menus have all 3 action buttons
- [ ] Upload images to CDN works from RestaurantDetail
- [ ] Download CSV with CDN works from RestaurantDetail
- [ ] All navigation maintains proper state
- [ ] Back button behavior is intuitive

## Notes
- All components already have necessary data - no API changes needed
- Use existing UI components (Button, Badge, etc.) for consistency
- Maintain existing styling patterns (brand colors, hover states)
- Consider adding loading states for async operations