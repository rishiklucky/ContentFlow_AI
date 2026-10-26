import sys
import uuid
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.project import Project
from app.models.source import Source
from app.models.transformation import Transformation, TransformationOutput
from app.core.security import get_password_hash, create_access_token

client = TestClient(app)


@pytest.fixture(scope="module")
def setup_projects_test_data():
    db = SessionLocal()
    u1_id = str(uuid.uuid4())
    u2_id = str(uuid.uuid4())

    user1 = User(
        id=u1_id,
        email=f"proj_u1_{u1_id[:8]}@contentflow.ai",
        full_name="Project Owner",
        hashed_password=get_password_hash("Password123!"),
        is_active=True,
    )
    user2 = User(
        id=u2_id,
        email=f"proj_u2_{u2_id[:8]}@contentflow.ai",
        full_name="Second User",
        hashed_password=get_password_hash("Password123!"),
        is_active=True,
    )
    db.add(user1)
    db.add(user2)
    db.flush()

    source = Source(
        user_id=user1.id,
        title="Q3 Energy Infrastructure Brief",
        source_type="pasted_text",
        extracted_text="Helios Capital committed $450 million in storage in August 2026.",
        word_count=10,
        character_count=65,
        paragraph_count=1,
    )
    db.add(source)
    db.flush()

    transformation = Transformation(
        user_id=user1.id,
        source_id=source.id,
        title="Helios Executive Transformation",
        target_audience="Executive Board",
        tone="Executive",
        language="English",
        detail_level="Standard",
        communication_objective="Briefing",
        selected_formats=["executive_summary"],
        status="completed",
    )
    db.add(transformation)
    db.flush()

    output = TransformationOutput(
        transformation_id=transformation.id,
        format_type="executive_summary",
        title="Executive Summary: Helios",
        content="Helios Capital committed $450 million in storage in August 2026.",
        status="completed",
        version=1,
    )
    db.add(output)
    db.commit()

    token1 = create_access_token(subject=u1_id)
    token2 = create_access_token(subject=u2_id)

    yield {
        "user1": user1,
        "user2": user2,
        "token1": token1,
        "token2": token2,
        "source": source,
        "transformation": transformation,
        "output": output,
    }

    # Teardown
    db.query(Transformation).filter(Transformation.user_id.in_([u1_id, u2_id])).delete(synchronize_session=False)
    db.query(Project).filter(Project.user_id.in_([u1_id, u2_id])).delete(synchronize_session=False)
    db.query(Source).filter(Source.user_id.in_([u1_id, u2_id])).delete(synchronize_session=False)
    db.query(User).filter(User.id.in_([u1_id, u2_id])).delete(synchronize_session=False)
    db.commit()
    db.close()


