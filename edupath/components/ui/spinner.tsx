import React from 'react';

export function Spinner({ className = '', size = 'md' }: { className?: string, size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };
  
  return (
    <div className={`inline-block animate-spin rounded-full border-solid border-current border-r-transparent text-indigo-600 ${sizes[size]} ${className}`} role="status">
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />
  );
}
