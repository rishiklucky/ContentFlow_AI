import uuid
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Transformation(Base):
    __tablename__ = "transformations"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id = Column(String(36), ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)

    # Configurable parameters
    target_audience = Column(String(100), default="General Professional", nullable=False)
    tone = Column(String(100), default="Professional & Executive", nullable=False)
    language = Column(String(50), default="English", nullable=False)
    detail_level = Column(String(50), default="Standard / Balanced", nullable=False)
    communication_objective = Column(String(100), default="Inform & Brief", nullable=False)
    additional_instructions = Column(Text, nullable=True)

    selected_formats = Column(JSON, nullable=False)  # List of format keys
    status = Column(String(50), default="completed", nullable=False)  # 'completed', 'partially_failed', 'failed', 'processing'

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", backref="transformations")
    source = relationship("Source", backref="transformations")
    outputs = relationship(
        "TransformationOutput",
        backref="transformation",
        cascade="all, delete-orphan",
        order_by="TransformationOutput.created_at",
    )

    def __repr__(self):
        return f"<Transformation id={self.id} title={self.title} status={self.status}>"


class TransformationOutput(Base):
    __tablename__ = "transformation_outputs"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    transformation_id = Column(
        String(36),
        ForeignKey("transformations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    format_type = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)  # Full markdown or formatted text, user-editable
    structured_data = Column(JSON, nullable=True)  # Format-specific structured JSON
    status = Column(String(50), default="completed", nullable=False)  # 'completed', 'failed', 'processing'
    error_message = Column(Text, nullable=True)
    version = Column(Integer, default=1, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    verifications = relationship(
        "OutputVerification",
        backref="transformation_output",
        cascade="all, delete-orphan",
        order_by="desc(OutputVerification.created_at)",
    )

    def __repr__(self):
        return f"<TransformationOutput id={self.id} format={self.format_type} status={self.status}>"
