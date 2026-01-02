import { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  Linkedin,
  Mail,
  User,
  Newspaper,
  Sparkles,
} from 'lucide-react';

import {
  RegistrationJob,
  CompanyCandidate,
  useCompleteRegistrationStep,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';

// ============================================================================
// URL UTILITIES
// ============================================================================

/**
 * Build Companies Office detail URL for a company
 * Mirrors the backend logic in companies-office-batch-service.js
 */
function buildCompaniesOfficeUrl(companyNumber: string): string {
  return `https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/${companyNumber}/detail`;
}

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

interface CompanySelectionViewProps {
  batchId: string;
  jobs: RegistrationJob[];
  onComplete: () => void;
}

// Company candidate card for detailed selection
function CompanyCandidateCard({
  candidate,
  isSelected,
  onToggle,
}: {
  candidate: CompanyCandidate;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const handleViewOnCompaniesOffice = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection when clicking the button
    window.open(buildCompaniesOfficeUrl(candidate.company_number), '_blank');
  };

  return (
    <div
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-all',
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
          : 'border-border hover:border-blue-300 hover:bg-muted/50'
      )}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{candidate.company_name}</span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span>#{candidate.company_number}</span>
            <Badge
              variant={candidate.status === 'Registered' ? 'default' : 'secondary'}
              className={cn(
                'text-xs',
                candidate.status === 'Registered' && 'bg-green-500'
              )}
            >
              {candidate.status}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Match: {candidate.match_source}
            </Badge>
          </div>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 mt-2 text-xs text-blue-600 hover:text-blue-800"
            onClick={handleViewOnCompaniesOffice}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View on Companies Office
          </Button>
        </div>
        {isSelected && (
          <CheckCircle2 className="h-5 w-5 text-blue-500" />
        )}
      </div>
    </div>
  );
}

// Manual entry details type
interface ManualEntryDetails {
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  company_name?: string;
  company_number?: string;
  gst_number?: string;
  nzbn?: string;
  full_legal_name?: string;
}

