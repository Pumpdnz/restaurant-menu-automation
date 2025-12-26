import { useState, useCallback, useRef, useEffect } from 'react';
import api from '../services/api';
import type { YoloModeFormData, Restaurant } from '../components/registration/YoloModeDialog';

// Step status types
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'retrying';

export interface StepResult {
  status: StepStatus;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
  retryCount?: number;
}

export interface ExecutionResults {
  phase1: {
    account?: StepResult;
    codeGeneration?: StepResult;
    onboardingUser?: StepResult;
    imageUpload?: StepResult;
  };
  phase2: {
    restaurant?: StepResult;
    website?: StepResult;
    services?: StepResult;
    payment?: StepResult;
    menu?: StepResult;
    onboardingSync?: StepResult;
  };
  phase3: {
    optionSets?: StepResult;
  };
  phase4: {
    itemTags?: StepResult;
  };
}

export type ExecutionPhase = 'phase1' | 'phase2' | 'phase3' | 'phase4' | null;
export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

// Polling configuration
const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_DURATION = 30 * 60 * 1000; // 30 minutes

// Step definitions for progress display
export const EXECUTION_STEPS = [
  { id: 'account', label: 'Account Registration', phase: 1, backendId: 'cloudwaitressAccount' },
  { id: 'codeGeneration', label: 'Code Generation', phase: 1, backendId: 'codeGeneration' },
  { id: 'onboardingUser', label: 'Onboarding User', phase: 1, conditional: true, backendId: 'createOnboardingUser' },
  { id: 'imageUpload', label: 'Image Upload', phase: 1, conditional: true, backendId: 'uploadImages' },
  { id: 'restaurant', label: 'Restaurant Registration', phase: 2, backendId: 'restaurantRegistration' },
  { id: 'website', label: 'Website Configuration', phase: 2, backendId: 'websiteConfig' },
  { id: 'services', label: 'Services Configuration', phase: 2, backendId: 'servicesConfig' },
  { id: 'payment', label: 'Payment Configuration', phase: 2, backendId: 'paymentConfig' },
  { id: 'menu', label: 'Menu Import', phase: 2, backendId: 'menuImport' },
  { id: 'onboardingSync', label: 'Onboarding Sync', phase: 2, conditional: true, backendId: 'syncOnboardingUser' },
  { id: 'optionSets', label: 'Option Sets', phase: 3, conditional: true, backendId: 'optionSets' },
  { id: 'itemTags', label: 'Item Tags', phase: 4, conditional: true, backendId: 'itemTags' },
] as const;

// Map backend sub-step names to frontend step IDs
const BACKEND_TO_FRONTEND_STEP_MAP: Record<string, string> = {
  cloudwaitressAccount: 'account',
  codeGeneration: 'codeGeneration',
  createOnboardingUser: 'onboardingUser',
  uploadImages: 'imageUpload',
  restaurantRegistration: 'restaurant',
  websiteConfig: 'website',
  servicesConfig: 'services',
  paymentConfig: 'payment',
  menuImport: 'menu',
  syncOnboardingUser: 'onboardingSync',
  optionSets: 'optionSets',
  itemTags: 'itemTags',
};

