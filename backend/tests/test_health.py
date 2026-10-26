import sys
from pathlib import Path
# Add backend root to python path for test imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "ContentFlow AI" in data["app_name"]


def test_health_check_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["services"]["api"] == "operational"


def test_system_info_endpoint():
    response = client.get("/api/v1/system-info")
    assert response.status_code == 200
    data = response.json()
    assert data["project_name"] == "ContentFlow AI"
    assert data["api_prefix"] == "/api/v1"


def test_cors_headers():
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


if __name__ == "__main__":
    test_root_endpoint()
    test_health_check_endpoint()
    test_system_info_endpoint()
    test_cors_headers()
    print("All backend verification tests passed successfully!")
