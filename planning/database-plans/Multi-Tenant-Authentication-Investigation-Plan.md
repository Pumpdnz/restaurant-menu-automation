# Multi-Tenant Authentication & User Management Investigation Plan
## For UberEats Image Extractor Application

### Executive Summary
This document outlines a comprehensive investigation plan to analyze how the pumpd-webhook application handles authentication, multi-tenancy, billing integration, and role-based access control. The findings will be used to implement similar functionality in the UberEats Image Extractor application.

---

## Investigation Objectives

### Primary Goals
1. **Authentication System**: Understand Google OAuth and email authentication implementation with Supabase
2. **Multi-Tenancy Architecture**: Analyze organization-based data isolation and access control
3. **Billing Integration**: Examine Stripe meters integration and usage tracking
4. **Role Management**: Document role-based permissions and feature access control
5. **Data Security**: Understand how user data is isolated and protected across organizations

### Expected Outcomes
- Complete understanding of authentication flow
- Documentation of database schema for multi-tenancy
- Mapping of billing integration points
- Role permission matrix
- Implementation roadmap for UberEats Image Extractor

---

## Investigation Areas

### 1. Authentication & Authorization

#### Frontend Components
- [ ] `/src/context/AuthContext.tsx` - Main auth context implementation
- [ ] `/src/context/auth/` directory
  - [ ] `AuthProvider.tsx` - Auth provider wrapper
  - [ ] `useAuth.tsx` - Auth hook implementation
  - [ ] `types.ts` - Auth type definitions
  - [ ] `profileUtils.ts` - User profile utilities
- [ ] `/src/api/auth.ts` - Auth API client
- [ ] `/src/api/client.ts` - Base API client configuration
- [ ] `/src/pages/Auth.tsx` - Authentication page component
- [ ] `/src/components/LoginForm.tsx` - Login form implementation
- [ ] `/src/pages/ResetPassword.tsx` - Password reset flow

#### Backend Components
- [ ] `/server/middleware/`
  - [ ] `auth.js` - Core auth middleware
  - [ ] `auth-middleware.js` - Extended auth middleware
  - [ ] `auth-internal.js` - Internal auth handling
- [ ] `/server/db/supabase.js` - Supabase client initialization
- [ ] `/server/utils/jwt-utils.js` - JWT token handling
- [ ] `/src/utils/jwt-roles.ts` - JWT role extraction

#### Supabase Integration
- [ ] `/src/integrations/supabase/client.ts` - Frontend Supabase client
- [ ] `/src/integrations/supabase/types.ts` - Supabase type definitions
- [ ] `/server/db/init-supabase.js` - Backend Supabase initialization

### 2. Multi-Tenant Architecture

#### Organization Management
- [ ] `/src/context/RestaurantContext.tsx` - Restaurant/Organization context
- [ ] `/src/pages/Organisation.tsx` - Organization management page
- [ ] `/src/hooks/useRestaurantBranding.ts` - Organization branding hook

#### Data Isolation
- [ ] Database schema analysis:
  - [ ] How organizations table is structured
  - [ ] User-organization relationships
  - [ ] Data access patterns with organization_id
- [ ] RLS (Row Level Security) policies investigation
- [ ] Organization-based query filtering patterns

#### Admin Components
- [ ] `/src/components/admin/` directory
  - [ ] `RestaurantsTab.tsx` - Restaurant management
  - [ ] `UsersTab.tsx` - User management
  - [ ] `AccessTab.tsx` - Access control
- [ ] `/server/handlers/admin/`
  - [ ] `admin-restaurants-handler.js`
  - [ ] `admin-users-handler.js`
  - [ ] `admin-permissions-handler.js`

### 3. Billing & Usage Tracking

#### Stripe Integration
- [ ] `/server/utils/stripe-client.js` - Stripe client configuration
- [ ] `/server/handlers/stripe-webhook-handler.js` - Webhook handling
- [ ] `/server/handlers/improved-stripe-webhook-handler.js` - Enhanced webhook handling
- [ ] `/server/handlers/admin/stripe-admin-handler.js` - Admin Stripe operations

