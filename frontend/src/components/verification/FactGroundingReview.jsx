import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Hash,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  ExternalLink,
} from 'lucide-react';
import Badge from '../common/Badge';
import Button from '../common/Button';

const CLASSIFICATION_CONFIG = {
  supported: {
    label: 'SUPPORTED',
    badgeVariant: 'success',
    color: '#059669',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    icon: CheckCircle2,
    desc: 'Fact is directly corroborated by source text without alteration.',
  },
  partially_supported: {
    label: 'PARTIAL',
    badgeVariant: 'amber',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    icon: AlertTriangle,
    desc: 'Fact contains elements of truth but includes extrapolations or omitted conditions.',
  },
  unsupported: {
    label: 'UNSUPPORTED',
    badgeVariant: 'vermilion',
    color: '#ea580c',
    bgColor: '#fff7ed',
    borderColor: '#fed7aa',
    icon: HelpCircle,
    desc: 'Claim asserts facts or statistics not found anywhere in source document.',
  },
  contradicts_source: {
    label: 'CONTRADICTION',
    badgeVariant: 'danger',
    color: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    icon: XCircle,
    desc: 'Claim directly conflicts with numbers, dates, or assertions in source.',
  },
  requires_review: {
    label: 'REVIEW',
    badgeVariant: 'default',
    color: '#64748b',
    bgColor: '#f8fafc',
    borderColor: '#e2e8f0',
    icon: HelpCircle,
    desc: 'Subjective, forward-looking, or ambiguous assertion requiring human judgment.',
  },
};

const CLAIM_TYPE_ICONS = {
  numerical: Hash,
  date_event: Calendar,
  entity: Layers,
  substantive: FileText,
};

