import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { CheckCircle, XCircle, Loader2, Circle, SkipForward, RotateCw } from 'lucide-react';
import type { StepResult, ExecutionPhase } from '../../hooks/useYoloModeExecution';
import { EXECUTION_STEPS } from '../../hooks/useYoloModeExecution';

interface YoloModeProgressProps {
  stepResults: Record<string, StepResult>;
  currentPhase: ExecutionPhase;
}

const PHASE_LABELS: Record<number, string> = {
  1: 'Initial Setup',
  2: 'Configuration',
  3: 'Menu Setup',
  4: 'Finalization',
};

export function YoloModeProgress({ stepResults, currentPhase }: YoloModeProgressProps) {
  const getStepIcon = (stepId: string) => {
    const result = stepResults[stepId];
    if (!result || result.status === 'pending') {
      return <Circle className="h-4 w-4 text-muted-foreground/50" />;
    }
    if (result.status === 'running') {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (result.status === 'retrying') {
      return <RotateCw className="h-4 w-4 animate-spin text-orange-500" />;
    }
    if (result.status === 'completed') {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (result.status === 'failed') {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (result.status === 'skipped') {
      return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    }
    return <Circle className="h-4 w-4 text-muted-foreground/50" />;
  };

  const getStepTextClass = (stepId: string) => {
    const result = stepResults[stepId];
    if (!result || result.status === 'pending') return 'text-muted-foreground';
    if (result.status === 'running') return 'text-blue-500 font-medium';
    if (result.status === 'retrying') return 'text-orange-500 font-medium';
    if (result.status === 'completed') return 'text-foreground';
    if (result.status === 'failed') return 'text-red-500';
    if (result.status === 'skipped') return 'text-muted-foreground';
    return 'text-muted-foreground';
  };

  const getStepDuration = (stepId: string) => {
    const result = stepResults[stepId];
    if (result?.startTime && result?.endTime) {
      const duration = Math.round((result.endTime - result.startTime) / 1000);
      return `${duration}s`;
    }
    return null;
  };

  // Group steps by phase
  const phases = [1, 2, 3, 4].map(phaseNum => ({
    phase: phaseNum,
    label: PHASE_LABELS[phaseNum],
    steps: EXECUTION_STEPS.filter(s => s.phase === phaseNum),
    isCurrent: currentPhase === `phase${phaseNum}`,
    isComplete: EXECUTION_STEPS
      .filter(s => s.phase === phaseNum)
      .every(s => {
        const result = stepResults[s.id];
        return result?.status === 'completed' || result?.status === 'skipped';
      }),
  }));

  // Calculate overall progress
  const totalSteps = EXECUTION_STEPS.length;
  const completedSteps = EXECUTION_STEPS.filter(s => {
    const result = stepResults[s.id];
    return result?.status === 'completed' || result?.status === 'skipped';
  }).length;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Overall Progress</span>
          <span className="font-medium">{progressPercent}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Phase cards */}
      {phases.map(phase => (
        <Card
          key={phase.phase}
          className={`transition-all ${
            phase.isCurrent
              ? 'border-blue-500 shadow-sm'
              : phase.isComplete
              ? 'border-green-500/50 bg-green-500/5'
              : ''
          }`}
        >
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Phase {phase.phase}: {phase.label}
              </CardTitle>
              {phase.isCurrent && (
                <Badge variant="default" className="text-xs">
                  Running
                </Badge>
              )}
              {phase.isComplete && !phase.isCurrent && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                  Complete
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="py-2 px-3">
            <div className="space-y-1">
              {phase.steps.map(step => {
                const result = stepResults[step.id];
                const duration = getStepDuration(step.id);

                return (
                  <div
                    key={step.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {getStepIcon(step.id)}
                      <span className={getStepTextClass(step.id)}>
                        {step.label}
                      </span>
                      {/* Show retry badge when retrying */}
                      {result?.status === 'retrying' && result.retryCount !== undefined && (
                        <Badge variant="outline" className="text-xs text-orange-500 border-orange-500 py-0 px-1">
                          Retry {result.retryCount}/3
                        </Badge>
                      )}
                      {/* Show retry count on failure */}
                      {result?.status === 'failed' && result.retryCount !== undefined && result.retryCount > 0 && (
                        <Badge variant="outline" className="text-xs text-red-500 border-red-500 py-0 px-1">
                          Failed after {result.retryCount} retries
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {duration && (
                        <span className="text-xs text-muted-foreground">
                          {duration}
                        </span>
                      )}
                      {result?.error && result.status === 'failed' && (
                        <span
                          className="text-xs text-red-400 max-w-[150px] truncate"
                          title={result.error}
                        >
                          {result.error}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
