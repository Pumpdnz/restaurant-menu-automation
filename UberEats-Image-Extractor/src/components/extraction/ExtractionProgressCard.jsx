import React from 'react';
import { CheckCircle, Loader2, Clock, AlertCircle, Info } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

// Backend phase order for determining completion
const PHASE_ORDER = [
  'starting',
  'extracting_categories',
  'extracting_items',
  'cleaning_urls',
  'extracting_option_sets',
  'deduplicating_option_sets',
  'validating_images',
  'saving_to_database',
  'completed'
];

export default function ExtractionProgressCard({
  extraction,
  progress,
  isPremium = false,
  showDetails = true
}) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'running':
      case 'processing':
      case 'in_progress':
        return 'text-blue-600 bg-blue-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
      case 'running':
      case 'processing':
      case 'in_progress':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  // Check if a phase is complete by comparing phase order
  const isPhaseComplete = (targetPhase) => {
    if (!progress?.phase) return false;
    const currentIndex = PHASE_ORDER.indexOf(progress.phase);
    const targetIndex = PHASE_ORDER.indexOf(targetPhase);
    return currentIndex > targetIndex;
  };

  // Check if a phase is currently active
  const isPhaseActive = (phases) => {
    if (!progress?.phase) return false;
    const phaseArray = Array.isArray(phases) ? phases : [phases];
    return phaseArray.includes(progress.phase);
  };

  // Calculate progress percentage based on backend phases
  const getProgressPercentage = () => {
    if (!progress?.phase) return 0;

    const currentIndex = PHASE_ORDER.indexOf(progress.phase);
    if (currentIndex === -1) return 0;

    // completed phase is at the end, so we calculate based on position
    return Math.round((currentIndex / (PHASE_ORDER.length - 1)) * 100);
  };

  const status = extraction?.state || extraction?.status || 'unknown';
  const isInProgress = status === 'running' || status === 'processing' || status === 'in_progress';

  // Determine which optional phases are enabled (from extraction data or progress)
  // Show option sets phase if: explicitly enabled, has extracted count, or currently in option sets phase
  const isInOptionSetsPhase = isPhaseActive(['extracting_option_sets', 'deduplicating_option_sets']) ||
    isPhaseComplete('deduplicating_option_sets');
  const extractOptionSets = extraction?.extractOptionSets ??
    extraction?.extracted_data?.extractOptionSets ??
    (progress?.optionSetsExtracted > 0 || isInOptionSetsPhase || true); // Default to showing if we can't determine

  const validateImages = extraction?.validateImages ??
    extraction?.extracted_data?.validateImages ??
    false;

  // Build detail string for items phase - show both count and current category
  const getItemsDetail = () => {
    const parts = [];
    if (progress?.itemsExtracted > 0) {
      parts.push(`${progress.itemsExtracted} items`);
    }
    if (progress?.currentCategory && isPhaseActive(['extracting_items', 'cleaning_urls'])) {
      parts.push(`Processing: ${progress.currentCategory}`);
    }
    return parts.length > 0 ? parts.join(' • ') : null;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">
              {extraction?.restaurant || extraction?.restaurantName || 'Extraction Job'}
            </CardTitle>
            {isPremium && (
              <Badge variant="secondary" className="text-xs">
                Premium
              </Badge>
            )}
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
            {getStatusIcon(status)}
            <span className="capitalize">{status}</span>
          </div>
        </div>
        <CardDescription>
          {extraction?.url || 'No URL provided'}
        </CardDescription>
      </CardHeader>

      {showDetails && (
        <CardContent className="space-y-4">
          {/* Progress Bar for Premium Extraction */}
          {isPremium && isInProgress && progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Progress</span>
                <span className="text-gray-900 font-medium">
                  {getProgressPercentage()}%
                </span>
              </div>
              <Progress value={getProgressPercentage()} className="h-2" />
            </div>
          )}

          {/* Premium Extraction Phases */}
          {isPremium && progress && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Extraction Phases</h4>
              <div className="space-y-1.5">
                {/* Phase 1: Extracting Categories */}
                <ExtractionPhase
                  name="Scanning Categories"
                  isActive={isPhaseActive('extracting_categories')}
                  isComplete={isPhaseComplete('extracting_categories')}
                  detail={progress.categoriesExtracted > 0 ? `${progress.categoriesExtracted} found` : null}
                />

                {/* Phase 2: Extracting Items */}
                <ExtractionPhase
                  name="Extracting Items"
                  isActive={isPhaseActive(['extracting_items', 'cleaning_urls'])}
                  isComplete={isPhaseComplete('cleaning_urls')}
                  detail={getItemsDetail()}
                />

                {/* Phase 3: Option Sets (conditional) */}
                {extractOptionSets && (
                  <ExtractionPhase
                    name="Extracting Option Sets"
                    isActive={isPhaseActive(['extracting_option_sets', 'deduplicating_option_sets'])}
                    isComplete={isPhaseComplete('deduplicating_option_sets')}
                    detail={progress.optionSetsExtracted > 0 ? `${progress.optionSetsExtracted} sets` : null}
                  />
                )}

                {/* Phase 4: Image Validation (conditional) */}
                {validateImages && (
                  <ExtractionPhase
                    name="Validating Images"
                    isActive={isPhaseActive('validating_images')}
                    isComplete={isPhaseComplete('validating_images')}
                    detail={progress.imagesValidated > 0 ? `${progress.imagesValidated} validated` : null}
                  />
                )}

                {/* Phase 5: Saving to Database */}
                <ExtractionPhase
                  name="Saving to Database"
                  isActive={isPhaseActive('saving_to_database')}
                  isComplete={progress.savedToDatabase === true || isPhaseComplete('saving_to_database')}
                />
              </div>
            </div>
          )}

          {/* Standard Extraction Progress - show current category and items count */}
          {!isPremium && isInProgress && progress && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Extraction Progress</h4>
              <div className="space-y-1.5">
                {progress.currentCategory && (
                  <div className="flex items-center justify-between py-1.5 px-2 rounded bg-blue-50">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
                      <span className="text-sm text-blue-700 font-medium">
                        Processing: {progress.currentCategory}
                      </span>
                    </div>
                  </div>
                )}
                {progress.itemsExtracted > 0 && (
                  <div className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50">
                    <span className="text-sm text-gray-600">Items extracted</span>
                    <span className="text-sm font-medium text-gray-900">{progress.itemsExtracted}</span>
                  </div>
                )}
                {progress.categoriesExtracted > 0 && (
                  <div className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50">
                    <span className="text-sm text-gray-600">Categories found</span>
                    <span className="text-sm font-medium text-gray-900">{progress.categoriesExtracted}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Extraction Details */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Job ID</span>
              <span className="font-mono text-xs text-gray-700">
                {extraction?.id || 'N/A'}
              </span>
            </div>
            {(extraction?.created_at || extraction?.startTime) && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Started</span>
                <span className="text-gray-700">
                  {new Date(extraction.created_at || extraction.startTime).toLocaleString()}
                </span>
              </div>
            )}
            {extraction?.menuId && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Menu ID</span>
                <span className="font-mono text-xs text-gray-700">
                  {extraction.menuId}
                </span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {status === 'failed' && extraction?.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{extraction.error}</p>
            </div>
          )}

          {/* Processing Message */}
          {isInProgress && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                {isPremium
                  ? 'Premium extraction with option sets in progress. This typically takes 2-5 minutes.'
                  : 'Extraction in progress. This typically takes 1-3 minutes.'}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function ExtractionPhase({ name, isActive, isComplete, detail }) {
  return (
    <div className={`flex items-center justify-between py-1.5 px-2 rounded ${
      isActive ? 'bg-blue-50' : isComplete ? 'bg-green-50' : 'bg-gray-50'
    }`}>
      <div className="flex items-center gap-2">
        {isActive ? (
          <Loader2 className="h-3 w-3 text-blue-600 animate-spin" />
        ) : isComplete ? (
          <CheckCircle className="h-3 w-3 text-green-600" />
        ) : (
          <div className="h-3 w-3 rounded-full border-2 border-gray-300" />
        )}
        <span className={`text-sm ${
          isActive ? 'text-blue-700 font-medium' :
          isComplete ? 'text-green-700' : 'text-gray-500'
        }`}>
          {name}
        </span>
      </div>
      {detail && (
        <span className="text-xs text-gray-600">{detail}</span>
      )}
    </div>
  );
}
