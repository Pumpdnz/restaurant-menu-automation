# Variable System Enhancements

## Overview

This project enhances the existing variable replacement system used in message templates, task templates, and sequence workflows. The enhancements focus on improving user experience, discoverability, and adding dynamic computed variables for better message personalization.

**Current Status:** 🟡 Planning Phase - Ready for Implementation

**Last Updated:** 2025-01-26

## Problem Statement

The existing variable replacement system has a solid technical foundation with 63 available variables, but suffers from:

1. **Poor Discoverability**: Only 6-13 variables shown in UI (out of 63 available)
2. **Manual Entry**: Users must type `{variable_name}` with exact spelling
3. **No Validation**: Unknown variables fail silently
4. **Missing Dynamic Variables**: No support for computed variables like example restaurants
5. **SequenceStepBuilder Gap**: Most critical component shows zero variable reference

## Documentation Structure

```
variable-enhancements/
├── README.md (this file)
├── architecture.md - System architecture and data flow
├── database-schema.md - New tables for dynamic variables
├── service-layer.md - Service updates and new functions
├── ui-components.md - Component specifications
└── implementation-roadmap.md - Phase-by-phase implementation plan
```

### Reference Documentation

- **Investigation Report**: `../investigation-findings/variable-replacement-investigation.md`
- **Existing Services**:
  - `src/services/variable-replacement-service.js`
  - `src/services/tasks-service.js`
  - `src/services/sequence-instances-service.js`

## Architecture Overview

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
├─────────────────────────────────────────────────────────────┤
│  CreateMessageTemplateModal                                  │
│  CreateTaskTemplateModal         ← Static variable lists    │
│  CreateTaskModal                                             │
│  SequenceStepBuilder (NO variables shown)                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Variable Replacement Service                    │
├─────────────────────────────────────────────────────────────┤
│  • extractVariables(messageContent)                          │
│  • replaceVariables(messageContent, restaurant)              │
│  • getVariableValue(variableName, restaurant)                │
│  • getAvailableVariables()                                   │
│  • validateVariables(messageContent)                         │
│  • VARIABLE_MAPPINGS (63 variables)                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   Database Layer                             │
├─────────────────────────────────────────────────────────────┤
│  restaurants (source data)                                   │
│  tasks (message + message_rendered)                          │
│  sequence_instances                                          │
└─────────────────────────────────────────────────────────────┘
```

### Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │         VariableSelector Component (NEW)            │    │
│  │  • Clickable variable badges                        │    │
│  │  • Insert at cursor position                        │    │
│  │  • Real-time validation                             │    │
│  │  • Category filtering                               │    │
│  │  • Search functionality                             │    │
│  └─────────────────────────────────────────────────────┘    │
│           ▲          ▲          ▲          ▲                 │
│           │          │          │          │                 │
│  CreateMessageTemplateModal                                  │
│  CreateTaskTemplateModal                                     │
│  CreateTaskModal                                             │
│  SequenceStepBuilder                                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│         Enhanced Variable Replacement Service                │
├─────────────────────────────────────────────────────────────┤
│  Existing Functions:                                         │
│  • extractVariables(messageContent)                          │
│  • replaceVariables(messageContent, restaurant)              │
│  • getVariableValue(variableName, restaurant)                │
│  • getAvailableVariables()                                   │
│  • validateVariables(messageContent)                         │
│                                                               │
│  NEW Functions:                                              │
│  • getExampleRestaurants(city) → [examples]                  │
│  • formatVariableAsLink(value, url, format) → HTML/text     │
│  • validateVariablesRealtime(text) → validationResult       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   Database Layer                             │
├─────────────────────────────────────────────────────────────┤
│  restaurants (source data)                                   │
│  tasks (message + message_rendered)                          │
│  sequence_instances                                          │
│  city_example_customers (NEW) ← Dynamic variable source     │
└─────────────────────────────────────────────────────────────┘
```

## Core Principles

### 1. Centralized Variable Management
- Single source of truth: `variable-replacement-service.js`
- All variables defined in `VARIABLE_MAPPINGS`
- UI components use `getAvailableVariables()` - NO hardcoding

### 2. Progressive Enhancement
- Phase 1: Standardize existing functionality
- Phase 2-3: Improve UX with click-to-insert and validation
- Phase 4-5: Add advanced features (dynamic variables, search)

### 3. Backward Compatibility
- Existing templates continue working unchanged
- `message` field stores original template
- `message_rendered` field stores computed output
- No breaking changes to variable syntax

### 4. Async-First Design
- All variable resolution is async (`replaceVariables` returns Promise)
- Supports future dynamic variables requiring database queries
- Handles loading states gracefully

## Existing UI Patterns

### Variable Display Pattern (Current)

```tsx
// Static list - BAD (what we're replacing)
const availableVariables = [
  { name: 'restaurant_name', description: 'Restaurant name' },
  { name: 'contact_name', description: 'Contact person name' },
  // ... hardcoded list
];

<div className="grid grid-cols-2 gap-2 text-xs">
  {availableVariables.map((variable) => (
    <div key={variable.name}>
      <Badge variant="outline">
        {'{' + variable.name + '}'}
      </Badge>
      <span>{variable.description}</span>
    </div>
  ))}
</div>
```

### Variable Display Pattern (Target)

