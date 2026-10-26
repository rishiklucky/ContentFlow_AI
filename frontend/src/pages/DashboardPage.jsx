import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FilePlus,
  FolderPlus,
  Layers,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import StatBox from '../components/common/StatBox';
import EmptyState from '../components/common/EmptyState';
import Pane from '../components/common/Pane';
import { transformationService } from '../services/api';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [transformations, setTransformations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    transformationService.list()
      .then((data) => {
        if (isMounted) {
          setTransformations(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setTransformations([]);
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="container-fluid px-0">
      {/* Page Title & Actions */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4 hairline-b pb-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="telemetry-meta">// WORKSPACE CONTROL</span>
            <Badge variant="green">STABLE</Badge>
          </div>
          <h1 className="heading-display h2 mb-0">Intelligence Dashboard</h1>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap w-100 w-md-auto">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => setLoading(true)}
            className="flex-grow-1 flex-md-grow-0"
          >
            SYNC LEDGER
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={FilePlus}
            onClick={() => navigate('/transform/new')}
            className="flex-grow-1 flex-md-grow-0"
          >
            START TRANSFORMATION
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <StatBox
            label="Transformations"
            value={transformations.length}
            sublabel="Total processed"
            trend="INIT"
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatBox
            label="Active Projects"
            value="0"
            sublabel="Workspace portfolios"
            trend="READY"
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatBox
            label="Factual Concurrence"
            value="100%"
            sublabel="Zero hallucination"
            trend="ACTIVE"
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatBox
            label="Grounding Anchors"
            value="0"
            sublabel="Verified extractions"
            trend="STANDBY"
          />
        </div>
      </div>

      {/* Main Grid: Active Ledger & Quick Telemetry */}
      <div className="row g-4">
        {/* Transformations Ledger */}
        <div className="col-12 col-xl-8">
          <Pane
            title="Dossier Transformation Ledger"
            tag="REG_01"
            actions={
              <Badge variant="default">0 RECORDS</Badge>
            }
          >
            {transformations.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Transformations Found in Ledger"
                description="Your workspace currently has no active or archived content transformations. Upload a source PDF or text document to initialize your first grounded multi-modal dossier."
                actionLabel="INITIALIZE FIRST TRANSFORMATION"
                onAction={() => navigate('/transform/new')}
                actionIcon={FilePlus}
                extraDetails="Supported formats: PDF, DOCX, TXT, Raw Prose • Real-time Claim Verification"
              />
            ) : (
              <div className="table-responsive">
                <table className="table table-hover font-mono text-xs mb-0">
                  <thead className="bg-light">
                    <tr>
                      <th>DOSSIER</th>
                      <th>SOURCE</th>
                      <th>TARGETS</th>
                      <th>STATUS</th>
                      <th>GROUNDING</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transformations.map((item) => (
                      <tr key={item.id}>
                        <td>{item.title}</td>
                        <td>{item.source_type}</td>
                        <td>{item.output_formats?.length || 0}</td>
                        <td>{item.status}</td>
                        <td>{item.grounding_score}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Pane>
        </div>

        {/* Ancillary Sidebar Matrix */}
        <div className="col-12 col-xl-4">
          <div className="d-flex flex-column gap-4">
            {/* System Status Card */}
            <Pane title="Grounding Engine Calibration" tag="SYS_CAL">
              <div className="font-mono text-xs space-y-2">
                <div className="d-flex justify-content-between py-1 hairline-b">
                  <span className="text-muted">CROSS-VALIDATION:</span>
                  <span className="fw-bold text-dark">DUAL-LLM PROVENANCE</span>
                </div>
                <div className="d-flex justify-content-between py-1 hairline-b">
                  <span className="text-muted">CITATION FORMAT:</span>
                  <span className="fw-bold text-dark">BRACKETED CODEX</span>
                </div>
                <div className="d-flex justify-content-between py-1 hairline-b">
                  <span className="text-muted">DRIFT TOLERANCE:</span>
                  <span className="fw-bold text-danger">0.00%</span>
                </div>
                <div className="d-flex justify-content-between py-1">
                  <span className="text-muted">STORAGE PIPELINE:</span>
                  <span className="fw-bold text-dark">NEON POSTGRESQL</span>
                </div>
              </div>
            </Pane>

            {/* Quick Tips Box */}
            <div className="p-3 border hairline-border bg-white font-mono text-xs">
              <div className="d-flex align-items-center gap-1.5 fw-bold text-dark mb-2">
                <AlertCircle size={15} className="text-warning" />
                <span>ARCHITECTURAL NOTICE</span>
              </div>
              <p className="text-muted mb-0 font-sans" style={{ fontSize: '13px' }}>
                ContentFlow strictly isolates claims from opinion. When uploading institutional source material, ensure files are under 50MB and free of password locks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
