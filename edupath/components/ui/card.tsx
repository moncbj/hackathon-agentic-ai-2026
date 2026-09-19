import React from 'react';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}
      {...props}
    />
  );
}

export function CardHeader({ className = '', ...props }: CardProps) {
  return <div className={`px-6 py-4 border-b border-slate-100 ${className}`} {...props} />;
}

export function CardTitle({ className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-lg font-semibold text-slate-900 ${className}`} {...props} />;
}

export function CardContent({ className = '', ...props }: CardProps) {
  return <div className={`p-6 ${className}`} {...props} />;
}

export function CardFooter({ className = '', ...props }: CardProps) {
  return <div className={`px-6 py-4 bg-slate-50 border-t border-slate-100 ${className}`} {...props} />;
}
