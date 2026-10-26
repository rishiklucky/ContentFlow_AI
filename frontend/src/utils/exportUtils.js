/**
 * Export and Clipboard Utilities for ContentFlow AI
 * Supports Markdown, Plain Text, JSON downloads, and robust Clipboard copying.
 */

/**
 * Sanitizes and generates a meaningful filename based on project title and output format.
 * Example: "Nordic-Infrastructure-Report_executive_summary_2026-10-26.md"
 */
export function formatExportFilename(title, formatType, extension) {
  const safeTitle = (title || 'contentflow_export')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[-\s]+/g, '_')
    .slice(0, 40) || 'contentflow';

  const safeFormat = (formatType || 'output')
    .replace(/[^\w-]/g, '')
    .toLowerCase();

  const dateStr = new Date().toISOString().slice(0, 10);
  const ext = extension.startsWith('.') ? extension : `.${extension}`;

  return `${safeTitle}_${safeFormat}_${dateStr}${ext}`;
}

/**
 * Converts Markdown content into clean, readable plain text.
 * Strips markdown markup while preserving structure, headings, bullets, slide numbers, and speaker notes.
 */
export function markdownToPlainText(mdText) {
  if (!mdText) return '';

  const lines = mdText.split('\n');
  const cleanLines = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const stripped = rawLine.trim();

    // Horizontal rules
    if (stripped === '---' || stripped === '***' || stripped === '___') {
      cleanLines.push('----------------------------------------');
      continue;
    }

    // Headings
    if (stripped.startsWith('#')) {
      const match = stripped.match(/^(#+)\s*(.*)/);
      if (match) {
        const level = match[1].length;
        let headingText = match[2];
        // Strip bold/italics
        headingText = headingText.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');

        if (level === 1) {
          cleanLines.push('');
          cleanLines.push('='.repeat(Math.max(headingText.length, 30)));
          cleanLines.push(headingText.toUpperCase());
          cleanLines.push('='.repeat(Math.max(headingText.length, 30)));
        } else if (level === 2) {
          cleanLines.push('');
          cleanLines.push(`## ${headingText.toUpperCase()}`);
          cleanLines.push('-'.repeat(Math.max(headingText.length, 25)));
        } else {
          cleanLines.push('');
          cleanLines.push(`[${headingText}]`);
        }
        continue;
      }
    }

    // Blockquotes & Speaker Notes (> 🗣️ **Speaker Notes:** ...)
    if (stripped.startsWith('>')) {
      let quoteText = stripped.slice(1).trim();
      quoteText = quoteText.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
      cleanLines.push(`   | ${quoteText}`);
      continue;
    }

    // Bullets (- or *)
    if (/^[-*]\s+/.test(stripped)) {
      let bulletText = stripped.replace(/^[-*]\s+/, '');
      bulletText = bulletText.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
      cleanLines.push(`  • ${bulletText}`);
      continue;
    }

    // Normal text: strip bold, italics, code backticks
    let cleaned = rawLine
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1');

    cleanLines.push(cleaned);
  }

  return cleanLines.join('\n').trim();
}

/**
 * Initiates a browser file download using a Blob.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Downloads text content as a Markdown (.md) file.
 */
export function exportMarkdown(content, filename) {
  if (!content) {
    throw new Error('Cannot export empty markdown content.');
  }
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, filename);
}

/**
 * Downloads text content as a Plain Text (.txt) file with markdown symbols cleaned.
 */
export function exportPlainText(content, filename) {
  if (!content) {
    throw new Error('Cannot export empty text content.');
  }
  const plainText = markdownToPlainText(content);
  const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, filename);
}

/**
 * Downloads output data as structured JSON.
 */
export function exportJson(data, filename) {
  if (!data) {
    throw new Error('Cannot export empty data.');
  }
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, filename);
}

/**
 * Robust copy to clipboard supporting standard API with execCommand fallback.
 */
export async function copyToClipboard(text) {
  if (!text) {
    throw new Error('No content available to copy.');
  }

  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to legacy method below
    }
  }

  // Fallback for older browsers or restricted iframe contexts
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.width = '2em';
  textArea.style.height = '2em';
  textArea.style.padding = '0';
  textArea.style.border = 'none';
  textArea.style.outline = 'none';
  textArea.style.boxShadow = 'none';
  textArea.style.background = 'transparent';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (!successful) throw new Error('Failed to copy to clipboard.');
    return true;
  } catch (err) {
    document.body.removeChild(textArea);
    throw new Error('Clipboard copy not supported or denied by browser.');
  }
}
