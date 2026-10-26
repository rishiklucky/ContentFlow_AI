import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  FileCheck,
  Search,
  Calendar,
  Layers,
  Eye,
  Trash2,
  Copy,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Filter,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals / Actions
  const [editingTrans, setEditingTrans] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingTransId, setDeletingTransId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadTransformations();
  }, [statusFilter]);

  const loadTransformations = async () => {
    try {
      setIsLoading(true);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await transformationService.list(params);
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

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!editingTrans || !editTitle.trim()) return;

    try {
      setIsSubmitting(true);
      const updated = await transformationService.update(editingTrans.id, {
        title: editTitle.trim(),
      });
      setTransformations((prev) =>
        prev.map((t) => (t.id === updated.id ? { ...t, title: updated.title } : t))
      );
      if (selectedTransformation?.id === updated.id) {
        setSelectedTransformation((prev) => ({ ...prev, title: updated.title }));
      }
      setEditingTrans(null);
    } catch (err) {
      alert(err.message || 'Failed to rename transformation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicate = async (id, e) => {
    e.stopPropagation();
    try {
      const cloned = await transformationService.duplicate(id);
      setTransformations((prev) => [cloned, ...prev]);
    } catch (err) {
      alert(err.message || 'Failed to duplicate transformation.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTransId) return;
    try {
      setIsSubmitting(true);
      await transformationService.delete(deletingTransId);
      setTransformations((prev) => prev.filter((t) => t.id !== deletingTransId));
      if (selectedTransformation?.id === deletingTransId) {
        setSelectedTransformation(null);
      }
      setDeletingTransId(null);
    } catch (err) {
      alert(err.message || 'Failed to delete transformation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTransformations = transformations.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchTitle = t.title.toLowerCase().includes(q);
    const matchSource = t.source_title?.toLowerCase().includes(q);
    const matchFormats = (t.selected_formats || []).some((f) => f.toLowerCase().includes(q));
    return matchTitle || matchSource || matchFormats;
  });

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
            <span className="telemetry-meta">// AUDIT TRAIL</span>
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

      {/* Filter and Search Bar */}
      <div className="p-3 border hairline-border bg-white mb-4 d-flex flex-column flex-md-row align-items-stretch align-items-md-center justify-content-between gap-3 shadow-sm">
        <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '440px' }}>
          <div className="input-group">
            <span className="input-group-text bg-light rounded-0 border-end-0">
              <Search size={15} className="text-muted" />
            </span>
            <input
              type="text"
              className="cf-input border-start-0"
              placeholder="Search by title, source document, format..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 font-mono text-xs">
          <span className="text-muted">STATUS:</span>
          {['all', 'completed', 'partially_failed', 'failed'].map((st) => (
            <button
              key={st}
              type="button"
              className={`btn btn-sm rounded-0 font-mono text-xs text-nowrap px-2 py-1 ${
                statusFilter === st
                  ? 'btn-dark text-white fw-bold'
                  : 'btn-outline-secondary border-0 text-muted'
              }`}
              onClick={() => setStatusFilter(st)}
            >
              {st.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="text-center py-5 font-mono text-muted">
          <div className="spinner-border text-dark mb-2" role="status" />
          <div className="text-xs">RETRIEVING HISTORICAL SESSIONS FROM NEON DB...</div>
        </div>
      ) : filteredTransformations.length === 0 ? (
        <EmptyState
          icon={History}
          title={searchQuery ? 'No Matching Transformations' : 'Transformation History Ledger is Empty'}
          description={
            searchQuery
              ? 'Try modifying your search term or status filter.'
              : 'Every completed transformation records an immutable provenance trace, logging source documents, generated outputs, and factual integrity calibrations.'
          }
          actionLabel="RUN YOUR FIRST TRANSFORMATION"
          onAction={() => navigate('/transform/new')}
        />
      ) : (
        <div className="row g-3">
          {filteredTransformations.map((t) => (
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

                  <h3 className="heading-display h6 mb-1 text-truncate" title={t.title}>
                    {t.title}
                  </h3>

                  {t.source_title && (
                    <div className="font-mono text-muted text-xs text-truncate mb-2">
                      SOURCE: {t.source_title}
                    </div>
                  )}

                  {t.project_name && (
                    <div className="font-mono text-primary text-xs text-truncate mb-2">
                      PROJECT: {t.project_name}
                    </div>
                  )}

                  <div className="d-flex gap-1 flex-wrap mb-3">
                    {(t.selected_formats || []).map((fmt) => (
                      <span key={fmt} className="badge bg-light text-muted border font-mono" style={{ fontSize: '9px' }}>
                        {fmt.replace('_', ' ').toUpperCase()}
                      </span>
                    ))}
                  </div>

                  <div className="font-mono text-xs text-muted mb-3">
                    AUDIENCE: <span className="text-dark fw-bold">{t.target_audience}</span> • TONE: {t.tone}
                  </div>
                </div>

                <div className="pt-3 hairline-t d-flex justify-content-between align-items-center">
                  <span className="font-mono text-xs text-muted">
                    {t.output_count} OUTPUT FORMATS
                  </span>

                  <div className="d-flex gap-1">
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
                      className="cf-btn cf-btn-sm cf-btn-outline"
                      title="Rename Transformation"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTrans(t);
                        setEditTitle(t.title);
                      }}
                    >
                      <Edit3 size={12} />
                    </button>

                    <button
                      type="button"
                      className="cf-btn cf-btn-sm cf-btn-outline"
                      title="Duplicate Transformation"
                      onClick={(e) => handleDuplicate(t.id, e)}
                    >
                      <Copy size={12} />
                    </button>

                    <button
                      type="button"
                      className="cf-btn cf-btn-sm cf-btn-outline text-danger"
                      title="Delete Transformation"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingTransId(t.id);
                      }}
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

      {/* Rename Transformation Modal */}
      {editingTrans && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-0 border hairline-border shadow">
              <div className="modal-header rounded-0 bg-light hairline-b">
                <h5 className="modal-title heading-display h6 mb-0">Rename Transformation</h5>
                <button type="button" className="btn-close" onClick={() => setEditingTrans(null)} />
              </div>
              <form onSubmit={handleRenameSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label font-mono text-xs fw-bold">TITLE *</label>
                    <input
                      type="text"
                      className="cf-input w-100"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer rounded-0 bg-light hairline-t d-flex justify-content-between">
                  <Button variant="outline" size="sm" onClick={() => setEditingTrans(null)}>
                    CANCEL
                  </Button>
                  <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'SAVING...' : 'SAVE TITLE'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTransId && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-0 border border-danger shadow">
              <div className="modal-header rounded-0 bg-danger-subtle text-danger hairline-b">
                <div className="d-flex align-items-center gap-2">
                  <AlertTriangle size={18} />
                  <h5 className="modal-title heading-display h6 mb-0">Confirm Transformation Deletion</h5>
                </div>
                <button type="button" className="btn-close" onClick={() => setDeletingTransId(null)} />
              </div>
              <div className="modal-body p-4 font-sans text-xs">
                <p className="mb-2 text-dark">
                  Are you sure you want to permanently delete this transformation session?
                </p>
                <p className="text-muted mb-0">
                  This will delete all generated outputs and verification records associated with this transformation. This action cannot be undone.
                </p>
              </div>
              <div className="modal-footer rounded-0 bg-light hairline-t d-flex justify-content-between">
                <Button variant="outline" size="sm" onClick={() => setDeletingTransId(null)}>
                  CANCEL
                </Button>
                <Button variant="primary" size="sm" onClick={handleDeleteConfirm} disabled={isSubmitting}>
                  {isSubmitting ? 'DELETING...' : 'YES, DELETE SESSION'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
