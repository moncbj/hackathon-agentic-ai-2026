import React from 'react';
import { 
  IconLock, 
  IconUnlock, 
  IconActivity, 
  IconCheckCircle, 
  IconAlertTriangle,
  IconUser
} from './icons';

type SkillStatus = 'locked' | 'available' | 'in_progress' | 'acquired' | 'struggling';
type Verification = 'self_reported' | 'verified';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: SkillStatus;
  verification?: Verification;
}

export function Badge({ 
  className = '', 
  status = 'available',
  verification,
  ...props 
}: BadgeProps) {
  const statusClasses = {
    locked: 'skill-node-locked',
    available: 'skill-node-available',
    in_progress: 'skill-node-in-progress',
    acquired: 'skill-node-acquired',
    struggling: 'skill-node-struggling',
  };
  
  const verificationClasses = {
    self_reported: 'verification-self-reported',
    verified: 'verification-verified',
  };

  const labels = {
    locked: 'Locked',
    available: 'Available',
    in_progress: 'In progress',
    acquired: 'Acquired',
    struggling: 'Struggling',
  };
  
  const Icons = {
    locked: IconLock,
    available: IconUnlock,
    in_progress: IconActivity,
    acquired: IconCheckCircle,
    struggling: IconAlertTriangle,
  };

  const StatusIcon = Icons[status];

  let classes = `inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium ${statusClasses[status]}`;
  if (verification) {
    classes += ` ${verificationClasses[verification]}`;
  }

  return (
    <div className={`${classes} ${className}`} {...props}>
      <StatusIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>{labels[status]}</span>
      {verification === 'self_reported' && (
        <span className="ml-1 inline-flex text-xs opacity-70 border-l border-current pl-1" title="Self-reported">
          <IconUser className="w-3.5 h-3.5" aria-label="Self-reported" />
        </span>
      )}
      {verification === 'verified' && (
        <span className="ml-1 inline-flex text-xs opacity-70 border-l border-current pl-1" title="Verified">
          <IconCheckCircle className="w-3.5 h-3.5" aria-label="Verified" />
        </span>
      )}
    </div>
  );
}
