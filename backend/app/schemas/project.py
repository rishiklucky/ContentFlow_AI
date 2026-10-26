from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Project workspace name")
    description: Optional[str] = Field(default=None, description="Optional project narrative description")
    tags: Optional[List[str]] = Field(default_factory=list, description="Categorization tags")


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None)
    tags: Optional[List[str]] = Field(default=None)
    status: Optional[str] = Field(default=None, description="'active' or 'archived'")


class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    status: str = "active"
    transformation_count: int = 0
    created_at: datetime
    updated_at: datetime


class ProjectDetailResponse(ProjectResponse):
    transformations: List[Any] = []
