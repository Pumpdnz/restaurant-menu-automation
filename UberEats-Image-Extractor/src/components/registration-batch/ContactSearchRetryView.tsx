import { useState, useMemo } from 'react';
import {
  Search,
  AlertCircle,
  Loader2,
  MapPin,
  RefreshCw,
  ChevronDown,
  UserPlus,
  ExternalLink,
  Building2,
  Linkedin,
  Mail,
  User,
  Newspaper,
  ChevronsDownUp,
  ChevronsUpDown,
  Sparkles,
} from 'lucide-react';

import {
  RegistrationJob,
  useRetryStep2Search,
  useSkipWithManualEntry,
} from '../../hooks/useRegistrationBatch';

import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  Collapsible,
  CollapsibleContent,
} from '../ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { cn } from '../../lib/utils';

// ============================================================================
// CLEANING UTILITIES (mirrors backend logic in companies-office-batch-service.js)
// ============================================================================

/**
 * Clean restaurant name for Companies Office search
 * Removes location/store identifiers often appended by delivery platforms
 */
function cleanRestaurantName(name: string): string {
  if (!name) return '';

  const cleaned = name
    .replace(/\s*\([^)]*\)\s*/g, '') // Remove all (parenthetical text)
    .trim();

  return cleaned || name;
}

/**
 * Parse street from a full address string
 * Extracts the street name portion by finding common street type suffixes
 */
function parseStreetFromAddress(address: string): string {
  if (!address) return '';

  const streetTypes = [
    'street', 'road', 'avenue', 'lane', 'place', 'way',
    'crescent', 'drive', 'terrace', 'boulevard', 'court',
    'close', 'parade', 'highway', 'grove', 'rise', 'mews',
    'quay', 'esplanade', 'square', 'walk', 'path', 'row'
  ];

  const addressLower = address.toLowerCase();
  let earliestIndex = -1;
  let matchedType = '';

  for (const streetType of streetTypes) {
    const regex = new RegExp(`\\b${streetType}\\b`, 'i');
    const match = addressLower.match(regex);
    if (match && match.index !== undefined) {
      const index = match.index;
      if (earliestIndex === -1 || index < earliestIndex) {
        earliestIndex = index;
        matchedType = streetType;
      }
    }
  }

  if (earliestIndex !== -1) {
    return address.substring(0, earliestIndex + matchedType.length)
      .replace(/[,\s]+$/, '')
      .trim();
  }

  // Fallback: take first 3 words
  const words = address.split(/\s+/);
  return words.slice(0, 3).join(' ')
    .replace(/[,\s]+$/, '')
    .trim();
}

interface ContactSearchRetryViewProps {
  batchId: string;
  jobs: RegistrationJob[];
  onComplete: () => void;
}

// Manual entry details type
interface ManualEntryDetails {
  contact_name: string;
  full_legal_name: string;
  contact_email: string;
  contact_phone: string;
  company_name: string;
  company_number: string;
  gst_number: string;
  nzbn: string;
}

