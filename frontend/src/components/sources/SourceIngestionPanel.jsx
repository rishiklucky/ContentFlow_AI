import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  Link2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  FolderOpen,
  Hash,
  FileCode,
} from 'lucide-react';
import { sourceService } from '../../services/api';
import Badge from '../common/Badge';
import Button from '../common/Button';

export default function SourceIngestionPanel({ activeSource, onSourceSelected, onSourceCleared }) {
  const [ingestMode, setIngestMode] = useState('file'); // 'file' | 'url' | 'text' | 'library'
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  // Text mode state
  const [textTitle, setTextTitle] = useState('');
  const [pastedText, setPastedText] = useState('');

  // URL mode state
  const [urlTitle, setUrlTitle] = useState('');
  const [articleUrl, setArticleUrl] = useState('');

  // Library / Existing Sources state
  const [savedSources, setSavedSources] = useState([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

  // Extracted text preview toggle
  const [showFullText, setShowFullText] = useState(false);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef(null);

  // Load existing user sources when Library tab is opened
  useEffect(() => {
    if (ingestMode === 'library') {
      loadLibrarySources();
    }
  }, [ingestMode]);

  const loadLibrarySources = async () => {
    try {
      setIsLoadingLibrary(true);
      const data = await sourceService.list();
      setSavedSources(data || []);
    } catch (err) {
      setErrorMessage(err.message || 'Could not load existing sources.');
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setErrorMessage('');

    // Check size limit (20MB)
    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 20MB limit. Please select a smaller document.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(10);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name);

      const source = await sourceService.uploadFile(formData, (percent) => {
        setUploadProgress(percent);
      });

      onSourceSelected(source);
      setUploadProgress(100);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to extract content from uploaded file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!pastedText.trim() || pastedText.trim().length < 10) {
      setErrorMessage('Please enter at least 10 characters of text.');
      return;
    }

    const title = textTitle.trim() || `Pasted Text - ${new Date().toLocaleTimeString()}`;

    try {
      setIsUploading(true);
      const source = await sourceService.createText({
        title,
        text: pastedText.trim(),
      });
      onSourceSelected(source);
      setPastedText('');
      setTextTitle('');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save and process pasted text.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!articleUrl.trim()) {
      setErrorMessage('Please enter a valid HTTP or HTTPS publication URL.');
      return;
    }

    try {
      setIsUploading(true);
      const source = await sourceService.createUrl({
        url: articleUrl.trim(),
        title: urlTitle.trim() || undefined,
      });
      onSourceSelected(source);
      setArticleUrl('');
      setUrlTitle('');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to fetch and extract content from URL.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectFromLibrary = async (sourceSummary) => {
    try {
      setIsUploading(true);
      setErrorMessage('');
      const fullSource = await sourceService.get(sourceSummary.id);
      onSourceSelected(fullSource);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load source details.');
    } finally {
      setIsUploading(false);
    }
  };

  const copyExtractedText = () => {
    if (!activeSource?.extracted_text) return;
    navigator.clipboard.writeText(activeSource.extracted_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {/* If an active source is already extracted and attached */}
      {activeSource ? (
        <div className="p-3 p-md-4 border hairline-border bg-white shadow-sm">
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-3 pb-3 hairline-b">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                <span className="telemetry-meta">// INGESTED SOURCE DOCUMENT</span>
                <Badge variant="success">READY FOR TRANSFORMATION</Badge>
                {activeSource.file_type && (
                  <Badge variant="default">{activeSource.file_type.toUpperCase()}</Badge>
                )}
              </div>
              <h3 className="heading-display h5 mb-1 text-break">{activeSource.title}</h3>
              {activeSource.original_filename && (
                <div className="font-mono text-muted text-xs text-break">
                  ORIGINAL FILE: {activeSource.original_filename}
                </div>
              )}
              {activeSource.source_url && (
                <div className="font-mono text-muted text-xs text-break">
                  SOURCE URL: {activeSource.source_url}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onSourceCleared}
              className="text-danger flex-shrink-0"
            >
              <Trash2 size={14} className="me-1" /> REMOVE SOURCE
            </Button>
          </div>

          {/* Key Metrics Grid */}
          <div className="row g-2 py-3 hairline-b text-center font-mono text-xs">
            <div className="col-4 col-sm-3">
              <div className="p-2 bg-light border hairline-border">
                <div className="text-muted">WORDS</div>
                <div className="h6 mb-0 fw-bold">{activeSource.word_count.toLocaleString()}</div>
              </div>
            </div>
            <div className="col-4 col-sm-3">
              <div className="p-2 bg-light border hairline-border">
                <div className="text-muted">CHARACTERS</div>
                <div className="h6 mb-0 fw-bold">{activeSource.character_count.toLocaleString()}</div>
              </div>
            </div>
            <div className="col-4 col-sm-3">
              <div className="p-2 bg-light border hairline-border">
                <div className="text-muted">PARAGRAPHS</div>
                <div className="h6 mb-0 fw-bold">{activeSource.paragraph_count.toLocaleString()}</div>
              </div>
            </div>
            <div className="col-12 col-sm-3">
              <div className="p-2 bg-light border hairline-border text-start">
                <div className="text-muted d-flex align-items-center gap-1">
                  <Hash size={12} /> SHA-256 HASH
                </div>
                <div
                  className="fw-bold text-truncate"
                  title={activeSource.sha256_hash}
                  style={{ fontSize: '10px' }}
                >
                  {activeSource.sha256_hash ? activeSource.sha256_hash.slice(0, 16) + '...' : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Scanned / OCR warning notice if present */}
          {activeSource.meta_info?.is_scanned && (
            <div className="p-2 my-2 bg-light border d-flex align-items-center gap-2 text-warning font-sans text-xs">
              <AlertCircle size={14} />
              <span>
                Scanned PDF detected. Text extraction quality may depend on scan clarity.
              </span>
            </div>
          )}

          {/* Extracted Text Review Area */}
          <div className="mt-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="font-mono text-xs fw-bold text-dark">
                EXTRACTED CONTENT PREVIEW
              </span>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="cf-btn cf-btn-sm cf-btn-outline"
                  onClick={copyExtractedText}
                  title="Copy extracted text to clipboard"
                >
                  {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                  <span className="ms-1">{copied ? 'COPIED' : 'COPY'}</span>
                </button>
                <button
                  type="button"
                  className="cf-btn cf-btn-sm cf-btn-outline"
                  onClick={() => setShowFullText(!showFullText)}
                >
                  {showFullText ? <EyeOff size={12} /> : <Eye size={12} />}
                  <span className="ms-1">{showFullText ? 'COLLAPSE' : 'EXPAND'}</span>
                </button>
              </div>
            </div>

            <div
              className="p-3 border hairline-border bg-light font-sans text-break"
              style={{
                fontSize: '13px',
                lineHeight: 1.6,
                maxHeight: showFullText ? '400px' : '140px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {activeSource.extracted_text}
            </div>
          </div>
        </div>
      ) : (
        /* Ingestion Input Tabs */
        <div>
          {/* Mode Selector */}
          <div className="btn-group w-100 hairline-border p-1 bg-light mb-3">
            <button
              type="button"
              className={`cf-btn cf-btn-sm flex-fill ${ingestMode === 'file' ? 'cf-btn-primary' : 'cf-btn-outline'}`}
              onClick={() => { setIngestMode('file'); setErrorMessage(''); }}
            >
              <UploadCloud size={14} className="me-1" /> FILE UPLOAD
            </button>
            <button
              type="button"
              className={`cf-btn cf-btn-sm flex-fill ${ingestMode === 'url' ? 'cf-btn-primary' : 'cf-btn-outline'}`}
              onClick={() => { setIngestMode('url'); setErrorMessage(''); }}
            >
              <Link2 size={14} className="me-1" /> URL INGESTION
            </button>
            <button
              type="button"
              className={`cf-btn cf-btn-sm flex-fill ${ingestMode === 'text' ? 'cf-btn-primary' : 'cf-btn-outline'}`}
              onClick={() => { setIngestMode('text'); setErrorMessage(''); }}
            >
              <FileText size={14} className="me-1" /> RAW PROSE
            </button>
            <button
              type="button"
              className={`cf-btn cf-btn-sm flex-fill ${ingestMode === 'library' ? 'cf-btn-primary' : 'cf-btn-outline'}`}
              onClick={() => { setIngestMode('library'); setErrorMessage(''); }}
            >
              <FolderOpen size={14} className="me-1" /> LIBRARY
            </button>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div
              className="p-3 mb-3 border d-flex align-items-start gap-2 text-danger font-sans"
              style={{ backgroundColor: '#FEF2F2', borderColor: '#F87171', fontSize: '13px' }}
              role="alert"
            >
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {/* Upload Progress Indicator */}
          {isUploading && (
            <div className="p-3 mb-3 border hairline-border bg-white text-center font-mono">
              <div className="spinner-border text-dark spinner-border-sm mb-2" role="status" />
              <div className="text-xs fw-bold">PROCESSING DOCUMENT & EXTRACTING TEXT...</div>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="progress mt-2" style={{ height: '6px' }}>
                  <div
                    className="progress-bar bg-dark"
                    role="progressbar"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Tab 1: File Upload */}
          {ingestMode === 'file' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              className={`p-4 p-md-5 border text-center transition-colors ${
                isDragOver ? 'bg-white border-dark border-2' : 'bg-light hairline-border'
              }`}
              style={{ borderStyle: isDragOver ? 'dashed' : 'solid' }}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="d-none"
                accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <UploadCloud size={40} className="text-muted mb-2" />
              <h4 className="heading-display h6 mb-1">DRAG & DROP RESEARCH DOCUMENT</h4>
              <p className="font-sans text-muted text-xs mb-3">
                Supported formats: <strong>PDF, DOCX, TXT, PNG, JPG, WEBP</strong> (Max 20MB)
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                SELECT LOCAL FILE
              </Button>
            </div>
          )}

          {/* Tab 2: URL Ingestion */}
          {ingestMode === 'url' && (
            <form onSubmit={handleUrlSubmit} className="p-3 p-md-4 border hairline-border bg-white shadow-sm">
              <div className="mb-3">
                <label className="cf-label" htmlFor="url-input">
                  Publication or Article URL <span className="text-danger">*</span>
                </label>
                <input
                  id="url-input"
                  type="url"
                  className="cf-input"
                  placeholder="https://example.com/research/market-report-2026.html"
                  value={articleUrl}
                  onChange={(e) => setArticleUrl(e.target.value)}
                  disabled={isUploading}
                  required
                />
                <div className="telemetry-meta mt-1">
                  Protected by SSRF guards: Private/local IPs (127.0.0.1, 10.x, 192.168.x) are strictly blocked.
                </div>
              </div>

              <div className="mb-3">
                <label className="cf-label" htmlFor="url-title-input">
                  Custom Title (Optional)
                </label>
                <input
                  id="url-title-input"
                  type="text"
                  className="cf-input"
                  placeholder="e.g. Q4 Market Overview Article"
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                  disabled={isUploading}
                />
              </div>

              <Button variant="primary" size="sm" type="submit" disabled={isUploading || !articleUrl.trim()}>
                FETCH & EXTRACT ARTICLE
              </Button>
            </form>
          )}

          {/* Tab 3: Raw Prose / Pasted Text */}
          {ingestMode === 'text' && (
            <form onSubmit={handleTextSubmit} className="p-3 p-md-4 border hairline-border bg-white shadow-sm">
              <div className="mb-3">
                <label className="cf-label" htmlFor="text-title-input">
                  Document Title (Optional)
                </label>
                <input
                  id="text-title-input"
                  type="text"
                  className="cf-input"
                  placeholder="e.g. Q3 Earnings Call Notes"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  disabled={isUploading}
                />
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="cf-label mb-0" htmlFor="raw-text-input">
                    Raw Document Corpus <span className="text-danger">*</span>
                  </label>
                  <span className="font-mono text-muted text-xs">
                    {pastedText.length} CHARACTERS | {pastedText.trim() ? pastedText.trim().split(/\s+/).length : 0} WORDS
                  </span>
                </div>
                <textarea
                  id="raw-text-input"
                  className="cf-textarea"
                  rows={6}
                  placeholder="Paste unformatted report text, earnings transcripts, research briefs, or articles here..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  disabled={isUploading}
                  required
                />
              </div>

              <Button variant="primary" size="sm" type="submit" disabled={isUploading || !pastedText.trim()}>
                PROCESS & EXTRACT TEXT
              </Button>
            </form>
          )}

          {/* Tab 4: Library / Previously Uploaded */}
          {ingestMode === 'library' && (
            <div className="p-3 border hairline-border bg-white shadow-sm">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="font-mono text-xs fw-bold text-dark">// SAVED RESEARCH SOURCES</span>
                <button
                  type="button"
                  className="cf-btn cf-btn-sm cf-btn-outline"
                  onClick={loadLibrarySources}
                  disabled={isLoadingLibrary}
                >
                  REFRESH
                </button>
              </div>

              {isLoadingLibrary ? (
                <div className="text-center py-4 font-mono text-xs text-muted">
                  <div className="spinner-border spinner-border-sm text-dark me-2" />
                  LOADING SOURCES...
                </div>
              ) : savedSources.length === 0 ? (
                <div className="text-center py-4 font-sans text-muted text-xs">
                  No source documents found in your library. Upload a file, URL, or pasted text above.
                </div>
              ) : (
                <div className="space-y-2" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {savedSources.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectFromLibrary(item)}
                      className="p-2 border hairline-border bg-light d-flex justify-content-between align-items-center cursor-pointer transition-colors hover-dark"
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="text-truncate me-2">
                        <span className="font-mono text-xs fw-bold text-dark d-block text-truncate">
                          {item.title}
                        </span>
                        <span className="font-mono text-muted text-xs">
                          {item.word_count.toLocaleString()} WORDS | {item.source_type.toUpperCase()} | {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <Badge variant="default">SELECT</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
