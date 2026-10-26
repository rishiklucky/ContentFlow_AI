import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  FileCheck,
  Download,
  Calendar,
  Layers,
  Eye,
  Trash2,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { transformationService } from '../services/api';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import TransformationWorkspace from '../components/transformations/TransformationWorkspace';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [transformations, setTransformations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransformation, setSelectedTransformation] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadTransformations();
  }, []);

  const loadTransformations = async () => {
    try {
      setIsLoading(true);
      const data = await transformationService.list();
      setTransformations(data || []);
    } catch (err) {
      console.error('Failed to load transformations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDetail = async (id) => {
    try {
      const full = await transformationService.get(id);
      setSelectedTransformation(full);
    } catch (err) {
      alert(err.message || 'Failed to load transformation details.');
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this transformation session and its generated outputs?')) {
      return;
    }

    try {
      setIsDeleting(true);
      await transformationService.delete(id);
      setTransformations((prev) => prev.filter((t) => t.id !== id));
      if (selectedTransformation?.id === id) {
        setSelectedTransformation(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete transformation.');
    } finally {
      setIsDeleting(false);
    }
  };

  // If a transformation is selected, show its full interactive workspace
  if (selectedTransformation) {
    return (
      <div className="container-fluid px-0">
        <div className="d-flex justify-content-between align-items-center mb-4 hairline-b pb-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="telemetry-meta">// TRANSFORMATION DOSSIER</span>
              <Badge variant="success">HISTORICAL RECORD</Badge>
            </div>
            <h1 className="heading-display h3 mb-0">{selectedTransformation.title}</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedTransformation(null)}
          >
            ← BACK TO HISTORY LIST
          </Button>
        </div>

        <TransformationWorkspace
          transformation={selectedTransformation}
          onTransformationUpdated={(updated) => {
            setSelectedTransformation(updated);
            setTransformations((prev) =>
              prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
            );
          }}
          onBackToConfig={() => setSelectedTransformation(null)}
        />
      </div>
    );
  }

  return (
    <div className="container-fluid px-0">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4 hairline-b pb-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="telemetry-meta">// IMMUTABLE AUDIT TRAIL</span>
            <Badge variant="default">{transformations.length} SESSIONS</Badge>
          </div>
          <h1 className="heading-display h2 mb-0">Transformation History</h1>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={Layers}
          onClick={() => navigate('/transform/new')}
        >
          NEW TRANSFORMATION
        </Button>
      </div>

      {/* Filter Ledger */}
      <div className="p-3 border hairline-border bg-white mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2 font-mono text-xs shadow-sm">
        <div className="d-flex align-items-center gap-2">
          <Calendar size={14} className="text-muted" />
          <span className="text-muted">RECORDED SESSIONS:</span>
          <span className="fw-bold text-dark">{transformations.length} IN NEON DB</span>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="text-center py-5 font-mono text-muted">
          <div className="spinner-border text-dark mb-2" role="status" />
          <div className="text-xs">RETRIEVING HISTORICAL SESSIONS...</div>
        </div>
      ) : transformations.length === 0 ? (
        <EmptyState
          icon={History}
          title="Transformation History Ledger is Empty"
          description="Every completed transformation records an immutable provenance trace, logging source hashes, generated format outputs, and factual integrity calibrations."
          actionLabel="RUN YOUR FIRST TRANSFORMATION"
          onAction={() => navigate('/transform/new')}
        />
      ) : (
        <div className="row g-3">
          {transformations.map((t) => (
            <div key={t.id} className="col-12 col-lg-6">
              <div
                className="p-3 border hairline-border bg-white shadow-sm h-100 d-flex flex-column justify-content-between cursor-pointer transition-colors hover-dark"
                style={{ cursor: 'pointer' }}
                onClick={() => handleOpenDetail(t.id)}
              >
                <div>
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <Badge variant={t.status === 'completed' ? 'success' : 'vermilion'}>
                      {t.status.toUpperCase()}
                    </Badge>
                    <span className="font-mono text-muted text-xs">
                      {new Date(t.created_at).toLocaleDateString()} • {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="heading-display h6 mb-2 text-truncate" title={t.title}>
                    {t.title}
                  </h3>

                  <div className="font-mono text-xs text-muted space-y-1 mb-3">
                    <div>AUDIENCE: <span className="text-dark fw-bold">{t.target_audience}</span></div>
                    <div>TONE: <span className="text-dark fw-bold">{t.tone}</span> • LANG: {t.language}</div>
                  </div>
                </div>

                <div className="pt-3 hairline-t d-flex justify-content-between align-items-center">
                  <span className="font-mono text-xs text-muted">
                    {t.output_count} OUTPUT FORMATS
                  </span>

                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="cf-btn cf-btn-sm cf-btn-outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(t.id);
                      }}
                    >
                      <Eye size={12} className="me-1" /> OPEN DOSSIER
                    </button>
                    <button
                      type="button"
                      className="cf-btn cf-btn-sm cf-btn-outline text-danger"
                      onClick={(e) => handleDelete(t.id, e)}
                      disabled={isDeleting}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
