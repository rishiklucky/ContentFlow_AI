import React, { useState } from 'react';
import {
  FileText,
  Linkedin,
  Twitter,
  ShieldAlert,
  Presentation,
  Image as ImageIcon,
  Video,
  Sparkles,
  Sliders,
  CheckSquare,
  ArrowRight,
  Info,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Pane from '../components/common/Pane';
import SourceIngestionPanel from '../components/sources/SourceIngestionPanel';
import StructuredAnalysisReview from '../components/analysis/StructuredAnalysisReview';
import TransformationWorkspace from '../components/transformations/TransformationWorkspace';
import { transformationService } from '../services/api';

const FORMAT_OPTIONS = [
  {
    id: 'executive_summary',
    name: 'Executive Summary',
    badge: '600-800w',
    desc: 'Dense C-suite memo with macro takeaways, executive briefing, and strategic context.',
    icon: FileText,
  },
  {
    id: 'linkedin_post',
    name: 'LinkedIn Thought Leadership',
    badge: '250-350w',
    desc: 'Compelling scroll-stopping hook, formatted takeaways, CTA, and relevant hashtags.',
    icon: Linkedin,
  },
  {
    id: 'twitter_thread',
    name: 'X / Twitter Thread Wire',
    badge: '4-7 tweets',
    desc: 'Numbered analytical wire breakdown with strict 280-character per tweet compliance.',
    icon: Twitter,
  },
  {
    id: 'advisory',
    name: 'Institutional Advisory',
    badge: '1200-1800w',
    desc: 'Legal and institutional grade risk, market implications, and strategic directives.',
    icon: ShieldAlert,
  },
  {
    id: 'presentation',
    name: 'Presentation Deck & Notes',
    badge: '5-7 slides',
    desc: 'Slide-by-slide titles, bullet points, layout directives, and full speaker notes.',
    icon: Presentation,
  },
  {
    id: 'infographic',
    name: 'Infographic Blueprint',
    badge: 'Layout Spec',
    desc: 'Structured visual blueprint: hero metric, visual metaphor, color palette, and panel layout.',
    icon: ImageIcon,
  },
  {
    id: 'video_script',
    name: 'Video Script & Storyboard',
    badge: '60-90s',
    desc: 'Scene-by-scene script with timestamps, camera/visual directions, and voiceover audio.',
    icon: Video,
  },
];

const AUDIENCE_OPTIONS = [
  'Executive Leadership (C-Suite)',
  'Industry Practitioners & Operators',
  'Technical Analysts & Engineers',
  'Institutional Investors & Capital Allocators',
  'General Public & Broad Audience',
];

const TONE_OPTIONS = [
  'Professional & Executive',
  'Conversational & Accessible',
  'Deep Technical Rigor',
  'Persuasive & Urgent',
  'Analytical & Objective',
];

const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'French',
  'German',
  'Japanese',
  'Mandarin',
  'Portuguese',
];

const DETAIL_OPTIONS = [
  'Concise & High-Level',
  'Standard & Balanced',
  'Comprehensive & In-Depth',
];

const OBJECTIVE_OPTIONS = [
  'Inform & Brief',
  'Persuade & Convince',
  'Educate & Explain',
  'Drive Decision & Action',
];

