import os
import sys
import uuid
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.source import Source
from app.core.security import get_password_hash, create_access_token
from app.schemas.analysis import (
    StructuredSourceAnalysis,
    KeyClaim,
    NumericalFact,
    NamedEntity,
    DateOrEvent,
)
from app.services.gemini import gemini_service

client = TestClient(app)


@pytest.fixture(scope="module")
def setup_users_and_sources():
    db = SessionLocal()
    u1_id = str(uuid.uuid4())
    u2_id = str(uuid.uuid4())

    user1 = User(
        id=u1_id,
        email=f"ana_user1_{u1_id[:8]}@contentflow.ai",
        full_name="Analysis User 1",
        hashed_password=get_password_hash("Password123!"),
        is_active=True,
    )
    user2 = User(
        id=u2_id,
        email=f"ana_user2_{u2_id[:8]}@contentflow.ai",
        full_name="Analysis User 2",
        hashed_password=get_password_hash("Password123!"),
        is_active=True,
    )
    db.add(user1)
    db.add(user2)
    db.commit()

    # Create a source owned by user1
    s1_id = str(uuid.uuid4())
    source1 = Source(
        id=s1_id,
        user_id=u1_id,
        title="Q3 Global Energy Outlook 2026",
        source_type="text",
        file_type="txt",
        original_filename="energy_q3.txt",
        extracted_text=(
            "In August 2026, Helios Capital deployed $450 million into grid-scale storage projects "
            "across Scandinavia. According to CEO Elena Rostova, utility solar capacity grew 24.5% year-over-year. "
            "However, transmission interconnection timelines lengthened to 38 months due to transformer shortages."
        ),
        word_count=42,
        character_count=280,
        paragraph_count=1,
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
        db.query(Source).filter(Source.user_id.in_([u1_id, u2_id])).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_([u1_id, u2_id])).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


SAMPLE_MOCK_ANALYSIS = {
    "main_topic": "Scandinavia Grid-Scale Energy Capital Deployment",
    "executive_summary": (
        "Helios Capital committed $450M into Scandinavian battery storage in August 2026 while solar grew 24.5%."
    ),
    "key_points": [
        "Helios Capital deployed $450 million into grid storage.",
        "Utility solar capacity accelerated 24.5% YoY.",
        "Transmission queue delays hit 38 months.",
    ],
    "entities": [
        {"name": "Helios Capital", "category": "organization", "context": "Private capital investor"},
        {"name": "Elena Rostova", "category": "person", "context": "Chief Executive Officer"},
        {"name": "Scandinavia", "category": "location", "context": "Target geographic deployment region"},
    ],
    "dates_and_events": [
        {
            "date": "August 2026",
            "event": "Capital deployment into Scandinavian grid storage",
            "excerpt": "In August 2026, Helios Capital deployed $450 million",
        },
    ],
    "numerical_facts": [
        {
            "value": "$450 million",
            "metric": "Capital deployed",
            "context": "Helios Capital investment into Scandinavian grid storage",
            "excerpt": "$450 million into grid-scale storage",
        },
        {
            "value": "24.5%",
            "metric": "Solar capacity growth",
            "context": "Year-over-year acceleration in Scandinavian solar capacity",
            "excerpt": "solar capacity grew 24.5% year-over-year",
        },
        {
            "value": "38 months",
            "metric": "Interconnection timeline",
            "context": "Transmission delays caused by transformer equipment shortages",
            "excerpt": "interconnection timelines lengthened to 38 months",
        },
    ],
    "key_claims": [
        {
            "claim": "Helios Capital invested $450 million in Scandinavian storage projects.",
            "status": "explicit_fact",
            "supporting_excerpt": "Helios Capital deployed $450 million into grid-scale storage projects across Scandinavia.",
        },
        {
            "claim": "Supply chain transformer constraints will extend deployment milestones further.",
            "status": "interpretation",
            "supporting_excerpt": "transformer shortages",
        },
    ],
    "recommendations": [
        "Prioritize transformer procurement lead times to prevent project delays."
    ],
    "uncertain_or_missing_info": [
        "Specific return on investment targets or IRR figures are omitted in the document.",
        "Exact count and locations of battery storage facilities are not specified.",
    ],
    "confidence_score": 0.95,
}


def test_pydantic_schema_validation():
    """Verify that StructuredSourceAnalysis strictly parses and validates conforming data."""
    validated = StructuredSourceAnalysis(**SAMPLE_MOCK_ANALYSIS)
    assert validated.main_topic == "Scandinavia Grid-Scale Energy Capital Deployment"
    assert len(validated.numerical_facts) == 3
    assert validated.numerical_facts[0].value == "$450 million"
    assert validated.key_claims[0].status == "explicit_fact"
    assert validated.key_claims[1].status == "interpretation"
    assert len(validated.uncertain_or_missing_info) == 2
    assert validated.confidence_score == 0.95


