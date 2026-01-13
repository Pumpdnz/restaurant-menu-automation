# Investigation Task 1: Dialog UI Patterns

## Overview
Analysis of existing Dialog patterns in RestaurantDetail.jsx to understand how to build the Yolo Mode confirmation dialog.

---

## Current Dialogs Found in RestaurantDetail.jsx

### 1. Logo Selection Dialog (max-w-4xl)
- Complex with RadioGroup + Checkbox
- Multiple image candidates display
- Selection state management

### 2. Logo Processing Dialog (600px)
- Conditional renders based on processMode
- Multiple form fields

### 3. Extraction Dialog (700px)
- Multi-option with RadioGroup
- Extraction mode selection

### 4. Details Extraction Dialog (500px)
- Simple dialog with field selection

### 5. Registration Type Dialog (max-w-md)
- Step-based with RadioGroup
- Email/password inputs
- Lines 8800-9000

### 6. Registration Logs Dialog (max-w-4xl)
- Scrollable log display

---

## Largest/Most Complex Reference: CompaniesOfficeDialog.jsx

**File**: `/src/components/dialogs/CompaniesOfficeDialog.jsx` (1254 lines)

### Key Patterns:
- **Multi-step wizard pattern** (4 steps)
- **Step-based state management**
- **Editable search fields**
- **ScrollArea for scrollable content**
- **Expandable sections**
- **Checkbox selection patterns**
- **Card-based layouts**
- **Result display patterns**

---

## Standard Dialog Structure Pattern

```jsx
<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogContent className="w-[95vw] max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Description text</DialogDescription>
    </DialogHeader>

    {/* Scrollable content area */}
    <div className="flex-1 overflow-y-auto px-1">
      {/* Main content */}
    </div>

    <DialogFooter className="flex justify-between">
      <Button variant="outline" onClick={() => setDialogOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSubmit}>
        Confirm
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Component Imports Needed

```jsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Checkbox } from '../components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
```

---

## Form Patterns Within Dialogs

### Editable Field Pattern
```jsx
<div className="space-y-2">
  <Label htmlFor="field-name">Field Label</Label>
  <Input
    id="field-name"
    value={formData.fieldName}
    onChange={(e) => setFormData(prev => ({ ...prev, fieldName: e.target.value }))}
    placeholder="Placeholder text"
  />
</div>
```

### Checkbox Pattern
```jsx
<div className="flex items-center space-x-2">
  <Checkbox
    id="checkbox-id"
    checked={formData.checkboxField}
    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, checkboxField: checked }))}
  />
  <Label htmlFor="checkbox-id">Checkbox label</Label>
</div>
```

### RadioGroup Pattern
```jsx
<RadioGroup value={formData.radioField} onValueChange={(value) => setFormData(prev => ({ ...prev, radioField: value }))}>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option1" id="option1" />
    <Label htmlFor="option1">Option 1</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option2" id="option2" />
    <Label htmlFor="option2">Option 2</Label>
  </div>
</RadioGroup>
```

### Select Dropdown Pattern
```jsx
<Select value={formData.selectField} onValueChange={(value) => setFormData(prev => ({ ...prev, selectField: value }))}>
  <SelectTrigger>
    <SelectValue placeholder="Select option..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

---

## Recommended Structure for Yolo Mode Dialog

### Option A: Tabbed Sections (Recommended)

```jsx
<Dialog open={yoloModeOpen} onOpenChange={setYoloModeOpen}>
  <DialogContent className="w-[95vw] max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
    <DialogHeader>
      <DialogTitle>Complete Restaurant Setup</DialogTitle>
      <DialogDescription>
        Review and confirm all settings before executing the full setup
      </DialogDescription>
    </DialogHeader>

    <Tabs defaultValue="account" className="flex-1 overflow-hidden flex flex-col">
      <TabsList className="grid grid-cols-6 w-full">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="restaurant">Restaurant</TabsTrigger>
        <TabsTrigger value="menu">Menu</TabsTrigger>
        <TabsTrigger value="website">Website</TabsTrigger>
        <TabsTrigger value="payment">Payment</TabsTrigger>
        <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-y-auto mt-4">
        <TabsContent value="account">
          {/* Account fields */}
        </TabsContent>
        <TabsContent value="restaurant">
          {/* Restaurant fields */}
        </TabsContent>
        {/* ... more tabs */}
      </div>
    </Tabs>

    <DialogFooter className="border-t pt-4">
      <Button variant="outline" onClick={() => setYoloModeOpen(false)}>
        Cancel
      </Button>
      <Button variant="secondary" onClick={handleSaveChanges}>
        Save Changes
      </Button>
      <Button onClick={handleExecuteYoloMode}>
        Execute Full Setup
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Option B: Collapsible Sections

```jsx
<div className="space-y-4">
  <Collapsible defaultOpen>
    <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted rounded-lg">
      <span className="font-medium">Account Details</span>
      <ChevronDown className="h-4 w-4" />
    </CollapsibleTrigger>
    <CollapsibleContent className="p-4 space-y-4">
      {/* Account fields */}
    </CollapsibleContent>
  </Collapsible>

  {/* More collapsible sections */}
</div>
```

---

## Section Card Pattern (for each section)

```jsx
<Card>
  <CardHeader className="pb-3">
    <div className="flex items-center justify-between">
      <CardTitle className="text-lg">Section Title</CardTitle>
      <Badge variant={isComplete ? "default" : "outline"}>
        {isComplete ? "Complete" : "Incomplete"}
      </Badge>
    </div>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Section form fields */}
  </CardContent>
</Card>
```

---

## Summary

| Pattern | Best For | Example Dialog |
|---------|----------|----------------|
| Tabbed | Many sections, equal importance | Yolo Mode (recommended) |
| Collapsible | Sequential sections, some optional | Configuration wizards |
| Multi-step | Linear flow with validation | Registration Type Dialog |
| Scrollable Cards | Review/display many items | Logo Selection Dialog |

**Recommendation**: Use **Tabbed Sections** for Yolo Mode as it allows users to easily navigate between different configuration areas while keeping all options visible and accessible.