export default function NewTransformationPage() {
  const [activeSource, setActiveSource] = useState(null);
  const [selectedFormats, setSelectedFormats] = useState([
    'executive_summary',
    'linkedin_post',
    'twitter_thread',
  ]);
  const [targetAudience, setTargetAudience] = useState(AUDIENCE_OPTIONS[0]);
  const [tone, setTone] = useState(TONE_OPTIONS[0]);
  const [language, setLanguage] = useState(LANGUAGE_OPTIONS[0]);
  const [detailLevel, setDetailLevel] = useState(DETAIL_OPTIONS[1]);
  const [communicationObjective, setCommunicationObjective] = useState(OBJECTIVE_OPTIONS[0]);
  const [directive, setDirective] = useState('');
  const [dossierTitle, setDossierTitle] = useState('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [executionMessage, setExecutionMessage] = useState(null);
  const [completedTransformation, setCompletedTransformation] = useState(null);

  const toggleFormat = (formatId) => {
    setSelectedFormats((prev) =>
      prev.includes(formatId)
        ? prev.filter((id) => id !== formatId)
        : [...prev, formatId]
    );
  };

  const selectAllFormats = () => {
    setSelectedFormats(FORMAT_OPTIONS.map((f) => f.id));
  };

  const clearAllFormats = () => {
    setSelectedFormats([]);
  };

  const handleExecuteTransformation = async () => {
    if (!activeSource) {
      setExecutionMessage({
        type: 'error',
        text: 'Please ingest or select a source document in Step 1 first.',
      });
      return;
    }
    if (selectedFormats.length === 0) {
      setExecutionMessage({
        type: 'error',
        text: 'Please select at least one target output format in Step 2.',
      });
      return;
    }

    setIsGenerating(true);
    setExecutionMessage(null);

    const payload = {
      source_id: activeSource.id,
      title: dossierTitle.trim() || `Transformation: ${activeSource.title}`,
      selected_formats: selectedFormats,
      target_audience: targetAudience,
      tone: tone,
      language: language,
      detail_level: detailLevel,
      communication_objective: communicationObjective,
      additional_instructions: directive.trim() || null,
    };

    try {
      const result = await transformationService.create(payload);
      setCompletedTransformation(result);
    } catch (err) {
      setExecutionMessage({
        type: 'error',
        text: err.message || 'Failed to generate transformation formats. Please try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // If a transformation was just completed, render the full workspace
  if (completedTransformation) {
    return (
      <div className="container-fluid px-0">
        <div className="d-flex justify-content-between align-items-center mb-4 hairline-b pb-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="telemetry-meta">// ACTIVE TRANSFORMATION WORKSPACE</span>
              <Badge variant="success">GENERATION ACTIVE</Badge>
            </div>
            <h1 className="heading-display h3 mb-0">{completedTransformation.title}</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompletedTransformation(null)}
          >
            ← BACK TO CONFIGURATION
          </Button>
        </div>

        <TransformationWorkspace
          transformation={completedTransformation}
          onTransformationUpdated={(updated) => setCompletedTransformation(updated)}
          onBackToConfig={() => setCompletedTransformation(null)}
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
            <span className="telemetry-meta">// GENERATION ENGINE</span>
            <Badge variant="vermilion">CALIBRATION PROTOCOL</Badge>
          </div>
          <h1 className="heading-display h2 mb-0">Multi-Format Content Generation</h1>
        </div>
      </div>

      <div className="row g-4">
        {/* Main Configuration Form */}
        <div className="col-12 col-lg-8">
          <div className="d-flex flex-column gap-4">
            {/* Step 1: Source Material */}
            <Pane title="§ 01. Ingest & Ground Source Material" tag="STEP_01">
              <div className="mb-3">
                <label className="cf-label" htmlFor="dossier-title">
                  Dossier Title
                </label>
                <input
                  id="dossier-title"
                  type="text"
                  className="cf-input"
                  placeholder="e.g., Clean Technology & Capital Deployment Outlook 2026"
                  value={dossierTitle}
                  onChange={(e) => setDossierTitle(e.target.value)}
                />
              </div>

              {/* Source Ingestion Component */}
              <SourceIngestionPanel
                activeSource={activeSource}
                onSourceSelected={(src) => {
                  setActiveSource(src);
                  setExecutionMessage(null);
                  if (!dossierTitle && src?.title) {
                    setDossierTitle(src.title);
                  }
                }}
                onSourceCleared={() => {
                  setActiveSource(null);
                  setExecutionMessage(null);
                }}
              />

              {/* Step 1B: Structured Content Understanding */}
              {activeSource && (
                <div className="mt-4 pt-3 hairline-t">
                  <StructuredAnalysisReview
                    source={activeSource}
                    initialAnalysis={activeSource.structured_analysis}
                    onAnalysisUpdated={(newAnalysis) => {
                      setActiveSource((prev) => ({
                        ...prev,
                        structured_analysis: newAnalysis,
                      }));
                    }}
                  />
                </div>
              )}
            </Pane>

            {/* Step 2: Output Formats Selector */}
            <Pane title="§ 02. Select Target Output Formats" tag="STEP_02">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="font-mono text-xs text-muted">
                  {selectedFormats.length} OF {FORMAT_OPTIONS.length} FORMATS SELECTED
                </span>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-link font-mono text-xs text-dark p-0 text-decoration-none"
                    onClick={selectAllFormats}
                  >
                    SELECT ALL
                  </button>
                  <span className="text-muted">|</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-link font-mono text-xs text-muted p-0 text-decoration-none"
                    onClick={clearAllFormats}
                  >
                    CLEAR
                  </button>
                </div>
              </div>

              <div className="d-flex flex-column gap-2">
                {FORMAT_OPTIONS.map((fmt) => {
                  const isChecked = selectedFormats.includes(fmt.id);
                  const IconComp = fmt.icon;
                  return (
                    <div
                      key={fmt.id}
                      onClick={() => toggleFormat(fmt.id)}
                      className={`p-3 border hairline-border cursor-pointer d-flex align-items-start justify-content-between transition-colors ${
                        isChecked ? 'bg-white border-dark shadow-sm' : 'bg-light text-muted'
                      }`}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="d-flex align-items-start gap-3">
                        <input
                          type="checkbox"
                          className="form-check-input mt-1 rounded-0"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <div className="p-2 bg-light border d-none d-sm-block">
                          <IconComp size={18} className={isChecked ? 'text-dark' : 'text-muted'} />
                        </div>
                        <div>
                          <div className="d-flex align-items-center gap-2">
                            <span className="font-mono text-xs fw-bold text-dark d-block">
                              {fmt.name}
                            </span>
                            <Badge variant={isChecked ? 'default' : 'secondary'}>{fmt.badge}</Badge>
                          </div>
                          <span className="font-sans text-muted d-block mt-1" style={{ fontSize: '12px' }}>
                            {fmt.desc}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Pane>

            {/* Step 3: Audience, Tone & Objectives Calibration */}
            <Pane title="§ 03. Calibration Parameters" tag="STEP_03">
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="cf-label" htmlFor="param-audience">
                    Target Audience
                  </label>
                  <select
                    id="param-audience"
                    className="cf-input"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                  >
                    {AUDIENCE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="cf-label" htmlFor="param-tone">
                    Editorial Tone
                  </label>
                  <select
                    id="param-tone"
                    className="cf-input"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                  >
                    {TONE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4">
                  <label className="cf-label" htmlFor="param-language">
                    Language
                  </label>
                  <select
                    id="param-language"
                    className="cf-input"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4">
                  <label className="cf-label" htmlFor="param-detail">
                    Level of Detail
                  </label>
                  <select
                    id="param-detail"
                    className="cf-input"
                    value={detailLevel}
                    onChange={(e) => setDetailLevel(e.target.value)}
                  >
                    {DETAIL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-4">
                  <label className="cf-label" htmlFor="param-objective">
                    Communication Objective
                  </label>
                  <select
                    id="param-objective"
                    className="cf-input"
                    value={communicationObjective}
                    onChange={(e) => setCommunicationObjective(e.target.value)}
                  >
                    {OBJECTIVE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className="cf-label" htmlFor="directive-input">
                  Additional Instructions & Directives
                </label>
                <textarea
                  id="directive-input"
                  className="cf-textarea"
                  rows={3}
                  value={directive}
                  onChange={(e) => setDirective(e.target.value)}
                  placeholder="e.g., Emphasize capital deployment milestones, highlight transformer shortages, restrict terminology to allocator vocabulary..."
                />
              </div>
            </Pane>
          </div>
        </div>

        {/* Action & Configuration Summary Column */}
        <div className="col-12 col-lg-4">
          <div className="p-3 border hairline-border bg-white shadow-sm font-mono text-xs space-y-3 sticky-top" style={{ top: '80px' }}>
            <div className="hairline-b pb-2 d-flex justify-content-between align-items-center">
              <span className="fw-bold text-dark">// TRANSFORMATION SPEC</span>
              <span className={activeSource ? 'stamp-badge' : 'badge bg-secondary rounded-0'}>
                {activeSource ? 'SOURCE READY' : 'AWAITING SOURCE'}
              </span>
            </div>

            <div className="space-y-1">
              <div className="d-flex justify-content-between text-muted">
                <span>SOURCE:</span>
                <span className="fw-bold text-dark text-truncate ms-2" style={{ maxWidth: '160px' }}>
                  {activeSource ? activeSource.title : 'NONE'}
                </span>
              </div>
              <div className="d-flex justify-content-between text-muted">
                <span>FORMATS:</span>
                <span className="fw-bold text-dark">
                  {selectedFormats.length} / {FORMAT_OPTIONS.length}
                </span>
              </div>
              <div className="d-flex justify-content-between text-muted">
                <span>AUDIENCE:</span>
                <span className="fw-bold text-dark text-truncate ms-2" style={{ maxWidth: '160px' }}>
                  {targetAudience}
                </span>
              </div>
              <div className="d-flex justify-content-between text-muted">
                <span>TONE:</span>
                <span className="fw-bold text-dark text-truncate ms-2" style={{ maxWidth: '160px' }}>
                  {tone}
                </span>
              </div>
              <div className="d-flex justify-content-between text-muted">
                <span>LANGUAGE:</span>
                <span className="fw-bold text-dark">{language}</span>
              </div>
              <div className="d-flex justify-content-between text-muted">
                <span>FACT GROUNDING:</span>
                <span className="fw-bold text-success">ENFORCED</span>
              </div>
              <div className="d-flex justify-content-between text-muted">
                <span>STRUCTURED FACTS:</span>
                <span className="fw-bold text-dark">
                  {activeSource?.structured_analysis?.numerical_facts?.length || 0} NUMS /{' '}
                  {activeSource?.structured_analysis?.entities?.length || 0} ENTS
                </span>
              </div>
            </div>

            {executionMessage && (
              <div
                className={`p-2 border font-sans text-xs ${
                  executionMessage.type === 'error'
                    ? 'text-danger bg-danger-subtle border-danger'
                    : 'text-success bg-success-subtle border-success'
                }`}
              >
                {executionMessage.text}
              </div>
            )}

            <div className="pt-3 hairline-t">
              <Button
                variant="primary"
                size="md"
                className="w-100 mb-2"
                disabled={isGenerating || selectedFormats.length === 0}
                onClick={handleExecuteTransformation}
              >
                {isGenerating ? (
                  <span className="d-flex align-items-center justify-content-center gap-2">
                    <span className="spinner-border spinner-border-sm" role="status" />
                    GENERATING {selectedFormats.length} FORMATS...
                  </span>
                ) : (
                  'EXECUTE TRANSFORMATION →'
                )}
              </Button>
              <div className="telemetry-meta text-center text-muted" style={{ fontSize: '10px' }}>
                Concurrently generates outputs from shared structured facts.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
