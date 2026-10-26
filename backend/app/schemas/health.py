from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(default="healthy", description="Current health status of the service")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="UTC timestamp of the health check")
    app_name: str = Field(description="Name of the application")
    environment: str = Field(description="Active operating environment")
    version: str = Field(default="1.0.0", description="API version")
    services: Dict[str, str] = Field(default_factory=dict, description="Status of connected internal services")


class SystemInfoResponse(BaseModel):
    project_name: str
    environment: str
    debug: bool
    api_prefix: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
