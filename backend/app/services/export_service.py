import io
import re
import zipfile
from datetime import datetime
from typing import Dict, Any, Optional
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

from app.models.transformation import Transformation, TransformationOutput


def sanitize_filename(title: str, max_length: int = 50) -> str:
    """
    Sanitizes string for safe filename across Windows and Unix platforms.
    """
    if not title:
        title = "contentflow_output"
    # Replace non-alphanumeric (except dashes and underscores) with hyphen
    clean = re.sub(r"[^\w\s-]", "", title).strip()
    clean = re.sub(r"[-\s]+", "_", clean)
    return clean[:max_length] or "contentflow_output"


def markdown_to_plain_text(md_text: str) -> str:
    """
    Converts markdown content into clean, readable plain text.
    Preserves structural sections, headings, bullets, slide titles, and speaker notes
    while stripping markdown markup like asterisks, hashes, and backticks.
    """
    if not md_text:
        return ""

    lines = md_text.splitlines()
    clean_lines = []
    
    for line in lines:
        stripped = line.strip()
        
        # Horizontal rules
        if stripped in ("---", "***", "___"):
            clean_lines.append("-" * 40)
            continue
            
        # Headings: convert # Heading to clear uppercase or structured line
        if stripped.startswith("#"):
            match = re.match(r"^(#+)\s*(.*)", stripped)
            if match:
                level = len(match.group(1))
                heading_text = match.group(2)
                # Strip internal bold/italic
                heading_text = re.sub(r"\*\*([^*]+)\*\*", r"\1", heading_text)
                heading_text = re.sub(r"\*([^*]+)\*", r"\1", heading_text)
                if level == 1:
                    clean_lines.append("")
                    clean_lines.append("=" * len(heading_text))
                    clean_lines.append(heading_text.upper())
                    clean_lines.append("=" * len(heading_text))
                elif level == 2:
                    clean_lines.append("")
                    clean_lines.append(f"## {heading_text.upper()}")
                    clean_lines.append("-" * len(heading_text))
                else:
                    clean_lines.append("")
                    clean_lines.append(f"[{heading_text}]")
                continue
                
        # Blockquotes & Speaker Notes: `> 🗣️ **Speaker Notes:** ...`
        if stripped.startswith(">"):
            content = stripped[1:].strip()
            content = re.sub(r"\*\*([^*]+)\*\*", r"\1", content)
            clean_lines.append(f"   | {content}")
            continue
            
        # Bullet points
        if re.match(r"^[-*]\s+", stripped):
            bullet_text = re.sub(r"^[-*]\s+", "", stripped)
            # Remove bold/italic markers
            bullet_text = re.sub(r"\*\*([^*]+)\*\*", r"\1", bullet_text)
            bullet_text = re.sub(r"\*([^*]+)\*", r"\1", bullet_text)
            clean_lines.append(f"  • {bullet_text}")
            continue

        # Normal text: remove inline bold, italic, code ticks
        cleaned = re.sub(r"\*\*([^*]+)\*\*", r"\1", line)
        cleaned = re.sub(r"\*([^*]+)\*", r"\1", cleaned)
        cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
        clean_lines.append(cleaned)

    return "\n".join(clean_lines).strip()


