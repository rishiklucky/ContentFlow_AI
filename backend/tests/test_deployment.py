import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_api_health_endpoint():
    """Verify lightweight /api/health responds quickly without triggering heavy AI processing."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app_name"] == "ContentFlow AI"
    assert "api" in data["services"]


def test_root_endpoint_json_for_api_clients():
    """Verify root endpoint returns JSON status for automated clients without Accept: text/html."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "ContentFlow AI" in data["app_name"]


def test_root_endpoint_html_for_browser_requests():
    """Verify root endpoint returns the compiled React SPA HTML for browser requests."""
    response = client.get("/", headers={"Accept": "text/html,application/xhtml+xml"})
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<div id=\"root\"></div>" in response.text


def test_client_side_routing_spa_fallback():
    """Verify nested React routes (e.g. /dashboard, /projects, /history) serve index.html."""
    for route in ["/dashboard", "/projects", "/history", "/login", "/register", "/transform/new"]:
        response = client.get(route)
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "<div id=\"root\"></div>" in response.text


def test_unknown_api_routes_return_json_404():
    """Verify unknown /api/* endpoints return 404 JSON, NOT the HTML page."""
    response = client.get("/api/nonexistent_route_test")
    assert response.status_code == 404
    assert "application/json" in response.headers["content-type"]
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()


def test_static_assets_served():
    """Verify static assets under /assets/ are served properly."""
    # Find one asset in frontend/dist/assets
    assets_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist" / "assets"
    asset_files = list(assets_dir.glob("*.js"))
    if asset_files:
        asset_name = asset_files[0].name
        response = client.get(f"/assets/{asset_name}")
        assert response.status_code == 200
        assert "javascript" in response.headers["content-type"].lower()
