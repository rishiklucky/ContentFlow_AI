from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict


class TransformationConfig(BaseModel):
    target_audience: str = Field("General Professional", description="Intended audience (e.g. C-Suite, Technical, General)")
    tone: str = Field("Professional & Executive", description="Writing style and tone")
    language: str = Field("English", description="Target output language")
    detail_level: str = Field("Standard / Balanced", description="Depth of coverage (Concise, Standard, Deep Dive)")
    communication_objective: str = Field("Inform & Brief", description="Primary goal (Inform, Persuade, Educate, Act)")
    additional_instructions: Optional[str] = Field(None, description="Optional custom user instructions")


class TransformationCreate(BaseModel):
    source_id: str = Field(..., description="UUID of the ingested source document")
    title: Optional[str] = Field(None, description="Optional custom transformation title")
    selected_formats: List[str] = Field(
        ...,
        min_length=1,
        description="List of formats to generate: executive_summary, linkedin_post, twitter_thread, advisory, presentation, infographic, video_script",
    )
    target_audience: str = Field("General Professional")
    tone: str = Field("Professional & Executive")
    language: str = Field("English")
    detail_level: str = Field("Standard / Balanced")
    communication_objective: str = Field("Inform & Brief")
    additional_instructions: Optional[str] = Field(None)


class TransformationOutputUpdate(BaseModel):
    content: str = Field(..., description="Edited output text content")
    title: Optional[str] = Field(None, description="Updated output title")


class TransformationOutputResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    transformation_id: str
    format_type: str
    title: str
    content: str
    structured_data: Optional[Dict[str, Any]] = None
    status: str
    error_message: Optional[str] = None
    version: int
    created_at: datetime
    updated_at: datetime


class TransformationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    source_id: str
    title: str
    target_audience: str
    tone: str
    language: str
    detail_level: str
    communication_objective: str
    additional_instructions: Optional[str] = None
    selected_formats: List[str]
    status: str
    outputs: List[TransformationOutputResponse] = []
    created_at: datetime
    updated_at: datetime


class TransformationSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_id: str
    title: str
    target_audience: str
    tone: str
    language: str
    status: str
    output_count: int = 0
    created_at: datetime
    updated_at: datetime
