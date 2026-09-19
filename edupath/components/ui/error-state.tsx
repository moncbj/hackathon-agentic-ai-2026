import React from 'react';
import { Button } from './button';
import { IconAlertTriangle } from './icons';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({ 
  className = '', 
  title = 'Something went wrong',
  description = 'An error occurred while loading this content. Please try again.',
  onRetry,
  ...props 
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-rose-50 border border-rose-100 rounded-2xl ${className}`} {...props}>
      <IconAlertTriangle className="w-10 h-10 text-rose-500 mb-3" />
      <h3 className="text-lg font-semibold text-rose-900 mb-1">{title}</h3>
      <p className="text-rose-700 mb-5 max-w-sm">{description}</p>
      {onRetry && (
        <Button variant="danger" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
