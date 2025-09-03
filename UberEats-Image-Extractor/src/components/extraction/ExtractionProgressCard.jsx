import React from 'react';
import { CheckCircle, Loader2, Clock, AlertCircle, Info } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

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

  const getProgressPercentage = () => {
    if (!progress) return 0;
    
    const phases = [
      'categoriesScanned',
      'itemsExtracted',
      'optionSetsExtracted',
      'imagesValidated',
      'savedToDatabase'
    ];
    
    const completedPhases = phases.filter(phase => progress[phase]).length;
    return (completedPhases / phases.length) * 100;
  };

  const status = extraction?.state || extraction?.status || 'unknown';
  const isInProgress = status === 'running' || status === 'processing' || status === 'in_progress';

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">
              {extraction?.restaurant || 'Extraction Job'}
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
                  {Math.round(getProgressPercentage())}%
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
                <ExtractionPhase
                  name="Scanning Categories"
                  isActive={progress.phase === 'scanning_categories'}
                  isComplete={progress.categoriesScanned}
                  detail={progress.categoriesFound ? `${progress.categoriesFound} found` : null}
                />
                <ExtractionPhase
                  name="Extracting Items"
                  isActive={progress.phase === 'extracting_items'}
                  isComplete={progress.itemsExtracted}
                  detail={progress.itemsFound ? `${progress.itemsFound} items` : null}
                />
                {progress.extractOptionSets && (
                  <ExtractionPhase
                    name="Extracting Option Sets"
                    isActive={progress.phase === 'extracting_options'}
                    isComplete={progress.optionSetsExtracted}
                    detail={progress.optionSetsFound ? `${progress.optionSetsFound} sets` : null}
                  />
                )}
                {progress.validateImages && (
                  <ExtractionPhase
                    name="Validating Images"
                    isActive={progress.phase === 'validating_images'}
                    isComplete={progress.imagesValidated}
                    detail={progress.imagesProcessed ? `${progress.imagesProcessed} validated` : null}
                  />
                )}
                <ExtractionPhase
                  name="Saving to Database"
                  isActive={progress.phase === 'saving_to_database'}
                  isComplete={progress.savedToDatabase}
                />
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
            {extraction?.created_at && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Started</span>
                <span className="text-gray-700">
                  {new Date(extraction.created_at).toLocaleString()}
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