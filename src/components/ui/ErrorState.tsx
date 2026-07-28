// ========================================================
// Error State Component
// Location: src/components/ui/ErrorState.tsx
// ========================================================

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { LoadingButton } from './LoadingButton';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'Failed to load data. Please check your internet connection or try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-rose-50/50 rounded-2xl border border-rose-100 my-4">
      <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-md mb-4">{message}</p>
      {onRetry && (
        <LoadingButton variant="outline" onClick={onRetry} className="text-xs px-4 py-2">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry Action
        </LoadingButton>
      )}
    </div>
  );
}
