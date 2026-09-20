import React from 'react';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ 
  className = '', 
  title = 'Nothing here yet',
  description = 'There is no data to display at this time.',
  icon,
  children,
  ...props 
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl ${className}`} {...props}>
      {icon && <div className="text-slate-400 mb-4">{icon}</div>}
      <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-slate-500 mb-6 max-w-sm">{description}</p>
      {children}
    </div>
  );
}
