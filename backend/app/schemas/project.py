from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class ProjectBase(BaseModel):
    name: str = Field(..., description="Project workspace name")
    description: Optional[str] = Field(default=None, description="Optional project narrative description")


class ProjectResponse(ProjectBase):
    id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    transformation_count: int = 0
