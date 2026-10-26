from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.source import Source
from app.models.transformation import Transformation, TransformationOutput
from app.schemas.transformation import (
    TransformationCreate,
    TransformationResponse,
    TransformationSummaryResponse,
    TransformationOutputResponse,
    TransformationOutputUpdate,
)
from app.services.gemini import gemini_service
from app.services.generation_engine import (
    generate_single_format,
    SUPPORTED_FORMATS,
    FORMAT_BUILDERS,
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists all transformation jobs created by the authenticated user.
    """
    items = (
        db.query(Transformation)
        .filter(Transformation.user_id == current_user.id)
        .order_by(Transformation.created_at.desc())
        .all()
    )
    result = []
    for t in items:
        result.append(
            TransformationSummaryResponse(
                id=t.id,
                source_id=t.source_id,
                title=t.title,
                target_audience=t.target_audience,
                tone=t.tone,
                language=t.language,
                status=t.status,
                output_count=len(t.outputs),
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
        )
    return result


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
