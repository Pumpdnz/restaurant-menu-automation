# Super Admin Dashboard - Phase 5: Polish & Testing Implementation

## Overview
Phase 5 focuses on polishing the Super Admin Dashboard with proper loading states, error handling, performance optimizations, and comprehensive testing to ensure production readiness.

## Timeline
**Duration**: 1-2 Days
**Prerequisites**: Phases 1-4 completed
**Deliverable**: Production-ready Super Admin Dashboard with excellent UX and comprehensive test coverage

## Part 1: UI/UX Polish

### 1.1 Loading States Implementation

#### Global Loading Component
**File**: `/src/components/super-admin/LoadingStates.tsx`
```typescript
import React from 'react';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Loader2 } from 'lucide-react';

// Table skeleton loader
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex} 
          className="grid gap-4" 
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-12 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Card skeleton loader
export function CardSkeleton({ count = 3 }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-2/3 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Statistics card skeleton
export function StatsSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-5 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-32 mt-1" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Full page loader
export function PageLoader({ message = "Loading..." }) {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-4" />
      <p className="text-gray-500">{message}</p>
    </div>
  );
}

// Inline loader for buttons
export function ButtonLoader({ loading, children, ...props }: any) {
  return (
    <button {...props} disabled={loading || props.disabled}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
```

