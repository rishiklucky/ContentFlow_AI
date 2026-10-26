import React, { useEffect, useState } from 'react';
import { systemService } from '../../services/api';
import Badge from '../common/Badge';

export default function TelemetryRuler() {
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    let isMounted = true;
    systemService.checkHealth()
      .then((data) => {
        if (isMounted) {
          setBackendStatus(data.status === 'healthy' ? 'connected' : 'degraded');
        }
      })
      .catch(() => {
        if (isMounted) {
          setBackendStatus('standby');
        }
      });
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="telemetry-topbar">
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <span className="d-inline-flex align-items-center gap-1 fw-bold text-dark">
          <span
            style={{
              width: '8px',
              height: '8px',
              backgroundColor: 'var(--cf-accent-vermilion)',
              display: 'inline-block'
            }}
          />
          CONTENTFLOW // MATRIX v1.0
        </span>
        <span className="text-muted d-none d-sm-inline">|</span>
        <span className="telemetry-meta d-none d-md-inline">
          PROTOCOL: <strong className="text-dark">FACT-GROUNDED TRANSFORMATION</strong>
        </span>
      </div>

      <div className="d-flex align-items-center gap-3">
        <div className="d-inline-flex align-items-center gap-1 font-mono text-[11px]">
          <span className="telemetry-meta">BACKEND:</span>
          {backendStatus === 'connected' ? (
            <Badge variant="green">ONLINE</Badge>
          ) : backendStatus === 'checking' ? (
            <Badge variant="default">CHECKING...</Badge>
          ) : (
            <Badge variant="vermilion">STANDBY</Badge>
          )}
        </div>

        <div className="telemetry-meta d-none d-lg-inline">
          ANCHOR TOLERANCE: <span className="text-dark fw-bold">ZERO FABRICATION</span>
        </div>
      </div>
    </div>
  );
}