def test_project_crud_lifecycle(setup_projects_test_data):
    """Tests creating, listing, searching, updating, and deleting a project."""
    data = setup_projects_test_data
    auth_headers = {"Authorization": f"Bearer {data['token1']}"}

    # 1. Create Project
    create_res = client.post(
        "/api/v1/projects",
        headers=auth_headers,
        json={
            "name": "Clean Energy Dossiers 2026",
            "description": "Portfolio of renewable grid transformation documents",
            "tags": ["Renewables", "Energy", "Executive"],
        },
    )
    assert create_res.status_code == 201
    proj_data = create_res.json()
    project_id = proj_data["id"]
    assert proj_data["name"] == "Clean Energy Dossiers 2026"
    assert proj_data["status"] == "active"
    assert "Renewables" in proj_data["tags"]

    # 2. List Projects
    list_res = client.get("/api/v1/projects", headers=auth_headers)
    assert list_res.status_code == 200
    projects = list_res.json()
    assert any(p["id"] == project_id for p in projects)

    # 3. Search Projects
    search_res = client.get("/api/v1/projects?search=Clean+Energy", headers=auth_headers)
    assert search_res.status_code == 200
    assert len(search_res.json()) >= 1
    assert search_res.json()[0]["id"] == project_id

    # 4. Assign Transformation to Project
    trans_id = data["transformation"].id
    assign_res = client.post(
        f"/api/v1/projects/{project_id}/transformations/{trans_id}",
        headers=auth_headers,
    )
    assert assign_res.status_code == 200

    # 5. Get Project Detail
    detail_res = client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["transformation_count"] == 1
    assert len(detail["transformations"]) == 1
    assert detail["transformations"][0]["id"] == trans_id

    # 6. Update Project (Rename & Archive)
    update_res = client.put(
        f"/api/v1/projects/{project_id}",
        headers=auth_headers,
        json={"name": "Renewable Infrastructure Portfolio", "status": "archived"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Renewable Infrastructure Portfolio"
    assert update_res.json()["status"] == "archived"

    # 7. Duplicate Project
    dup_res = client.post(f"/api/v1/projects/{project_id}/duplicate", headers=auth_headers)
    assert dup_res.status_code == 201
    dup_data = dup_res.json()
    assert dup_data["name"] == "Copy of Renewable Infrastructure Portfolio"
    assert dup_data["id"] != project_id
    assert dup_data["transformation_count"] == 1

    # 8. Delete Cloned Project
    del_dup = client.delete(f"/api/v1/projects/{dup_data['id']}", headers=auth_headers)
    assert del_dup.status_code == 200

    # 9. Delete Original Project
    del_res = client.delete(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert del_res.status_code == 200

    # 10. Verify Deleted
    get_del = client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert get_del.status_code == 404


def test_transformation_history_rename_and_duplicate(setup_projects_test_data):
    """Tests transformation history listing, rename, and duplicate endpoints."""
    data = setup_projects_test_data
    auth_headers = {"Authorization": f"Bearer {data['token1']}"}
    trans_id = data["transformation"].id

    # 1. List History with real metadata
    list_res = client.get("/api/v1/transformations", headers=auth_headers)
    assert list_res.status_code == 200
    history = list_res.json()
    target = next((t for t in history if t["id"] == trans_id), None)
    assert target is not None
    assert target["source_title"] == "Q3 Energy Infrastructure Brief"
    assert "executive_summary" in target["selected_formats"]
    assert target["status"] == "completed"

    # 2. Rename Transformation
    rename_res = client.put(
        f"/api/v1/transformations/{trans_id}",
        headers=auth_headers,
        json={"title": "Helios Energy Transformation (Updated)"},
    )
    assert rename_res.status_code == 200
    assert rename_res.json()["title"] == "Helios Energy Transformation (Updated)"

    # 3. Duplicate Transformation
    dup_res = client.post(f"/api/v1/transformations/{trans_id}/duplicate", headers=auth_headers)
    assert dup_res.status_code == 201
    dup_data = dup_res.json()
    assert dup_data["id"] != trans_id
    assert "Copy of" in dup_data["title"]
    assert len(dup_data["outputs"]) == 1
    assert dup_data["outputs"][0]["format_type"] == "executive_summary"


def test_dashboard_real_metrics(setup_projects_test_data):
    """Tests the dashboard metrics endpoint returning real database counts."""
    data = setup_projects_test_data
    auth_headers = {"Authorization": f"Bearer {data['token1']}"}

    metrics_res = client.get("/api/v1/dashboard/metrics", headers=auth_headers)
    assert metrics_res.status_code == 200
    metrics = metrics_res.json()

    # Real counts check
    assert metrics["total_transformations"] >= 1
    assert metrics["total_sources"] >= 1
    assert metrics["total_outputs"] >= 1
    assert "completed" in metrics["status_breakdown"]
    assert len(metrics["recent_transformations"]) >= 1
    assert metrics["recent_transformations"][0]["source_title"] is not None


def test_tenant_isolation_projects_and_history(setup_projects_test_data):
    """Enforces strict tenant isolation: User 2 cannot access User 1's projects or transformations."""
    data = setup_projects_test_data
    user1_headers = {"Authorization": f"Bearer {data['token1']}"}
    user2_headers = {"Authorization": f"Bearer {data['token2']}"}

    # Create a project owned by User 1
    create_res = client.post(
        "/api/v1/projects",
        headers=user1_headers,
        json={"name": "Confidential Strategic Dossiers"},
    )
    assert create_res.status_code == 201
    project_id = create_res.json()["id"]

    # User 2 attempts to view User 1's project
    get_res = client.get(f"/api/v1/projects/{project_id}", headers=user2_headers)
    assert get_res.status_code == 404

    # User 2 attempts to update User 1's project
    put_res = client.put(
        f"/api/v1/projects/{project_id}",
        headers=user2_headers,
        json={"name": "Hacked Project"},
    )
    assert put_res.status_code == 404

    # User 2 attempts to duplicate User 1's project
    dup_res = client.post(f"/api/v1/projects/{project_id}/duplicate", headers=user2_headers)
    assert dup_res.status_code == 404

    # User 2 attempts to delete User 1's project
    del_res = client.delete(f"/api/v1/projects/{project_id}", headers=user2_headers)
    assert del_res.status_code == 404

    # User 2 attempts to rename User 1's transformation
    trans_id = data["transformation"].id
    trans_put = client.put(
        f"/api/v1/transformations/{trans_id}",
        headers=user2_headers,
        json={"title": "Hacked Transformation"},
    )
    assert trans_put.status_code == 404

    # User 2 attempts to duplicate User 1's transformation
    trans_dup = client.post(f"/api/v1/transformations/{trans_id}/duplicate", headers=user2_headers)
    assert trans_dup.status_code == 404