#### Progress Indicator for Long Operations
**File**: `/src/components/super-admin/ProgressIndicator.tsx`
```typescript
import React from 'react';
import { Progress } from '../ui/progress';
import { Card, CardContent } from '../ui/card';
import { CheckCircle, XCircle } from 'lucide-react';

interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  error?: string;
}

interface ProgressIndicatorProps {
  title: string;
  steps: ProgressStep[];
  currentStep: number;
}

export function ProgressIndicator({ title, steps, currentStep }: ProgressIndicatorProps) {
  const progress = (currentStep / steps.length) * 100;

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="font-semibold mb-4">{title}</h3>
        <Progress value={progress} className="mb-4" />
        
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center space-x-3">
              {step.status === 'completed' && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              {step.status === 'error' && (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              {step.status === 'in-progress' && (
                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
              )}
              {step.status === 'pending' && (
                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
              )}
              
              <div className="flex-1">
                <p className={`text-sm ${
                  step.status === 'completed' ? 'text-gray-600' :
                  step.status === 'error' ? 'text-red-600' :
                  step.status === 'in-progress' ? 'font-semibold' :
                  'text-gray-400'
                }`}>
                  {step.label}
                </p>
                {step.error && (
                  <p className="text-xs text-red-500 mt-1">{step.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 1.2 Error Handling Implementation

#### Error Boundary Component
**File**: `/src/components/super-admin/ErrorBoundary.tsx`
```typescript
import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Log to error tracking service (e.g., Sentry)
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: { react: errorInfo }
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center text-red-600">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                An unexpected error occurred. Please try refreshing the page.
              </p>
              
              {this.state.error && (
                <details className="text-xs bg-gray-50 p-3 rounded">
                  <summary className="cursor-pointer font-medium">
                    Error details
                  </summary>
                  <pre className="mt-2 overflow-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
              
              <div className="flex space-x-3">
                <Button onClick={this.handleReset} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### Error Toast System
**File**: `/src/hooks/useErrorHandler.ts`
```typescript
import { useToast } from '../components/ui/use-toast';
import { useCallback } from 'react';

interface ErrorOptions {
  title?: string;
  retry?: () => void;
  silent?: boolean;
}

export function useErrorHandler() {
  const { toast } = useToast();

  const handleError = useCallback((error: any, options: ErrorOptions = {}) => {
    console.error('Error:', error);

    // Parse error message
    let message = 'An unexpected error occurred';
    if (error?.message) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }

    // Check for specific error types
    if (error?.code === 'PGRST116') {
      message = 'No data found';
    } else if (error?.code === '23505') {
      message = 'This item already exists';
    } else if (error?.code === '23503') {
      message = 'Cannot delete - this item is being used elsewhere';
    } else if (error?.code === '42501') {
      message = 'You do not have permission to perform this action';
    }

    // Show toast unless silent
    if (!options.silent) {
      toast({
        title: options.title || 'Error',
        description: message,
        variant: 'destructive',
        action: options.retry ? (
          <button onClick={options.retry} className="text-sm underline">
            Retry
          </button>
        ) : undefined
      });
    }

    return message;
  }, [toast]);

  return { handleError };
}
```

### 1.3 Confirmation Dialogs

#### Reusable Confirmation Dialog
**File**: `/src/components/super-admin/ConfirmDialog.tsx`
```typescript
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Input } from '../ui/input';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: 'default' | 'destructive';
  requireConfirmation?: string; // Text user must type to confirm
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  variant = 'default',
  requireConfirmation
}: ConfirmDialogProps) {
  const [confirmationText, setConfirmationText] = React.useState('');
  const isDestructive = variant === 'destructive';
  const canConfirm = !requireConfirmation || confirmationText === requireConfirmation;

  const handleConfirm = () => {
    onConfirm();
    setConfirmationText('');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center">
            {isDestructive ? (
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            ) : (
              <Info className="h-5 w-5 text-blue-500 mr-2" />
            )}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span>{description}</span>
            
            {requireConfirmation && (
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium">
                  Type <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">
                    {requireConfirmation}
                  </span> to confirm:
                </p>
                <Input
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder={requireConfirmation}
                  className="font-mono"
                />
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmationText('')}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={isDestructive ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### 1.4 Performance Optimizations

#### Virtual Scrolling for Large Lists
**File**: `/src/components/super-admin/VirtualTable.tsx`
```typescript
import React, { useCallback, useRef } from 'react';
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

interface VirtualTableProps<T> {
  data: T[];
  columns: {
    key: string;
    header: string;
    width: number;
    render: (item: T) => React.ReactNode;
  }[];
  rowHeight?: number;
  onRowClick?: (item: T) => void;
}

export function VirtualTable<T>({ 
  data, 
  columns, 
  rowHeight = 50,
  onRowClick 
}: VirtualTableProps<T>) {
  const listRef = useRef<List>(null);

  const Row = useCallback(({ index, style }: any) => {
    const item = data[index];
    
    return (
      <div 
        style={style} 
        className="flex items-center border-b hover:bg-gray-50 cursor-pointer"
        onClick={() => onRowClick?.(item)}
      >
        {columns.map((column) => (
          <div 
            key={column.key} 
            style={{ width: column.width }}
            className="px-4 py-2 truncate"
          >
            {column.render(item)}
          </div>
        ))}
      </div>
    );
  }, [data, columns, onRowClick]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex border-b bg-gray-50 font-medium">
        {columns.map((column) => (
          <div 
            key={column.key} 
            style={{ width: column.width }}
            className="px-4 py-2"
          >
            {column.header}
          </div>
        ))}
      </div>
      
      {/* Virtual List */}
      <div className="flex-1">
        <AutoSizer>
          {({ height, width }) => (
            <List
              ref={listRef}
              height={height}
              itemCount={data.length}
              itemSize={() => rowHeight}
              width={width}
            >
              {Row}
            </List>
          )}
        </AutoSizer>
      </div>
    </div>
  );
}
```

#### Debounced Search Hook
**File**: `/src/hooks/useDebouncedSearch.ts`
```typescript
import { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';

export function useDebouncedSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  delay: number = 300
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await searchFn(searchQuery);
        setResults(data);
      } catch (err: any) {
        setError(err.message || 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, delay),
    [searchFn, delay]
  );

  useEffect(() => {
    debouncedSearch(query);
    return () => debouncedSearch.cancel();
  }, [query, debouncedSearch]);

  return {
    query,
    setQuery,
    results,
    loading,
    error
  };
}
```

#### Data Caching Hook
**File**: `/src/hooks/useDataCache.ts`
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  key: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function useDataCache<T>(
  fetchFn: () => Promise<T>,
  options: CacheOptions
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cache = useRef<Map<string, CacheEntry<T>>>(new Map());

  const { ttl = 5 * 60 * 1000, key } = options; // Default 5 minutes

  const fetchData = useCallback(async (force = false) => {
    // Check cache first
    if (!force) {
      const cached = cache.current.get(key);
      if (cached && Date.now() - cached.timestamp < ttl) {
        setData(cached.data);
        return cached.data;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      
      // Update cache
      cache.current.set(key, {
        data: result,
        timestamp: Date.now()
      });
      
      setData(result);
      return result;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchFn, key, ttl]);

  const invalidate = useCallback(() => {
    cache.current.delete(key);
    return fetchData(true);
  }, [key, fetchData]);

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(true),
    invalidate
  };
}
```

### 1.5 Responsive Design

#### Responsive Table Component
**File**: `/src/components/super-admin/ResponsiveTable.tsx`
```typescript
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChevronRight } from 'lucide-react';

interface ResponsiveTableProps<T> {
  data: T[];
  columns: {
    key: string;
    header: string;
    render: (item: T) => React.ReactNode;
    mobileHide?: boolean;
  }[];
  onRowClick?: (item: T) => void;
}

export function ResponsiveTable<T>({ data, columns, onRowClick }: ResponsiveTableProps<T>) {
  // Desktop view
  const DesktopView = () => (
    <div className="hidden md:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key}>{col.header}</TableHead>
            ))}
            {onRowClick && <TableHead className="w-10"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => (
            <TableRow 
              key={index}
              className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <TableCell key={col.key}>{col.render(item)}</TableCell>
              ))}
              {onRowClick && (
                <TableCell>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  // Mobile view
  const MobileView = () => (
    <div className="md:hidden space-y-3">
      {data.map((item, index) => (
        <Card 
          key={index}
          className={onRowClick ? 'cursor-pointer' : ''}
          onClick={() => onRowClick?.(item)}
        >
          <CardContent className="pt-4">
            {columns.filter(col => !col.mobileHide).map((col) => (
              <div key={col.key} className="flex justify-between py-2 border-b last:border-0">
                <span className="text-sm text-gray-500">{col.header}</span>
                <span className="text-sm font-medium">{col.render(item)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <>
      <DesktopView />
      <MobileView />
    </>
  );
}
```

## Part 2: Testing Implementation

### 2.1 Unit Tests

#### Component Tests
**File**: `/src/components/super-admin/__tests__/SuperAdminRoute.test.tsx`
```typescript
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SuperAdminRoute } from '../SuperAdminRoute';
import { AuthContext } from '../../../context/AuthContext';

const mockAuthContext = (role: string) => ({
  user: { id: '1', email: 'test@test.com', role },
  loading: false,
  isSuperAdmin: () => role === 'super_admin',
  // ... other context values
});

describe('SuperAdminRoute', () => {
  it('allows super admin access', () => {
    render(
      <BrowserRouter>
        <AuthContext.Provider value={mockAuthContext('super_admin')}>
          <SuperAdminRoute>
            <div>Protected Content</div>
          </SuperAdminRoute>
        </AuthContext.Provider>
      </BrowserRouter>
    );
    
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects non-super admin', () => {
    render(
      <BrowserRouter>
        <AuthContext.Provider value={mockAuthContext('admin')}>
          <SuperAdminRoute>
            <div>Protected Content</div>
          </SuperAdminRoute>
        </AuthContext.Provider>
      </BrowserRouter>
    );
    
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
```

#### Hook Tests
**File**: `/src/hooks/__tests__/useErrorHandler.test.ts`
```typescript
import { renderHook, act } from '@testing-library/react';
import { useErrorHandler } from '../useErrorHandler';

jest.mock('../components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}));

describe('useErrorHandler', () => {
  it('handles string errors', () => {
    const { result } = renderHook(() => useErrorHandler());
    
    act(() => {
      const message = result.current.handleError('Test error');
      expect(message).toBe('Test error');
    });
  });

  it('handles error objects', () => {
    const { result } = renderHook(() => useErrorHandler());
    
    act(() => {
      const error = new Error('Test error message');
      const message = result.current.handleError(error);
      expect(message).toBe('Test error message');
    });
  });

  it('handles specific error codes', () => {
    const { result } = renderHook(() => useErrorHandler());
    
    act(() => {
      const error = { code: '23505', message: 'duplicate key' };
      const message = result.current.handleError(error);
      expect(message).toBe('This item already exists');
    });
  });
});
```

### 2.2 Integration Tests

#### API Integration Tests
**File**: `/src/api/__tests__/superAdmin.test.ts`
```typescript
import { supabase } from '../../lib/supabase';

describe('Super Admin API', () => {
  let testOrgId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Setup test data
    const { data: org } = await supabase
      .from('organisations')
      .insert({ name: 'Test Org' })
      .select()
      .single();
    
    testOrgId = org.id;
  });

  afterAll(async () => {
    // Cleanup
    await supabase
      .from('organisations')
      .delete()
      .eq('id', testOrgId);
  });

  describe('Organizations', () => {
    it('fetches all organizations', async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('*');
      
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('updates organization feature flags', async () => {
      const newFlags = { standardExtraction: { enabled: false } };
      
      const { error } = await supabase
        .from('organisations')
        .update({ feature_flags: newFlags })
        .eq('id', testOrgId);
      
      expect(error).toBeNull();
    });

    it('archives organization', async () => {
      const { error } = await supabase
        .from('organisations')
        .update({ 
          status: 'archived',
          archived_at: new Date().toISOString()
        })
        .eq('id', testOrgId);
      
      expect(error).toBeNull();
    });
  });

  describe('Usage Tracking', () => {
    it('tracks usage event', async () => {
      const { data, error } = await supabase
        .rpc('track_usage_event', {
          p_org_id: testOrgId,
          p_event_type: 'test_event',
          p_quantity: 1
        });
      
      expect(error).toBeNull();
      expect(data).toBeTruthy();
    });

    it('retrieves usage statistics', async () => {
      const { data, error } = await supabase
        .from('usage_events')
        .select('*')
        .eq('organisation_id', testOrgId);
      
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
```

### 2.3 End-to-End Tests

#### Playwright Test Suite
**File**: `/e2e/superAdmin.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Super Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as super admin
    await page.goto('/login');
    await page.fill('[name="email"]', 'superadmin@test.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('navigates to super admin dashboard', async ({ page }) => {
    await page.click('text=Super Admin');
    await expect(page).toHaveURL('/super-admin');
    await expect(page.locator('h1')).toContainText('Super Admin Dashboard');
  });

  test('switches between tabs', async ({ page }) => {
    await page.goto('/super-admin');
    
    // Check Organizations tab
    await page.click('text=Organizations');
    await expect(page.locator('h2')).toContainText('Organizations');
    
    // Check Users tab
    await page.click('text=Users');
    await expect(page.locator('h2')).toContainText('User Management');
    
    // Check Usage tab
    await page.click('text=Usage');
    await expect(page.locator('h2')).toContainText('Usage Statistics');
  });

  test('creates new organization', async ({ page }) => {
    await page.goto('/super-admin');
    await page.click('text=Create Organization');
    
    // Fill form
    await page.fill('[name="name"]', 'Test Organization');
    await page.fill('[name="adminEmail"]', 'admin@testorg.com');
    
    // Configure features
    await page.click('[name="standardExtraction"]');
    await page.fill('[name="standardExtractionRate"]', '0.15');
    
    // Submit
    await page.click('text=Create');
    
    // Verify
    await expect(page.locator('text=Test Organization')).toBeVisible();
  });

  test('archives organization', async ({ page }) => {
    await page.goto('/super-admin');
    
    // Click on organization
    await page.click('text=Test Organization');
    
    // Archive
    await page.click('text=Archive Organization');
    await page.click('text=Confirm');
    
    // Verify
    await expect(page.locator('text=archived')).toBeVisible();
  });

  test('manages users', async ({ page }) => {
    await page.goto('/super-admin');
    await page.click('text=Users');
    
    // Search user
    await page.fill('[placeholder="Search users..."]', 'test@example.com');
    
    // Edit user
    await page.click('text=Edit');
    await page.selectOption('[name="role"]', 'admin');
    await page.click('text=Save');
    
    // Verify
    await expect(page.locator('text=User updated')).toBeVisible();
  });

  test('views usage statistics', async ({ page }) => {
    await page.goto('/super-admin');
    await page.click('text=Usage');
    
    // Select date range
    await page.click('text=Last 30 days');
    await page.click('text=Last 7 days');
    
    // Select organization
    await page.selectOption('[name="organization"]', 'test-org-id');
    
    // Export
    await page.click('text=Export CSV');
    
    // Verify download started
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toContain('usage-stats');
  });
});
```

### 2.4 Performance Testing

#### Performance Monitoring
**File**: `/src/utils/performance.ts`
```typescript
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number[]> = new Map();

  mark(name: string) {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string) {
    const start = this.marks.get(startMark);
    if (!start) {
      console.warn(`No mark found for ${startMark}`);
      return;
    }

    const duration = performance.now() - start;
    
    if (!this.measures.has(name)) {
      this.measures.set(name, []);
    }
    
    this.measures.get(name)!.push(duration);
    
    // Log if too slow
    if (duration > 1000) {
      console.warn(`Performance: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }

  getStats(name: string) {
    const measures = this.measures.get(name);
    if (!measures || measures.length === 0) {
      return null;
    }

    const sorted = [...measures].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  logAllStats() {
    console.group('Performance Stats');
    for (const [name, _] of this.measures) {
      const stats = this.getStats(name);
      if (stats) {
        console.table({ [name]: stats });
      }
    }
    console.groupEnd();
  }
}

