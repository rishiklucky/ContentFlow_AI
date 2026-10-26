from fastapi import APIRouter, status
from app.schemas.health import HealthResponse, SystemInfoResponse
from app.core.config import settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
def check_health():
    """
    Service health check endpoint.
    Returns overall system status, API version, and sub-service readiness.
    """
    return HealthResponse(
        status="healthy",
        app_name=settings.PROJECT_NAME,
        environment=settings.ENVIRONMENT,
        version="1.0.0",
        services={
            "api": "operational",
            "grounding_engine": "standby",
            "document_processor": "standby"
        }
    )


@router.get("/system-info", response_model=SystemInfoResponse, status_code=status.HTTP_200_OK)
def get_system_info():
    """
    Returns public system metadata and environment configuration.
    """
    return SystemInfoResponse(
        project_name=settings.PROJECT_NAME,
        environment=settings.ENVIRONMENT,
        debug=settings.DEBUG,
        api_prefix=settings.API_V1_STR
    )
