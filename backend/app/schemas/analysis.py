from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class NamedEntity(BaseModel):
    name: str = Field(..., description="Name of the company, person, location, technology, or asset")
    category: str = Field("other", description="Category: organization, person, location, technology, financial_asset, other")
    context: Optional[str] = Field(None, description="Brief description of the entity's relevance in the document")


class DateOrEvent(BaseModel):
    date: Optional[str] = Field(None, description="Identified date, quarter, or timeframe (e.g. 'Q3 2026', 'October 24, 2025')")
    event: str = Field(..., description="The historical or projected event, milestone, or occurrence")
    excerpt: Optional[str] = Field(None, description="Direct quote or excerpt from the source")


class NumericalFact(BaseModel):
    value: str = Field(..., description="Specific numeric figure, percentage, or currency (e.g. '24%', '$150M', '3.5x')")
    metric: str = Field(..., description="What the number measures or describes")
    context: str = Field(..., description="Surrounding contextual sentence or explanation")
    excerpt: Optional[str] = Field(None, description="Direct excerpt containing this exact number")


class KeyClaim(BaseModel):
    claim: str = Field(..., description="Core argument or factual claim made in the source")
    status: str = Field("explicit_fact", description="'explicit_fact' if directly stated, 'interpretation' if reasoned, 'speculation' if forward-looking")
    supporting_excerpt: Optional[str] = Field(None, description="Verbatim source excerpt backing this claim")


class StructuredSourceAnalysis(BaseModel):
    main_topic: str = Field(..., description="Primary subject matter and central thesis of the document")
    executive_summary: str = Field(..., description="Structured 2-3 paragraph executive briefing of the source")
    key_points: List[str] = Field(default_factory=list, description="High-level bullet takeaways")
    entities: List[NamedEntity] = Field(default_factory=list, description="Extracted named entities")
    dates_and_events: List[DateOrEvent] = Field(default_factory=list, description="Identifiable dates, quarters, and events")
    numerical_facts: List[NumericalFact] = Field(default_factory=list, description="Quantifiable metrics, statistics, and figures")
    key_claims: List[KeyClaim] = Field(default_factory=list, description="Key assertions distinguished by fact vs interpretation")
    recommendations: List[str] = Field(default_factory=list, description="Prescriptive action items or strategic guidance found in source")
    uncertain_or_missing_info: List[str] = Field(default_factory=list, description="Explicitly noted gaps, missing metrics, or uncertainties")
    confidence_score: float = Field(0.95, ge=0.0, le=1.0, description="Overall factual confidence rating")


class SourceAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_id: str
    analysis: StructuredSourceAnalysis
    model_used: str
    analyzed_at: datetime
    execution_time_seconds: Optional[float] = None