export default function FactGroundingReview({
  verification,
  isLoading,
  error,
  onRunVerification,
  onReverify,
  onSelectClaim,
  selectedClaimId,
}) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedClaimIds, setExpandedClaimIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const toggleExpand = (claimId) => {
    setExpandedClaimIds((prev) => {
      const next = new Set(prev);
      if (next.has(claimId)) {
        next.delete(claimId);
      } else {
        next.add(claimId);
      }
      return next;
    });
  };

  const claims = verification?.claims || [];
  const counts = verification?.classification_counts || {};
  const scorePercent = verification ? Math.round(verification.overall_grounding_score * 100) : null;

  // Filter claims
  const filteredClaims = claims.filter((claim) => {
    // Classification filter
    if (activeFilter === 'flagged') {
      if (claim.classification !== 'unsupported' && claim.classification !== 'contradicts_source') {
        return false;
      }
    } else if (activeFilter === 'contradictions') {
      if (claim.classification !== 'contradicts_source') return false;
    } else if (activeFilter === 'supported') {
      if (claim.classification !== 'supported') return false;
    } else if (activeFilter === 'review') {
      if (claim.classification !== 'requires_review' && claim.classification !== 'partially_supported') {
        return false;
      }
    }

    // Text search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = claim.claim_text?.toLowerCase().includes(q);
      const matchReason = claim.reasoning?.toLowerCase().includes(q);
      const matchSource = claim.source_excerpt?.toLowerCase().includes(q);
      if (!matchText && !matchReason && !matchSource) return false;
    }

    return true;
  });

  // Loading State
  if (isLoading) {
    return (
      <div className="p-4 border hairline-border bg-white text-center my-3 shadow-sm">
        <RefreshCw size={24} className="text-primary spin-animation mb-2 mx-auto" />
        <h4 className="heading-display h6 mb-1">Auditing Fact Consistency & Grounding</h4>
        <p className="font-mono text-muted text-xs mb-0">
          SCANNING CLAIMS • COMPARING NUMERICAL VALUES & DATES • SYNTHESIZING EVIDENCE
        </p>
      </div>
    );
  }

  // Error State
  if (error && !verification) {
    return (
      <div className="p-3 border border-danger bg-danger-subtle text-danger font-sans text-xs my-3 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
        <div>
          <strong>Verification Error:</strong> {error}
        </div>
        <Button variant="outline" size="sm" onClick={onRunVerification}>
          RETRY VERIFICATION
        </Button>
      </div>
    );
  }

  // Unverified State
  if (!verification) {
    return (
      <div className="p-4 border hairline-border bg-light text-center my-3">
        <ShieldCheck size={32} className="text-muted mb-2 mx-auto" />
        <h4 className="heading-display h6 mb-1">Source Fact Grounding Unverified</h4>
        <p className="font-sans text-muted text-xs mb-3 mx-auto" style={{ maxWidth: '440px' }}>
          Audit this generated output against the original source document to identify supported facts, altered numbers, or potential hallucinations.
        </p>
        <Button variant="primary" size="sm" icon={ShieldCheck} onClick={onRunVerification}>
          RUN FACT CONSISTENCY AUDIT
        </Button>
      </div>
    );
  }

  // Score badge color
  let scoreVariant = 'success';
  if (scorePercent < 60) scoreVariant = 'danger';
  else if (scorePercent < 85) scoreVariant = 'warning';

  const flaggedCount = (counts.unsupported || 0) + (counts.contradicts_source || 0);

  return (
    <div className="border hairline-border bg-white shadow-sm mb-4">
      {/* Grounding Header Bar */}
      <div className="p-3 bg-light hairline-b d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3">
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <div
              className={`p-2 border rounded-0 ${
                flaggedCount > 0 ? 'bg-danger-subtle border-danger text-danger' : 'bg-success-subtle border-success text-success'
              }`}
            >
              {flaggedCount > 0 ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
            </div>
            <div>
              <div className="d-flex align-items-center gap-2">
                <span className="heading-display h6 mb-0 font-mono fw-bold">
                  {scorePercent}% SOURCE GROUNDED
                </span>
                <span
                  className={`badge font-mono rounded-0 ${
                    flaggedCount === 0 ? 'bg-success text-white' : 'bg-danger text-white'
                  }`}
                  style={{ fontSize: '10px' }}
                >
                  {flaggedCount === 0 ? 'CLEAN AUDIT' : `${flaggedCount} FLAGGED`}
                </span>
              </div>
              <div className="font-mono text-xs text-muted">
                {counts.total || claims.length} VERIFIABLE CLAIMS AUDITED • DETERMINISTIC & AI GROUNDING
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            disabled={isLoading}
            onClick={onReverify}
            title="Rerun fact verification on the current text"
          >
            {isLoading ? 'AUDITING...' : 'RERUN AUDIT'}
          </Button>
        </div>
      </div>

      {/* Grounding Metrics Strip */}
      <div className="p-3 hairline-b bg-white">
        <div className="row g-2 text-center font-mono text-xs">
          <div className="col-6 col-sm-4 col-md-2">
            <div className="p-2 border hairline-border bg-light">
              <div className="text-muted" style={{ fontSize: '10px' }}>TOTAL CLAIMS</div>
              <div className="fw-bold fs-6 text-dark">{counts.total || claims.length}</div>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-md-2">
            <div className="p-2 border border-success bg-success-subtle text-success">
              <div style={{ fontSize: '10px' }}>SUPPORTED</div>
              <div className="fw-bold fs-6">{counts.supported || 0}</div>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-md-2">
            <div className="p-2 border border-warning bg-warning-subtle text-warning-emphasis">
              <div style={{ fontSize: '10px' }}>PARTIAL</div>
              <div className="fw-bold fs-6">{counts.partially_supported || 0}</div>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-md-2">
            <div className="p-2 border border-danger bg-danger-subtle text-danger">
              <div style={{ fontSize: '10px' }}>CONTRADICTION</div>
              <div className="fw-bold fs-6">{counts.contradicts_source || 0}</div>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-md-2">
            <div className="p-2 border border-orange bg-orange-subtle text-orange" style={{ color: '#ea580c' }}>
              <div style={{ fontSize: '10px' }}>UNSUPPORTED</div>
              <div className="fw-bold fs-6">{counts.unsupported || 0}</div>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-md-2">
            <div className="p-2 border hairline-border bg-light text-muted">
              <div style={{ fontSize: '10px' }}>REVIEW</div>
              <div className="fw-bold fs-6">{counts.requires_review || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-2 bg-light hairline-b d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
        {/* Filter Pills */}
        <div className="d-flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          {[
            { key: 'all', label: `All (${claims.length})` },
            { key: 'flagged', label: `Flagged (${flaggedCount})`, isDanger: flaggedCount > 0 },
            { key: 'contradictions', label: `Contradictions (${counts.contradicts_source || 0})` },
            { key: 'supported', label: `Supported (${counts.supported || 0})` },
            { key: 'review', label: `Review (${(counts.requires_review || 0) + (counts.partially_supported || 0)})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`btn btn-sm rounded-0 font-mono text-xs text-nowrap px-2 py-1 ${
                activeFilter === tab.key
                  ? 'btn-dark text-white fw-bold'
                  : 'btn-outline-secondary border-0 text-muted'
              }`}
              onClick={() => setActiveFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="d-flex align-items-center gap-2">
          <div className="input-group input-group-sm" style={{ maxWidth: '240px' }}>
            <span className="input-group-text bg-white border-end-0 rounded-0">
              <Search size={12} className="text-muted" />
            </span>
            <input
              type="text"
              className="form-control border-start-0 rounded-0 font-mono text-xs"
              placeholder="Search claims..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Claim Cards List */}
      <div className="p-3" style={{ maxHeight: '520px', overflowY: 'auto' }}>
        {filteredClaims.length === 0 ? (
          <div className="p-4 text-center text-muted font-mono text-xs">
            NO CLAIMS MATCH CURRENT FILTER
          </div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {filteredClaims.map((claim) => {
              const cfg = CLASSIFICATION_CONFIG[claim.classification] || CLASSIFICATION_CONFIG.requires_review;
              const ClassIcon = cfg.icon;
              const TypeIcon = CLAIM_TYPE_ICONS[claim.claim_type] || FileText;
              const isExpanded = expandedClaimIds.has(claim.id || claim.claim_index);
              const isFlagged = claim.classification === 'contradicts_source' || claim.classification === 'unsupported';

              return (
                <div
                  key={claim.id || claim.claim_index}
                  className={`border transition-all ${
                    isFlagged ? 'border-danger-subtle bg-white' : 'hairline-border bg-white'
                  }`}
                  style={{
                    borderLeft: `4px solid ${cfg.color}`,
                  }}
                >
                  {/* Claim Card Header */}
                  <div
                    className="p-3 d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2 cursor-pointer hover-light"
                    onClick={() => toggleExpand(claim.id || claim.claim_index)}
                  >
                    <div className="d-flex align-items-start gap-2 flex-grow-1">
                      <div className="pt-1">
                        <ClassIcon size={16} style={{ color: cfg.color }} />
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                          <span
                            className="badge font-mono rounded-0"
                            style={{
                              backgroundColor: cfg.bgColor,
                              color: cfg.color,
                              border: `1px solid ${cfg.borderColor}`,
                              fontSize: '10px',
                            }}
                          >
                            {cfg.label}
                          </span>

                          <span className="font-mono text-muted text-xs d-flex align-items-center gap-1">
                            <TypeIcon size={11} />
                            {claim.claim_type.toUpperCase()}
                          </span>

                          {claim.is_deterministic && (
                            <span className="badge bg-light text-dark border font-mono" style={{ fontSize: '9px' }}>
                              ⚡ DETERMINISTIC CHECK
                            </span>
                          )}

                          <span className="font-mono text-muted text-xs">
                            CONFIDENCE: {Math.round(claim.confidence_score * 100)}%
                          </span>
                        </div>

                        <p className="font-sans text-dark fw-medium mb-1 text-break" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                          "{claim.claim_text}"
                        </p>

                        {!isExpanded && claim.reasoning && (
                          <div className="font-sans text-muted text-xs text-truncate" style={{ maxWidth: '600px' }}>
                            {claim.reasoning}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm btn-link text-muted p-0 ms-auto text-decoration-none"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {/* Expanded Evidence & Source Grounding Details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-top hairline-border bg-light">
                      {/* Human-Readable Explanation */}
                      {claim.reasoning && (
                        <div className="mt-2 font-sans text-xs text-dark">
                          <strong className="font-mono text-muted d-block mb-1">AUDIT ASSESSMENT:</strong>
                          <p className="mb-2 text-muted">{claim.reasoning}</p>
                        </div>
                      )}

                      {/* Source Excerpt / Evidence Container */}
                      {claim.source_excerpt ? (
                        <div
                          className="p-2 border rounded-0 font-sans mt-2"
                          style={{
                            backgroundColor: cfg.bgColor,
                            borderColor: cfg.borderColor,
                            fontSize: '12px',
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center mb-1 font-mono text-xs fw-bold">
                            <span style={{ color: cfg.color }}>
                              {claim.classification === 'contradicts_source'
                                ? '⚠️ SOURCE CONTRADICTION EXCERPT'
                                : '✓ VERIFIED SOURCE EVIDENCE'}
                            </span>
                            {claim.source_reference && (
                              <span className="text-muted fw-normal">
                                REF: {claim.source_reference}
                              </span>
                            )}
                          </div>
                          <p className="mb-0 fst-italic text-dark">
                            "{claim.source_excerpt}"
                          </p>
                        </div>
                      ) : claim.classification === 'unsupported' ? (
                        <div className="p-2 border border-warning bg-warning-subtle text-warning-emphasis font-mono text-xs mt-2">
                          <strong>ANTI-FABRICATION INTEGRITY:</strong> No supporting excerpt or corroborating metric was found in the source document.
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Human In The Loop Disclaimer */}
      <div className="p-2 bg-light hairline-t d-flex align-items-center gap-2 font-mono text-muted" style={{ fontSize: '11px' }}>
        <Info size={13} className="text-primary flex-shrink-0" />
        <span>
          GROUNDING AUDIT ASSISTANCE: Automated verification compares claims against ingested source facts. This audit assists human fact-checking and does not constitute an infallible guarantee of truth.
        </span>
      </div>
    </div>
  );
}
