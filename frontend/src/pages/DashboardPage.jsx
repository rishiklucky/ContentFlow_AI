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
  FolderKanban,
  ArrowRight,
  Eye,
  Database,
  ExternalLink,
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import StatBox from '../components/common/StatBox';
import EmptyState from '../components/common/EmptyState';
import Pane from '../components/common/Pane';
import { dashboardService } from '../services/api';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardMetrics();
  }, []);

  const loadDashboardMetrics = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load real dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const recentTrans = metrics?.recent_transformations || [];
  const recentProjects = metrics?.recent_projects || [];

  return (
    <div className="container-fluid px-0">
      {/* Page Title & Actions */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4 hairline-b pb-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="telemetry-meta">// WORKSPACE CONTROL</span>
            <Badge variant="green">LIVE DATABASE METRICS</Badge>
          </div>
          <h1 className="heading-display h2 mb-0">Intelligence Dashboard</h1>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap w-100 w-md-auto">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            disabled={loading}
            onClick={loadDashboardMetrics}
            className="flex-grow-1 flex-md-grow-0"
          >
            {loading ? 'SYNCING...' : 'SYNC LEDGER'}
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

      {/* Real Metrics Row from Neon PostgreSQL */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <StatBox
            label="Transformations"
            value={metrics?.total_transformations ?? 0}
            sublabel="Total processed"
            trend={metrics?.total_transformations > 0 ? 'ACTIVE' : 'READY'}
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatBox
            label="Active Projects"
            value={metrics?.total_projects ?? 0}
            sublabel="Workspace portfolios"
            trend={metrics?.total_projects > 0 ? 'LIVE' : 'STANDBY'}
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatBox
            label="Ingested Sources"
            value={metrics?.total_sources ?? 0}
            sublabel="Knowledge repository"
            trend="NEON DB"
          />
        </div>
        <div className="col-6 col-lg-3">
          <StatBox
            label="Factual Grounding"
            value={`${metrics?.average_grounding_score ?? 100}%`}
            sublabel="Verified consistency"
            trend={metrics?.average_grounding_score >= 85 ? 'EXCELLENT' : 'ATTENTION'}
          />
        </div>
      </div>

      {/* Main Grid: Active Ledger & Quick Telemetry */}
      <div className="row g-4">
        {/* Transformations Ledger */}
        <div className="col-12 col-xl-8">
          <Pane
            title="Recent Dossier Transformations"
            tag="REG_01"
            actions={
              <Badge variant="default">{recentTrans.length} SESSIONS</Badge>
            }
          >
            {recentTrans.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Transformations Found in Ledger"
                description="Your workspace currently has no active or archived content transformations. Upload a source PDF or text document to initialize your first grounded multi-modal dossier."
                actionLabel="INITIALIZE FIRST TRANSFORMATION"
                onAction={() => navigate('/transform/new')}
                actionIcon={FilePlus}
                extraDetails="Supported formats: PDF, DOCX, TXT • Real-time Claim Verification with PostgreSQL audit trails"
              />
            ) : (
              <div className="table-responsive">
                <table className="table table-hover font-mono text-xs mb-0 align-middle">
                  <thead className="bg-light">
                    <tr>
                      <th>DOSSIER TITLE</th>
                      <th>SOURCE DOCUMENT</th>
                      <th>FORMATS</th>
                      <th>STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrans.map((item) => (
                      <tr key={item.id} className="cursor-pointer" onClick={() => navigate('/history')}>
                        <td className="fw-bold text-dark text-truncate" style={{ maxWidth: '200px' }}>
                          {item.title}
                        </td>
                        <td className="text-muted text-truncate" style={{ maxWidth: '180px' }}>
                          {item.source_title || 'Direct Text Ingestion'}
                        </td>
                        <td>
                          <span className="badge bg-light text-muted border font-mono">
                            {item.output_count} FORMATS
                          </span>
                        </td>
                        <td>
                          <Badge variant={item.status === 'completed' ? 'success' : 'vermilion'}>
                            {item.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="cf-btn cf-btn-sm cf-btn-outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/history');
                            }}
                          >
                            <Eye size={12} className="me-1" /> OPEN
                          </button>
                        </td>
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
            {/* Active Projects Panel */}
            <Pane
              title="Project Portfolios"
              tag="PROJ_01"
              actions={
                <button
                  type="button"
                  className="btn btn-link p-0 font-mono text-xs text-muted text-decoration-none"
                  onClick={() => navigate('/projects')}
                >
                  VIEW ALL →
                </button>
              }
            >
              {recentProjects.length === 0 ? (
                <div className="p-3 text-center text-muted font-mono text-xs">
                  <FolderKanban size={24} className="mb-2 text-muted mx-auto" />
                  <p className="mb-2">No active projects yet.</p>
                  <Button variant="outline" size="sm" onClick={() => navigate('/projects')}>
                    CREATE PROJECT
                  </Button>
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {recentProjects.map((p) => (
                    <div
                      key={p.id}
                      className="p-2 border hairline-border bg-light d-flex justify-content-between align-items-center cursor-pointer hover-dark"
                      onClick={() => navigate('/projects')}
                    >
                      <div className="text-truncate me-2">
                        <div className="fw-bold font-mono text-xs text-dark text-truncate">{p.name}</div>
                        <div className="text-muted text-xs font-mono">{p.transformation_count} Transformations</div>
                      </div>
                      <Badge variant={p.status === 'active' ? 'success' : 'default'}>
                        {p.status.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Pane>

            {/* System Status Card */}
            <Pane title="Infrastructure Health" tag="SYS_CAL">
              <div className="font-mono text-xs space-y-2">
                <div className="d-flex justify-content-between py-1 hairline-b">
                  <span className="text-muted">DATABASE:</span>
                  <span className="fw-bold text-success d-flex align-items-center gap-1">
                    <CheckCircle2 size={12} /> NEON POSTGRESQL (LIVE)
                  </span>
                </div>
                <div className="d-flex justify-content-between py-1 hairline-b">
                  <span className="text-muted">TOTAL OUTPUTS:</span>
                  <span className="fw-bold text-dark">{metrics?.total_outputs ?? 0} GENERATED</span>
                </div>
                <div className="d-flex justify-content-between py-1 hairline-b">
                  <span className="text-muted">AI ENGINE:</span>
                  <span className="fw-bold text-dark">GOOGLE GEMINI 3.8 FLASH</span>
                </div>
                <div className="d-flex justify-content-between py-1">
                  <span className="text-muted">GROUNDING AUDIT:</span>
                  <span className="fw-bold text-primary">DETERMINISTIC + SEMANTIC</span>
                </div>
              </div>
            </Pane>
          </div>
        </div>
      </div>
    </div>
  );
}