def generate_docx_document(
    transformation_title: str,
    output: TransformationOutput,
    transformation: Optional[Transformation] = None,
) -> io.BytesIO:
    """
    Creates a formatted DOCX document with headers, metadata, headings, bullets, and speaker notes.
    """
    doc = Document()
    
    # Document Title
    title_p = doc.add_paragraph()
    title_run = title_p.add_run(output.title or f"{output.format_type.replace('_', ' ').title()}")
    title_run.font.size = Pt(20)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(15, 23, 42)  # Deep Navy #0f172a
    
    # Subtitle / Metadata
    meta_p = doc.add_paragraph()
    meta_p.paragraph_format.space_after = Pt(14)
    format_label = output.format_type.replace("_", " ").upper()
    export_time = datetime.utcnow().strftime("%B %d, %Y")
    
    sub_run = meta_p.add_run(
        f"Format: {format_label} | Project: {transformation_title} | Exported: {export_time} | Version: v{output.version}"
    )
    sub_run.font.size = Pt(9)
    sub_run.font.italic = True
    sub_run.font.color.rgb = RGBColor(100, 116, 139) # Slate

    # Divider line
    doc.add_paragraph("-" * 60)

    # Process markdown lines into formatted DOCX paragraphs
    raw_content = output.content or ""
    lines = raw_content.splitlines()

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
            
        if stripped in ("---", "***", "___"):
            sep = doc.add_paragraph()
            sep.paragraph_format.space_before = Pt(8)
            sep.paragraph_format.space_after = Pt(8)
            r = sep.add_run("—" * 35)
            r.font.color.rgb = RGBColor(203, 213, 225)
            continue
            
        # Heading 1
        if stripped.startswith("# ") and not stripped.startswith("## "):
            h = doc.add_heading(level=1)
            h.paragraph_format.space_before = Pt(14)
            h.paragraph_format.space_after = Pt(6)
            run = h.add_run(re.sub(r"[*_#]", "", stripped[2:]))
            run.font.color.rgb = RGBColor(15, 23, 42)
            continue
            
        # Heading 2
        if stripped.startswith("## ") and not stripped.startswith("### "):
            h = doc.add_heading(level=2)
            h.paragraph_format.space_before = Pt(12)
            h.paragraph_format.space_after = Pt(4)
            run = h.add_run(re.sub(r"[*_#]", "", stripped[3:]))
            run.font.color.rgb = RGBColor(30, 41, 59)
            continue
            
        # Heading 3
        if stripped.startswith("### "):
            h = doc.add_heading(level=3)
            h.paragraph_format.space_before = Pt(10)
            h.paragraph_format.space_after = Pt(3)
            run = h.add_run(re.sub(r"[*_#]", "", stripped[4:]))
            run.font.color.rgb = RGBColor(51, 65, 85)
            continue
            
        # Blockquote / Speaker Notes
        if stripped.startswith(">"):
            qp = doc.add_paragraph(style='Quote')
            qp.paragraph_format.left_indent = Inches(0.4)
            note_text = stripped[1:].strip()
            # Clean markers
            note_text = re.sub(r"\*\*([^*]+)\*\*", r"\1", note_text)
            q_run = qp.add_run(note_text)
            q_run.font.italic = True
            q_run.font.size = Pt(10)
            q_run.font.color.rgb = RGBColor(71, 85, 105)
            continue
            
        # Bullets
        if re.match(r"^[-*]\s+", stripped):
            bp = doc.add_paragraph(style='List Bullet')
            b_text = re.sub(r"^[-*]\s+", "", stripped)
            # Parse simple bold
            parts = re.split(r"(\*\*[^*]+\*\*)", b_text)
            for part in parts:
                if part.startswith("**") and part.endswith("**"):
                    br = bp.add_run(part[2:-2])
                    br.bold = True
                else:
                    bp.add_run(part)
            continue
            
        # Normal body paragraph
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        
        parts = re.split(r"(\*\*[^*]+\*\*)", line)
        for part in parts:
            if part.startswith("**") and part.endswith("**"):
                r = p.add_run(part[2:-2])
                r.bold = True
            else:
                p.add_run(part)

    stream = io.BytesIO()
    doc.save(stream)
    stream.seek(0)
    return stream


def generate_batch_export_zip(
    transformation: Transformation,
    user_email: str,
) -> io.BytesIO:
    """
    Bundles all completed outputs into an in-memory ZIP archive
    containing Markdown and Plain Text versions of each format,
    plus an informative MANIFEST.txt.
    """
    zip_buffer = io.BytesIO()
    safe_title = sanitize_filename(transformation.title)

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        manifest_lines = [
            "CONTENTFLOW AI - MULTI-FORMAT GENERATION ARCHIVE",
            "=" * 60,
            f"Project / Transformation: {transformation.title}",
            f"User Account:            {user_email}",
            f"Created Date:            {transformation.created_at.strftime('%Y-%m-%d %H:%M:%S UTC') if transformation.created_at else 'N/A'}",
            f"Target Audience:         {transformation.target_audience}",
            f"Tone:                    {transformation.tone}",
            f"Communication Language:  {transformation.language}",
            f"Total Generated Formats: {len(transformation.outputs)}",
            "=" * 60,
            "",
            "FILES INCLUDED IN THIS ARCHIVE:",
        ]

        for out in transformation.outputs:
            if out.status == "failed" or not out.content:
                manifest_lines.append(f"- [SKIPPED] {out.format_type} (Status: {out.status})")
                continue

            fmt_safe = sanitize_filename(out.format_type)
            
            # 1. Markdown file
            md_filename = f"{safe_title}_{fmt_safe}.md"
            zf.writestr(f"markdown/{md_filename}", out.content.encode("utf-8"))
            
            # 2. Clean Plain Text file
            txt_content = markdown_to_plain_text(out.content)
            txt_filename = f"{safe_title}_{fmt_safe}.txt"
            zf.writestr(f"plain_text/{txt_filename}", txt_content.encode("utf-8"))
            
            manifest_lines.append(f"- {out.title or fmt_safe} (v{out.version}):")
            manifest_lines.append(f"    • markdown/{md_filename}")
            manifest_lines.append(f"    • plain_text/{txt_filename}")

        manifest_lines.append("")
        manifest_lines.append("Integrity: All exports generated with ContentFlow AI source-grounding engine.")
        zf.writestr("MANIFEST.txt", "\n".join(manifest_lines).encode("utf-8"))

    zip_buffer.seek(0)
    return zip_buffer
