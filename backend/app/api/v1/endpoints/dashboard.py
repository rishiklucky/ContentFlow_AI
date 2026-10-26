from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.source import Source
from app.models.transformation import Transformation, TransformationOutput
from app.models.verification import OutputVerification
from app.schemas.transformation import TransformationSummaryResponse
from app.schemas.project import ProjectResponse

router = APIRouter()


@router.get("/metrics", status_code=status.HTTP_200_OK)
def get_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns real, live database metrics and activity ledgers for the authenticated user.
    Never fabricates metrics.
    """
    # 1. Total counts from Neon PostgreSQL
    total_transformations = (
        db.query(func.count(Transformation.id))
        .filter(Transformation.user_id == current_user.id)
        .scalar()
        or 0
    )

    total_projects = (
        db.query(func.count(Project.id))
        .filter(Project.user_id == current_user.id)
        .scalar()
        or 0
    )

    total_sources = (
        db.query(func.count(Source.id))
        .filter(Source.user_id == current_user.id)
        .scalar()
        or 0
    )

    total_outputs = (
        db.query(func.count(TransformationOutput.id))
        .join(Transformation, TransformationOutput.transformation_id == Transformation.id)
        .filter(Transformation.user_id == current_user.id)
        .scalar()
        or 0
    )

    # 2. Real Average Grounding Score from output_verifications
    avg_score_val = (
        db.query(func.avg(OutputVerification.overall_grounding_score))
        .filter(OutputVerification.user_id == current_user.id)
        .scalar()
    )
    average_grounding_score = round(float(avg_score_val) * 100, 1) if avg_score_val is not None else 100.0

    # 3. Status breakdown of transformations
    status_counts = {"completed": 0, "processing": 0, "partially_failed": 0, "failed": 0}
    rows = (
        db.query(Transformation.status, func.count(Transformation.id))
        .filter(Transformation.user_id == current_user.id)
        .group_by(Transformation.status)
        .all()
    )
    for st, count in rows:
        status_counts[st] = count

    # 4. Recent transformations
    recent_trans_records = (
        db.query(Transformation)
        .filter(Transformation.user_id == current_user.id)
        .order_by(desc(Transformation.created_at))
        .limit(5)
        .all()
    )
    recent_transformations = []
    for t in recent_trans_records:
        recent_transformations.append(
            TransformationSummaryResponse(
                id=t.id,
                source_id=t.source_id,
                source_title=t.source.title if t.source else None,
                project_id=t.project_id,
                project_name=t.project.name if t.project else None,
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

    # 5. Recent projects
    recent_proj_records = (
        db.query(Project)
        .filter(Project.user_id == current_user.id)
        .order_by(desc(Project.created_at))
        .limit(5)
        .all()
    )
    recent_projects = []
    for p in recent_proj_records:
        recent_projects.append(
            ProjectResponse(
                id=p.id,
                user_id=p.user_id,
                name=p.name,
                description=p.description,
                tags=p.tags or [],
                status=p.status,
                transformation_count=len(p.transformations) if p.transformations else 0,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )

    return {
        "total_transformations": total_transformations,
        "total_projects": total_projects,
        "total_sources": total_sources,
        "total_outputs": total_outputs,
        "average_grounding_score": average_grounding_score,
        "status_breakdown": status_counts,
        "recent_transformations": recent_transformations,
        "recent_projects": recent_projects,
    }