// Global instance
export const perfMonitor = new PerformanceMonitor();
```

### 2.5 Manual Testing Checklist

#### Comprehensive Test Scenarios
**File**: `/docs/SUPER-ADMIN-TEST-CHECKLIST.md`
```markdown
# Super Admin Dashboard - Manual Testing Checklist

## Access Control
- [ ] Super admin can access dashboard
- [ ] Admin users are redirected
- [ ] Regular users are redirected
- [ ] Unauthenticated users are redirected
- [ ] Super admin badge displays correctly

## Organizations Tab
### List View
- [ ] All organizations display
- [ ] Member counts are accurate
- [ ] Search filters results correctly
- [ ] Sorting works (name, date, members)
- [ ] Pagination works for 20+ orgs
- [ ] Loading skeleton displays
- [ ] Empty state displays when no results

### Create Organization
- [ ] Modal opens correctly
- [ ] Form validation works
- [ ] Feature flags can be toggled
- [ ] Billing rates can be set
- [ ] Organization creates successfully
- [ ] Invitation email sends to admin
- [ ] Error handling for duplicate names

### Edit Organization
- [ ] Modal loads current data
- [ ] Name can be updated
- [ ] Feature flags update correctly
- [ ] Billing rates update correctly
- [ ] Changes save successfully
- [ ] Optimistic UI updates

