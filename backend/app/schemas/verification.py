from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class ClaimVerificationItem(BaseModel):
    claim_index: int = Field(0, description="Sequential index of claim in the document")
    claim_text: str = Field(..., description="The factual proposition extracted from the output")
    claim_type: str = Field(
        "substantive",
        description="Type of claim: 'numerical', 'date_event', 'entity', or 'substantive'",
    )
    classification: str = Field(
        ...,
        description="Grounding classification: 'supported', 'partially_supported', 'unsupported', 'contradicts_source', or 'requires_review'",
    )
    confidence_score: float = Field(
        0.9,
        ge=0.0,
        le=1.0,
        description="Confidence score of the verification judgment",
    )
    reasoning: Optional[str] = Field(
        None,
        description="Clear, simple explanation of why the claim is supported or flagged",
    )
    source_excerpt: Optional[str] = Field(
        None,
        description="Verbatim text from source backing or contradicting the claim. Must be null if unsupported.",
    )
    source_reference: Optional[str] = Field(
        None,
        description="Identifiable section, page, or anchor from the source",
    )
    is_deterministic: bool = Field(
        False,
        description="True if resolved via deterministic numerical or date comparison",
    )


class ClaimVerificationResponse(ClaimVerificationItem):
    model_config = ConfigDict(from_attributes=True)

    id: str
    verification_id: str
    created_at: datetime


class OutputVerificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    output_id: str
    user_id: str
    status: str
    overall_grounding_score: float
    classification_counts: Dict[str, int]
    summary_notes: Optional[str] = None
    claims: List[ClaimVerificationResponse] = []
    created_at: datetime
    updated_at: datetime


class VerifyOutputRequest(BaseModel):
    custom_instructions: Optional[str] = Field(
        None,
        description="Optional instructions to guide specific fact verification priorities",
    )
