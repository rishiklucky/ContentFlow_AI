from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class SourceCreateText(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Title of the pasted text source")
    text: str = Field(..., min_length=10, description="The textual content to extract and process")


class SourceCreateURL(BaseModel):
    url: str = Field(..., min_length=5, max_length=1000, description="Valid public HTTP/HTTPS URL of the article")
    title: Optional[str] = Field(None, max_length=255, description="Optional custom title for the article")


class SourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    title: str
    source_type: str
    file_type: Optional[str] = None
    original_filename: Optional[str] = None
    source_url: Optional[str] = None
    file_size_bytes: Optional[int] = None
    sha256_hash: Optional[str] = None
    character_count: int
    word_count: int
    paragraph_count: int
    extracted_text: str
    meta_info: Optional[Dict[str, Any]] = None
    structured_analysis: Optional[Dict[str, Any]] = None
    analyzed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class SourceSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    title: str
    source_type: str
    file_type: Optional[str] = None
    original_filename: Optional[str] = None
    source_url: Optional[str] = None
    file_size_bytes: Optional[int] = None
    character_count: int
    word_count: int
    paragraph_count: int
    created_at: datetime
