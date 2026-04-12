import React, { useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, Circle, Loader2, AlertTriangle, GitBranch, Rocket } from 'lucide-react';

interface DeployStep {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  message?: string;
}

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  wsUrl: string;
  onDeployComplete?: () => void;
  repoUrl: string;
  branch: string;
}

const STEP_LABELS: Record<string, string> = {
  clone: 'Cloning Repository',
  detect: 'Detecting Server Folder',
  stack: 'Auto-detecting Stack',
  install: 'Installing Dependencies',
  start: 'Starting Process',
  complete: 'Deployment Complete',
  error: 'Error',
};

const DeployModal: React.FC<DeployModalProps> = ({ isOpen, onClose, wsUrl, onDeployComplete, repoUrl, branch }) => {
  const [steps, setSteps] = useState<DeployStep[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Reset state
    setSteps([]);
    setIsComplete(false);
    setHasError(false);

    // Connect to deploy progress WebSocket
    const token = localStorage.getItem('aquos_token');
    const socket = new WebSocket(`${wsUrl}?type=deploy&token=${token}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'deploy-progress') {
        setSteps(prev => {
          const existing = prev.findIndex(s => s.key === data.step);
          const newStep: DeployStep = {
            key: data.step,
            label: STEP_LABELS[data.step] || data.step,
            status: data.status,
            message: data.message,
          };

          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = newStep;
            return updated;
          }
          return [...prev, newStep];
        });

        if (data.step === 'complete') {
          setIsComplete(true);
          onDeployComplete?.();
        }
        if (data.status === 'error') {
          setHasError(true);
        }
      }
    };

    return () => {
      socket.close();
    };
  }, [isOpen, wsUrl]);

  // Auto-scroll
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [steps]);

  if (!isOpen) return null;

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckCircle2 className="w-5 h-5 text-[#34a853]" />;
      case 'running': return <Loader2 className="w-5 h-5 text-[#1a73e8] animate-spin" />;
      case 'error': return <AlertTriangle className="w-5 h-5 text-[#ea4335]" />;
      default: return <Circle className="w-5 h-5 text-[#dadce0]" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-[scaleIn_0.3s_ease-out]">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center ${
              hasError ? 'bg-[#fde9e9]' : isComplete ? 'bg-[#e6f4ea]' : 'bg-[#e8f0fe]'
            }`}>
              <Rocket className={`w-7 h-7 ${
                hasError ? 'text-[#ea4335]' : isComplete ? 'text-[#34a853]' : 'text-[#1a73e8]'
              }`} />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#202124]">
                {hasError ? 'Deployment Failed' : isComplete ? 'Deployed!' : 'Deploying...'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <GitBranch className="w-3 h-3 text-[#5f6368]" />
                <span className="text-[10px] font-bold text-[#5f6368] uppercase tracking-wider">{branch}</span>
              </div>
            </div>
          </div>
          {(isComplete || hasError) && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#f8f9fa] rounded-xl transition-all"
            >
              <X className="w-5 h-5 text-[#5f6368]" />
            </button>
          )}
        </div>

        {/* Repo URL */}
        <div className="mx-8 mb-4 px-4 py-2.5 bg-[#f8f9fa] rounded-xl">
          <p className="text-[11px] font-bold text-[#5f6368] truncate">{repoUrl}</p>
        </div>

        {/* Steps */}
        <div ref={logRef} className="px-8 pb-8 max-h-[400px] overflow-y-auto">
          <div className="space-y-1">
            {steps.map((step, i) => (
              <div key={step.key + i} className="flex items-start gap-3 py-2.5">
                <div className="mt-0.5 flex-shrink-0">
                  {getStepIcon(step.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-extrabold ${
                    step.status === 'error' ? 'text-[#ea4335]' :
                    step.status === 'done' ? 'text-[#202124]' :
                    step.status === 'running' ? 'text-[#1a73e8]' : 'text-[#9aa0a6]'
                  }`}>
                    {step.label}
                  </p>
                  {step.message && (
                    <p className={`text-[11px] font-bold mt-0.5 ${
                      step.status === 'error' ? 'text-[#ea4335]/70' : 'text-[#5f6368]'
                    }`}>
                      {step.message}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {steps.length === 0 && (
              <div className="flex items-center gap-3 py-4 text-[#9aa0a6]">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-bold">Connecting to deployment engine...</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {(isComplete || hasError) && (
          <div className="px-8 pb-8">
            <button
              onClick={onClose}
              className={`w-full py-4 rounded-[20px] font-black text-sm uppercase tracking-wider transition-all active:scale-95 ${
                hasError
                  ? 'bg-[#ea4335] text-white shadow-lg shadow-[#ea4335]/20'
                  : 'bg-[#1a73e8] text-white shadow-lg shadow-[#1a73e8]/20'
              }`}
            >
              {hasError ? 'Close' : 'View Workloads'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeployModal;
