import uuid
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Source(Base):
    __tablename__ = "sources"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    source_type = Column(String(50), nullable=False)  # 'file', 'pasted_text', 'url'
    file_type = Column(String(50), nullable=True)     # 'pdf', 'docx', 'txt', 'png', 'jpg', 'webp'
    original_filename = Column(String(255), nullable=True)
    storage_path = Column(String(500), nullable=True)
    source_url = Column(String(1000), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    sha256_hash = Column(String(64), nullable=True)
    extracted_text = Column(Text, nullable=False)
    character_count = Column(Integer, default=0, nullable=False)
    word_count = Column(Integer, default=0, nullable=False)
    paragraph_count = Column(Integer, default=0, nullable=False)
    meta_info = Column(JSON, nullable=True)
    structured_analysis = Column(JSON, nullable=True)
    analyzed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", backref="sources")

    def __repr__(self):
        return f"<Source id={self.id} title={self.title} type={self.source_type}>"
