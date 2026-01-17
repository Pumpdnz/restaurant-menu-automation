# Demo Booking Feature - Documentation Hub

**Last Updated:** 2025-01-19
**Status:** Planning Phase - Ready for Implementation
**Version:** 1.0

---

## Overview

The Demo Booking Feature enhances the sales task management system to better support the demo booking qualification process. When a sales rep books a demo with a prospect, they can now capture detailed qualification information that helps with follow-ups, deal progression, and smooth handover to Customer Success.

### Key Capabilities
- New "Demo Meeting" task type with 18 qualification fields
- Bi-directional sync: task updates restaurant record on create AND edit
- Flexible data capture: no required fields beyond task basics
- Pre-configured options with custom value support
- Integrated contact information display with meeting links

---

## Documentation Structure

This folder contains complete planning documentation for implementing the demo booking feature:

### Core Documentation
- **[README.md](README.md)** (this file) - Documentation hub and quick start guide
- **[REQUIREMENTS-DOCUMENT.md](REQUIREMENTS-DOCUMENT.md)** - Comprehensive requirements analysis
- **[architecture.md](architecture.md)** - System architecture and design patterns
- **[implementation-roadmap.md](implementation-roadmap.md)** - Phase-by-phase implementation plan

### Technical Specifications
- **[database-schema.md](database-schema.md)** - Database schema changes and migrations
- **[api-specification.md](api-specification.md)** - Backend API endpoints and contracts
- **[service-layer.md](service-layer.md)** - Business logic and service implementations
- **[ui-components.md](ui-components.md)** - Frontend component specifications

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  CreateTaskModal  │  EditTaskModal  │  TaskTypeQuickView        │
│  (Form + Logic)   │  (Form + Logic) │  (Display Logic)          │
└────────┬──────────┴────────┬─────────┴──────────┬───────────────┘
         │                   │                     │
         ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API Routes Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/tasks      │  PATCH /api/tasks/:id                   │
│  (Create Task)        │  (Update Task)                          │
└────────┬──────────────┴────────┬────────────────────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                              │
├─────────────────────────────────────────────────────────────────┤
│  tasks-service.js                                               │
│  - createTask() → Updates restaurant + creates task             │
│  - updateTask() → Updates restaurant + updates task             │
│  - Handles qualification data sync                              │
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database Layer (Supabase)                    │
├─────────────────────────────────────────────────────────────────┤
│  restaurants table    │  tasks table                            │
│  + 18 new columns     │  + demo_meeting type                    │
│  (qualification data) │  (metadata stores qualification)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. Bi-Directional Sync
- **Create**: Task creation updates restaurant record with all qualification data
- **Edit**: Task editing updates restaurant record with only changed fields
- **Rationale**: Keep restaurant record as source of truth while maintaining edit history in task metadata

### 2. No Required Fields
- **Decision**: No qualification fields are mandatory (not even meeting_link)
- **Rationale**: Maximize flexibility - different demos uncover different information
- **Validation**: Only standard task fields (name, type, restaurant_id) are required

### 3. Flexible Data Input
- **Pre-configured Options**: Common values provided for quick selection
- **Custom Values**: Users can enter any custom value alongside pre-configured options
- **JSON Storage**: Arrays stored as `[{type: 'predefined'|'custom', value: string}]`

### 4. Backward Compatibility
- **Existing Tasks**: All current task types remain unchanged
- **Mixed Workflows**: Demo meeting tasks coexist with other task types
- **Gradual Adoption**: Teams can adopt demo meeting tasks at their own pace

---

## Existing UI Patterns

### Task Type Display Pattern
Each task type has specialized display logic in TaskTypeQuickView:

```typescript
// Pattern: Type-specific information display
switch (task.type) {
  case 'email':
    return <EmailView task={task} />;      // Shows email addresses + message
  case 'call':
    return <CallView task={task} />;       // Shows phone numbers
  case 'social_message':
    return <SocialView task={task} />;     // Shows social links + message
  case 'internal_activity':
    return <InternalView task={task} />;   // Shows all contact info
  case 'demo_meeting':
    return <DemoMeetingView task={task} />; // NEW: Shows contact + meeting link + qualification
}
```

### Form Field Patterns
CreateTaskModal uses dynamic field rendering based on task type:

```typescript
// Pattern: Conditional field display
{formData.type === 'email' && (
  <MessageSection
    messageTemplates={emailTemplates}
    value={formData.message}
    onChange={handleMessageChange}
  />
)}

{formData.type === 'demo_meeting' && (
  <QualificationSection
    data={qualificationData}
    onChange={handleQualificationChange}
  />
)}
```

---

## Implementation Location

### New Files to Create

**Frontend Components:**
```
/UberEats-Image-Extractor/src/components/
├── demo-meeting/
│   ├── QualificationForm.tsx          # Main qualification form section
│   ├── TagInput.tsx                   # Multi-select with custom values
│   ├── QualificationDisplay.tsx       # Display component for quick view
│   ├── QualificationDetail.tsx        # Display component for detail modal
│   └── index.ts                       # Barrel export
```

**Backend Services:**
```
/UberEats-Image-Extractor/src/services/
└── qualification-service.js           # Qualification data handling logic
```

**Database Migrations:**
```
/supabase/migrations/
├── YYYYMMDD_add_demo_qualification_columns.sql
└── YYYYMMDD_add_demo_meeting_task_type.sql
```

### Files to Modify

**Existing Components:**
- `/src/components/tasks/CreateTaskModal.tsx` - Add demo_meeting type handling
- `/src/components/tasks/EditTaskModal.tsx` - Add qualification field editing
- `/src/components/tasks/TaskTypeQuickView.tsx` - Add demo_meeting view
- `/src/components/tasks/TaskDetailModal.tsx` - Add qualification detail display