#### SMS Billing (as reference for usage-based billing)
- [ ] `/src/context/SmsBillingContext.tsx` - Billing context
- [ ] `/src/context/sms-billing/` directory
- [ ] `/server/handlers/`
  - [ ] `restaurant-sms-billing-handler.js`
  - [ ] `sms-billing-handler.js`
- [ ] `/server/services/stripe/`
  - [ ] `meter-management.js` - Meter management
  - [ ] `restaurant-sms.js` - Usage tracking

#### Meter Implementation
- [ ] `/server/init/meter-init.js` - Meter initialization
- [ ] Usage event recording patterns
- [ ] Billing cycle management
- [ ] Usage reports generation

### 4. Role-Based Access Control

#### Role Management
- [ ] `/src/utils/role-utils.ts` - Role utility functions
- [ ] `/src/utils/jwt-roles.ts` - JWT role extraction
- [ ] `/src/components/RoleBadge.tsx` - Role display component
- [ ] `/src/components/RouteGuard.tsx` - Route protection

#### Permission System
- [ ] `/src/components/admin/superadmin/` directory
  - [ ] `SuperAdminRolesTab.tsx` - Role management
  - [ ] `SuperAdminPermissionsTab.tsx` - Permission management
  - [ ] `SuperAdminUsersTab.tsx` - User role assignment

#### Feature Flags
- [ ] `/src/utils/features/`
  - [ ] `featureFlags.ts` - Feature flag system
  - [ ] `initializeFeatureFlags.ts` - Feature initialization
- [ ] `/src/components/AdminFeatureFlagAlert.tsx` - Feature flag alerts

### 5. User Management

#### User Registration & Onboarding
- [ ] `/src/pages/Onboarding.tsx` - User onboarding flow
- [ ] `/src/hooks/useOnboarding.ts` - Onboarding hook
- [ ] `/src/types/onboarding.ts` - Onboarding types
- [ ] `/server/handlers/restaurant-registration.js` - Registration handler

#### Super Admin Features
- [ ] `/src/pages/admin/SuperAdmin.tsx` - Super admin page
- [ ] `/src/hooks/useSuperAdminUsers.ts` - User management hook
- [ ] `/src/hooks/useSuperAdminOnboarding.ts` - Admin onboarding
- [ ] `/src/types/super-admin-onboarding.ts` - Admin types

#### User Profile Management
- [ ] `/src/pages/CustomerProfile.tsx` - Profile page
- [ ] `/src/context/auth/profileUtils.ts` - Profile utilities
- [ ] User settings and preferences storage

### 6. Security & Data Protection

#### Authentication Security
- [ ] Token storage patterns (localStorage, cookies, etc.)
- [ ] Refresh token implementation
- [ ] Session management
- [ ] Password policies

#### API Security
- [ ] CORS configuration
- [ ] Rate limiting implementation
- [ ] API key management for internal services
- [ ] Request validation patterns

#### Data Protection
- [ ] Encryption practices
- [ ] Sensitive data handling
- [ ] Audit logging
- [ ] GDPR compliance features

---

## Investigation Methodology

### Phase 1: Authentication Flow (Days 1-2)
1. **Frontend Auth Flow**
   - Trace login process from UI to API
   - Document Google OAuth implementation
   - Analyze email/password flow
   - Map token management

2. **Backend Auth Processing**
   - Middleware chain analysis
   - JWT validation process
   - Session management
   - Supabase auth integration

3. **Documentation Output**
   - Auth flow diagram
   - Sequence diagrams for OAuth and email auth
   - Token lifecycle documentation

### Phase 2: Multi-Tenancy (Days 3-4)
1. **Database Schema Analysis**
   - Export and analyze table structures
   - Document relationships
   - Identify organization isolation patterns

2. **Data Access Patterns**
   - Query organization filtering
   - RLS policy analysis
   - Cross-tenant prevention mechanisms

3. **Documentation Output**
   - ER diagram with multi-tenant structure
   - Data access matrix
   - Organization isolation checklist

