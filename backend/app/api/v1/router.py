from fastapi import APIRouter
from app.api.v1.endpoints import health, transformations, projects, auth, sources, dashboard

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(sources.router, prefix="/sources", tags=["Sources"])
api_router.include_router(transformations.router, prefix="/transformations", tags=["Transformations"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])


