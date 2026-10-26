import sys
import uuid
from pathlib import Path
from unittest.mock import patch
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.source import Source
from app.models.transformation import Transformation, TransformationOutput
from app.core.security import get_password_hash, create_access_token
from app.core.config import settings
from app.services.generation_engine import SUPPORTED_FORMATS, generate_single_format

client = TestClient(app)


SAMPLE_STRUCTURED_ANALYSIS = {
    "main_topic": "European Clean Grid Capital Allocation 2026",
    "executive_summary": "Helios Capital deployed $450M in battery storage with utility solar growing 24.5%.",
    "key_points": [
        "Helios Capital deployed $450 million in Scandinavian storage.",
        "Utility solar capacity surged 24.5% year-over-year.",
        "Transformer equipment shortages pushed queue to 38 months.",
    ],
    "entities": [
        {"name": "Helios Capital", "category": "organization", "context": "Private investment fund"},
        {"name": "Elena Rostova", "category": "person", "context": "Chief Executive Officer"},
    ],
    "dates_and_events": [
        {"date": "August 2026", "event": "Capital deployment into Scandinavian battery storage"},
    ],
    "numerical_facts": [
        {"value": "$450 million", "metric": "Capital deployed", "context": "Storage infrastructure investment"},
        {"value": "24.5%", "metric": "Solar growth", "context": "YoY utility solar capacity growth"},
    ],
    "key_claims": [
        {"claim": "Helios deployed $450 million.", "status": "explicit_fact"},
    ],
    "uncertain_or_missing_info": ["Detailed IRR targets are omitted."],
    "confidence_score": 0.95,
}


@pytest.fixture(scope="module")
def setup_transformation_test_data():
    db = SessionLocal()
    u1_id = str(uuid.uuid4())
    u2_id = str(uuid.uuid4())

    user1 = User(
        id=u1_id,
        email=f"trans_user1_{u1_id[:8]}@contentflow.ai",
        full_name="Trans User One",
        hashed_password=get_password_hash("Password123!"),
        is_active=True,
    )
    user2 = User(
        id=u2_id,
        email=f"trans_user2_{u2_id[:8]}@contentflow.ai",
        full_name="Trans User Two",
        hashed_password=get_password_hash("Password123!"),
        is_active=True,
    )
    db.add(user1)
    db.add(user2)
    db.commit()

    # Create source with structured analysis for user1
    s1_id = str(uuid.uuid4())
    source1 = Source(
        id=s1_id,
        user_id=u1_id,
        title="European Energy Dossier",
        source_type="text",
        file_type="txt",
        extracted_text="In August 2026, Helios Capital deployed $450 million into grid storage. Solar grew 24.5%.",
        word_count=20,
        character_count=120,
        paragraph_count=1,
        structured_analysis=SAMPLE_STRUCTURED_ANALYSIS,
    )
    db.add(source1)
    db.commit()

    token1 = create_access_token(subject=u1_id)
    token2 = create_access_token(subject=u2_id)

    yield {
        "user1": user1,
        "token1": token1,
        "user2": user2,
        "token2": token2,
        "source1": source1,
    }

    # Teardown
    try:
        db.query(TransformationOutput).delete(synchronize_session=False)
        db.query(Transformation).delete(synchronize_session=False)
        db.query(Source).filter(Source.user_id.in_([u1_id, u2_id])).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_([u1_id, u2_id])).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def fake_generate_single_format(structured_analysis, format_type, config):
    return (
        f"# Mocked Rendered Content for {format_type}\nGrounded in {structured_analysis['main_topic']}.",
        {"format": format_type, "generated": True},
        "mocked-gemini-model",
    )


