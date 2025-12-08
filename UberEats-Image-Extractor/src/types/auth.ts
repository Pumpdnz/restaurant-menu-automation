// Three-tier authentication role system
export type UserRole = 'super_admin' | 'admin' | 'user';

export interface FeatureFlags {
  [key: string]: boolean | { enabled: boolean; ratePerItem?: number; [key: string]: any } | FeatureFlags;
}

export interface Organisation {
  id: string;
  name: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  settings?: Record<string, any>;
  feature_flags?: FeatureFlags;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organisationId: string;
  organisation?: Organisation;
}

export interface OrganisationInvite {
  id: string;
  organisation_id: string;
  email: string;
  role: Exclude<UserRole, 'super_admin'>; // Can't invite super admins
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
}

export interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;

  // Role checks
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  hasRole: (role: UserRole) => boolean;

  // Feature flags
  featureFlags: FeatureFlags | null;
  isFeatureEnabled: (path: string) => boolean;
  refetchFeatureFlags: () => Promise<void>;

  // Organization management (admin only)
  inviteUser?: (email: string, role: Exclude<UserRole, 'super_admin'>) => Promise<string>;
  removeUser?: (userId: string) => Promise<void>;
  updateUserRole?: (userId: string, role: Exclude<UserRole, 'super_admin'>) => Promise<void>;

  // Super admin functions
  impersonateUser?: (userId: string) => Promise<void>;
  exitImpersonation?: () => Promise<void>;
  switchOrganization?: (orgId: string) => Promise<void>;
}

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}