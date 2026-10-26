import React from 'react';

export default function StatBox({
  label,
  value,
  sublabel = null,
  trend = null, // e.g. 'up' | 'down' | 'neutral'
  className = '',
}) {
  return (
    <div className={`cf-stat-box ${className}`}>
      <div className="cf-stat-value">{value}</div>
      <div className="cf-stat-label">{label}</div>
      {sublabel && (
        <div className="telemetry-meta mt-1 pt-1 hairline-t d-flex align-items-center justify-content-between">
          <span>{sublabel}</span>
          {trend && <span className="font-mono text-dark fw-bold">[{trend}]</span>}
        </div>
      )}
    </div>
  );
}
