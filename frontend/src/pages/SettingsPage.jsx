import React, { useState } from 'react';
import {
  Sliders,
  Shield,
  Key,
  Server,
  Save,
  RotateCcw,
  CheckCircle,
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Pane from '../components/common/Pane';

export default function SettingsPage() {
  const [model, setModel] = useState('gemini-1.5-pro');
  const [temperature, setTemperature] = useState(0.15);
  const [citationFormat, setCitationFormat] = useState('bracketed_page_section');
  const [strictAnchors, setStrictAnchors] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="container-fluid px-0">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4 hairline-b pb-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="telemetry-meta">// SYSTEM ARCHITECTURE</span>
            <Badge variant="default">CONFIGURATION</Badge>
          </div>
          <h1 className="heading-display h2 mb-0">System Calibration & Settings</h1>
        </div>

        <div className="d-flex align-items-center gap-2">
          {saved && (
            <span className="font-mono text-xs text-success d-flex align-items-center gap-1">
              <CheckCircle size={14} /> CALIBRATION SAVED
            </span>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={Save}
            onClick={handleSave}
          >
            SAVE CONFIGURATION
          </Button>
        </div>
      </div>

      <div className="row g-4">
        {/* Column 1: AI Engine Calibration */}
        <div className="col-12 col-lg-6">
          <Pane title="AI Model & Temperature Controls" tag="MOD_01">
            <form onSubmit={handleSave}>
              <div className="mb-3">
                <label className="cf-label" htmlFor="model-select">
                  Primary Foundation Model
                </label>
                <select
                  id="model-select"
                  className="cf-select"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="gemini-1.5-pro">Google Gemini 1.5 Pro (Recommended for Dense Ingestion)</option>
                  <option value="gemini-1.5-flash">Google Gemini 1.5 Flash (High-Velocity Summarization)</option>
                  <option value="gemini-2.0-flash-exp">Google Gemini 2.0 Flash (Experimental Matrix)</option>
                </select>
                <div className="telemetry-meta mt-1">
                  Enforces structured schema outputs and citation anchoring.
                </div>
              </div>

              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="cf-label mb-0" htmlFor="temp-slider">
                    Sampling Temperature ({temperature})
                  </label>
                  <span className="font-mono text-xs text-muted">0.0 (Deterministic) - 1.0 (Creative)</span>
                </div>
                <input
                  id="temp-slider"
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-100 form-range"
                />
                <div className="telemetry-meta mt-1">
                  Lower values (0.10 - 0.20) are strictly enforced to minimize factual hallucination.
                </div>
              </div>

              <div className="mb-3">
                <label className="cf-label" htmlFor="citation-style">
                  Citation Codex Standard
                </label>
                <select
                  id="citation-style"
                  className="cf-select"
                  value={citationFormat}
                  onChange={(e) => setCitationFormat(e.target.value)}
                >
                  <option value="bracketed_page_section">[DOC-P.04 §02] (Swiss Archival Style)</option>
                  <option value="inline_footnote">Footnote Superscript [¹]</option>
                  <option value="academic_harvard">(Author, 2025, p. 4)</option>
                </select>
              </div>
            </form>
          </Pane>
        </div>

        {/* Column 2: Grounding & Verification Policies */}
        <div className="col-12 col-lg-6">
          <div className="d-flex flex-column gap-4">
            <Pane title="Fact Verification & Strictness" tag="POL_01">
              <div className="space-y-3 font-sans">
                <div className="p-3 border hairline-border bg-light d-flex align-items-center justify-content-between">
                  <div>
                    <span className="font-mono text-xs fw-bold text-dark d-block">
                      STRICT DETERMINISTIC VERIFICATION
                    </span>
                    <span className="text-muted" style={{ fontSize: '12px' }}>
                      Flag unverified numbers, dates, and names before export.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className="form-check-input rounded-0 mt-0"
                    checked={strictAnchors}
                    onChange={(e) => setStrictAnchors(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                </div>

                <div className="p-3 border hairline-border bg-white font-mono text-xs">
                  <div className="fw-bold text-dark mb-1">AUDIT THRESHOLDS</div>
                  <div className="d-flex justify-content-between text-muted py-1 hairline-b">
                    <span>MINIMUM CONCURRENCE:</span>
                    <span className="text-dark fw-bold">95.0%</span>
                  </div>
                  <div className="d-flex justify-content-between text-muted py-1 hairline-b">
                    <span>CROSS-LLM DISCREPANCY LIMIT:</span>
                    <span className="text-dark fw-bold">0.05%</span>
                  </div>
                  <div className="d-flex justify-content-between text-muted py-1">
                    <span>EXTRACT RETENTION:</span>
                    <span className="text-dark fw-bold">14 DAYS</span>
                  </div>
                </div>
              </div>
            </Pane>

            <Pane title="Cluster & Storage Architecture" tag="ENV_01">
              <div className="font-mono text-xs space-y-2">
                <div className="d-flex justify-content-between py-1 hairline-b">
                  <span className="text-muted">DATABASE ENGINE:</span>
                  <span className="fw-bold text-dark">NEON POSTGRESQL</span>
                </div>
                <div className="d-flex justify-content-between py-1 hairline-b">
                  <span className="text-muted">FRONTEND RUNTIME:</span>
                  <span className="fw-bold text-dark">VITE + REACT 18</span>
                </div>
                <div className="d-flex justify-content-between py-1">
                  <span className="text-muted">BACKEND RUNTIME:</span>
                  <span className="fw-bold text-dark">FASTAPI + PYTHON 3.10</span>
                </div>
              </div>
            </Pane>
          </div>
        </div>
      </div>
    </div>
  );
}
