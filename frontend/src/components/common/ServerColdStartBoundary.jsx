import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Server, AlertTriangle, CheckCircle2, WifiOff, Clock } from 'lucide-react';
import { systemService } from '../../services/api';
import Button from './Button';

/**
 * Free-Tier Cold-Start Boundary
 * Gracefully manages Render free-tier sleep cycles by checking /api/health on mount
 * and displaying clear user feedback instead of a broken or frozen white screen.
 */
export default function ServerColdStartBoundary({ children }) {
  const [serverState, setServerState] = useState('checking'); // 'ready' | 'waking' | 'failed'
  const [attempt, setAttempt] = useState(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const MAX_ATTEMPTS = 6;
  const RETRY_DELAYS = [2500, 4000, 6000, 8000, 10000, 12000];

  const verifyServerHealth = useCallback(async (currentAttempt = 1) => {
    try {
      await systemService.checkHealth(5000);
      setServerState('ready');
      setErrorMessage('');
    } catch (err) {
      if (currentAttempt < MAX_ATTEMPTS) {
        setServerState('waking');
        setAttempt(currentAttempt + 1);
        const delay = RETRY_DELAYS[currentAttempt - 1] || 6000;
        setTimeout(() => {
          verifyServerHealth(currentAttempt + 1);
        }, delay);
      } else {
        setServerState('failed');
        setErrorMessage(
          err.message ||
            'The cloud server took longer than expected to wake up. Render free-tier instances may require up to 60-90 seconds to initialize.'
        );
      }
    }
  }, []);

  useEffect(() => {
    verifyServerHealth(1);
  }, [verifyServerHealth]);

  // Elapsed timer when waking up
  useEffect(() => {
    let timer = null;
    if (serverState === 'waking') {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [serverState]);

  const handleManualRetry = () => {
    setServerState('waking');
    setAttempt(1);
    setElapsedSeconds(0);
    setErrorMessage('');
    verifyServerHealth(1);
  };

  // If server responded, render normal application seamlessly
  if (serverState === 'ready') {
    return children;
  }

  // Waking up screen
  if (serverState === 'waking' || serverState === 'checking') {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3">
        <div
          className="border hairline-border bg-white shadow-sm p-4 p-md-5 text-center mx-auto"
          style={{ maxWidth: '520px', width: '100%' }}
        >
          <div className="d-flex justify-content-center mb-3">
            <div
              className="p-3 bg-light border hairline-border rounded-0 d-inline-flex align-items-center justify-content-center"
              style={{ width: '64px', height: '64px' }}
            >
              <Server size={32} className="text-primary animate-pulse" />
            </div>
          </div>

          <div className="font-mono text-xs text-muted mb-2">// FREE-TIER SERVICE INITIALIZATION</div>
          <h1 className="heading-display h4 mb-3">Waking up ContentFlow AI</h1>

          <p className="font-sans text-muted text-sm mb-4" style={{ lineHeight: 1.6 }}>
            The server is starting because this application uses free cloud hosting. This may take up to a minute.
            Please wait while we prepare your workspace.
          </p>

          <div className="p-3 bg-light border hairline-border mb-4 font-mono text-xs d-flex flex-column gap-2 text-start">
            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted">HOST ENVIRONMENT:</span>
              <span className="fw-bold text-dark">Render Web Service</span>
            </div>
            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted">STATUS:</span>
              <span className="text-primary fw-bold d-flex align-items-center gap-1">
                <RefreshCw size={12} className="spin" /> Spawning container...
              </span>
            </div>
            <div className="d-flex justify-content-between align-items-center">
              <span className="text-muted">PING ATTEMPT:</span>
              <span className="text-dark">
                {attempt} of {MAX_ATTEMPTS} ({elapsedSeconds}s elapsed)
              </span>
            </div>
          </div>

          <div className="progress rounded-0 mb-3" style={{ height: '4px' }}>
            <div
              className="progress-bar progress-bar-striped progress-bar-animated bg-primary"
              role="progressbar"
              style={{ width: `${Math.min((elapsedSeconds / 60) * 100, 95)}%` }}
              aria-valuenow={elapsedSeconds}
              aria-valuemin="0"
              aria-valuemax="60"
            />
          </div>

          <p className="font-mono text-xs text-muted mb-0">
            No need to refresh the page — ContentFlow AI will connect automatically.
          </p>
        </div>
      </div>
    );
  }

  // Failed / Timeout screen
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3">
      <div
        className="border hairline-border bg-white shadow-sm p-4 p-md-5 text-center mx-auto"
        style={{ maxWidth: '520px', width: '100%' }}
      >
        <div className="d-flex justify-content-center mb-3">
          <div
            className="p-3 bg-danger-subtle border border-danger rounded-0 d-inline-flex align-items-center justify-content-center"
            style={{ width: '64px', height: '64px' }}
          >
            <WifiOff size={32} className="text-danger" />
          </div>
        </div>

        <div className="font-mono text-xs text-danger mb-2">// CONNECTION TIMEOUT</div>
        <h1 className="heading-display h4 mb-3">Server Connection Delayed</h1>

        <p className="font-sans text-muted text-sm mb-4" style={{ lineHeight: 1.6 }}>
          {errorMessage ||
            'The backend service is taking longer than expected to start up. Please verify your connection or click retry.'}
        </p>

        <div className="d-flex justify-content-center gap-2">
          <Button
            variant="primary"
            size="md"
            icon={RefreshCw}
            onClick={handleManualRetry}
          >
            RETRY CONNECTION
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => window.location.reload()}
          >
            REFRESH PAGE
          </Button>
        </div>
      </div>
    </div>
  );
}