export function useYoloModeExecution() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('idle');
  const [currentPhase, setCurrentPhase] = useState<ExecutionPhase>(null);
  const [stepResults, setStepResults] = useState<Record<string, StepResult>>({});
  const [jobId, setJobId] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);
  const restaurantIdRef = useRef<string | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Convert backend phase structure to frontend step results
  const convertPhasesToStepResults = useCallback((phases: Record<string, any>): Record<string, StepResult> => {
    const results: Record<string, StepResult> = {};

    Object.values(phases).forEach((phase: any) => {
      if (phase?.sub_steps) {
        Object.entries(phase.sub_steps).forEach(([backendStepName, step]: [string, any]) => {
          // Map backend step name to frontend step ID
          const frontendStepId = BACKEND_TO_FRONTEND_STEP_MAP[backendStepName] || backendStepName;

          // Map backend status to frontend status
          // Backend uses 'in_progress', frontend uses 'running'
          let status: StepStatus;
          const backendStatus = step.status as string;
          if (backendStatus === 'in_progress') {
            status = 'running';
          } else {
            status = backendStatus as StepStatus;
          }

          results[frontendStepId] = {
            status,
            error: step.error,
            startTime: step.started_at,
            endTime: step.completed_at,
            retryCount: step.attempts,
          };
        });
      }
    });

    return results;
  }, []);

  // Poll for execution progress
  const pollProgress = useCallback(async (restaurantId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      pollStartTimeRef.current = Date.now();

      const poll = async () => {
        // Check timeout
        const elapsed = Date.now() - (pollStartTimeRef.current || 0);
        if (elapsed > MAX_POLL_DURATION) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setExecutionStatus('failed');
          setIsExecuting(false);
          reject(new Error('Execution timeout - please check restaurant status'));
          return;
        }

        try {
          const response = await api.get(`/registration/single-restaurant-progress/${restaurantId}`);
          const { status, phases, currentPhase: phase, error } = response.data;

          // Update phase progress
          if (phases && Object.keys(phases).length > 0) {
            const results = convertPhasesToStepResults(phases);
            setStepResults(results);
          }

          if (phase) {
            setCurrentPhase(phase as ExecutionPhase);
          }

          // Check completion states
          if (status === 'completed') {
            setExecutionStatus('completed');
            setIsExecuting(false);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            resolve();
          } else if (status === 'failed') {
            setExecutionStatus('failed');
            setIsExecuting(false);
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            reject(new Error(error || 'Execution failed'));
          }
          // If still running (in_progress or pending), continue polling
        } catch (err) {
          // Ignore individual poll errors, continue polling
          console.warn('Poll error (will retry):', err);
        }
      };

      // Start polling
      pollIntervalRef.current = setInterval(poll, POLL_INTERVAL);
      poll(); // Immediate first poll
    });
  }, [convertPhasesToStepResults]);

  // Start execution - now uses backend async execution
  const executeYoloMode = useCallback(async (
    formData: YoloModeFormData,
    _restaurant: Restaurant,
    restaurantId: string
  ): Promise<ExecutionResults> => {
    setIsExecuting(true);
    setExecutionStatus('running');
    setStepResults({});
    setCurrentPhase('phase1');
    restaurantIdRef.current = restaurantId;

    try {
      // Submit to backend for async execution
      const response = await api.post('/registration/execute-single-restaurant', {
        restaurantId,
        formData,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to start execution');
      }

      setJobId(response.data.jobId);
      console.log('[useYoloModeExecution] Backend execution started, job ID:', response.data.jobId);

      // Start polling for progress (this will resolve when execution completes)
      await pollProgress(restaurantId);

      // Return empty results - actual results come from polling
      return {
        phase1: {},
        phase2: {},
        phase3: {},
        phase4: {},
      };
    } catch (error: any) {
      setExecutionStatus('failed');
      setIsExecuting(false);
      throw error;
    }
  }, [pollProgress]);

  // Cancel execution (stops polling, backend continues)
  const cancelExecution = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsExecuting(false);
    setExecutionStatus('cancelled');
    setCurrentPhase(null);
  }, []);

  // Reset state
  const resetExecution = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsExecuting(false);
    setExecutionStatus('idle');
    setCurrentPhase(null);
    setStepResults({});
    setJobId(null);
    restaurantIdRef.current = null;
    pollStartTimeRef.current = null;
  }, []);

  // Check for in-progress execution and resume polling if needed
  const checkAndResumeExecution = useCallback(async (restaurantId: string): Promise<boolean> => {
    // Don't start if already polling
    if (pollIntervalRef.current) return false;

    try {
      const response = await api.get(`/registration/single-restaurant-progress/${restaurantId}`);
      const { status, phases, currentPhase: phase, jobId: existingJobId } = response.data;

      // Check if there's an active execution
      if (status === 'in_progress' || status === 'pending') {
        console.log('[useYoloModeExecution] Found in-progress execution, resuming polling');

        // Restore state
        setIsExecuting(true);
        setExecutionStatus('running');
        if (existingJobId) setJobId(existingJobId);
        restaurantIdRef.current = restaurantId;

        if (phase) {
          setCurrentPhase(phase as ExecutionPhase);
        }

        if (phases && Object.keys(phases).length > 0) {
          const results = convertPhasesToStepResults(phases);
          setStepResults(results);
        }

        // Resume polling
        pollProgress(restaurantId).catch((err) => {
          console.error('[useYoloModeExecution] Resume polling failed:', err);
        });

        return true; // Indicates we resumed an existing execution
      }

      return false; // No active execution
    } catch (err) {
      console.warn('[useYoloModeExecution] Could not check for in-progress execution:', err);
      return false;
    }
  }, [convertPhasesToStepResults, pollProgress]);

  return {
    isExecuting,
    executionStatus,
    currentPhase,
    stepResults,
    jobId,
    executeYoloMode,
    cancelExecution,
    resetExecution,
    checkAndResumeExecution,
  };
}