### Phase 3: Billing Integration (Days 5-6)
1. **Stripe Setup Analysis**
   - API key configuration
   - Webhook endpoint setup
   - Meter configuration

2. **Usage Tracking**
   - Event recording patterns
   - Aggregation methods
   - Reporting mechanisms

3. **Documentation Output**
   - Billing flow diagram
   - Meter event schema
   - Usage tracking implementation guide

### Phase 4: Role Management (Day 7)
1. **Permission Structure**
   - Role hierarchy analysis
   - Permission matrix creation
   - Feature access mapping

2. **Implementation Patterns**
   - Frontend route guarding
   - API endpoint protection
   - Feature flag integration

3. **Documentation Output**
   - Role permission matrix
   - Access control flow diagram
   - Feature flag documentation

### Phase 5: Implementation Planning (Day 8)
1. **Gap Analysis**
   - Current vs. required features
   - Technology compatibility
   - Migration requirements

2. **Implementation Roadmap**
   - Priority ranking
   - Dependency mapping
   - Timeline estimation

3. **Documentation Output**
   - Implementation roadmap
   - Migration checklist
   - Risk assessment

---

## Key Files Priority List

### Critical Files (Must Investigate)
1. `/src/context/auth/AuthProvider.tsx`
2. `/server/middleware/auth.js`
3. `/server/db/supabase.js`
4. `/src/integrations/supabase/client.ts`
5. `/server/utils/stripe-client.js`
6. `/src/utils/role-utils.ts`
7. `/server/handlers/stripe-webhook-handler.js`

### Important Files (Should Investigate)
1. `/src/context/RestaurantContext.tsx`
2. `/src/pages/Organisation.tsx`
3. `/server/services/stripe/meter-management.js`
4. `/src/components/RouteGuard.tsx`
5. `/server/handlers/admin/admin-permissions-handler.js`
6. `/src/hooks/useOnboarding.ts`

### Reference Files (Good to Know)
1. `/src/context/SmsBillingContext.tsx`
2. `/src/utils/features/featureFlags.ts`
3. `/src/components/admin/superadmin/SuperAdminPanel.tsx`
4. `/server/handlers/restaurant-registration.js`

---

## Expected Deliverables

### 1. Technical Documentation
- Complete authentication flow documentation
- Multi-tenant database schema
- API endpoint security matrix
- Role permission matrix

### 2. Implementation Guides
- Step-by-step Supabase auth setup
- Stripe meters configuration guide
- Multi-tenant data isolation checklist
- Role management implementation guide

### 3. Code Templates
- Auth context implementation
- Protected route components
- Organization filtering utilities
- Billing integration helpers

### 4. Migration Plan
- Database schema migration scripts
- User data migration strategy
- Feature parity checklist
- Testing strategy

---

## Risk Assessment

### Technical Risks
- **Complexity**: Multi-tenant architecture may be complex
- **Dependencies**: External service dependencies (Supabase, Stripe)
- **Migration**: Data migration from existing system
- **Performance**: Multi-tenant query performance

### Mitigation Strategies
- Thorough documentation before implementation
- Incremental migration approach
- Performance testing at each stage
- Fallback mechanisms for external services

---

## Timeline Estimate

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Investigation | 8 days | Complete documentation |
| Planning | 2 days | Implementation roadmap |
| Implementation | 15-20 days | Working system |
| Testing | 5 days | Test coverage |
| Migration | 3-5 days | Data migration |
| **Total** | **33-40 days** | **Production-ready system** |

---

## Next Steps

1. **Immediate Actions**
   - Begin with AuthContext investigation
   - Set up local development environment
   - Create investigation tracking spreadsheet

2. **Week 1 Goals**
   - Complete authentication flow analysis
   - Document multi-tenant architecture
   - Create initial implementation plan

3. **Success Criteria**
   - Full understanding of existing system
   - Clear implementation roadmap
   - Risk mitigation plan in place

---

## Notes Section
*To be filled during investigation*

### Discoveries
- 

### Questions
- 

### Concerns
- 

### Recommendations
- 

---

*Document Version: 1.0*
*Created: 2025-08-25*
*Last Updated: 2025-08-25*