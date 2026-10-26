import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  FileText,
  Search,
  Trash2,
  Eye,
  ArrowRight,
  ExternalLink,
  Hash,
  UploadCloud,
  Check,
} from 'lucide-react';
import { sourceService } from '../services/api';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import StructuredAnalysisReview from '../components/analysis/StructuredAnalysisReview';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalTab, setModalTab] = useState('text');

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      setIsLoading(true);
      const data = await sourceService.list();
      setSources(data || []);
    } catch (err) {
      console.error('Failed to load sources:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this source document and its stored binary?')) {
      return;
    }

    try {
      setIsDeleting(true);
      await sourceService.delete(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
      if (selectedSource?.id === id) {
        setSelectedSource(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete source.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewDetail = async (id) => {
    try {
      const full = await sourceService.get(id);
      setSelectedSource(full);
    } catch (err) {
      alert(err.message || 'Failed to load source details.');
    }
  };

  const filteredSources = sources.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.source_type && s.source_type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="container-fluid px-0">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4 hairline-b pb-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="telemetry-meta">// RESEARCH REPOSITORY</span>
            <Badge variant="default">{sources.length} INGESTED</Badge>
          </div>
          <h1 className="heading-display h2 mb-0">Sources & Research Dossiers</h1>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={UploadCloud}
          onClick={() => navigate('/transform/new')}
        >
          INGEST NEW DOCUMENT
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 border hairline-border bg-white mb-4 d-flex flex-column flex-md-row align-items-stretch align-items-md-center justify-content-between gap-3 shadow-sm">
        <div className="input-group" style={{ maxWidth: '400px' }}>
          <span className="input-group-text bg-light rounded-0 border-end-0">
            <Search size={15} className="text-muted" />
          </span>
          <input
            type="text"
            className="cf-input border-start-0"
            placeholder="Search documents by title or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="d-flex align-items-center gap-2 font-mono text-xs">
          <span className="text-muted">TOTAL INGESTED:</span>
          <span className="fw-bold text-dark">{sources.length}</span>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="text-center py-5 font-mono text-muted">
          <div className="spinner-border text-dark mb-2" role="status" />
          <div className="text-xs">RETRIEVING INGESTED SOURCES FROM NEON DB...</div>
        </div>
      ) : filteredSources.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={searchQuery ? 'No Matching Documents' : 'No Ingested Sources Yet'}
          description={
            searchQuery
              ? 'Try modifying your search term.'
              : 'Upload research PDFs, Word documents, URLs, or paste text to build your grounded research library.'
          }
          actionLabel="INGEST YOUR FIRST SOURCE"
          actionIcon={UploadCloud}
          onAction={() => navigate('/transform/new')}
          extraDetails="Supports PDF with page structure, DOCX, TXT, OCR images, and SSRF-protected URL fetching."
        />
      ) : (
        <div className="row g-3">
          {filteredSources.map((source) => (
            <div key={source.id} className="col-12 col-md-6 col-xl-4">
              <div
                onClick={() => handleViewDetail(source.id)}
                className="p-3 border hairline-border bg-white shadow-sm h-100 d-flex flex-column justify-content-between transition-colors hover-dark"
                style={{ cursor: 'pointer' }}
              >
                <div>
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <Badge variant="default">
                      {(source.file_type || source.source_type || 'SOURCE').toUpperCase()}
                    </Badge>
                    <span className="font-mono text-muted text-xs">
                      {new Date(source.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="heading-display h6 mb-1 text-truncate" title={source.title}>
                    {source.title}
                  </h3>

                  {source.original_filename && (
                    <div className="font-mono text-muted text-xs text-truncate mb-2">
                      FILE: {source.original_filename}
                    </div>
                  )}
                </div>

                <div className="pt-3 mt-3 hairline-t">
                  <div className="d-flex justify-content-between align-items-center font-mono text-xs text-muted mb-2">
                    <span>{source.word_count.toLocaleString()} WORDS</span>
                    <span>{source.paragraph_count} PARAGRAPHS</span>
                  </div>

                  <div className="d-flex justify-content-between align-items-center pt-2">
                    <button
                      type="button"
                      className="cf-btn cf-btn-sm cf-btn-outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetail(source.id);
                      }}
                    >
                      <Eye size={12} className="me-1" /> PREVIEW
                    </button>

                    <button
                      type="button"
                      className="cf-btn cf-btn-sm cf-btn-outline text-danger"
                      onClick={(e) => handleDelete(source.id, e)}
                      disabled={isDeleting}
                      title="Delete source document and binary"
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

      {/* Detail / Text Preview Modal */}
      {selectedSource && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSelectedSource(null)}
        >
          <div
            className="modal-dialog modal-lg modal-dialog-scrollable"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content rounded-0 border hairline-border">
              <div className="modal-header rounded-0 bg-light hairline-b">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <Badge variant="default">
                      {(selectedSource.file_type || selectedSource.source_type).toUpperCase()}
                    </Badge>
                    <span className="telemetry-meta">// SOURCE DETAIL</span>
                  </div>
                  <h5 className="modal-title heading-display h6 text-break">{selectedSource.title}</h5>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedSource(null)}
                />
              </div>

              <div className="modal-body p-4">
                {/* Metrics */}
                <div className="row g-2 text-center font-mono text-xs mb-3">
                  <div className="col-4">
                    <div className="p-2 bg-light border">
                      <div className="text-muted">WORDS</div>
                      <div className="fw-bold h6 mb-0">{selectedSource.word_count.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="p-2 bg-light border">
                      <div className="text-muted">CHARACTERS</div>
                      <div className="fw-bold h6 mb-0">{selectedSource.character_count.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="p-2 bg-light border">
                      <div className="text-muted">PARAGRAPHS</div>
                      <div className="fw-bold h6 mb-0">{selectedSource.paragraph_count}</div>
                    </div>
                  </div>
                </div>

                {selectedSource.sha256_hash && (
                  <div className="p-2 bg-light border font-mono text-xs mb-3 d-flex align-items-center gap-2">
                    <Hash size={14} className="text-muted" />
                    <span className="text-muted">SHA-256:</span>
                    <span className="fw-bold text-break">{selectedSource.sha256_hash}</span>
                  </div>
                )}

                {/* Modal View Tabs */}
                <div className="d-flex border-bottom hairline-border mb-3 font-mono text-xs">
                  <button
                    type="button"
                    className={`btn btn-link text-decoration-none rounded-0 px-3 py-2 fw-bold ${
                      modalTab === 'text'
                        ? 'border-bottom border-2 border-dark text-dark'
                        : 'text-muted'
                    }`}
                    onClick={() => setModalTab('text')}
                  >
                    RAW EXTRACTED TEXT
                  </button>
                  <button
                    type="button"
                    className={`btn btn-link text-decoration-none rounded-0 px-3 py-2 fw-bold d-flex align-items-center gap-1 ${
                      modalTab === 'analysis'
                        ? 'border-bottom border-2 border-dark text-dark'
                        : 'text-muted'
                    }`}
                    onClick={() => setModalTab('analysis')}
                  >
                    AI STRUCTURED UNDERSTANDING
                    {selectedSource.structured_analysis && (
                      <span className="badge bg-dark text-white font-mono" style={{ fontSize: '9px' }}>
                        ANALYZED
                      </span>
                    )}
                  </button>
                </div>

                {modalTab === 'text' ? (
                  <>
                    <div className="font-mono text-xs fw-bold text-dark mb-2">EXTRACTED CONTENT:</div>
                    <div
                      className="p-3 bg-light border hairline-border font-sans text-break"
                      style={{
                        fontSize: '13px',
                        lineHeight: 1.6,
                        maxHeight: '350px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {selectedSource.extracted_text}
                    </div>
                  </>
                ) : (
                  <StructuredAnalysisReview
                    source={selectedSource}
                    initialAnalysis={selectedSource.structured_analysis}
                    onAnalysisUpdated={(newAnalysis) => {
                      setSelectedSource((prev) => ({
                        ...prev,
                        structured_analysis: newAnalysis,
                        analyzed_at: new Date().toISOString(),
                      }));
                      setSources((prev) =>
                        prev.map((s) =>
                          s.id === selectedSource.id
                            ? { ...s, structured_analysis: newAnalysis, analyzed_at: new Date().toISOString() }
                            : s
                        )
                      );
                    }}
                  />
                )}
              </div>

              <div className="modal-footer rounded-0 bg-light hairline-t d-flex justify-content-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSource(null)}
                >
                  CLOSE
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/transformations/new')}
                >
                  USE IN TRANSFORMATION →
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
