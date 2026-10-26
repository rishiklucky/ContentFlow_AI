import React, { useState } from 'react';
import { X, Copy, Check, Download, FileText, Code, File } from 'lucide-react';
import {
  formatExportFilename,
  markdownToPlainText,
  exportMarkdown,
  exportPlainText,
  exportJson,
  copyToClipboard,
} from '../../utils/exportUtils';
import Button from '../common/Button';

export default function ExportPreviewModal({
  isOpen,
  onClose,
  output,
  transformationTitle,
  onNotify,
}) {
  const [selectedFormat, setSelectedFormat] = useState('md'); // 'md' | 'txt' | 'json'
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen || !output) return null;

  const content = output.content || '';
  const plainText = markdownToPlainText(content);
  const jsonPayload = {
    transformation_title: transformationTitle,
    format_type: output.format_type,
    title: output.title,
    version: output.version,
    status: output.status,
    content: output.content,
    structured_data: output.structured_data,
    exported_at: new Date().toISOString(),
  };

  const getPreviewText = () => {
    if (selectedFormat === 'txt') return plainText;
    if (selectedFormat === 'json') return JSON.stringify(jsonPayload, null, 2);
    return content;
  };

  const previewText = getPreviewText();
  const filename = formatExportFilename(transformationTitle, output.format_type, selectedFormat);
  const charCount = previewText.length;
  const wordCount = previewText.split(/\s+/).filter(Boolean).length;

  const handleCopy = async () => {
    try {
      await copyToClipboard(previewText);
      setIsCopied(true);
      if (onNotify) onNotify(`Copied ${selectedFormat.toUpperCase()} preview to clipboard!`, 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to copy to clipboard', 'danger');
    }
  };

  const handleDownload = () => {
    try {
      if (selectedFormat === 'md') {
        exportMarkdown(content, filename);
      } else if (selectedFormat === 'txt') {
        exportPlainText(content, filename);
      } else if (selectedFormat === 'json') {
        exportJson(jsonPayload, filename);
      }
      if (onNotify) onNotify(`Downloaded ${filename} successfully!`, 'success');
      onClose();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Export download failed', 'danger');
    }
  };

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', zIndex: 1055 }}
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable mx-2 mx-sm-auto">
        <div className="modal-content rounded-0 border hairline-border shadow-lg">
          {/* Header */}
          <div className="modal-header bg-light hairline-b py-3 px-3 px-sm-4 d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="telemetry-meta">// EXPORT PREVIEW</span>
              <span className="badge bg-white text-dark border hairline-border font-mono text-xs">
                {output.format_type.toUpperCase()}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-link text-muted p-1 text-decoration-none"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Subheader / Format Selector */}
          <div className="px-3 px-sm-4 py-2 bg-light-subtle hairline-b d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
            <div className="btn-group btn-group-sm rounded-0 font-mono text-xs" role="group">
              <button
                type="button"
                className={`btn btn-sm ${selectedFormat === 'md' ? 'btn-primary' : 'btn-outline-secondary'} rounded-0`}
                onClick={() => setSelectedFormat('md')}
              >
                📄 Markdown (.md)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${selectedFormat === 'txt' ? 'btn-primary' : 'btn-outline-secondary'} rounded-0`}
                onClick={() => setSelectedFormat('txt')}
              >
                📝 Plain Text (.txt)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${selectedFormat === 'json' ? 'btn-primary' : 'btn-outline-secondary'} rounded-0`}
                onClick={() => setSelectedFormat('json')}
              >
                ⚙️ JSON (.json)
              </button>
            </div>

            <div className="font-mono text-xs text-muted text-break">
              FILE: <strong>{filename}</strong>
            </div>
          </div>

          {/* Body Preview */}
          <div className="modal-body p-3 p-sm-4 bg-white" style={{ minHeight: '260px', maxHeight: '55vh', overflowY: 'auto' }}>
            <pre
              className="p-3 bg-light border hairline-border font-mono mb-0 text-dark text-break"
              style={{
                fontSize: '12.5px',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {previewText || '// NO CONTENT AVAILABLE'}
            </pre>
          </div>

          {/* Footer */}
          <div className="modal-footer bg-light hairline-t py-2 px-3 px-sm-4 d-flex flex-column flex-sm-row justify-content-between align-items-stretch align-items-sm-center gap-2">
            <div className="font-mono text-xs text-muted">
              {charCount.toLocaleString()} CHARS • {wordCount.toLocaleString()} WORDS
            </div>

            <div className="d-flex align-items-center gap-2 justify-content-end">
              <Button
                variant="outline"
                size="sm"
                icon={isCopied ? Check : Copy}
                onClick={handleCopy}
              >
                {isCopied ? 'COPIED!' : 'COPY PREVIEW'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={handleDownload}
              >
                DOWNLOAD {selectedFormat.toUpperCase()}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
