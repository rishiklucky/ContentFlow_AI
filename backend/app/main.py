import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from app.core.config import settings
from app.api.v1.router import api_router
from app.api.v1.endpoints import auth

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-Powered Multi-Modal Content Transformation Platform with Strict Grounding Verification",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
    docs_url=f"{settings.API_V1_STR}/docs" if settings.DEBUG else None,
    redoc_url=f"{settings.API_V1_STR}/redoc" if settings.DEBUG else None,
)

# Set CORS middleware - allows localhost, 127.0.0.1, local network IPs, and production deployment origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|.*\.onrender\.com)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lightweight backend health check for cold starts and Render monitoring
@app.get("/api/health")
def api_health():
    """
    Lightweight health check endpoint for cold-start wakeups and monitoring.
    Does NOT invoke expensive external AI models or expose private infrastructure.
    """
    return {
        "status": "healthy",
        "app_name": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0",
        "services": {
            "api": "operational",
            "database": "connected",
        }
    }

# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Direct alias for /api/auth endpoints
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication (Alias)"])

# Locate compiled React frontend dist folder
FRONTEND_DIST_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
FRONTEND_ASSETS_DIR = FRONTEND_DIST_DIR / "assets"

# Mount /assets if frontend is compiled
if FRONTEND_ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_ASSETS_DIR)), name="assets")


@app.get("/")
def root(request: Request):
    """
    Root entrypoint. Serves compiled React SPA if accessed from a browser (Accept: text/html),
    or returns service status JSON for API clients and automated tests.
    """
    accept = request.headers.get("accept", "")
    index_file = FRONTEND_DIST_DIR / "index.html"
    
    if "text/html" in accept and index_file.is_file():
        return FileResponse(str(index_file))
        
    return {
        "status": "online",
        "app_name": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "api_v1_docs": f"{settings.API_V1_STR}/docs" if settings.DEBUG else None,
        "health_check": "/api/health"
    }


@app.get("/{full_path:path}")
async def serve_spa_or_static(request: Request, full_path: str):
    """
    Client-side routing fallback for React Router.
    Ensures unknown /api/* endpoints return 404 JSON, while client routes (e.g. /login, /dashboard)
    serve index.html.
    """
    # 1. API routes that were not matched must return JSON error (not HTML)
    if full_path.startswith("api/") or full_path == "api":
        return JSONResponse(
            status_code=404,
            content={"detail": f"API endpoint '/{full_path}' not found."}
        )

    # 2. Check if a direct static file exists in dist (e.g. vite.svg, favicon.ico)
    direct_file = FRONTEND_DIST_DIR / full_path
    if direct_file.is_file():
        return FileResponse(str(direct_file))

    # 3. Fallback to index.html for React SPA routes (/dashboard, /projects, /history, etc.)
    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(str(index_file))

    # 4. If frontend is not built, return JSON 404
    return JSONResponse(
        status_code=404,
        content={"detail": f"Path '/{full_path}' not found. Please build frontend static assets."}
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", settings.PORT))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=settings.DEBUG)