### Archive Organization
- [ ] Confirmation dialog appears
- [ ] Impact summary displays
- [ ] Archive completes successfully
- [ ] Users lose access
- [ ] Data is preserved
- [ ] Organization appears in archived list

### Delete Organization
- [ ] Only works for archived orgs
- [ ] Requires typing org name
- [ ] Shows data impact
- [ ] Deletes all related data
- [ ] Cannot be undone

### Data Management
- [ ] Reassign restaurant works
- [ ] Reassign menu works
- [ ] Duplicate restaurant works
- [ ] Duplicate menu works
- [ ] Bulk selection works
- [ ] Progress indicator displays

## Users Tab
### List View
- [ ] All users display
- [ ] Organization shows correctly
- [ ] Search works (name, email)
- [ ] Filter by organization works
- [ ] Filter by role works
- [ ] Sorting works
- [ ] Pagination works

### Create User
- [ ] Modal opens
- [ ] Form validation works
- [ ] Organization can be selected
- [ ] Role can be selected
- [ ] User creates successfully
- [ ] Invitation email sends

### Edit User
- [ ] Modal loads current data
- [ ] Name can be updated
- [ ] Email can be updated
- [ ] Role can be changed
- [ ] Organization can be changed
- [ ] Cannot demote last admin
- [ ] Changes save successfully

