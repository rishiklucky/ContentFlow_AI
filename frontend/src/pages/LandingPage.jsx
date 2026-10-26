import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
  CheckCircle,
  FileSpreadsheet,
  Share2,
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Pane from '../components/common/Pane';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="container-fluid px-0">
      {/* Hero Section */}
      <div className="py-4 py-lg-5 hairline-b mb-5">
        <div className="row align-items-center g-4">
          <div className="col-lg-8">
            <div className="d-flex align-items-center gap-2 mb-3">
              <Badge variant="vermilion">PLATFORM SPEC v1.0</Badge>
              <span className="telemetry-meta">ARCHITECTURAL EDITORIAL INTELLIGENCE</span>
            </div>

            <h1 className="heading-display display-4 mb-3">
              Multi-Modal Content Transformation with Uncompromising Source Grounding.
            </h1>

            <p className="lead font-sans text-secondary mb-4" style={{ maxWidth: '640px', lineHeight: 1.6 }}>
              ContentFlow AI digests complex reports, whitepapers, and filings into tailored institutional formats—without hallucination, factual drift, or generic synthesis bloat.
            </p>

            <div className="d-flex align-items-center gap-3 flex-wrap">
              <Button
                variant="primary"
                size="lg"
                icon={ArrowRight}
                onClick={() => navigate('/dashboard')}
                className="touch-target"
              >
                ENTER WORKSPACE
              </Button>
              <Button
                variant="secondary"
                size="lg"
                icon={FileText}
                onClick={() => navigate('/transform/new')}
                className="touch-target"
              >
                NEW TRANSFORMATION
              </Button>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="p-3 border hairline-border bg-white shadow-sm font-mono text-xs">
              <div className="hairline-b pb-2 mb-3 d-flex justify-content-between align-items-center">
                <span className="fw-bold text-dark">// SYSTEM CALIBRATION</span>
                <span className="stamp-badge">VERIFIED</span>
              </div>
              <ul className="list-unstyled mb-0 space-y-2">
                <li className="d-flex justify-content-between py-1 hairline-b">
                  <span className="text-muted">SOURCE GROUNDING:</span>
                  <span className="fw-bold text-dark">STRICT ANCHORING</span>
                </li>
                <li className="d-flex justify-content-between py-1 hairline-b">
                  <span className="text-muted">FACT AUDIT:</span>
                  <span className="fw-bold text-dark">DETERMINISTIC</span>
                </li>
                <li className="d-flex justify-content-between py-1 hairline-b">
                  <span className="text-muted">OUTPUT FORMATS:</span>
                  <span className="fw-bold text-dark">5 SYNCHRONIZED</span>
                </li>
                <li className="d-flex justify-content-between py-1">
                  <span className="text-muted">SECURITY ENCLAVE:</span>
                  <span className="fw-bold text-success">ISOLATED</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Architecture Matrix */}
      <div className="mb-5">
        <div className="d-flex justify-content-between align-items-baseline mb-4 hairline-b pb-2">
          <span className="heading-section">§ 01. CORE ARCHITECTURAL CAPABILITIES</span>
          <span className="telemetry-meta">[FOUNDATION PROTOCOL]</span>
        </div>

        <div className="row g-4">
          <div className="col-12 col-md-6 col-lg-3">
            <Pane title="Multi-Format Dossiers" tag="FMT_01" className="h-100">
              <div className="mb-3">
                <Layers size={28} className="text-dark" />
              </div>
              <h5 className="font-serif fw-bold mb-2">Simultaneous Outputs</h5>
              <p className="font-sans text-muted mb-0" style={{ fontSize: '13px' }}>
                One source ingested generates executive briefings, LinkedIn dispatches, analytical Twitter threads, and board presentations.
              </p>
            </Pane>
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <Pane title="Fact Grounding" tag="FMT_02" className="h-100">
              <div className="mb-3">
                <ShieldCheck size={28} className="text-dark" />
              </div>
              <h5 className="font-serif fw-bold mb-2">Zero Fabrication</h5>
              <p className="font-sans text-muted mb-0" style={{ fontSize: '13px' }}>
                Every metric, date, and claim is pinned to verified source coordinates with deterministic audit verification.
              </p>
            </Pane>
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <Pane title="Tone Architecture" tag="FMT_03" className="h-100">
              <div className="mb-3">
                <Cpu size={28} className="text-dark" />
              </div>
              <h5 className="font-serif fw-bold mb-2">Calibrated Rigor</h5>
              <p className="font-sans text-muted mb-0" style={{ fontSize: '13px' }}>
                Granular tone control from high-velocity narrative wires to institutional grade capital allocation advisories.
              </p>
            </Pane>
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <Pane title="Audit Trail" tag="FMT_04" className="h-100">
              <div className="mb-3">
                <FileSpreadsheet size={28} className="text-dark" />
              </div>
              <h5 className="font-serif fw-bold mb-2">Cryptographic Log</h5>
              <p className="font-sans text-muted mb-0" style={{ fontSize: '13px' }}>
                Complete paragraph-level extraction provenance with dual-LLM cross-validation logs and citation mapping.
              </p>
            </Pane>
          </div>
        </div>
      </div>
    </div>
  );
}