def test_missing_facts_not_invented():
    """Anti-hallucination requirement: explicit facts and missing information must be tracked."""
    analysis = StructuredSourceAnalysis(**SAMPLE_MOCK_ANALYSIS)
    # Explicit fact has exact excerpt
    explicit = [c for c in analysis.key_claims if c.status == "explicit_fact"]
    assert len(explicit) == 1
    assert "Helios Capital deployed $450 million" in explicit[0].supporting_excerpt

    # Missing information is explicitly captured
    assert any("omitted" in gap.lower() for gap in analysis.uncertain_or_missing_info)


def test_analyze_source_mocked_success(setup_users_and_sources):
    """Test POST /api/v1/sources/{id}/analyze with mocked Gemini analysis."""
    source_id = setup_users_and_sources["source1"].id
    headers = {"Authorization": f"Bearer {setup_users_and_sources['token1']}"}

    mock_analysis_obj = StructuredSourceAnalysis(**SAMPLE_MOCK_ANALYSIS)
    mock_return = (mock_analysis_obj, "gemini-3.5-flash", 1.25)

    with patch.object(gemini_service, "analyze_source_content", return_value=mock_return):
        resp = client.post(f"/api/v1/sources/{source_id}/analyze", headers=headers)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["source_id"] == source_id
        assert data["analysis"]["main_topic"] == "Scandinavia Grid-Scale Energy Capital Deployment"
        assert len(data["analysis"]["numerical_facts"]) == 3
        assert len(data["analysis"]["uncertain_or_missing_info"]) == 2


def test_get_source_analysis_success(setup_users_and_sources):
    """Test GET /api/v1/sources/{id}/analysis returns previously persisted analysis."""
    source_id = setup_users_and_sources["source1"].id
    headers = {"Authorization": f"Bearer {setup_users_and_sources['token1']}"}

    resp = client.get(f"/api/v1/sources/{source_id}/analysis", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["source_id"] == source_id
    assert data["analysis"]["main_topic"] == "Scandinavia Grid-Scale Energy Capital Deployment"
    assert data["analyzed_at"] is not None


def test_analysis_tenant_isolation(setup_users_and_sources):
    """Ensure User 2 cannot access or analyze User 1's source."""
    source_id = setup_users_and_sources["source1"].id
    user2_headers = {"Authorization": f"Bearer {setup_users_and_sources['token2']}"}

    # User 2 attempting to view User 1's analysis
    resp_get = client.get(f"/api/v1/sources/{source_id}/analysis", headers=user2_headers)
    assert resp_get.status_code == 404

    # User 2 attempting to trigger analysis on User 1's source
    resp_post = client.post(f"/api/v1/sources/{source_id}/analyze", headers=user2_headers)
    assert resp_post.status_code == 404


def test_analyze_nonexistent_source(setup_users_and_sources):
    """Ensure 404 is returned when source does not exist."""
    headers = {"Authorization": f"Bearer {setup_users_and_sources['token1']}"}
    fake_id = str(uuid.uuid4())
    resp = client.post(f"/api/v1/sources/{fake_id}/analyze", headers=headers)
    assert resp.status_code == 404


def test_analyze_gemini_error_handling(setup_users_and_sources):
    """Ensure that Gemini service errors result in a 502 with helpful message."""
    source_id = setup_users_and_sources["source1"].id
    headers = {"Authorization": f"Bearer {setup_users_and_sources['token1']}"}

    with patch.object(gemini_service, "analyze_source_content", side_effect=RuntimeError("Quota limit reached")):
        resp = client.post(f"/api/v1/sources/{source_id}/analyze", headers=headers)
        assert resp.status_code == 502
        assert "Quota limit reached" in resp.json()["detail"]


from app.core.config import settings

@pytest.mark.skipif(
    not (settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")),
    reason="Requires active GEMINI_API_KEY",
)
def test_live_gemini_integration():
    """Optional live integration test validating live Gemini API response structure."""
    sample_text = (
        "Project Meridian reached financial close in October 2025, securing 120 million Euros "
        "from the European Investment Bank. Over 400 technicians were hired in Munich. "
        "Operational efficiency is projected to exceed 98.2%."
    )
    analysis, model_used, elapsed = gemini_service.analyze_source_content(sample_text)
    assert analysis.main_topic != ""
    assert len(analysis.numerical_facts) >= 1
    assert analysis.confidence_score >= 0.0
    assert model_used.startswith("gemini")
    assert elapsed > 0
