import React, { useState } from 'react';
import {
  FileText,
  Share2,
  Twitter,
  Linkedin,
  ShieldAlert,
  Presentation,
  Image as ImageIcon,
  Video,
  Copy,
  Check,
  Download,
  Edit3,
  RefreshCw,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight,
  Save,
  X,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Archive,
  Eye,
  FileDown,
} from 'lucide-react';
import { transformationService } from '../../services/api';
import Badge from '../common/Badge';
import Button from '../common/Button';
import FactGroundingReview from '../verification/FactGroundingReview';
import ExportPreviewModal from './ExportPreviewModal';
import {
  formatExportFilename,
  markdownToPlainText,
  exportMarkdown,
  exportPlainText,
  downloadBlob,
  copyToClipboard,
} from '../../utils/exportUtils';

const FORMAT_ICONS = {
  executive_summary: FileText,
  linkedin_post: Linkedin,
  twitter_thread: Twitter,
  advisory: ShieldAlert,
  presentation: Presentation,
  infographic: ImageIcon,
  video_script: Video,
};

const FORMAT_NAMES = {
  executive_summary: 'Executive Summary',
  linkedin_post: 'LinkedIn Thought Leadership',
  twitter_thread: 'X / Twitter Thread',
  advisory: 'Institutional Advisory',
  presentation: 'Presentation Deck & Notes',
  infographic: 'Infographic Blueprint',
  video_script: 'Video Script & Storyboard',
};

