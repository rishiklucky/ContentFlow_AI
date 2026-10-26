from typing import List
from fastapi import APIRouter, status
from app.schemas.project import ProjectResponse

router = APIRouter()


@router.get("/", response_model=List[ProjectResponse], status_code=status.HTTP_200_OK)
def list_projects():
    """
    List user projects (placeholder for Phase 1 - returns empty list).
    """
    return []