// Restaurant selection row with retry capability
function RestaurantSelectionRow({
  job,
  selection,
  onSelectionChange,
  isExpanded,
  onToggleExpand,
  retrySearchParams,
  onRetryParamsChange,
  onRetrySearch,
  isRetrying,
  manualEntryDetails,
  onManualDetailsChange,
}: {
  job: RegistrationJob;
  selection: string | null;
  onSelectionChange: (companyNumber: string | null) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  retrySearchParams: { restaurant_name: string; street: string; city: string };
  onRetryParamsChange: (params: { restaurant_name?: string; street?: string; city?: string }) => void;
  onRetrySearch: () => void;
  isRetrying: boolean;
  manualEntryDetails: ManualEntryDetails;
  onManualDetailsChange: (details: Partial<ManualEntryDetails>) => void;
}) {
  const candidates = job.company_candidates || [];
  const hasMultipleCandidates = candidates.length > 1;
  const hasSingleCandidate = candidates.length === 1;
  const noCandidates = candidates.length === 0;
  const selectedCandidate = candidates.find(c => c.company_number === selection);

  // Single candidate rows are expandable when skip or retry is selected (to show forms)
  const singleCandidateNeedsExpand = hasSingleCandidate && (selection === 'skip' || selection === 'retry');
  const isExpandable = hasMultipleCandidates || noCandidates || singleCandidateNeedsExpand;

  return (
    <>
      <TableRow className={cn(isExpandable && 'cursor-pointer')}>
        <TableCell onClick={isExpandable ? onToggleExpand : undefined}>
          {isExpandable && (
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                !isExpanded && "-rotate-90"
              )}
            />
          )}
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
          <Badge variant="secondary">{candidates.length} found</Badge>
        </TableCell>
        <TableCell>
          {candidates.length === 0 ? (
            <span className="text-muted-foreground text-sm">No companies found</span>
          ) : candidates.length === 1 ? (
            // Single candidate - auto-select with options for skip/retry
            <div className="flex items-center gap-2">
              <Select
                value={selection || ''}
                onValueChange={(value) => {
                  onSelectionChange(value || null);
                  // Auto-expand when skip or retry is selected
                  if ((value === 'skip' || value === 'retry') && !isExpanded) {
                    onToggleExpand();
                  }
                }}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={candidates[0].company_number}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {candidates[0].company_name}
                    </div>
                  </SelectItem>
                  <SelectItem value="retry">
                    <div className="flex items-center gap-2 text-yellow-600">
                      <RefreshCw className="h-4 w-4" />
                      Retry search
                    </div>
                  </SelectItem>
                  <SelectItem value="skip">
                    <div className="flex items-center gap-2 text-orange-500">
                      <AlertCircle className="h-4 w-4" />
                      Skip - Enter manually
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            // Multiple candidates - show selected or prompt to expand
            <div className="flex items-center gap-2">
              {selectedCandidate ? (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedCandidate.company_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {selectedCandidate.status}
                  </Badge>
                </div>
              ) : selection === 'skip' ? (
                <span className="text-muted-foreground">Skipped</span>
              ) : selection === 'retry' ? (
                <span className="text-yellow-600">Retrying search...</span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleExpand}
                >
                  Select company...
                </Button>
              )}
            </div>
          )}
        </TableCell>
        <TableCell>
          {selection && selection !== 'skip' && selection !== 'retry' && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
          {selection === 'skip' && (
            <Badge variant="outline">Skipped</Badge>
          )}
          {selection === 'retry' && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-300">Retry</Badge>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded selection panel */}
      <Collapsible open={isExpanded && hasMultipleCandidates} asChild>
        <TableRow className="bg-muted/30 border-0">
          <TableCell colSpan={5} className="p-0">
            <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
              <div className="p-4 space-y-3">
                <p className="text-sm font-medium">
                Select the correct company for {job.restaurant?.name || job.restaurant_name}:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {candidates.map((candidate) => (
                  <CompanyCandidateCard
                    key={candidate.company_number}
                    candidate={candidate}
                    isSelected={selection === candidate.company_number}
                    onToggle={() => {
                      // Toggle: deselect if already selected, otherwise select
                      if (selection === candidate.company_number) {
                        onSelectionChange(null);
                      } else {
                        onSelectionChange(candidate.company_number);
                      }
                    }}
                  />
                ))}
                {/* Retry search option */}
                <div
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    selection === 'retry'
                      ? 'border-yellow-500 bg-yellow-50 ring-1 ring-yellow-500'
                      : 'border-border hover:border-yellow-300 hover:bg-muted/50'
                  )}
                  onClick={() => {
                    // Toggle: deselect if already selected, otherwise select retry
                    if (selection === 'retry') {
                      onSelectionChange(null);
                    } else {
                      onSelectionChange('retry');
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-yellow-600" />
                    <span className="font-medium">Retry Search</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Search again with different parameters
                  </p>
                </div>

                {/* Skip option with manual entry */}
                <div
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    selection === 'skip'
                      ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500'
                      : 'border-border hover:border-orange-300 hover:bg-muted/50'
                  )}
                  onClick={() => {
                    // Toggle: deselect if already selected, otherwise select skip
                    if (selection === 'skip') {
                      onSelectionChange(null);
                    } else {
                      onSelectionChange('skip');
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">Skip - Enter details manually</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter contact details manually if no company match
                  </p>
                </div>
              </div>

              {/* Retry search form when retry is selected */}
              {selection === 'retry' && (
                <div className="mt-4 p-4 border rounded-lg bg-yellow-50/50 space-y-4">
                  <p className="text-sm font-medium text-yellow-700">
                    Edit search parameters and retry:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Restaurant/Company Name
                      </label>
                      <Input
                        value={retrySearchParams.restaurant_name}
                        onChange={(e) => onRetryParamsChange({ restaurant_name: e.target.value })}
                        placeholder="Company/Restaurant name"
                        disabled={isRetrying}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Street Address
                      </label>
                      <Input
                        value={retrySearchParams.street}
                        onChange={(e) => onRetryParamsChange({ street: e.target.value })}
                        placeholder="Street address"
                        disabled={isRetrying}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        City
                      </label>
                      <Input
                        value={retrySearchParams.city}
                        onChange={(e) => onRetryParamsChange({ city: e.target.value })}
                        placeholder="City"
                        disabled={isRetrying}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetrySearch();
                      }}
                      disabled={isRetrying}
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
                  </div>
                </div>
              )}

              {/* Manual entry form when skip is selected */}
              {selection === 'skip' && (
                <div className="mt-4 p-4 border rounded-lg bg-orange-50/50 space-y-4">
                  <p className="text-sm font-medium text-orange-700">
                    Enter contact details manually:
                  </p>

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
                        onClick={(e) => {
                          e.stopPropagation();
                          const query = encodeURIComponent(job.restaurant?.name || '');
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
                        onClick={(e) => {
                          e.stopPropagation();
                          const query = encodeURIComponent(`${job.restaurant?.name || ''} ${job.restaurant?.city || ''} owner LinkedIn`);
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
                        onClick={(e) => {
                          e.stopPropagation();
                          const query = encodeURIComponent(`${job.restaurant?.name || ''} ${job.restaurant?.city || ''} owner email address`);
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
                        onClick={(e) => {
                          e.stopPropagation();
                          const query = encodeURIComponent(`${job.restaurant?.name || ''} ${job.restaurant?.city || ''} owner`);
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
                        onClick={(e) => {
                          e.stopPropagation();
                          const query = encodeURIComponent(`${job.restaurant?.name || ''} ${job.restaurant?.city || ''} owner`);
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
                        onClick={(e) => {
                          e.stopPropagation();
                          const query = encodeURIComponent(`What is the name of the owner of ${job.restaurant?.name || ''} ${job.restaurant?.city || ''} and what is the NZBN of the company behind this business and is there a publicly available email for contacting the business or their owners?`);
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
                        value={manualEntryDetails.contact_name}
                        onChange={(e) => onManualDetailsChange({ contact_name: e.target.value })}
                        placeholder="Owner/Director name (required)"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Full Legal Name
                      </label>
                      <Input
                        value={manualEntryDetails.full_legal_name || ''}
                        onChange={(e) => onManualDetailsChange({ full_legal_name: e.target.value })}
                        placeholder="Full legal name if different (optional)"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Contact Email
                      </label>
                      <Input
                        type="email"
                        value={manualEntryDetails.contact_email || ''}
                        onChange={(e) => onManualDetailsChange({ contact_email: e.target.value })}
                        placeholder="email@example.com (optional)"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Contact Phone
                      </label>
                      <Input
                        type="tel"
                        value={manualEntryDetails.contact_phone || ''}
                        onChange={(e) => onManualDetailsChange({ contact_phone: e.target.value })}
                        placeholder="e.g. 021 123 4567 (optional)"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Company Information */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Company Name
                      </label>
                      <Input
                        value={manualEntryDetails.company_name || ''}
                        onChange={(e) => onManualDetailsChange({ company_name: e.target.value })}
                        placeholder="Legal company name (optional)"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Company Number
                      </label>
                      <Input
                        value={manualEntryDetails.company_number || ''}
                        onChange={(e) => onManualDetailsChange({ company_number: e.target.value })}
                        placeholder="e.g. 1234567 (optional)"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        GST Number
                      </label>
                      <Input
                        value={manualEntryDetails.gst_number || ''}
                        onChange={(e) => onManualDetailsChange({ gst_number: e.target.value })}
                        placeholder="e.g. 123-456-789 (optional)"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        NZBN
                      </label>
                      <Input
                        value={manualEntryDetails.nzbn || ''}
                        onChange={(e) => onManualDetailsChange({ nzbn: e.target.value })}
                        placeholder="13-digit NZ Business Number (optional)"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                </div>
              )}
              </div>
            </CollapsibleContent>
          </TableCell>
        </TableRow>
      </Collapsible>

      {/* Expanded panel for single candidate - when skip or retry is selected */}
      <Collapsible open={isExpanded && hasSingleCandidate && (selection === 'skip' || selection === 'retry')} asChild>
        <TableRow className={cn(
          "border-0 transition-colors duration-200",
          selection === 'retry' ? 'bg-yellow-50/50' : 'bg-orange-50/50'
        )}>
          <TableCell colSpan={5} className="p-0">
            <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
              <div className="p-4 space-y-4">
                {/* Retry search form when retry is selected */}
                {selection === 'retry' && (
                  <>
                <div className="flex items-center gap-2 text-yellow-700">
                    <RefreshCw className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Edit search parameters and retry:
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Restaurant/Company Name
                      </label>
                      <Input
                        value={retrySearchParams.restaurant_name}
                        onChange={(e) => onRetryParamsChange({ restaurant_name: e.target.value })}
                        placeholder="Company/Restaurant name"
                        disabled={isRetrying}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Street Address
                      </label>
                      <Input
                        value={retrySearchParams.street}
                        onChange={(e) => onRetryParamsChange({ street: e.target.value })}
                        placeholder="Street address"
                        disabled={isRetrying}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        City
                      </label>
                      <Input
                        value={retrySearchParams.city}
                        onChange={(e) => onRetryParamsChange({ city: e.target.value })}
                        placeholder="City"
                        disabled={isRetrying}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={onRetrySearch}
                      disabled={isRetrying}
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
                  </div>
                  </>
                )}

                {/* Manual entry form when skip is selected */}
                {selection === 'skip' && (
                  <>
                <div className="flex items-center gap-2 text-orange-700">
                    <AlertCircle className="h-4 w-4" />
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
                        onClick={(e) => {
                          e.stopPropagation();
                          const query = encodeURIComponent(job.restaurant?.name || '');
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
                        onClick={(e) => {
                          e.stopPropagation();
                          const query = encodeURIComponent(`${job.restaurant?.name || ''} ${job.restaurant?.city || ''} owner LinkedIn`);
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
                        onClick={(e) => {
                          e.stopPropagation();
                          const query = encodeURIComponent(`${job.restaurant?.name || ''} ${job.restaurant?.city || ''} owner email address`);
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
                        onClick={(e) => {
                          e.stopPropagation();
                          const query = encodeURIComponent(`${job.restaurant?.name || ''} ${job.restaurant?.city || ''} owner`);
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
                        onClick={(e) => {
                          e.stopPropagation();
                          const query = encodeURIComponent(`What is the name of the owner of ${job.restaurant?.name || ''} ${job.restaurant?.city || ''} and what is the NZBN of the company behind this business and is there a publicly available email for contacting the business or their owners?`);
                          window.open(`https://www.google.com/search?udm=50&q=${query}`, '_blank');
                        }}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI Search
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>

                  {/* Manual entry form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Contact Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={manualEntryDetails.contact_name || ''}
                        onChange={(e) => onManualDetailsChange({ contact_name: e.target.value })}
                        placeholder="e.g. John Smith"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Full Legal Name
                      </label>
                      <Input
                        value={manualEntryDetails.full_legal_name || ''}
                        onChange={(e) => onManualDetailsChange({ full_legal_name: e.target.value })}
                        placeholder="e.g. John Edward Smith (optional)"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Contact Email
                      </label>
                      <Input
                        value={manualEntryDetails.contact_email || ''}
                        onChange={(e) => onManualDetailsChange({ contact_email: e.target.value })}
                        placeholder="email@example.com (optional)"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Contact Phone
                      </label>
                      <Input
                        value={manualEntryDetails.contact_phone || ''}
                        onChange={(e) => onManualDetailsChange({ contact_phone: e.target.value })}
                        placeholder="+64 21 123 4567 (optional)"
                      />
                    </div>
                  </div>

                  {/* Optional company details */}
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">
                      Optional company details (if found):
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Company Name
                        </label>
                        <Input
                          value={manualEntryDetails.company_name || ''}
                          onChange={(e) => onManualDetailsChange({ company_name: e.target.value })}
                          placeholder="Legal company name (optional)"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Company Number
                        </label>
                        <Input
                          value={manualEntryDetails.company_number || ''}
                          onChange={(e) => onManualDetailsChange({ company_number: e.target.value })}
                          placeholder="e.g. 1234567 (optional)"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          GST Number
                        </label>
                        <Input
                          value={manualEntryDetails.gst_number || ''}
                          onChange={(e) => onManualDetailsChange({ gst_number: e.target.value })}
                          placeholder="e.g. 123-456-789 (optional)"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          NZBN
                        </label>
                        <Input
                          value={manualEntryDetails.nzbn || ''}
                          onChange={(e) => onManualDetailsChange({ nzbn: e.target.value })}
                          placeholder="13-digit NZ Business Number (optional)"
                        />
                      </div>
                    </div>
                  </div>
                  </>
                )}
              </div>
            </CollapsibleContent>
          </TableCell>
        </TableRow>
      </Collapsible>

      {/* Expanded retry panel - when no candidates found */}
      <Collapsible open={isExpanded && noCandidates} asChild>
        <TableRow className="bg-yellow-50/50 border-0">
          <TableCell colSpan={5} className="p-0">
            <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
              <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 text-yellow-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  No companies found. Edit search parameters and retry:
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Restaurant Name
                  </label>
                  <Input
                    value={retrySearchParams.restaurant_name}
                    onChange={(e) => onRetryParamsChange({ restaurant_name: e.target.value })}
                    placeholder="Company/Restaurant name"
                    disabled={isRetrying}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Street Address
                  </label>
                  <Input
                    value={retrySearchParams.street}
                    onChange={(e) => onRetryParamsChange({ street: e.target.value })}
                    placeholder="Street address"
                    disabled={isRetrying}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    City
                  </label>
                  <Input
                    value={retrySearchParams.city}
                    onChange={(e) => onRetryParamsChange({ city: e.target.value })}
                    placeholder="City"
                    disabled={isRetrying}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetrySearch}
                  disabled={isRetrying}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectionChange('skip')}
                  disabled={isRetrying}
                >
                  Skip this restaurant
                </Button>
              </div>

              {/* Search Links for manual research */}
              <div className="bg-muted/50 rounded-md p-3 space-y-2 mt-4">
                <p className="text-xs text-muted-foreground">
                  Search for company and contact information:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const query = encodeURIComponent(job.restaurant?.name || '');
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
                      const query = encodeURIComponent(`${job.restaurant?.name || ''} ${job.restaurant?.city || ''} owner LinkedIn`);
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
                      const query = encodeURIComponent(`${job.restaurant?.name || ''} ${job.restaurant?.city || ''} owner email address`);
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
                      const query = encodeURIComponent(`${job.restaurant?.name || ''} ${job.restaurant?.city || ''} owner`);
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
                      const query = encodeURIComponent(`What is the name of the owner of ${job.restaurant?.name || ''} ${job.restaurant?.city || ''} and what is the NZBN of the company behind this business and is there a publicly available email for contacting the business or their owners?`);
                      window.open(`https://www.google.com/search?udm=50&q=${query}`, '_blank');
                    }}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Search
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
              </div>
            </CollapsibleContent>
          </TableCell>
        </TableRow>
      </Collapsible>
    </>
  );
}

export function CompanySelectionView({
  batchId,
  jobs,
  onComplete,
}: CompanySelectionViewProps) {
  const completeStepMutation = useCompleteRegistrationStep();
  const retrySearchMutation = useRetryStep2Search();
  const skipWithManualEntryMutation = useSkipWithManualEntry();

  // Filter jobs that need company selection
  const pendingJobs = useMemo(() => {
    return jobs.filter((job) => {
      const step3 = job.steps?.find((s) => s.step_number === 3);
      return step3?.status === 'action_required';
    });
  }, [jobs]);

  // Selection state
  const [selections, setSelections] = useState<Record<string, string | null>>(() => {
    // Pre-select single candidates
    const initial: Record<string, string | null> = {};
    pendingJobs.forEach((job) => {
      if (job.company_candidates?.length === 1) {
        initial[job.id] = job.company_candidates[0].company_number;
      }
    });
    return initial;
  });

  // Expanded state for multi-candidate rows
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Retry search parameters per job - pre-cleaned so user sees what will actually be searched
  const [retryParams, setRetryParams] = useState<Record<string, { restaurant_name: string; street: string; city: string }>>(() => {
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

  // Track which job is currently retrying
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  // Manual entry details per job (used when skip is selected)
  const [manualEntryDetails, setManualEntryDetails] = useState<Record<string, ManualEntryDetails>>(() => {
    const initial: Record<string, ManualEntryDetails> = {};
    pendingJobs.forEach((job) => {
      initial[job.id] = {
        contact_name: '',
        contact_email: job.restaurant?.email || '',
        contact_phone: '',
        company_name: '',
        company_number: '',
        gst_number: '',
      };
    });
    return initial;
  });

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    if (!searchQuery) return pendingJobs;
    const query = searchQuery.toLowerCase();
    return pendingJobs.filter((job) =>
      (job.restaurant?.name || job.restaurant_name || '').toLowerCase().includes(query)
    );
  }, [pendingJobs, searchQuery]);

  // Selection handlers
  const handleSelectionChange = (jobId: string, companyNumber: string | null) => {
    setSelections((prev) => ({ ...prev, [jobId]: companyNumber }));
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

  // Retry search handlers
  const handleRetryParamsChange = (jobId: string, params: Partial<{ restaurant_name: string; street: string; city: string }>) => {
    setRetryParams((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], ...params },
    }));
  };

  const handleRetrySearch = async (jobId: string) => {
    setRetryingJobId(jobId);
    try {
      await retrySearchMutation.mutateAsync({
        jobId,
        searchParams: retryParams[jobId],
      });
      // Refresh will happen via onComplete -> refetch
      onComplete();
    } finally {
      setRetryingJobId(null);
    }
  };

  // Manual entry details handlers
  const handleManualDetailsChange = (jobId: string, details: Partial<ManualEntryDetails>) => {
    setManualEntryDetails((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], ...details },
    }));
  };

  // Auto-select all single candidates
  const handleAutoSelect = () => {
    const autoSelections: Record<string, string | null> = { ...selections };
    pendingJobs.forEach((job) => {
      if (job.company_candidates?.length === 1 && !autoSelections[job.id]) {
        autoSelections[job.id] = job.company_candidates[0].company_number;
      }
    });
    setSelections(autoSelections);
  };

  // Submit selections
  const handleSubmit = async () => {
    // Separate skip selections (with manual entry) from company selections
    const skipJobIds: string[] = [];
    // Build object with job_id as key to match API contract
    const companySelections: Record<string, { company_number: string | null }> = {};

    Object.entries(selections).forEach(([jobId, value]) => {
      if (value === null) return;
      if (value === 'skip') {
        skipJobIds.push(jobId);
      } else {
        // Object format: { 'job-uuid': { company_number: '123456' } }
        companySelections[jobId] = {
          company_number: value,
        };
      }
    });

    // Process skip selections with manual entry (these skip Steps 2-4)
    for (const jobId of skipJobIds) {
      const details = manualEntryDetails[jobId];
      if (details?.contact_name) {
        await skipWithManualEntryMutation.mutateAsync({
          jobId,
          manualDetails: details,
        });
      }
    }

    // Process company selections (normal Step 3 completion)
    if (Object.keys(companySelections).length > 0) {
      await completeStepMutation.mutateAsync({
        batchId,
        stepNumber: 3,
        data: { selections: companySelections },
      });
    }

    onComplete();
  };

  // Check if all skip selections have required contact_name
  const allSkipsHaveContactName = useMemo(() => {
    return Object.entries(selections).every(([jobId, value]) => {
      if (value !== 'skip') return true;
      return manualEntryDetails[jobId]?.contact_name?.trim().length > 0;
    });
  }, [selections, manualEntryDetails]);

  // Check completion status (retry doesn't count as a valid selection)
  const selectedCount = Object.values(selections).filter((v) => v !== null && v !== 'retry').length;
  const allSelected = selectedCount === pendingJobs.length;
  const hasRetryPending = Object.values(selections).some((v) => v === 'retry');

  if (pendingJobs.length === 0) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-lg">Step 3: Select Companies</CardTitle>
          </div>
          <Badge variant="outline" className="text-orange-600 border-orange-300">
            {selectedCount}/{pendingJobs.length} selected
          </Badge>
        </div>
        <CardDescription>
          Review and select the correct company entity for each restaurant from Companies Office search results
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search and actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search restaurants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleAutoSelect}>
            Auto-select single matches
          </Button>
        </div>

        {/* Selection table */}
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead className="w-28">Candidates</TableHead>
                <TableHead>Selected Company</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job) => (
                <RestaurantSelectionRow
                  key={job.id}
                  job={job}
                  selection={selections[job.id] || null}
                  onSelectionChange={(value) => handleSelectionChange(job.id, value)}
                  isExpanded={expandedJobIds.has(job.id)}
                  onToggleExpand={() => toggleExpanded(job.id)}
                  retrySearchParams={retryParams[job.id] || { restaurant_name: '', street: '', city: '' }}
                  onRetryParamsChange={(params) => handleRetryParamsChange(job.id, params)}
                  onRetrySearch={() => handleRetrySearch(job.id)}
                  isRetrying={retryingJobId === job.id}
                  manualEntryDetails={manualEntryDetails[job.id] || { contact_name: '' }}
                  onManualDetailsChange={(details) => handleManualDetailsChange(job.id, details)}
                />
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Submit button */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSubmit}
            disabled={!allSelected || !allSkipsHaveContactName || hasRetryPending || completeStepMutation.isPending || skipWithManualEntryMutation.isPending}
          >
            {(completeStepMutation.isPending || skipWithManualEntryMutation.isPending) ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirm All Selections ({selectedCount}/{pendingJobs.length})
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default CompanySelectionView;
