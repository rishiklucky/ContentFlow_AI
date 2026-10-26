import React from 'react';
import Button from './Button';

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel = null,
  onAction = null,
  actionIcon = null,
  className = '',
  extraDetails = null,
}) {
  return (
    <div className={`cf-empty-state ${className}`}>
      {Icon && (
        <div className="cf-empty-icon">
          <Icon size={24} strokeWidth={1.75} />
        </div>
      )}
      <h3 className="cf-empty-title">{title}</h3>
      <p className="cf-empty-desc">{description}</p>
      {extraDetails && (
        <div className="telemetry-meta mb-3 p-2 bg-light border hairline-border">
          {extraDetails}
        </div>
      )}
      {actionLabel && (
        <Button
          variant="primary"
          onClick={onAction}
          icon={actionIcon}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