**Existing Services:**
- `/src/services/tasks-service.js` - Add restaurant update logic for demo_meeting

---

## Quick Start Guide

### For Developers

1. **Read Documentation First**
   - Start with [REQUIREMENTS-DOCUMENT.md](REQUIREMENTS-DOCUMENT.md) for full context
   - Review [architecture.md](architecture.md) for system design
   - Check [implementation-roadmap.md](implementation-roadmap.md) for task breakdown

2. **Understand Current System**
   - Explore existing task types in TaskTypeQuickView.tsx
   - Review how CreateTaskModal handles different task types
   - Examine current restaurant table schema

3. **Implementation Order**
   - Phase 1: Database schema (migrations)
   - Phase 2: Backend services (task creation/editing logic)
   - Phase 3: Frontend components (form, display)
   - Phase 4: Integration & testing

### For Project Managers

1. **Review Requirements**: [REQUIREMENTS-DOCUMENT.md](REQUIREMENTS-DOCUMENT.md)
2. **Check Roadmap**: [implementation-roadmap.md](implementation-roadmap.md)
3. **Estimate Timeline**: ~8-12 days for complete implementation
4. **Identify Dependencies**: Database access, Supabase migrations, frontend components

---

## Related Documentation

### Sales Features Documentation
- **Parent Folder**: [planning/database-plans/sales-specific-features/](../)
- **Implementation Plan**: [../IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md)
- **Database Schemas**: [../database-schemas/](../database-schemas/)

### Task System Documentation
- **Tasks Page**: [UberEats-Image-Extractor/src/pages/Tasks.tsx](../../../UberEats-Image-Extractor/src/pages/Tasks.tsx)
- **Task Components**: [UberEats-Image-Extractor/src/components/tasks/](../../../UberEats-Image-Extractor/src/components/tasks/)
- **Task Service**: [UberEats-Image-Extractor/src/services/tasks-service.js](../../../UberEats-Image-Extractor/src/services/tasks-service.js)

---

## Key Decisions Made

### 1. Edit Behavior
**Decision**: Editing a demo meeting task updates the restaurant record with only changed fields

**Rationale**:
- Keeps restaurant data up-to-date as qualification information evolves
- Prevents overwriting unchanged fields with stale data
- Maintains audit trail in task metadata

**Implementation**: Track field changes in EditTaskModal and only send modified fields to backend

### 2. Required Fields
**Decision**: No qualification fields are mandatory (not even meeting_link)

**Rationale**:
- Maximum flexibility for different demo scenarios
- Some demos may not have meeting link yet (pending scheduling)
- Better user experience - less friction in task creation

**Implementation**: Remove all field-level validation, maintain only task-level validation (name, type, restaurant_id)

### 3. Pre-configured Options
**Decision**: Pumpd-specific value propositions and common objections

**Updated Lists**:
- **Painpoints**: 8 items focused on platform fees, data ownership, customer relationships
- **Core Selling Points**: 11 items highlighting commission reduction, customer retention, SMS marketing
- **Features to Highlight**: 15 items emphasizing low commissions, branding, loyalty, marketing tools
- **Possible Objections**: 12 items covering platform relationships, POS integration, adoption concerns

**Implementation**: Store as constants in frontend, allow custom values alongside pre-configured options

### 4. Meeting Link Validation
**Decision**: No validation required

**Rationale**:
- Accept any text format (URL, phone number, location, notes)
- Users may add placeholder text initially
- Validation adds friction without clear value

**Implementation**: Plain text input field, no format validation

---

## Status

### Current Phase
**Planning Complete** - All documentation created and reviewed

### Completed
✅ Requirements gathering and analysis
✅ Architecture design
✅ API specification
✅ Database schema design
✅ UI component specifications
✅ Implementation roadmap

### In Progress
⏸️ Awaiting implementation start

### Not Started
❌ Database migrations
❌ Backend implementation
❌ Frontend implementation
❌ Testing
❌ Deployment

---

## Next Steps

### Immediate (Week 1)
1. **Database Setup**
   - Create migration files
   - Test migrations in development environment
   - Apply to staging database

2. **Backend Foundation**
   - Implement qualification-service.js
   - Update tasks-service.js with demo_meeting handling
   - Add field-level change tracking for edits

### Short-term (Week 2)
3. **Frontend Components**
   - Create TagInput component
   - Build QualificationForm component
   - Update CreateTaskModal and EditTaskModal

4. **Integration**
   - Update TaskTypeQuickView with demo_meeting view
   - Update TaskDetailModal with qualification display
   - Test end-to-end flow

### Medium-term (Week 3)
5. **Testing & Refinement**
   - Unit tests for services
   - Integration tests for create/edit flow
   - E2E tests for complete workflow
   - Bug fixes and polish

6. **Documentation & Training**
   - User documentation
   - Training materials for sales team
   - Video walkthrough

---

## Support

### Technical Questions
- Review [architecture.md](architecture.md) for design patterns
- Check [api-specification.md](api-specification.md) for endpoint details
- Consult [service-layer.md](service-layer.md) for business logic

### Implementation Questions
- Follow [implementation-roadmap.md](implementation-roadmap.md) phase by phase
- Reference [database-schema.md](database-schema.md) for data structure
- Use [ui-components.md](ui-components.md) for component specs

### Business Questions
- Review [REQUIREMENTS-DOCUMENT.md](REQUIREMENTS-DOCUMENT.md) for context
- Check "Key Decisions Made" section above
- Consult with stakeholders for clarification

---

**Document Prepared By:** Claude (AI Assistant)
**Last Updated:** 2025-01-19
**Version:** 1.0
**Status:** Final - Ready for Implementation
