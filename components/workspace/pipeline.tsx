'use client';

import { cn } from '@/lib/utils';
import { PipelineStep, PipelineStepStatus } from '@/types';
import { ChevronRight, CheckCircle2, Circle, Loader2, Play, } from 'lucide-react';

interface PipelineProps {
  currentStep: PipelineStep;
  onStepClick: (step: PipelineStep) => void;
  pipelineStatus?: Record<PipelineStep, PipelineStepStatus>;
}

const STEPS: { key: PipelineStep; label: string }[] = [
  { key: 'document', label: 'Document' },
  { key: 'mapping', label: 'Mapping' },
  { key: 'schema', label: 'Schema' },
  { key: 'lims', label: 'LIMS Data' },
  { key: 'script', label: 'Script' },
  { key: 'debug', label: 'Debug' },
];

export default function Pipeline({ currentStep, onStepClick, pipelineStatus,  }: PipelineProps) {
  const getStepIndex = (step: PipelineStep) => STEPS.findIndex(s => s.key === step);
  const currentIndex = getStepIndex(currentStep);

  const getStatusIcon = (status: PipelineStepStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-cyan-500 animate-spin" />;
      case 'pending':
      default:
        return <Circle className="h-5 w-5 text-gray-300" />;
    }
  };

  const getStatusColor = (status: PipelineStepStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500';
      case 'in_progress':
        return 'bg-cyan-500';
      case 'pending':
      default:
        return 'bg-gray-200';
    }
  };

  const calculateProgress = () => {
    if (!pipelineStatus) return 0;
    const completedSteps = Object.values(pipelineStatus).filter(s => s === 'completed').length;
    return (completedSteps / STEPS.length) * 100;
  };

  return (
    <div className="w-full bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="relative flex items-center justify-between">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute top-8 left-16 right-16 h-1 bg-gray-200 rounded-full" />
              <div 
                className="absolute top-8 left-16 h-1 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
                style={{ width: `calc(${calculateProgress()}% - 32px)` }}
              />
              
              <div className="relative flex items-center justify-between">
                {STEPS.map((step, index) => {
                  const status = pipelineStatus?.[step.key] || 'pending';
                  const isCurrent = step.key === currentStep;
                  const isClickable = pipelineStatus ? 
                    (status === 'completed' || status === 'in_progress' || 
                       (index === currentIndex + 1 && pipelineStatus[STEPS[currentIndex].key] === 'completed')) :
                    index <= currentIndex;

                  return (
                    <div key={step.key} className="flex items-center flex-1">
                      <button
                        onClick={() => isClickable && onStepClick(step.key)}
                        disabled={!isClickable}
                        className={cn(
                          "relative group flex flex-col items-center gap-2 transition-all duration-200",
                          isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                        )}
                      >
                        <div
                          className={cn(
                            "relative flex items-center justify-center w-16 h-16 rounded-2xl border-2 transition-all duration-200 z-10",
                            isCurrent
                              ? "border-cyan-500 bg-cyan-50 shadow-lg shadow-cyan-500/20 scale-105"
                              : status === 'completed'
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-gray-200 bg-white hover:border-cyan-300"
                          )}
                        >
                          {getStatusIcon(status)}
                        </div>
                        
                        <span
                          className={cn(
                            "text-sm font-medium whitespace-nowrap transition-colors",
                            isCurrent
                              ? "text-cyan-700"
                              : status === 'completed'
                              ? "text-emerald-700"
                              : "text-gray-600 group-hover:text-gray-800"
                          )}
                        >
                          {step.label}
                        </span>
                      </button>

                      {index < STEPS.length - 1 && (
                        <ChevronRight className="h-5 w-5 text-cyan-400 mx-2 flex-shrink-0 relative z-10 self-center" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