// Restaurant retry row
function RestaurantRetryRow({
  job,
  searchParams,
  onSearchParamsChange,
  onRetry,
  isRetrying,
  manualEntry,
  onManualEntryChange,
  onManualEntrySubmit,
  isSubmittingManual,
  isExpanded,
  onToggleExpand,
}: {
  job: RegistrationJob;
  searchParams: { restaurant_name: string; street: string; city: string };
  onSearchParamsChange: (params: Partial<{ restaurant_name: string; street: string; city: string }>) => void;
  onRetry: () => void;
  isRetrying: boolean;
  manualEntry: ManualEntryDetails;
  onManualEntryChange: (params: Partial<ManualEntryDetails>) => void;
  onManualEntrySubmit: () => void;
  isSubmittingManual: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const [showManualEntry, setShowManualEntry] = useState(false);
  const isDisabled = isRetrying || isSubmittingManual;

  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggleExpand}>
        <TableCell>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              !isExpanded && "-rotate-90"
            )}
          />
        </TableCell>
        <TableCell>
          <div className="font-medium">{job.restaurant?.name || job.restaurant_name}</div>
          {job.restaurant?.address && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {job.restaurant.address}
            </div>
          )}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-yellow-600 border-yellow-300">
            No results
          </Badge>
        </TableCell>
        <TableCell>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            Edit & Retry
          </Button>
        </TableCell>
      </TableRow>

      {/* Expanded retry panel with animation */}
      <Collapsible open={isExpanded} asChild>
        <TableRow className="bg-yellow-50/50 border-0">
          <TableCell colSpan={4} className="p-0">
            <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
              <div className="p-4 space-y-4">
              {/* Retry Search Section */}
              {!showManualEntry && (
                <>
                  <div className="flex items-center gap-2 text-yellow-700">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      No companies found. Edit search parameters and retry:
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Restaurant/Company Name
                      </label>
                      <Input
                        value={searchParams.restaurant_name}
                        onChange={(e) => onSearchParamsChange({ restaurant_name: e.target.value })}
                        placeholder="Company/Restaurant name"
                        disabled={isDisabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Street Address
                      </label>
                      <Input
                        value={searchParams.street}
                        onChange={(e) => onSearchParamsChange({ street: e.target.value })}
                        placeholder="Street address"
                        disabled={isDisabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        City
                      </label>
                      <Input
                        value={searchParams.city}
                        onChange={(e) => onSearchParamsChange({ city: e.target.value })}
                        placeholder="City"
                        disabled={isDisabled}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={onRetry}
                      disabled={isDisabled}
                    >
                      {isRetrying ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Retry Search
                        </>
                      )}
                    </Button>
                    <span className="text-sm text-muted-foreground">or</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowManualEntry(true)}
                      disabled={isDisabled}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Enter Details Manually
                    </Button>
                  </div>
                </>
              )}

              {/* Manual Entry Section */}
              {showManualEntry && (
                <>
                  <div className="flex items-center gap-2 text-blue-700">
                    <UserPlus className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Enter contact details manually:
                    </span>
                  </div>

                  {/* Search Links */}
                  <div className="bg-muted/50 rounded-md p-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Search for company and contact information:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const query = encodeURIComponent(searchParams.restaurant_name || job.restaurant?.name || '');
                          window.open(`https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/search?q=${query}&entityStatusGroups=REGISTERED&advancedPanel=true&mode=advanced#results`, '_blank');
                        }}
                      >
                        <Building2 className="h-3 w-3 mr-1" />
                        Companies Office
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const query = encodeURIComponent(`${searchParams.restaurant_name || job.restaurant?.name || ''} ${job.restaurant?.city || ''} owner LinkedIn`);
                          window.open(`https://www.google.com/search?q=${query}`, '_blank');
                        }}
                      >
                        <Linkedin className="h-3 w-3 mr-1" />
                        LinkedIn
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const query = encodeURIComponent(`${searchParams.restaurant_name || job.restaurant?.name || ''} ${job.restaurant?.city || ''} owner email address`);
                          window.open(`https://www.google.com/search?q=${query}`, '_blank');
                        }}
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        Email Search
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const query = encodeURIComponent(`${searchParams.restaurant_name || job.restaurant?.name || ''} ${job.restaurant?.city || ''} owner`);
                          window.open(`https://www.google.com/search?q=${query}`, '_blank');
                        }}
                      >
                        <User className="h-3 w-3 mr-1" />
                        Owner Search
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const query = encodeURIComponent(`${searchParams.restaurant_name || job.restaurant?.name || ''} ${job.restaurant?.city || ''} owner`);
                          window.open(`https://www.google.com/search?q=${query}&tbm=nws`, '_blank');
                        }}
                      >
                        <Newspaper className="h-3 w-3 mr-1" />
                        Owner News
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const query = encodeURIComponent(`What is the name of the owner of ${searchParams.restaurant_name || job.restaurant?.name || ''} ${job.restaurant?.city || ''} and what is the NZBN of the company behind this business and is there a publicly available email for contacting the business or their owners?`);
                          window.open(`https://www.google.com/search?udm=50&q=${query}`, '_blank');
                        }}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI Search
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Contact Information */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Contact Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={manualEntry.contact_name}
                        onChange={(e) => onManualEntryChange({ contact_name: e.target.value })}
                        placeholder="Owner/Director name (required)"
                        disabled={isDisabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Full Legal Name
                      </label>
                      <Input
                        value={manualEntry.full_legal_name}
                        onChange={(e) => onManualEntryChange({ full_legal_name: e.target.value })}
                        placeholder="Full legal name if different (optional)"
                        disabled={isDisabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Contact Email
                      </label>
                      <Input
                        type="email"
                        value={manualEntry.contact_email}
                        onChange={(e) => onManualEntryChange({ contact_email: e.target.value })}
                        placeholder="email@example.com (optional)"
                        disabled={isDisabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Contact Phone
                      </label>
                      <Input
                        type="tel"
                        value={manualEntry.contact_phone}
                        onChange={(e) => onManualEntryChange({ contact_phone: e.target.value })}
                        placeholder="e.g. 021 123 4567 (optional)"
                        disabled={isDisabled}
                      />
                    </div>

                    {/* Company Information */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Company Name
                      </label>
                      <Input
                        value={manualEntry.company_name}
                        onChange={(e) => onManualEntryChange({ company_name: e.target.value })}
                        placeholder="Legal company name (optional)"
                        disabled={isDisabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Company Number
                      </label>
                      <Input
                        value={manualEntry.company_number}
                        onChange={(e) => onManualEntryChange({ company_number: e.target.value })}
                        placeholder="e.g. 1234567 (optional)"
                        disabled={isDisabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        GST Number
                      </label>
                      <Input
                        value={manualEntry.gst_number}
                        onChange={(e) => onManualEntryChange({ gst_number: e.target.value })}
                        placeholder="e.g. 123-456-789 (optional)"
                        disabled={isDisabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        NZBN
                      </label>
                      <Input
                        value={manualEntry.nzbn}
                        onChange={(e) => onManualEntryChange({ nzbn: e.target.value })}
                        placeholder="13-digit NZ Business Number (optional)"
                        disabled={isDisabled}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={onManualEntrySubmit}
                      disabled={isDisabled || !manualEntry.contact_name.trim()}
                    >
                      {isSubmittingManual ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Save & Skip Search
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowManualEntry(false)}
                      disabled={isDisabled}
                    >
                      Back to Search
                    </Button>
                  </div>
                </>
              )}
            </div>
            </CollapsibleContent>
          </TableCell>
        </TableRow>
      </Collapsible>
    </>
  );
}

export function ContactSearchRetryView({
  batchId,
  jobs,
  onComplete,
}: ContactSearchRetryViewProps) {
  const retrySearchMutation = useRetryStep2Search();
  const skipWithManualEntryMutation = useSkipWithManualEntry();

  // Filter jobs that need Step 2 retry (action_required on step 2 AND no candidates found)
  // If candidates exist, they should go to CompanySelectionView instead
  const pendingJobs = useMemo(() => {
    return jobs.filter((job) => {
      const step2 = job.steps?.find((s) => s.step_number === 2);
      const hasCandidates = job.company_candidates && job.company_candidates.length > 0;
      // Only show in retry view if Step 2 action_required AND no candidates found
      return step2?.status === 'action_required' && !hasCandidates;
    });
  }, [jobs]);

  // Search parameters per job - pre-cleaned so user sees what will actually be searched
  const [searchParams, setSearchParams] = useState<Record<string, { restaurant_name: string; street: string; city: string }>>(() => {
    const initial: Record<string, { restaurant_name: string; street: string; city: string }> = {};
    pendingJobs.forEach((job) => {
      initial[job.id] = {
        restaurant_name: cleanRestaurantName(job.restaurant?.name || ''),
        street: parseStreetFromAddress(job.restaurant?.address || ''),
        city: job.restaurant?.city || '',
      };
    });
    return initial;
  });

  // Manual entry details per job
  const [manualEntries, setManualEntries] = useState<Record<string, ManualEntryDetails>>(() => {
    const initial: Record<string, ManualEntryDetails> = {};
    pendingJobs.forEach((job) => {
      initial[job.id] = {
        contact_name: '',
        full_legal_name: '',
        contact_email: '',
        contact_phone: '',
        company_name: '',
        company_number: '',
        gst_number: '',
        nzbn: '',
      };
    });
    return initial;
  });

  // Expanded state
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(() => {
    // Auto-expand all jobs that need retry
    return new Set(pendingJobs.map(j => j.id));
  });

  // Track which job is currently retrying
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  // Track which job is currently submitting manual entry
  const [submittingManualJobId, setSubmittingManualJobId] = useState<string | null>(null);

  const handleSearchParamsChange = (jobId: string, params: Partial<{ restaurant_name: string; street: string; city: string }>) => {
    setSearchParams((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], ...params },
    }));
  };

  const handleManualEntryChange = (jobId: string, params: Partial<ManualEntryDetails>) => {
    setManualEntries((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], ...params },
    }));
  };

  const handleRetry = async (jobId: string) => {
    setRetryingJobId(jobId);
    try {
      await retrySearchMutation.mutateAsync({
        jobId,
        searchParams: searchParams[jobId],
      });
      onComplete();
    } finally {
      setRetryingJobId(null);
    }
  };

  const handleManualEntrySubmit = async (jobId: string) => {
    setSubmittingManualJobId(jobId);
    try {
      await skipWithManualEntryMutation.mutateAsync({
        jobId,
        manualDetails: manualEntries[jobId],
      });
      onComplete();
    } finally {
      setSubmittingManualJobId(null);
    }
  };

  const toggleExpanded = (jobId: string) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedJobIds(new Set(pendingJobs.map(j => j.id)));
  };

  const collapseAll = () => {
    setExpandedJobIds(new Set());
  };

  const allExpanded = useMemo(() => {
    return pendingJobs.length > 0 && pendingJobs.every(job => expandedJobIds.has(job.id));
  }, [pendingJobs, expandedJobIds]);

  const handleExpandCollapseAll = () => {
    if (allExpanded) {
      collapseAll();
    } else {
      expandAll();
    }
  };

  if (pendingJobs.length === 0) {
    return null;
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-yellow-600" />
            <CardTitle className="text-lg">Step 2: Contact Details Search - Retry Required</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExpandCollapseAll}
              className="h-8"
            >
              {allExpanded ? (
                <>
                  <ChevronsDownUp className="h-4 w-4 mr-2" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronsUpDown className="h-4 w-4 mr-2" />
                  Expand All
                </>
              )}
            </Button>
            <Badge variant="outline" className="text-yellow-600 border-yellow-300">
              {pendingJobs.length} need retry
            </Badge>
          </div>
        </div>
        <CardDescription>
          No matching companies were found for these restaurants. Edit the search parameters and retry.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-32">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingJobs.map((job) => (
                <RestaurantRetryRow
                  key={job.id}
                  job={job}
                  searchParams={searchParams[job.id] || { restaurant_name: '', street: '', city: '' }}
                  onSearchParamsChange={(params) => handleSearchParamsChange(job.id, params)}
                  onRetry={() => handleRetry(job.id)}
                  isRetrying={retryingJobId === job.id}
                  manualEntry={manualEntries[job.id] || { contact_name: '', full_legal_name: '', contact_email: '', contact_phone: '', company_name: '', company_number: '', gst_number: '', nzbn: '' }}
                  onManualEntryChange={(params) => handleManualEntryChange(job.id, params)}
                  onManualEntrySubmit={() => handleManualEntrySubmit(job.id)}
                  isSubmittingManual={submittingManualJobId === job.id}
                  isExpanded={expandedJobIds.has(job.id)}
                  onToggleExpand={() => toggleExpanded(job.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default ContactSearchRetryView;
