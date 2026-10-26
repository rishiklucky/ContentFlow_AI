import React from 'react';

export default function Pane({
  title,
  tag = null,
  actions = null,
  children,
  className = '',
  tactile = false,
}) {
  return (
    <div className={`cf-pane ${tactile ? 'cf-pane-tactile' : ''} ${className}`}>
      {(title || tag || actions) && (
        <div className="cf-pane-header">
          <div className="d-flex align-items-center gap-2">
            {tag && <span className="telemetry-meta">[{tag}]</span>}
            <span>{title}</span>
          </div>
          {actions && <div className="d-flex align-items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="cf-pane-body">{children}</div>
    </div>
  );
}
