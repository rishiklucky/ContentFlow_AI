import React, { useState } from 'react';
import {
  Brain,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Hash,
  Calendar,
  Building2,
  TrendingUp,
  FileCheck,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { sourceService } from '../../services/api';
import Badge from '../common/Badge';
import Button from '../common/Button';

export default function StructuredAnalysisReview({
  source,
  initialAnalysis,
  onAnalysisUpdated,
}) {
  const [analysis, setAnalysis] = useState(
    initialAnalysis || source?.structured_analysis || null
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'facts' | 'entities' | 'claims' | 'gaps'

  const handleRunAnalysis = async () => {
    if (!source?.id) return;
    setErrorMessage('');
    setIsAnalyzing(true);

    try {
      const response = await sourceService.analyze(source.id);
      setAnalysis(response.analysis);
      if (onAnalysisUpdated) {
        onAnalysisUpdated(response.analysis);
      }
    } catch (err) {
      setErrorMessage(
        err.message || 'Failed to generate structured source analysis with Gemini.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!analysis) {
    return (
      <div className="p-4 border hairline-border bg-white text-center shadow-sm">
        <div className="d-inline-flex p-3 rounded-circle bg-light mb-3">
          <Brain size={32} className="text-dark" />
        </div>
        <h4 className="heading-display h5 mb-2">Structured AI Content Understanding</h4>
        <p className="font-sans text-muted mb-4 mx-auto" style={{ maxWidth: '480px', fontSize: '13px' }}>
          Execute Google Gemini deep fact extraction to extract key topics, executive summaries, numerical figures, named entities, and verified claims before generating derivative content.
        </p>

        {errorMessage && (
          <div className="p-3 mb-3 border border-danger bg-danger-subtle text-danger text-start font-sans text-xs">
            <strong>Analysis Error:</strong> {errorMessage}
          </div>
        )}

        {isAnalyzing && (
          <div className="py-2 mb-3 font-mono text-xs text-muted d-flex align-items-center justify-content-center gap-2">
            <div className="spinner-border spinner-border-sm text-dark" role="status" />
            <span>EXTRACTING FACTS, CLAIMS & TIMELINE VIA GEMINI (15-25s)...</span>
          </div>
        )}

        <Button
          variant="primary"
          size="md"
          icon={isAnalyzing ? RefreshCw : Sparkles}
          disabled={isAnalyzing}
          onClick={handleRunAnalysis}
        >
          {isAnalyzing ? 'ANALYZING SOURCE WITH GEMINI...' : 'EXTRACT STRUCTURED FACTS WITH GEMINI →'}
        </Button>
      </div>
    );
  }

  return (
    <div className="border hairline-border bg-white shadow-sm">
      {/* Header bar */}
      <div className="p-3 bg-light hairline-b d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="telemetry-meta">// STRUCTURED INTELLIGENCE REPORT</span>
          <Badge variant="success">GEMINI VERIFIED</Badge>
          <span className="font-mono text-xs text-muted">
            CONFIDENCE: {(analysis.confidence_score * 100).toFixed(0)}%
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={RefreshCw}
          disabled={isAnalyzing}
          onClick={handleRunAnalysis}
        >
          {isAnalyzing ? 'RE-ANALYZING...' : 'RE-RUN ANALYSIS'}
        </Button>
      </div>

      {errorMessage && (
        <div className="p-3 border-bottom border-danger bg-danger-subtle text-danger font-sans text-xs">
          <strong>Analysis Error:</strong> {errorMessage}
        </div>
      )}

      {/* Main topic banner */}
      <div className="p-3 p-md-4 hairline-b bg-white">
        <div className="telemetry-meta text-muted mb-1">IDENTIFIED MAIN TOPIC</div>
        <h3 className="heading-display h4 mb-0 text-dark">{analysis.main_topic}</h3>
      </div>

      {/* Tab Navigation */}
      <div className="d-flex border-bottom overflow-x-auto bg-light font-mono text-xs">
        <button
          type="button"
          className={`py-2 px-3 border-0 border-bottom border-2 text-nowrap ${
            activeTab === 'summary' ? 'border-dark fw-bold bg-white text-dark' : 'border-transparent text-muted bg-transparent'
          }`}
          onClick={() => setActiveTab('summary')}
        >
          EXECUTIVE SUMMARY
        </button>
        <button
          type="button"
          className={`py-2 px-3 border-0 border-bottom border-2 text-nowrap ${
            activeTab === 'facts' ? 'border-dark fw-bold bg-white text-dark' : 'border-transparent text-muted bg-transparent'
          }`}
          onClick={() => setActiveTab('facts')}
        >
          NUMERICAL FACTS ({analysis.numerical_facts?.length || 0})
        </button>
        <button
          type="button"
          className={`py-2 px-3 border-0 border-bottom border-2 text-nowrap ${
            activeTab === 'entities' ? 'border-dark fw-bold bg-white text-dark' : 'border-transparent text-muted bg-transparent'
          }`}
          onClick={() => setActiveTab('entities')}
        >
          ENTITIES & DATES ({((analysis.entities?.length || 0) + (analysis.dates_and_events?.length || 0))})
        </button>
        <button
          type="button"
          className={`py-2 px-3 border-0 border-bottom border-2 text-nowrap ${
            activeTab === 'claims' ? 'border-dark fw-bold bg-white text-dark' : 'border-transparent text-muted bg-transparent'
          }`}
          onClick={() => setActiveTab('claims')}
        >
          CLAIMS & FINDINGS ({analysis.key_claims?.length || 0})
        </button>
        <button
          type="button"
          className={`py-2 px-3 border-0 border-bottom border-2 text-nowrap ${
            activeTab === 'gaps' ? 'border-dark fw-bold bg-white text-dark' : 'border-transparent text-muted bg-transparent'
          }`}
          onClick={() => setActiveTab('gaps')}
        >
          KNOWLEDGE GAPS ({analysis.uncertain_or_missing_info?.length || 0})
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-3 p-md-4">
        {/* Tab 1: Executive Summary */}
        {activeTab === 'summary' && (
          <div>
            <div className="p-3 bg-light border hairline-border mb-4 font-sans text-break" style={{ lineHeight: 1.7, fontSize: '14px' }}>
              {analysis.executive_summary}
            </div>

            <h5 className="font-mono text-xs fw-bold text-dark mb-2">KEY TAKEAWAYS:</h5>
            <ul className="list-group list-group-flush border hairline-border font-sans text-xs">
              {analysis.key_points?.map((pt, idx) => (
                <li key={idx} className="list-group-item d-flex align-items-start gap-2 py-2">
                  <CheckCircle2 size={15} className="text-success flex-shrink-0 mt-0.5" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>

            {analysis.recommendations?.length > 0 && (
              <div className="mt-4">
                <h5 className="font-mono text-xs fw-bold text-dark mb-2">IDENTIFIED RECOMMENDATIONS:</h5>
                <ul className="list-group list-group-flush border hairline-border font-sans text-xs">
                  {analysis.recommendations.map((rec, idx) => (
                    <li key={idx} className="list-group-item d-flex align-items-start gap-2 py-2 bg-light">
                      <TrendingUp size={15} className="text-primary flex-shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Numerical Facts */}
        {activeTab === 'facts' && (
          <div>
            <div className="row g-2">
              {analysis.numerical_facts?.length === 0 ? (
                <div className="text-muted text-xs p-3">No specific numerical metrics identified in source.</div>
              ) : (
                analysis.numerical_facts.map((num, idx) => (
                  <div key={idx} className="col-12 col-md-6">
                    <div className="p-3 border hairline-border bg-light h-100">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="font-mono text-xs text-muted text-uppercase">{num.metric}</span>
                        <span className="badge bg-dark font-mono text-xs">{num.value}</span>
                      </div>
                      <p className="font-sans text-dark text-xs mb-2">{num.context}</p>
                      {num.excerpt && (
                        <div className="p-1.5 bg-white border font-mono text-[11px] text-muted text-truncate" title={num.excerpt}>
                          "{num.excerpt}"
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Entities & Dates */}
        {activeTab === 'entities' && (
          <div className="space-y-4">
            <div>
              <h5 className="font-mono text-xs fw-bold text-dark mb-2">NAMED ENTITIES & ASSETS:</h5>
              <div className="d-flex flex-wrap gap-2">
                {analysis.entities?.map((ent, idx) => (
                  <div key={idx} className="p-2 border hairline-border bg-light font-mono text-xs">
                    <span className="fw-bold text-dark">{ent.name}</span>
                    <Badge variant="default" className="ms-2">{ent.category.toUpperCase()}</Badge>
                    {ent.context && (
                      <div className="font-sans text-muted text-[11px] mt-1">{ent.context}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {analysis.dates_and_events?.length > 0 && (
              <div className="pt-3 hairline-t">
                <h5 className="font-mono text-xs fw-bold text-dark mb-2">DATES & TIMELINES:</h5>
                <div className="list-group list-group-flush border hairline-border font-sans text-xs">
                  {analysis.dates_and_events.map((d, idx) => (
                    <div key={idx} className="list-group-item d-flex align-items-start gap-2 py-2">
                      <Calendar size={14} className="text-muted flex-shrink-0 mt-0.5" />
                      <div>
                        {d.date && <strong className="font-mono text-dark me-2">[{d.date}]</strong>}
                        <span>{d.event}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Key Claims & Factual Grounding */}
        {activeTab === 'claims' && (
          <div className="space-y-2">
            {analysis.key_claims?.length === 0 ? (
              <div className="text-muted text-xs p-3">No explicit claims listed.</div>
            ) : (
              analysis.key_claims.map((claim, idx) => (
                <div key={idx} className="p-3 border hairline-border bg-light">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="font-sans fw-bold text-dark text-xs">{claim.claim}</span>
                    <Badge variant={claim.status === 'explicit_fact' ? 'success' : 'default'}>
                      {claim.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  {claim.supporting_excerpt && (
                    <div className="font-mono text-[11px] text-muted border-start border-2 border-dark ps-2 mt-1">
                      "{claim.supporting_excerpt}"
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 5: Gaps & Missing Information */}
        {activeTab === 'gaps' && (
          <div>
            <div className="p-3 bg-light border border-warning-subtle mb-3 text-dark font-sans text-xs d-flex align-items-start gap-2">
              <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
              <div>
                <strong>Zero-Fabrication Audit (Rule #8):</strong> The following dimensions, statistics, or metrics are explicitly noted as absent or unverified in the source document.
              </div>
            </div>

            <ul className="list-group list-group-flush border hairline-border font-sans text-xs">
              {analysis.uncertain_or_missing_info?.length === 0 ? (
                <li className="list-group-item text-muted">No information gaps identified.</li>
              ) : (
                analysis.uncertain_or_missing_info.map((gap, idx) => (
                  <li key={idx} className="list-group-item d-flex align-items-start gap-2 py-2">
                    <HelpCircle size={14} className="text-muted flex-shrink-0 mt-0.5" />
                    <span>{gap}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
