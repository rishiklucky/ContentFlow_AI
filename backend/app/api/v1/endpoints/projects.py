from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.transformation import Transformation, TransformationOutput
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectDetailResponse,
)
from app.schemas.transformation import TransformationSummaryResponse

router = APIRouter()


@router.get("", response_model=List[ProjectResponse], status_code=status.HTTP_200_OK)
def list_projects(
    search: Optional[str] = Query(None, description="Search by project name or description"),
    project_status: Optional[str] = Query(None, alias="status", description="Filter by status ('active', 'archived')"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists projects owned by the authenticated user with search, status filtering, and pagination.
    """
    query = db.query(Project).filter(Project.user_id == current_user.id)

    if project_status:
        query = query.filter(Project.status == project_status)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter((Project.name.ilike(term)) | (Project.description.ilike(term)))

    projects = query.order_by(desc(Project.created_at)).offset(skip).limit(limit).all()

    result = []
    for p in projects:
        t_count = len(p.transformations) if p.transformations else 0
        result.append(
            ProjectResponse(
                id=p.id,
                user_id=p.user_id,
                name=p.name,
                description=p.description,
                tags=p.tags or [],
                status=p.status,
                transformation_count=t_count,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )
    return result


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new project workspace owned by the current user.
    """
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project name cannot be blank.")

    project = Project(
        user_id=current_user.id,
        name=name,
        description=data.description.strip() if data.description else None,
        tags=data.tags or [],
        status="active",
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        description=project.description,
        tags=project.tags or [],
        status=project.status,
        transformation_count=0,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("/{project_id}", response_model=ProjectDetailResponse, status_code=status.HTTP_200_OK)
def get_project_detail(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves project detail including its associated transformations.
    Enforces user ownership.
    """
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    transformations_summary = []
    for t in project.transformations:
        source_title = t.source.title if t.source else None
        transformations_summary.append(
            TransformationSummaryResponse(
                id=t.id,
                source_id=t.source_id,
                source_title=source_title,
                project_id=project.id,
                project_name=project.name,
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

    return ProjectDetailResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        description=project.description,
        tags=project.tags or [],
        status=project.status,
        transformation_count=len(transformations_summary),
        created_at=project.created_at,
        updated_at=project.updated_at,
        transformations=transformations_summary,
    )


@router.put("/{project_id}", response_model=ProjectResponse, status_code=status.HTTP_200_OK)
def update_project(
    project_id: str,
    data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates or renames an existing project workspace.
    Enforces user ownership.
    """
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    if data.name is not None:
        name_val = data.name.strip()
        if not name_val:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project name cannot be empty.")
        project.name = name_val

    if data.description is not None:
        project.description = data.description.strip() if data.description else None

    if data.tags is not None:
        project.tags = data.tags

    if data.status is not None:
        if data.status not in {"active", "archived"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be 'active' or 'archived'.")
        project.status = data.status

    project.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(project)

    t_count = len(project.transformations) if project.transformations else 0
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        description=project.description,
        tags=project.tags or [],
        status=project.status,
        transformation_count=t_count,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.post("/{project_id}/duplicate", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def duplicate_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Duplicates a project workspace and all its associated transformations and outputs.
    Enforces user ownership.
    """
    original = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == current_user.id)
        .first()
    )
    if not original:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    # 1. Create duplicate project record
    clone_project = Project(
        user_id=current_user.id,
        name=f"Copy of {original.name}",
        description=original.description,
        tags=list(original.tags or []),
        status="active",
    )
    db.add(clone_project)
    db.flush()

    # 2. Duplicate associated transformations
    for trans in original.transformations:
        clone_trans = Transformation(
            user_id=current_user.id,
            source_id=trans.source_id,
            project_id=clone_project.id,
            title=f"Copy of {trans.title}",
            target_audience=trans.target_audience,
            tone=trans.tone,
            language=trans.language,
            detail_level=trans.detail_level,
            communication_objective=trans.communication_objective,
            additional_instructions=trans.additional_instructions,
            selected_formats=list(trans.selected_formats or []),
            status=trans.status,
        )
        db.add(clone_trans)
        db.flush()

        # Duplicate outputs
        for out in trans.outputs:
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
    db.refresh(clone_project)

    t_count = len(clone_project.transformations) if clone_project.transformations else 0
    return ProjectResponse(
        id=clone_project.id,
        user_id=clone_project.user_id,
        name=clone_project.name,
        description=clone_project.description,
        tags=clone_project.tags or [],
        status=clone_project.status,
        transformation_count=t_count,
        created_at=clone_project.created_at,
        updated_at=clone_project.updated_at,
    )


@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deletes a project workspace. Cascades deletion to child transformations.
    Enforces user ownership.
    """
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    for t in project.transformations:
        t.project_id = None
    db.delete(project)
    db.commit()
    return {"message": "Project successfully deleted.", "id": project_id}



@router.post("/{project_id}/transformations/{transformation_id}", status_code=status.HTTP_200_OK)
def assign_transformation_to_project(
    project_id: str,
    transformation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Assigns or moves a transformation into a specific project workspace.
    Enforces user ownership on both entities.
    """
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    transformation = (
        db.query(Transformation)
        .filter(Transformation.id == transformation_id, Transformation.user_id == current_user.id)
        .first()
    )
    if not transformation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transformation not found.")

    transformation.project_id = project.id
    transformation.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(transformation)

    return {
        "message": "Transformation successfully assigned to project.",
        "project_id": project.id,
        "transformation_id": transformation.id,
    }
