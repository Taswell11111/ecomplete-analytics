import React from 'react';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-red-50/50 rounded-xl border border-red-100 text-center">
      <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h3>
      <p className="text-sm text-red-600 mb-4 max-w-md">
        {error.message || "An unexpected error occurred while loading this component."}
      </p>
      <button
        onClick={resetErrorBoundary}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium shadow-sm"
      >
        <RefreshCw className="w-4 h-4" />
        Try again
      </button>
    </div>
  );
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children, onReset }) => {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback} onReset={onReset}>
      {children}
    </ReactErrorBoundary>
  );
};
