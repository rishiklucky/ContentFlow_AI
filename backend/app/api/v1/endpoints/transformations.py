from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.source import Source
from app.models.project import Project
from app.models.transformation import Transformation, TransformationOutput
from app.models.verification import OutputVerification, ClaimVerification
from app.schemas.transformation import (
    TransformationCreate,
    TransformationUpdate,
    TransformationResponse,
    TransformationSummaryResponse,
    TransformationOutputResponse,
    TransformationOutputUpdate,
)
from app.schemas.verification import OutputVerificationResponse, VerifyOutputRequest
from app.services.gemini import gemini_service
from app.services.generation_engine import (
    generate_single_format,
    SUPPORTED_FORMATS,
    FORMAT_BUILDERS,
)
from app.services.fact_checker import fact_verification_engine
from app.services.export_service import (
    sanitize_filename,
    markdown_to_plain_text,
    generate_docx_document,
    generate_batch_export_zip,
)


router = APIRouter()


@router.post("", response_model=TransformationResponse, status_code=status.HTTP_201_CREATED)
def create_transformation(
    data: TransformationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates and executes a multi-format content generation job.
    Uses the shared structured source intelligence to generate each selected format.
    Handles partial failures gracefully without erasing successful outputs.
    """
    # 1. Verify source ownership
    source = (
        db.query(Source)
        .filter(Source.id == data.source_id, Source.user_id == current_user.id)
        .first()
    )
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source document not found or access denied.",
        )

    # 2. Ensure structured analysis exists (if not yet analyzed, analyze first)
    if not source.structured_analysis:
        try:
            analysis_obj, _, _ = gemini_service.analyze_source_content(
                source_text=source.extracted_text,
                source_title=source.title,
            )
            source.structured_analysis = analysis_obj.model_dump()
            source.analyzed_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(source)
        except Exception as err:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to generate structured facts from source: {str(err)}",
            )

    # 3. Validate requested formats
    invalid_formats = [f for f in data.selected_formats if f not in SUPPORTED_FORMATS]
    if invalid_formats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format(s): {invalid_formats}. Supported: {list(SUPPORTED_FORMATS.keys())}",
        )

    # 4. Create parent Transformation record
    title = data.title.strip() if data.title and data.title.strip() else f"Transformation: {source.title}"
    transformation = Transformation(
        user_id=current_user.id,
        source_id=source.id,
        project_id=data.project_id,
        title=title,
        target_audience=data.target_audience,
        tone=data.tone,
        language=data.language,
        detail_level=data.detail_level,
        communication_objective=data.communication_objective,
        additional_instructions=data.additional_instructions,
        selected_formats=data.selected_formats,
        status="processing",
    )
    db.add(transformation)
    db.commit()
    db.refresh(transformation)

    # 5. Execute generation for each format
    config = {
        "target_audience": data.target_audience,
        "tone": data.tone,
        "language": data.language,
        "detail_level": data.detail_level,
        "communication_objective": data.communication_objective,
        "additional_instructions": data.additional_instructions,
    }

    success_count = 0
    fail_count = 0

    for fmt in data.selected_formats:
        default_title = FORMAT_BUILDERS.get(fmt, (None, None, fmt.title()))[2]
        try:
            content, structured_data, _ = generate_single_format(
                structured_analysis=source.structured_analysis,
                format_type=fmt,
                config=config,
            )
            output_obj = TransformationOutput(
                transformation_id=transformation.id,
                format_type=fmt,
                title=f"{default_title}: {source.title}",
                content=content,
                structured_data=structured_data,
                status="completed",
                error_message=None,
                version=1,
            )
            db.add(output_obj)
            success_count += 1
        except Exception as err:
            fail_count += 1
            output_obj = TransformationOutput(
                transformation_id=transformation.id,
                format_type=fmt,
                title=f"{default_title} (Failed)",
                content="",
                structured_data=None,
                status="failed",
                error_message=str(err),
                version=1,
            )
            db.add(output_obj)

    # Update parent status
    if fail_count == 0:
        transformation.status = "completed"
    elif success_count > 0:
        transformation.status = "partially_failed"
    else:
        transformation.status = "failed"

    db.commit()
    db.refresh(transformation)
    return transformation


@router.get("", response_model=List[TransformationSummaryResponse], status_code=status.HTTP_200_OK)
def list_transformations(
    search: Optional[str] = Query(None, description="Search by transformation title"),
    trans_status: Optional[str] = Query(None, alias="status", description="Filter by status"),
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists transformation history created by the authenticated user with real processing status,
    source title, and format metadata.
    """
    query = db.query(Transformation).filter(Transformation.user_id == current_user.id)

    if trans_status:
        query = query.filter(Transformation.status == trans_status)
    if project_id:
        query = query.filter(Transformation.project_id == project_id)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(Transformation.title.ilike(term))

    items = query.order_by(Transformation.created_at.desc()).all()
    result = []
    for t in items:
        source_title = t.source.title if t.source else None
        project_name = t.project.name if t.project else None
        result.append(
            TransformationSummaryResponse(
                id=t.id,
                source_id=t.source_id,
                source_title=source_title,
                project_id=t.project_id,
                project_name=project_name,
                title=t.title,
                target_audience=t.target_audience,
                tone=t.tone,
                language=t.language,
                status=t.status,
                selected_formats=t.selected_formats or [],
                output_count=len(t.outputs) if t.outputs else 0,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
        )
    return result


@router.put("/{transformation_id}", response_model=TransformationResponse, status_code=status.HTTP_200_OK)
def update_transformation(
    transformation_id: str,
    data: TransformationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Allows user to rename a transformation session or update its project assignment.
    Enforces user ownership.
    """
    transformation = (
        db.query(Transformation)
        .filter(Transformation.id == transformation_id, Transformation.user_id == current_user.id)
        .first()
    )
    if not transformation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation not found.")

    if data.title is not None:
        title_val = data.title.strip()
        if not title_val:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title cannot be empty.")
        transformation.title = title_val

    if data.project_id is not None:
        if data.project_id != "":
            p = db.query(Project).filter(Project.id == data.project_id, Project.user_id == current_user.id).first()
            if not p:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target project not found.")
            transformation.project_id = data.project_id
        else:
            transformation.project_id = None

    transformation.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(transformation)
    return transformation


@router.post("/{transformation_id}/duplicate", response_model=TransformationResponse, status_code=status.HTTP_201_CREATED)
def duplicate_transformation(
    transformation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Duplicates a transformation and all its generated outputs and versions.
    Enforces user ownership.
    """
    original = (
        db.query(Transformation)
        .filter(Transformation.id == transformation_id, Transformation.user_id == current_user.id)
        .first()
    )
    if not original:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation not found.")

    clone_trans = Transformation(
        user_id=current_user.id,
        source_id=original.source_id,
        project_id=original.project_id,
        title=f"Copy of {original.title}",
        target_audience=original.target_audience,
        tone=original.tone,
        language=original.language,
        detail_level=original.detail_level,
        communication_objective=original.communication_objective,
        additional_instructions=original.additional_instructions,
        selected_formats=list(original.selected_formats or []),
        status=original.status,
    )
    db.add(clone_trans)
    db.flush()

    for out in original.outputs:
        clone_out = TransformationOutput(
            transformation_id=clone_trans.id,
            format_type=out.format_type,
            title=out.title,
            content=out.content,
            structured_data=out.structured_data,
            status=out.status,
            error_message=out.error_message,
            version=out.version,
        )
        db.add(clone_out)

    db.commit()
    db.refresh(clone_trans)
    return clone_trans



@router.get("/{transformation_id}", response_model=TransformationResponse, status_code=status.HTTP_200_OK)
def get_transformation_detail(
    transformation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves a transformation and all its generated outputs.
    Enforces strict user ownership.
    """
    transformation = (
        db.query(Transformation)
        .filter(Transformation.id == transformation_id, Transformation.user_id == current_user.id)
        .first()
    )
    if not transformation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transformation not found.",
        )
    return transformation


@router.put("/{transformation_id}/outputs/{output_id}", response_model=TransformationOutputResponse, status_code=status.HTTP_200_OK)
def update_transformation_output(
    transformation_id: str,
    output_id: str,
    data: TransformationOutputUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Allows user to edit and save updated text content for a specific generated format.
    Increments the version counter.
    """
    transformation = (
        db.query(Transformation)
        .filter(Transformation.id == transformation_id, Transformation.user_id == current_user.id)
        .first()
    )
    if not transformation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation not found.")

    output = (
        db.query(TransformationOutput)
        .filter(
            TransformationOutput.id == output_id,
            TransformationOutput.transformation_id == transformation.id,
        )
        .first()
    )
    if not output:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation output not found.")

    output.content = data.content
    if data.title:
        output.title = data.title
    output.version += 1
    output.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(output)
    return output


@router.post("/{transformation_id}/outputs/{output_id}/regenerate", response_model=TransformationOutputResponse, status_code=status.HTTP_200_OK)
def regenerate_single_output(
    transformation_id: str,
    output_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Regenerates a single format output using the same configuration and source facts
    without re-generating other completed outputs.
    """
    transformation = (
        db.query(Transformation)
        .filter(Transformation.id == transformation_id, Transformation.user_id == current_user.id)
        .first()
    )
    if not transformation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation not found.")

    output = (
        db.query(TransformationOutput)
        .filter(
            TransformationOutput.id == output_id,
            TransformationOutput.transformation_id == transformation.id,
        )
        .first()
    )
    if not output:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation output not found.")

    source = transformation.source
    if not source or not source.structured_analysis:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source structured facts are missing.")

    config = {
        "target_audience": transformation.target_audience,
        "tone": transformation.tone,
        "language": transformation.language,
        "detail_level": transformation.detail_level,
        "communication_objective": transformation.communication_objective,
        "additional_instructions": transformation.additional_instructions,
    }

    try:
        content, structured_data, _ = generate_single_format(
            structured_analysis=source.structured_analysis,
            format_type=output.format_type,
            config=config,
        )
        output.content = content
        output.structured_data = structured_data
        output.status = "completed"
        output.error_message = None
        output.version += 1
        output.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(output)
        return output
    except Exception as err:
        output.status = "failed"
        output.error_message = str(err)
        output.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(output)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to regenerate {output.format_type}: {str(err)}",
        )


@router.delete("/{transformation_id}", status_code=status.HTTP_200_OK)
def delete_transformation(
    transformation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deletes a transformation and all its generated outputs.
    """
    transformation = (
        db.query(Transformation)
        .filter(Transformation.id == transformation_id, Transformation.user_id == current_user.id)
        .first()
    )
    if not transformation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation not found.")

    db.delete(transformation)
    db.commit()
    return {"message": "Transformation successfully deleted.", "id": transformation_id}


@router.post(
    "/{transformation_id}/outputs/{output_id}/verify",
    response_model=OutputVerificationResponse,
    status_code=status.HTTP_200_OK,
)
def verify_transformation_output(
    transformation_id: str,
    output_id: str,
    payload: Optional[VerifyOutputRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verifies claims in a generated transformation output against the original source document
    and its structured representation. Classifies claims into Supported, Partially Supported,
    Unsupported, Contradicts Source, or Requires Review.
    Stores and updates verification results in PostgreSQL.
    """
    transformation = (
        db.query(Transformation)
        .filter(Transformation.id == transformation_id, Transformation.user_id == current_user.id)
        .first()
    )
    if not transformation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation not found.")

    output = (
        db.query(TransformationOutput)
        .filter(
            TransformationOutput.id == output_id,
            TransformationOutput.transformation_id == transformation.id,
        )
        .first()
    )
    if not output:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation output not found.")

    source = transformation.source
    if not source or not source.extracted_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source document text is unavailable for grounding check.",
        )

    custom_instructions = payload.custom_instructions if payload else None

    try:
        grounding_score, counts, notes, claims = fact_verification_engine.verify_output(
            output_content=output.content,
            source_text=source.extracted_text,
            source_title=source.title,
            structured_analysis=source.structured_analysis,
            custom_instructions=custom_instructions,
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Fact verification check failed: {str(err)}",
        )

    # Persist or update verification record
    verification_record = (
        db.query(OutputVerification)
        .filter(OutputVerification.output_id == output.id)
        .first()
    )
    if not verification_record:
        verification_record = OutputVerification(
            output_id=output.id,
            user_id=current_user.id,
            status="completed",
            overall_grounding_score=grounding_score,
            classification_counts=counts,
            summary_notes=notes,
        )
        db.add(verification_record)
        db.flush()
    else:
        verification_record.overall_grounding_score = grounding_score
        verification_record.classification_counts = counts
        verification_record.summary_notes = notes
        verification_record.status = "completed"
        verification_record.updated_at = datetime.now(timezone.utc)
        # Clear previous claims for this verification
        db.query(ClaimVerification).filter(ClaimVerification.verification_id == verification_record.id).delete()
        db.flush()

    # Add verified claims
    for idx, c in enumerate(claims):
        claim_obj = ClaimVerification(
            verification_id=verification_record.id,
            claim_index=idx,
            claim_text=c.claim_text,
            claim_type=c.claim_type,
            classification=c.classification,
            confidence_score=c.confidence_score,
            reasoning=c.reasoning,
            source_excerpt=c.source_excerpt,
            source_reference=c.source_reference,
            is_deterministic=c.is_deterministic,
        )
        db.add(claim_obj)

    db.commit()
    db.refresh(verification_record)
    return verification_record


@router.get(
    "/{transformation_id}/outputs/{output_id}/verification",
    response_model=OutputVerificationResponse,
    status_code=status.HTTP_200_OK,
)
def get_output_verification(
    transformation_id: str,
    output_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves the latest fact-verification result and classified claims for an output.
    """
    transformation = (
        db.query(Transformation)
        .filter(Transformation.id == transformation_id, Transformation.user_id == current_user.id)
        .first()
    )
    if not transformation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation not found.")

    output = (
        db.query(TransformationOutput)
        .filter(
            TransformationOutput.id == output_id,
            TransformationOutput.transformation_id == transformation.id,
        )
        .first()
    )
    if not output:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation output not found.")

    verification_record = (
        db.query(OutputVerification)
        .filter(OutputVerification.output_id == output.id)
        .first()
    )
    if not verification_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No verification has been run for this output yet.",
        )

    return verification_record


@router.get(
    "/{transformation_id}/outputs/{output_id}/export",
    status_code=status.HTTP_200_OK,
)
def export_transformation_output(
    transformation_id: str,
    output_id: str,
    format: str = Query("md", pattern="^(md|txt|docx|json)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Exports a single transformation output in MD, TXT, DOCX, or JSON format.
    Enforces user ownership and validates that output content is available.
    """
    transformation = (
        db.query(Transformation)
        .filter(Transformation.id == transformation_id, Transformation.user_id == current_user.id)
        .first()
    )
    if not transformation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation not found.")

    output = (
        db.query(TransformationOutput)
        .filter(
            TransformationOutput.id == output_id,
            TransformationOutput.transformation_id == transformation.id,
        )
        .first()
    )
    if not output:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation output not found.")

    if output.status == "failed" or not output.content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot export output with status '{output.status}' or empty content.",
        )

    safe_title = sanitize_filename(transformation.title)
    fmt_safe = sanitize_filename(output.format_type)
    base_filename = f"{safe_title}_{fmt_safe}"

    if format == "md":
        content_bytes = output.content.encode("utf-8")
        return Response(
            content=content_bytes,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{base_filename}.md"'},
        )

    elif format == "txt":
        plain_text = markdown_to_plain_text(output.content)
        content_bytes = plain_text.encode("utf-8")
        return Response(
            content=content_bytes,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{base_filename}.txt"'},
        )

    elif format == "docx":
        docx_stream = generate_docx_document(transformation.title, output, transformation)
        return StreamingResponse(
            docx_stream,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{base_filename}.docx"'},
        )

    elif format == "json":
        export_payload = {
            "transformation_id": transformation.id,
            "project_title": transformation.title,
            "output_id": output.id,
            "format_type": output.format_type,
            "title": output.title,
            "version": output.version,
            "status": output.status,
            "content": output.content,
            "structured_data": output.structured_data,
            "exported_at": datetime.now(timezone.utc).isoformat(),
        }
        import json as json_lib
        content_bytes = json_lib.dumps(export_payload, indent=2).encode("utf-8")
        return Response(
            content=content_bytes,
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{base_filename}.json"'},
        )


@router.get(
    "/{transformation_id}/export-all",
    status_code=status.HTTP_200_OK,
)
def export_all_transformation_outputs(
    transformation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Bundles all completed outputs for a transformation into a single downloadable ZIP archive.
    Includes Markdown and Plain Text versions of each format, along with a MANIFEST.txt.
    """
    transformation = (
        db.query(Transformation)
        .filter(Transformation.id == transformation_id, Transformation.user_id == current_user.id)
        .first()
    )
    if not transformation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation not found.")

    completed_outputs = [o for o in transformation.outputs if o.status == "completed" and o.content]
    if not completed_outputs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No completed outputs available to export.",
        )

    safe_title = sanitize_filename(transformation.title)
    zip_stream = generate_batch_export_zip(transformation, current_user.email)
    
    return StreamingResponse(
        zip_stream,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}_all_formats.zip"'},
    )


