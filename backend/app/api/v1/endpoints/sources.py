import hashlib
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.source import Source
from app.schemas.source import (
    SourceCreateText,
    SourceCreateURL,
    SourceResponse,
    SourceSummaryResponse,
)
from app.schemas.analysis import SourceAnalysisResponse, StructuredSourceAnalysis
from app.services.extractor import extract_content, calculate_text_metrics
from app.services.storage import storage_service, MAX_FILE_SIZE_BYTES
from app.services.ssrf import fetch_url_article
from app.services.gemini import gemini_service

router = APIRouter()


@router.post("/upload", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
async def upload_source_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload and extract text from supported documents (PDF, DOCX, TXT, PNG, JPG, JPEG, WEBP).
    Validates file format, size limits, computes SHA-256 hash, and stores metadata in PostgreSQL.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided in upload request.",
        )

    # Read binary contents
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read uploaded file: {str(e)}",
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.",
        )

    # Extract text and metadata
    try:
        file_type, extracted_text, meta = extract_content(file_bytes, file.filename)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Content extraction failed: {str(err)}",
        )

    # Persist file binary to storage
    try:
        storage_path, sha256_hash, file_size = storage_service.save_file(
            user_id=current_user.id,
            original_filename=file.filename,
            file_bytes=file_bytes,
        )
    except Exception as store_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store file on disk: {str(store_err)}",
        )

    # Calculate metrics
    char_count, word_count, para_count = calculate_text_metrics(extracted_text)

    source_title = title.strip() if title and title.strip() else file.filename

    new_source = Source(
        user_id=current_user.id,
        title=source_title,
        source_type="file",
        file_type=file_type,
        original_filename=file.filename,
        storage_path=storage_path,
        file_size_bytes=file_size,
        sha256_hash=sha256_hash,
        extracted_text=extracted_text,
        character_count=char_count,
        word_count=word_count,
        paragraph_count=para_count,
        meta_info=meta,
    )

    db.add(new_source)
    db.commit()
    db.refresh(new_source)

    return new_source


@router.post("/text", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
def create_text_source(
    data: SourceCreateText,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ingest and process pasted raw text or articles.
    """
    clean_text = data.text.strip()
    if len(clean_text) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pasted text must contain at least 10 characters.",
        )

    char_count, word_count, para_count = calculate_text_metrics(clean_text)
    sha256_hash = hashlib.sha256(clean_text.encode("utf-8")).hexdigest()

    new_source = Source(
        user_id=current_user.id,
        title=data.title.strip(),
        source_type="pasted_text",
        file_type="txt",
        original_filename=None,
        storage_path=None,
        source_url=None,
        file_size_bytes=len(clean_text.encode("utf-8")),
        sha256_hash=sha256_hash,
        extracted_text=clean_text,
        character_count=char_count,
        word_count=word_count,
        paragraph_count=para_count,
        meta_info={"input_method": "pasted_text"},
    )

    db.add(new_source)
    db.commit()
    db.refresh(new_source)

    return new_source


@router.post("/url", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
def create_url_source(
    data: SourceCreateURL,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Securely fetch an article URL with SSRF protection and extract readable text.
    """
    try:
        article_title, extracted_text, meta = fetch_url_article(data.url)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch content from URL: {str(err)}",
        )

    char_count, word_count, para_count = calculate_text_metrics(extracted_text)
    sha256_hash = hashlib.sha256(extracted_text.encode("utf-8")).hexdigest()

    source_title = data.title.strip() if data.title and data.title.strip() else article_title

    new_source = Source(
        user_id=current_user.id,
        title=source_title,
        source_type="url",
        file_type="html",
        original_filename=None,
        storage_path=None,
        source_url=data.url.strip(),
        file_size_bytes=len(extracted_text.encode("utf-8")),
        sha256_hash=sha256_hash,
        extracted_text=extracted_text,
        character_count=char_count,
        word_count=word_count,
        paragraph_count=para_count,
        meta_info=meta,
    )

    db.add(new_source)
    db.commit()
    db.refresh(new_source)

    return new_source


@router.get("", response_model=List[SourceSummaryResponse], status_code=status.HTTP_200_OK)
def list_user_sources(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve all source documents owned by the authenticated user.
    """
    sources = (
        db.query(Source)
        .filter(Source.user_id == current_user.id)
        .order_by(Source.created_at.desc())
        .all()
    )
    return sources


@router.get("/{source_id}", response_model=SourceResponse, status_code=status.HTTP_200_OK)
def get_source_detail(
    source_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve full source document details including extracted text.
    Enforces strict ownership: users cannot access sources belonging to other accounts.
    """
    source = (
        db.query(Source)
        .filter(Source.id == source_id, Source.user_id == current_user.id)
        .first()
    )
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source document not found.",
        )
    return source


@router.delete("/{source_id}", status_code=status.HTTP_200_OK)
def delete_source(
    source_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a source document and clean up its stored binary from disk.
    Enforces ownership: only the owner can delete the source.
    """
    source = (
        db.query(Source)
        .filter(Source.id == source_id, Source.user_id == current_user.id)
        .first()
    )
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source document not found.",
        )

    # Delete file from local storage if applicable
    if source.storage_path:
        storage_service.delete_file(source.storage_path)

    db.delete(source)
    db.commit()

    return {"message": "Source document successfully deleted.", "id": source_id}


@router.post("/{source_id}/analyze", response_model=SourceAnalysisResponse, status_code=status.HTTP_200_OK)
def analyze_source_with_gemini(
    source_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Executes deep structured content understanding on an ingested source using Google Gemini.
    Extracts main topic, executive summary, named entities, numerical facts, claims, and gaps.
    Saves the structured analysis directly in PostgreSQL.
    """
    from datetime import datetime, timezone

    source = (
        db.query(Source)
        .filter(Source.id == source_id, Source.user_id == current_user.id)
        .first()
    )
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source document not found.",
        )

    try:
        analysis_data, model_name, elapsed_seconds = gemini_service.analyze_source_content(
            source_text=source.extracted_text,
            source_title=source.title,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini AI processing error: {str(err)}",
        )

    now = datetime.now(timezone.utc)
    source.structured_analysis = analysis_data.model_dump()
    source.analyzed_at = now
    db.commit()
    db.refresh(source)

    return SourceAnalysisResponse(
        source_id=source.id,
        analysis=analysis_data,
        model_used=model_name,
        analyzed_at=now,
        execution_time_seconds=elapsed_seconds,
    )


@router.get("/{source_id}/analysis", response_model=SourceAnalysisResponse, status_code=status.HTTP_200_OK)
def get_source_analysis(
    source_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves existing structured analysis for a source document.
    """
    source = (
        db.query(Source)
        .filter(Source.id == source_id, Source.user_id == current_user.id)
        .first()
    )
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source document not found.",
        )

    if not source.structured_analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source has not been analyzed yet. Run POST /analyze first.",
        )

    analysis_obj = StructuredSourceAnalysis.model_validate(source.structured_analysis)
    return SourceAnalysisResponse(
        source_id=source.id,
        analysis=analysis_obj,
        model_used="gemini-3.5-flash",
        analyzed_at=source.analyzed_at or source.updated_at,
        execution_time_seconds=None,
    )