def test_create_transformation_all_seven_formats(setup_transformation_test_data):
    """Test generating all 7 supported formats concurrently from shared structured facts."""
    source_id = setup_transformation_test_data["source1"].id
    headers = {"Authorization": f"Bearer {setup_transformation_test_data['token1']}"}

    payload = {
        "source_id": source_id,
        "title": "Clean Grid Multi-Format Deployment Pack",
        "selected_formats": list(SUPPORTED_FORMATS.keys()),
        "target_audience": "C-Suite & Investment Partners",
        "tone": "Professional & Executive",
        "language": "English",
        "detail_level": "Standard / Balanced",
        "communication_objective": "Inform & Brief",
        "additional_instructions": "Highlight battery storage capacity.",
    }

    with patch("app.api.v1.endpoints.transformations.generate_single_format", side_effect=fake_generate_single_format):
        resp = client.post("/api/v1/transformations", json=payload, headers=headers)
        assert resp.status_code == 201, resp.text
        data = resp.json()

        assert data["title"] == "Clean Grid Multi-Format Deployment Pack"
        assert data["status"] == "completed"
        assert len(data["outputs"]) == 7

        format_types = [o["format_type"] for o in data["outputs"]]
        for expected in SUPPORTED_FORMATS.keys():
            assert expected in format_types


def test_create_transformation_invalid_format(setup_transformation_test_data):
    """Ensure invalid formats return 400 Bad Request."""
    source_id = setup_transformation_test_data["source1"].id
    headers = {"Authorization": f"Bearer {setup_transformation_test_data['token1']}"}

    payload = {
        "source_id": source_id,
        "selected_formats": ["unsupported_tiktok_dance"],
    }
    resp = client.post("/api/v1/transformations", json=payload, headers=headers)
    assert resp.status_code == 400
    assert "Unsupported format" in resp.json()["detail"]


def test_partial_failure_handling(setup_transformation_test_data):
    """Ensure partial failures in one format do NOT erase or fail successful formats."""
    source_id = setup_transformation_test_data["source1"].id
    headers = {"Authorization": f"Bearer {setup_transformation_test_data['token1']}"}

    def flaky_generate(structured_analysis, format_type, config):
        if format_type == "video_script":
            raise RuntimeError("Temporary model rate limit on video script generator.")
        return fake_generate_single_format(structured_analysis, format_type, config)

    payload = {
        "source_id": source_id,
        "selected_formats": ["executive_summary", "video_script"],
    }

    with patch("app.api.v1.endpoints.transformations.generate_single_format", side_effect=flaky_generate):
        resp = client.post("/api/v1/transformations", json=payload, headers=headers)
        assert resp.status_code == 201, resp.text
        data = resp.json()

        assert data["status"] == "partially_failed"
        assert len(data["outputs"]) == 2

        exec_out = next(o for o in data["outputs"] if o["format_type"] == "executive_summary")
        video_out = next(o for o in data["outputs"] if o["format_type"] == "video_script")

        assert exec_out["status"] == "completed"
        assert "Mocked Rendered Content" in exec_out["content"]

        assert video_out["status"] == "failed"
        assert "Temporary model rate limit" in video_out["error_message"]


def test_update_transformation_output(setup_transformation_test_data):
    """Verify editing output text saves content and increments version."""
    source_id = setup_transformation_test_data["source1"].id
    headers = {"Authorization": f"Bearer {setup_transformation_test_data['token1']}"}

    # Create transformation with 1 output
    payload = {
        "source_id": source_id,
        "selected_formats": ["linkedin_post"],
    }
    with patch("app.api.v1.endpoints.transformations.generate_single_format", side_effect=fake_generate_single_format):
        resp = client.post("/api/v1/transformations", json=payload, headers=headers)
        trans_id = resp.json()["id"]
        output_id = resp.json()["outputs"][0]["id"]

    # Update output content
    update_payload = {
        "content": "# Custom Edited LinkedIn Content\nHuman edited polish with exact stats.",
        "title": "Edited LinkedIn Post Title",
    }
    resp_put = client.put(
        f"/api/v1/transformations/{trans_id}/outputs/{output_id}",
        json=update_payload,
        headers=headers,
    )
    assert resp_put.status_code == 200, resp_put.text
    updated = resp_put.json()
    assert updated["content"] == update_payload["content"]
    assert updated["title"] == update_payload["title"]
    assert updated["version"] == 2