### Delete User
- [ ] Confirmation dialog appears
- [ ] Soft delete works
- [ ] Hard delete works
- [ ] Cannot delete last admin
- [ ] User is removed from org

## Usage Statistics Tab
### Filters
- [ ] Date range picker works
- [ ] Presets work (Today, Last 7 days, etc.)
- [ ] Custom date range works
- [ ] Organization filter works
- [ ] Extraction type filter works

### Metrics Display
- [ ] All 20+ metrics display
- [ ] Values are accurate
- [ ] Credit calculations correct
- [ ] Period comparisons work
- [ ] Loading states display
- [ ] Error states handle gracefully

### Export
- [ ] CSV export works
- [ ] JSON export works
- [ ] Includes all metrics
- [ ] Includes billing calculations
- [ ] File downloads correctly

## Performance
- [ ] Dashboard loads in <2 seconds
- [ ] Tab switches are instant
- [ ] Search responds in <500ms
- [ ] Lists handle 100+ items
- [ ] Virtual scrolling works
- [ ] No memory leaks

## Error Handling
- [ ] Network errors show toast
- [ ] Validation errors display
- [ ] Retry mechanisms work
- [ ] Error boundaries catch crashes
- [ ] Fallback UI displays

## Responsive Design
- [ ] Desktop view (1920px)
- [ ] Laptop view (1366px)
- [ ] Tablet view (768px)
- [ ] Mobile view (375px)
- [ ] Tables become cards on mobile
- [ ] Modals are responsive
- [ ] Navigation collapses

## Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Focus indicators visible
- [ ] Color contrast sufficient
- [ ] ARIA labels present
```

## Part 3: Implementation Schedule

### Day 1 Morning (4 hours)
1. Implement loading states (1 hour)
2. Implement error handling (1 hour)
3. Implement confirmation dialogs (1 hour)
4. Implement performance optimizations (1 hour)

### Day 1 Afternoon (4 hours)
1. Implement responsive design (1 hour)
2. Write unit tests (1 hour)
3. Write integration tests (1 hour)
4. Set up E2E tests (1 hour)

### Day 2 (If needed)
1. Complete E2E test suite (2 hours)
2. Performance testing (2 hours)
3. Manual testing (2 hours)
4. Bug fixes and polish (2 hours)

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Performance benchmarks met
- [ ] Security review done

### Deployment Steps
1. Merge to staging branch
2. Run full test suite
3. Deploy to staging environment
4. Smoke test all features
5. Deploy to production
6. Monitor for errors

### Post-Deployment
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify all features working
- [ ] Update status page
- [ ] Notify stakeholders

## Success Criteria

### Must Have
- [x] All loading states implemented
- [x] Error handling comprehensive
- [x] Confirmation dialogs for destructive actions
- [x] Basic responsive design
- [x] Core features tested

### Should Have
- [x] Virtual scrolling for large lists
- [x] Debounced search
- [x] Data caching
- [x] E2E test coverage

### Nice to Have
- [ ] Full mobile optimization
- [ ] Keyboard shortcuts
- [ ] Advanced animations
- [ ] Dark mode support

---

**Document Version**: 1.0
**Phase**: 5 - Polish & Testing
**Status**: Ready for Implementation
**Prerequisites**: Phases 1-4 Complete