```tsx
// Dynamic from service - GOOD (what we're building)
import { VariableSelector } from '../ui/variable-selector';

<VariableSelector
  onVariableSelect={handleVariableInsert}
  textareaRef={messageTextareaRef}
  selectedType={formData.type} // Filter by message type
  showValidation={true}
  currentMessage={formData.message}
/>
```

## Implementation Location

### New Files to Create

```
src/components/ui/
├── variable-selector.tsx (NEW) - Main component
├── variable-badge.tsx (NEW) - Clickable variable badge
└── variable-search.tsx (NEW) - Search/filter interface

src/hooks/
└── useVariableInsertion.ts (NEW) - Hook for cursor insertion logic

supabase/migrations/
└── YYYYMMDDHHMMSS_create_city_example_customers.sql (NEW)
```

### Files to Modify

```
src/services/
└── variable-replacement-service.js (UPDATE)
    - Add getExampleRestaurants()
    - Add formatVariableAsLink()
    - Add new dynamic variables to VARIABLE_MAPPINGS

src/components/message-templates/
└── CreateMessageTemplateModal.tsx (UPDATE)
    - Replace hardcoded list with VariableSelector
    - Add click-to-insert functionality

src/components/task-templates/
└── CreateTaskTemplateModal.tsx (UPDATE)
    - Replace hardcoded list with VariableSelector

src/components/tasks/
└── CreateTaskModal.tsx (UPDATE)
    - Replace hardcoded list with VariableSelector

src/components/sequences/
└── SequenceStepBuilder.tsx (UPDATE)
    - ADD VariableSelector (currently shows nothing)
```

## Quick Start Guide

### For Developers

1. **Read Investigation Report First**
   ```bash
   open planning/database-plans/sales-specific-features/investigation-findings/variable-replacement-investigation.md
   ```

2. **Review Current Implementation**
   - Study `src/services/variable-replacement-service.js`
   - Understand `VARIABLE_MAPPINGS` structure
   - See how `replaceVariables()` works

3. **Follow Implementation Roadmap**
   - Start with Phase 1 (Standardize)
   - Complete each phase before moving to next
   - Test thoroughly between phases

4. **Use Architecture Documentation**
   - `architecture.md` for system design
   - `service-layer.md` for service updates
   - `ui-components.md` for component specs

### For Stakeholders

**Current State:**
- 63 variables available but poorly exposed
- Manual variable entry prone to errors
- No dynamic personalization

**After Phase 1-2:**
- All 63 variables visible in UI
- Click-to-insert functionality
- Reduced template creation time by ~50%

**After Phase 3-4:**
- Real-time validation
- Dynamic example restaurant variables
- Personalized messages with local references

**After Phase 5:**
- Advanced search and filtering
- Frequently used variables
- Optimal user experience

## Related Documentation

### Investigation & Analysis
- `../investigation-findings/variable-replacement-investigation.md` - Complete analysis

### Implementation Plans
- `implementation-roadmap.md` - Phase-by-phase plan
- `architecture.md` - System architecture
- `database-schema.md` - Database changes
- `service-layer.md` - Service layer updates
- `ui-components.md` - Component specifications

### Existing Codebase
- `src/services/variable-replacement-service.js` - Core service
- `src/lib/qualification-constants.ts` - Variable definitions
- `src/components/message-templates/` - Message template UI
- `src/components/sequences/` - Sequence builder UI

## Status

### ✅ Completed
- Investigation and analysis
- Gap identification
- Architecture design
- Implementation planning

### 🟡 In Progress
- Creating detailed specifications
- Database schema design
- Component wireframes

### ⏳ Not Started
- Phase 1: Standardize variable display
- Phase 2: Click-to-insert functionality
- Phase 3: Real-time validation
- Phase 4: Dynamic variables
- Phase 5: Enhanced picker UI

## Next Steps

### Immediate (Week 1)
1. Review and approve documentation
2. Set up development branch
3. Begin Phase 1 implementation

### Short Term (Weeks 2-4)
1. Complete Phase 1 (Standardize)
2. Complete Phase 2 (Click-to-insert)
3. User testing and feedback

### Medium Term (Weeks 5-8)
1. Complete Phase 3 (Validation)
2. Begin Phase 4 (Dynamic variables)
3. Database migration for example customers

### Long Term (Weeks 9-12)
1. Complete Phase 4
2. Complete Phase 5 (Advanced features)
3. Full user acceptance testing
4. Production deployment

## Success Metrics

### User Experience
- ⏱️ Template creation time: -50% (from 5 min to 2.5 min)
- 📈 Variable usage rate: +100% (from 30% to 60%)
- ❌ Variable errors: -90% (from 10% to 1%)
- ⭐ User satisfaction: 4.5/5

### Technical
- ✅ All 63 variables accessible in all components
- ✅ Zero hardcoded variable lists
- ✅ Real-time validation in all forms
- ✅ Click-to-insert working in all textareas

### Business
- 📊 Example restaurant usage: 50%+ of messages
- 💬 Message personalization: Measurable increase
- ⚡ Time to demo booking: Reduced

## Support & Questions

For questions or clarifications:
1. Review investigation report first
2. Check architecture documentation
3. Consult implementation roadmap
4. Review service layer specifications

---

**Project:** Pumpd Restaurant Automation System
**Module:** Sales-Specific Features
**Feature:** Variable System Enhancements
**Version:** 1.0
**Last Updated:** 2025-01-26