def test_regenerate_single_output_isolation(setup_transformation_test_data):
    """Ensure regenerating ONE output only regenerates that output without touching others."""
    source_id = setup_transformation_test_data["source1"].id
    headers = {"Authorization": f"Bearer {setup_transformation_test_data['token1']}"}

    payload = {
        "source_id": source_id,
        "selected_formats": ["executive_summary", "linkedin_post"],
    }
    with patch("app.api.v1.endpoints.transformations.generate_single_format", side_effect=fake_generate_single_format):
        resp = client.post("/api/v1/transformations", json=payload, headers=headers)
        trans_id = resp.json()["id"]
        exec_out_id = next(o["id"] for o in resp.json()["outputs"] if o["format_type"] == "executive_summary")
        linkedin_out_id = next(o["id"] for o in resp.json()["outputs"] if o["format_type"] == "linkedin_post")

    # Mock regenerated output specifically
    def regen_mock(*args, **kwargs):
        return ("# Newly Regenerated Exec Summary", {"regen": True}, "gemini-3.5-flash")

    with patch("app.api.v1.endpoints.transformations.generate_single_format", side_effect=regen_mock):
        resp_regen = client.post(
            f"/api/v1/transformations/{trans_id}/outputs/{exec_out_id}/regenerate",
            headers=headers,
        )
        assert resp_regen.status_code == 200, resp_regen.text
        regen_data = resp_regen.json()
        assert regen_data["id"] == exec_out_id
        assert regen_data["content"] == "# Newly Regenerated Exec Summary"
        assert regen_data["version"] == 2

    # Check that linkedin output was NOT modified
    resp_get = client.get(f"/api/v1/transformations/{trans_id}", headers=headers)
    linkedin_check = next(o for o in resp_get.json()["outputs"] if o["id"] == linkedin_out_id)
    assert linkedin_check["version"] == 1


def test_transformation_tenant_isolation(setup_transformation_test_data):
    """Ensure User 2 cannot access, edit, or regenerate User 1's transformation."""
    source_id = setup_transformation_test_data["source1"].id
    user1_headers = {"Authorization": f"Bearer {setup_transformation_test_data['token1']}"}
    user2_headers = {"Authorization": f"Bearer {setup_transformation_test_data['token2']}"}

    with patch("app.api.v1.endpoints.transformations.generate_single_format", side_effect=fake_generate_single_format):
        resp = client.post(
            "/api/v1/transformations",
            json={"source_id": source_id, "selected_formats": ["advisory"]},
            headers=user1_headers,
        )
        trans_id = resp.json()["id"]
        output_id = resp.json()["outputs"][0]["id"]

    # User 2 tries to GET transformation
    assert client.get(f"/api/v1/transformations/{trans_id}", headers=user2_headers).status_code == 404

    # User 2 tries to PUT output
    assert client.put(
        f"/api/v1/transformations/{trans_id}/outputs/{output_id}",
        json={"content": "Malicious edit"},
        headers=user2_headers,
    ).status_code == 404

    # User 2 tries to REGENERATE output
    assert client.post(
        f"/api/v1/transformations/{trans_id}/outputs/{output_id}/regenerate",
        headers=user2_headers,
    ).status_code == 404


@pytest.mark.skipif(
    not (settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")),
    reason="Requires active GEMINI_API_KEY",
)
def test_live_format_generation_integration():
    """Live integration test: generates Twitter thread using Google Gemini and verifies constraints."""
    config = {
        "target_audience": "Clean Energy Analysts",
        "tone": "Analytical & Fast-Paced",
        "language": "English",
    }
    content, structured, model = generate_single_format(
        SAMPLE_STRUCTURED_ANALYSIS,
        "twitter_thread",
        config,
    )
    assert "tweets" in structured
    assert len(structured["tweets"]) >= 3
    # Check that tweets respect the 280 character limit
    for tw in structured["tweets"]:
        assert len(tw["text"]) <= 280
    assert model.startswith("gemini")