export default function TransformationWorkspace({
  transformation,
  onTransformationUpdated,
  onBackToConfig,
}) {
  const [activeFormatIndex, setActiveFormatIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [notification, setNotification] = useState({ message: '', type: 'success' });
  const [verificationMap, setVerificationMap] = useState({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [showVerificationPanel, setShowVerificationPanel] = useState(true);

  const outputs = transformation?.outputs || [];
  const currentOutput = outputs[activeFormatIndex] || outputs[0] || null;

  const activeVerification =
    verificationMap[currentOutput?.id] ||
    currentOutput?.verifications?.[0] ||
    null;

  const notifyUser = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((prev) => (prev.message === message ? { message: '', type: 'success' } : prev));
    }, 4000);
  };

  const handleRunVerification = async () => {
    if (!currentOutput) return;
    setIsVerifying(true);
    setVerificationError('');
    try {
      const res = await transformationService.verifyOutput(
        transformation.id,
        currentOutput.id
      );
      setVerificationMap((prev) => ({ ...prev, [currentOutput.id]: res }));
    } catch (err) {
      setVerificationError(err.message || 'Fact verification check failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleStartEdit = () => {
    if (!currentOutput) return;
    setEditedContent(currentOutput.content);
    setIsEditing(true);
    setErrorMessage('');
  };

  const handleSaveEdit = async () => {
    if (!currentOutput) return;
    setIsSaving(true);
    setErrorMessage('');
    try {
      const updated = await transformationService.updateOutput(
        transformation.id,
        currentOutput.id,
        { content: editedContent }
      );
      // Update in local state
      const nextOutputs = outputs.map((o) => (o.id === updated.id ? updated : o));
      const nextTrans = { ...transformation, outputs: nextOutputs };
      if (onTransformationUpdated) onTransformationUpdated(nextTrans);
      setIsEditing(false);
      notifyUser('Edits saved successfully. Exports will contain this latest version.', 'success');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!currentOutput) return;
    setIsRegenerating(true);
    setErrorMessage('');
    try {
      const updated = await transformationService.regenerateOutput(
        transformation.id,
        currentOutput.id
      );
      const nextOutputs = outputs.map((o) => (o.id === updated.id ? updated : o));
      const nextTrans = { ...transformation, outputs: nextOutputs };
      if (onTransformationUpdated) onTransformationUpdated(nextTrans);
      setIsEditing(false);
      notifyUser('Output regenerated successfully.', 'success');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to regenerate this output.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopy = async (text, key = 'main', label = 'Content') => {
    if (!text) {
      notifyUser('No content available to copy.', 'danger');
      return;
    }
    try {
      await copyToClipboard(text);
      setCopiedKey(key);
      notifyUser(`${label} copied to clipboard!`, 'success');
      setTimeout(() => setCopiedKey(null), 2500);
    } catch (err) {
      notifyUser(err.message || 'Failed to copy to clipboard.', 'danger');
    }
  };

  const handleDownload = async (format = 'md') => {
    if (!currentOutput || !currentOutput.content || currentOutput.status === 'failed') {
      notifyUser('Cannot export an empty or failed output.', 'danger');
      return;
    }

    const filename = formatExportFilename(transformation.title, currentOutput.format_type, format);

    try {
      if (format === 'md') {
        exportMarkdown(currentOutput.content, filename);
        notifyUser(`Downloaded ${filename} successfully.`, 'success');
      } else if (format === 'txt') {
        exportPlainText(currentOutput.content, filename);
        notifyUser(`Downloaded ${filename} successfully.`, 'success');
      } else if (format === 'json') {
        const jsonPayload = {
          transformation_id: transformation.id,
          project_title: transformation.title,
          output_id: currentOutput.id,
          format_type: currentOutput.format_type,
          title: currentOutput.title,
          version: currentOutput.version,
          status: currentOutput.status,
          content: currentOutput.content,
          structured_data: currentOutput.structured_data,
          exported_at: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(jsonPayload, null, 2)], {
          type: 'application/json;charset=utf-8',
        });
        downloadBlob(blob, filename);
        notifyUser(`Downloaded ${filename} successfully.`, 'success');
      } else if (format === 'docx') {
        setIsExporting(true);
        notifyUser('Generating Word (.docx) document...', 'success');
        const res = await transformationService.exportOutput(
          transformation.id,
          currentOutput.id,
          'docx'
        );
        downloadBlob(res.data, filename);
        notifyUser(`Downloaded ${filename} successfully.`, 'success');
      }
    } catch (err) {
      notifyUser(err.message || 'Export download failed.', 'danger');
    } finally {
      setIsExporting(false);
    }
  };

  const handleBatchExportZip = async () => {
    if (!transformation) return;
    const completedOutputs = outputs.filter((o) => o.status === 'completed' && o.content);
    if (completedOutputs.length === 0) {
      notifyUser('No completed outputs available to export.', 'danger');
      return;
    }

    setIsExporting(true);
    notifyUser('Preparing multi-format ZIP archive...', 'success');
    try {
      const res = await transformationService.exportAll(transformation.id);
      const zipName = formatExportFilename(transformation.title, 'all_formats', '.zip');
      downloadBlob(res.data, zipName);
      notifyUser(`Downloaded ${zipName} successfully!`, 'success');
    } catch (err) {
      notifyUser(err.message || 'Batch ZIP export failed.', 'danger');
    } finally {
      setIsExporting(false);
    }
  };

  if (!transformation || outputs.length === 0) {
    return (
      <div className="p-4 border hairline-border bg-white text-center font-mono text-muted text-xs">
        NO TRANSFORMATION DATA AVAILABLE
      </div>
    );
  }

  const IconComponent = FORMAT_ICONS[currentOutput?.format_type] || FileText;

  return (
    <div className="border hairline-border bg-white shadow-sm">
      {/* Transformation Meta Header */}
      <div className="p-3 bg-light hairline-b d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
        <div>
          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
            <span className="telemetry-meta">// TRANSFORMATION DOSSIER</span>
            <Badge variant={transformation.status === 'completed' ? 'success' : 'vermilion'}>
              {transformation.status.toUpperCase()}
            </Badge>
            <span className="font-mono text-xs text-muted">
              AUDIENCE: {transformation.target_audience} • TONE: {transformation.tone} • LANG: {transformation.language}
            </span>
          </div>
          <h2 className="heading-display h5 mb-0 text-break">{transformation.title}</h2>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            icon={Archive}
            onClick={handleBatchExportZip}
            disabled={isExporting}
            title="Bundle all completed outputs into a downloadable ZIP archive"
          >
            {isExporting ? 'EXPORTING...' : 'EXPORT ALL (.ZIP)'}
          </Button>
          {onBackToConfig && (
            <Button variant="outline" size="sm" onClick={onBackToConfig}>
              ← RECONFIGURE FORMATS
            </Button>
          )}
        </div>
      </div>

      {/* Responsive Format Tab Bar */}
      <div className="hairline-b bg-light px-2 pt-2 d-flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        {outputs.map((out, idx) => {
          const OutIcon = FORMAT_ICONS[out.format_type] || FileText;
          const isActive = idx === activeFormatIndex;
          const isFailed = out.status === 'failed';
          return (
            <button
              key={out.id}
              type="button"
              className={`btn btn-sm rounded-0 font-mono text-xs px-3 py-2 d-flex align-items-center gap-2 text-nowrap transition-colors ${
                isActive
                  ? 'bg-white text-dark fw-bold border-top border-start border-end hairline-border'
                  : 'text-muted border-0 hover-light'
              }`}
              style={{
                marginBottom: isActive ? '-1px' : '0',
                borderBottom: isActive ? '1px solid white' : 'none',
              }}
              onClick={() => {
                setActiveFormatIndex(idx);
                setIsEditing(false);
                setErrorMessage('');
              }}
            >
              <OutIcon size={14} className={isFailed ? 'text-danger' : isActive ? 'text-primary' : 'text-muted'} />
              <span>{FORMAT_NAMES[out.format_type] || out.format_type}</span>
              {isFailed ? (
                <span className="badge bg-danger text-white font-mono" style={{ fontSize: '9px' }}>
                  FAILED
                </span>
              ) : out.version > 1 ? (
                <span className="badge bg-secondary text-white font-mono" style={{ fontSize: '9px' }}>
                  v{out.version}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Output Content Area */}
      {currentOutput && (
        <div className="p-3 p-md-4">
          {/* User Notification Toast/Banner */}
          {notification.message && (
            <div
              className={`p-2 p-md-3 mb-3 border d-flex align-items-center justify-content-between font-mono text-xs ${
                notification.type === 'success'
                  ? 'border-success bg-success-subtle text-success'
                  : 'border-danger bg-danger-subtle text-danger'
              }`}
            >
              <div className="d-flex align-items-center gap-2 text-break">
                {notification.type === 'success' ? (
                  <CheckCircle2 size={16} className="flex-shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="flex-shrink-0" />
                )}
                <span>{notification.message}</span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-link p-0 text-decoration-none text-current ms-2 flex-shrink-0"
                onClick={() => setNotification({ message: '', type: 'success' })}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Output Toolbar */}
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3 pb-3 mb-3 hairline-b">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="p-2 bg-light border rounded-0">
                <IconComponent size={20} className="text-dark" />
              </div>
              <div>
                <h3 className="heading-display h6 mb-0 text-break">{currentOutput.title}</h3>
                <div className="font-mono text-xs text-muted d-flex align-items-center gap-2 flex-wrap">
                  <span>VERSION: {currentOutput.version}</span>
                  <span>•</span>
                  <span>STATUS: {currentOutput.status.toUpperCase()}</span>
                  <span>•</span>
                  <span>UPDATED: {new Date(currentOutput.updated_at).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="d-flex align-items-center gap-2 flex-wrap w-100 w-lg-auto justify-content-start justify-content-lg-end">
              {!isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Edit3}
                    onClick={handleStartEdit}
                    disabled={currentOutput.status === 'failed'}
                    title="Edit output text directly"
                  >
                    EDIT
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    icon={isRegenerating ? RefreshCw : RefreshCw}
                    disabled={isRegenerating}
                    onClick={handleRegenerate}
                    title="Regenerate this specific output without touching other outputs"
                  >
                    {isRegenerating ? 'REGENERATING...' : 'REGENERATE'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    icon={copiedKey === 'main' ? Check : Copy}
                    onClick={() => handleCopy(currentOutput.content, 'main', 'Output')}
                    disabled={!currentOutput.content || currentOutput.status === 'failed'}
                    title="Copy full content to clipboard"
                  >
                    {copiedKey === 'main' ? 'COPIED!' : 'COPY'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    icon={Eye}
                    onClick={() => setIsPreviewOpen(true)}
                    disabled={!currentOutput.content || currentOutput.status === 'failed'}
                    title="Preview formatted Plain Text, Markdown, or JSON before downloading"
                  >
                    PREVIEW
                  </Button>

                  <Button
                    variant={activeVerification ? (activeVerification.overall_grounding_score >= 0.85 ? 'outline' : 'outline') : 'primary'}
                    size="sm"
                    icon={ShieldCheck}
                    onClick={() => setShowVerificationPanel((prev) => !prev)}
                    title="Audit claims against source facts"
                  >
                    {activeVerification
                      ? `${Math.round(activeVerification.overall_grounding_score * 100)}% GROUNDED`
                      : 'AUDIT FACTS'}
                  </Button>

                  <div className="dropdown">
                    <button
                      className="cf-btn cf-btn-sm cf-btn-outline dropdown-toggle d-flex align-items-center gap-1"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                      disabled={!currentOutput.content || currentOutput.status === 'failed' || isExporting}
                    >
                      <Download size={13} /> {isExporting ? 'EXPORTING...' : 'EXPORT'}
                    </button>
                    <ul className="dropdown-menu rounded-0 shadow-sm font-mono text-xs">
                      <li>
                        <button className="dropdown-item py-2 d-flex align-items-center gap-2" onClick={() => setIsPreviewOpen(true)}>
                          <span>👁️</span> <span>Preview & Formats...</span>
                        </button>
                      </li>
                      <li>
                        <hr className="dropdown-divider my-1" />
                      </li>
                      <li>
                        <button className="dropdown-item py-2 d-flex align-items-center gap-2" onClick={() => handleDownload('md')}>
                          <span>📄</span> <span>Markdown (.md)</span>
                        </button>
                      </li>
                      <li>
                        <button className="dropdown-item py-2 d-flex align-items-center gap-2" onClick={() => handleDownload('txt')}>
                          <span>📝</span> <span>Plain Text (.txt)</span>
                        </button>
                      </li>
                      <li>
                        <button className="dropdown-item py-2 d-flex align-items-center gap-2" onClick={() => handleDownload('docx')}>
                          <span>📑</span> <span>Word Document (.docx)</span>
                        </button>
                      </li>
                      <li>
                        <button className="dropdown-item py-2 d-flex align-items-center gap-2" onClick={() => handleDownload('json')}>
                          <span>⚙️</span> <span>JSON Data (.json)</span>
                        </button>
                      </li>
                      <li>
                        <hr className="dropdown-divider my-1" />
                      </li>
                      <li>
                        <button className="dropdown-item py-2 d-flex align-items-center gap-2 text-primary" onClick={handleBatchExportZip}>
                          <span>📦</span> <span>All Outputs (.zip)</span>
                        </button>
                      </li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="d-flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Save}
                    disabled={isSaving}
                    onClick={handleSaveEdit}
                  >
                    {isSaving ? 'SAVING...' : 'SAVE EDITS'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={X}
                    disabled={isSaving}
                    onClick={() => setIsEditing(false)}
                  >
                    CANCEL
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Fact Grounding & Source Consistency Inspector */}
          {showVerificationPanel && (
            <FactGroundingReview
              verification={activeVerification}
              isLoading={isVerifying}
              error={verificationError}
              onRunVerification={handleRunVerification}
              onReverify={handleRunVerification}
            />
          )}


          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 mb-3 border border-danger bg-danger-subtle text-danger font-sans text-xs">
              <strong>Error:</strong> {errorMessage}
            </div>
          )}

          {/* Failed Output State */}
          {currentOutput.status === 'failed' && (
            <div className="p-4 border border-danger bg-danger-subtle text-center my-3">
              <AlertTriangle size={28} className="text-danger mb-2" />
              <h4 className="heading-display h6 text-danger mb-1">Output Generation Failed</h4>
              <p className="font-sans text-muted text-xs mb-3 mx-auto" style={{ maxWidth: '480px' }}>
                {currentOutput.error_message || 'An error occurred while generating this format.'}
              </p>
              <Button
                variant="primary"
                size="sm"
                icon={RefreshCw}
                disabled={isRegenerating}
                onClick={handleRegenerate}
              >
                {isRegenerating ? 'RETRYING...' : 'RETRY GENERATING THIS FORMAT'}
              </Button>
            </div>
          )}

          {/* Editing Mode */}
          {isEditing && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-2 font-mono text-xs text-muted">
                <span>EDITING RAW MARKDOWN / TEXT:</span>
                <span>
                  {editedContent.length.toLocaleString()} CHARS • {editedContent.split(/\s+/).filter(Boolean).length} WORDS
                </span>
              </div>
              <textarea
                className="cf-input w-100 font-mono"
                rows={16}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                style={{ fontSize: '13px', lineHeight: 1.6 }}
              />
            </div>
          )}

          {/* Standard Formatted Content Views */}
          {!isEditing && currentOutput.status !== 'failed' && (
            <div>
              {/* Specialized View: X / Twitter Thread */}
              {currentOutput.format_type === 'twitter_thread' && currentOutput.structured_data?.tweets && (
                <div>
                  <div className="font-mono text-xs text-muted mb-3 d-flex align-items-center justify-content-between">
                    <span>{currentOutput.structured_data.tweets.length} THREAD WIRE CARDS</span>
                    <span>STRICT 280-CHARACTER COMPLIANCE</span>
                  </div>
                  <div className="d-flex flex-column gap-3">
                    {currentOutput.structured_data.tweets.map((tw) => {
                      const count = tw.text?.length || 0;
                      const isOver = count > 280;
                      return (
                        <div key={tw.tweet_number} className="p-3 border hairline-border bg-white shadow-sm">
                          <div className="d-flex justify-content-between align-items-center mb-2 font-mono text-xs">
                            <span className="fw-bold text-dark">
                              TWEET {tw.tweet_number}/{currentOutput.structured_data.tweets.length}
                            </span>
                            <div className="d-flex align-items-center gap-2">
                              <span className={`badge ${isOver ? 'bg-danger text-white' : 'bg-light text-muted border'}`}>
                                {count} / 280
                              </span>
                              <button
                                type="button"
                                className="btn btn-sm btn-link text-muted p-0 text-decoration-none"
                                onClick={() => handleCopy(tw.text, `tw_${tw.tweet_number}`)}
                              >
                                {copiedKey === `tw_${tw.tweet_number}` ? (
                                  <span className="text-success text-xs font-mono">COPIED</span>
                                ) : (
                                  <Copy size={13} />
                                )}
                              </button>
                            </div>
                          </div>
                          <p className="font-sans text-dark mb-0 text-break" style={{ fontSize: '14px', lineHeight: 1.6 }}>
                            {tw.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Specialized View: Presentation Deck */}
              {currentOutput.format_type === 'presentation' && currentOutput.structured_data?.slides && (
                <div>
                  <div className="font-mono text-xs text-muted mb-3">
                    SLIDE-BY-SLIDE PRESENTATION CARDS WITH SPEAKER NOTES
                  </div>
                  <div className="row g-3">
                    {currentOutput.structured_data.slides.map((slide) => (
                      <div key={slide.slide_number} className="col-12 col-lg-6">
                        <div className="p-3 border hairline-border bg-white shadow-sm h-100 d-flex flex-column justify-content-between">
                          <div>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <Badge variant="default">SLIDE {slide.slide_number}</Badge>
                              <span className="font-mono text-muted text-xs text-truncate ms-2" style={{ maxWidth: '200px' }}>
                                {slide.visual_layout_suggestion}
                              </span>
                            </div>
                            <h4 className="heading-display h6 mb-3">{slide.title}</h4>
                            <ul className="font-sans text-muted ps-3 mb-3" style={{ fontSize: '13px', lineHeight: 1.6 }}>
                              {slide.bullet_points?.map((bp, i) => (
                                <li key={i}>{bp}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="p-2 bg-light border hairline-border font-sans mt-2" style={{ fontSize: '12px' }}>
                            <strong className="font-mono text-dark d-block mb-1">🗣️ SPEAKER NOTES:</strong>
                            <p className="text-muted mb-0">{slide.speaker_notes}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Specialized View: Infographic Blueprint */}
              {currentOutput.format_type === 'infographic' && currentOutput.structured_data?.sections && (
                <div>
                  <div className="p-3 bg-light border hairline-border mb-3">
                    <div className="font-mono text-xs text-muted mb-1">// HERO FOCAL STATISTIC</div>
                    <div className="heading-display h4 text-primary mb-1">{currentOutput.structured_data.hero_metric}</div>
                    <div className="font-mono text-xs text-muted">
                      THEME: {currentOutput.structured_data.visual_metaphor} • COLORS:{' '}
                      {currentOutput.structured_data.recommended_color_palette?.join(', ')}
                    </div>
                  </div>

                  <div className="row g-3">
                    {currentOutput.structured_data.sections.map((sec) => (
                      <div key={sec.section_number} className="col-12 col-md-6 col-xl-4">
                        <div className="p-3 border hairline-border bg-white shadow-sm h-100">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <Badge variant="default">PANEL {sec.section_number}</Badge>
                            <span className="font-mono text-xs text-muted">[{sec.icon_suggestion}]</span>
                          </div>
                          <h4 className="heading-display h6 mb-1">{sec.title}</h4>
                          <div className="p-2 bg-light font-mono text-xs fw-bold text-dark mb-2">
                            {sec.focal_stat}
                          </div>
                          <div className="font-mono text-muted text-xs mb-2">
                            LAYOUT: {sec.layout_directive}
                          </div>
                          <p className="font-sans text-muted mb-0" style={{ fontSize: '12px', lineHeight: 1.5 }}>
                            {sec.body_copy}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Specialized View: Video Script & Storyboard */}
              {currentOutput.format_type === 'video_script' && currentOutput.structured_data?.scenes && (
                <div>
                  <div className="p-3 bg-light border hairline-border mb-3 d-flex flex-column flex-sm-row justify-content-between gap-2">
                    <div>
                      <div className="font-mono text-xs text-muted">// VIDEO STORYBOARD BRIEF</div>
                      <div className="heading-display h6 mb-0">{currentOutput.structured_data.video_title}</div>
                    </div>
                    <div className="font-mono text-xs text-muted text-sm-end">
                      DURATION: {currentOutput.structured_data.estimated_duration}
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-bordered hairline-border align-middle font-sans text-xs">
                      <thead className="table-light font-mono text-muted">
                        <tr>
                          <th style={{ width: '120px' }}>SCENE & TIMECODE</th>
                          <th style={{ width: '40%' }}>VISUAL & CAMERA DIRECTIONS</th>
                          <th>VERBATIM VOICEOVER NARRATION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentOutput.structured_data.scenes.map((sc) => (
                          <tr key={sc.scene_number}>
                            <td className="font-mono fw-bold text-dark">
                              SCENE {sc.scene_number}
                              <div className="text-muted fw-normal">{sc.timecode}</div>
                            </td>
                            <td className="text-muted">{sc.visual_cues}</td>
                            <td className="text-dark fw-medium">"{sc.narration_script}"</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Default Formatted Markdown View (Executive Summary, LinkedIn, Advisory) */}
              {(currentOutput.format_type === 'executive_summary' ||
                currentOutput.format_type === 'linkedin_post' ||
                currentOutput.format_type === 'advisory' ||
                !currentOutput.structured_data) && (
                <div
                  className="p-3 p-md-4 bg-light border hairline-border font-sans text-dark"
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    maxHeight: '600px',
                    overflowY: 'auto',
                  }}
                >
                  {currentOutput.content}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Export & Format Preview Modal */}
      <ExportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        output={currentOutput}
        transformationTitle={transformation?.title || 'Transformation'}
        onNotify={notifyUser}
      />
    </div>
  );
}
