import React from 'react';
import { IconInfo, IconAlertTriangle, IconCheckCircle } from './icons';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'warning' | 'success' | 'error';
  title?: string;
}

export function Alert({ 
  className = '', 
  variant = 'info', 
  title, 
  children, 
  ...props 
}: AlertProps) {
  const variants = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    error: 'bg-rose-50 text-rose-800 border-rose-200',
  };

  const Icons = {
    info: IconInfo,
    warning: IconAlertTriangle,
    success: IconCheckCircle,
    error: IconAlertTriangle,
  };

  const Icon = Icons[variant];

  return (
    <div className={`flex gap-3 p-4 border rounded-xl ${variants[variant]} ${className}`} role="alert" {...props}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div>
        {title && <h4 className="font-semibold mb-1">{title}</h4>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
    </div>
  );
}
