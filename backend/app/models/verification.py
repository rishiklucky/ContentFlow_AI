import uuid
from sqlalchemy import Column, String, Integer, Float, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class OutputVerification(Base):
    __tablename__ = "output_verifications"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    output_id = Column(
        String(36),
        ForeignKey("transformation_outputs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String(50), default="completed", nullable=False)  # 'completed', 'processing', 'failed'
    overall_grounding_score = Column(Float, default=1.0, nullable=False)  # 0.0 to 1.0
    classification_counts = Column(JSON, nullable=False)  # e.g. {"supported": 5, "unsupported": 1, ...}
    summary_notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    claims = relationship(
        "ClaimVerification",
        backref="verification",
        cascade="all, delete-orphan",
        order_by="ClaimVerification.claim_index",
    )

    def __repr__(self):
        return f"<OutputVerification id={self.id} output_id={self.output_id} score={self.overall_grounding_score}>"


class ClaimVerification(Base):
    __tablename__ = "claim_verifications"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    verification_id = Column(
        String(36),
        ForeignKey("output_verifications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    claim_index = Column(Integer, default=0, nullable=False)
    claim_text = Column(Text, nullable=False)
    claim_type = Column(String(50), default="substantive", nullable=False)  # 'numerical', 'date_event', 'entity', 'substantive'
    classification = Column(String(50), nullable=False)  # 'supported', 'partially_supported', 'unsupported', 'contradicts_source', 'requires_review'
    confidence_score = Column(Float, default=0.9, nullable=False)
    reasoning = Column(Text, nullable=True)
    source_excerpt = Column(Text, nullable=True)  # Verbatim quote; NULL if unsupported
    source_reference = Column(String(255), nullable=True)  # Section, page or structured fact anchor
    is_deterministic = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<ClaimVerification id={self.id} class={self.classification} type={self.claim_type}>"
