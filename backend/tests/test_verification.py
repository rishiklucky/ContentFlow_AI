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
from app.models.verification import OutputVerification, ClaimVerification
from app.core.security import get_password_hash, create_access_token
from app.services.fact_checker import fact_verification_engine
from app.schemas.verification import ClaimVerificationItem

client = TestClient(app)

SAMPLE_SOURCE_TEXT = """
Helios Capital Global Infrastructure Report - August 2026.
In the third quarter of 2026, Helios Capital deployed $450 million into Scandinavian utility-scale battery energy storage systems.
Chief Executive Officer Elena Rostova noted that regional solar capacity expanded 24.5% year-over-year.
However, acute transformer equipment delivery bottlenecks have extended interconnection waiting queues to 38 months.
Total European portfolio assets reached $3.2 billion across 14 operational facilities.
"""

SAMPLE_ANALYSIS = {
    "main_topic": "Helios Capital Scandinavian Energy Deployment 2026",
    "executive_summary": "Helios deployed $450M in battery storage with solar capacity surging 24.5%.",
    "key_points": [
        "Helios Capital deployed $450 million in Scandinavian storage.",
        "Regional solar capacity expanded 24.5% year-over-year.",
        "Transformer delivery bottlenecks pushed queues to 38 months.",
    ],
    "entities": [
        {"name": "Helios Capital", "category": "organization", "context": "Infrastructure fund"},
        {"name": "Elena Rostova", "category": "person", "context": "CEO"},
    ],
    "dates_and_events": [
        {"date": "August 2026", "event": "Scandinavian battery storage capital deployment"},
    ],
    "numerical_facts": [
        {"value": "$450 million", "metric": "Capital deployed", "context": "Storage deployment"},
        {"value": "24.5%", "metric": "Solar capacity growth", "context": "YoY growth"},
        {"value": "38 months", "metric": "Interconnection queue", "context": "Supply bottlenecks"},
        {"value": "$3.2 billion", "metric": "Total portfolio assets", "context": "14 operational facilities"},
    ],
    "key_claims": [
        {"claim": "Helios deployed $450 million.", "status": "explicit_fact"},
    ],
    "uncertain_or_missing_info": ["Specific facility-level EBITDA numbers are omitted."],
    "confidence_score": 0.95,
}


@pytest.fixture(scope="module")
def setup_verification_test_data():
    db = SessionLocal()
    u1_id = str(uuid.uuid4())
    u2_id = str(uuid.uuid4())

    user1 = User(
        id=u1_id,
        email=f"verify_u1_{u1_id[:8]}@contentflow.ai",
        full_name="Verification Owner",
        hashed_password=get_password_hash("Password123!"),
        is_active=True,
    )
    user2 = User(
        id=u2_id,
        email=f"verify_u2_{u2_id[:8]}@contentflow.ai",
        full_name="Other User",
        hashed_password=get_password_hash("Password123!"),
        is_active=True,
    )
    db.add(user1)
    db.add(user2)
    db.flush()

    source = Source(
        user_id=user1.id,
        title="Helios Capital Report August 2026",
        source_type="pasted_text",
        extracted_text=SAMPLE_SOURCE_TEXT,
        character_count=len(SAMPLE_SOURCE_TEXT),
        word_count=len(SAMPLE_SOURCE_TEXT.split()),
        paragraph_count=4,
        structured_analysis=SAMPLE_ANALYSIS,
    )
    db.add(source)
    db.flush()

    transformation = Transformation(
        user_id=user1.id,
        source_id=source.id,
        title="Helios Executive Transformation",
        target_audience="Board of Directors",
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
        title="Executive Summary: Helios Capital",
        content="Helios Capital deployed $450 million in August 2026. Regional solar capacity surged 24.5%. Total assets reached $3.2 billion.",
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
    db.query(Transformation).filter(Transformation.id == transformation.id).delete()
    db.query(Source).filter(Source.id == source.id).delete()
    db.query(User).filter(User.id.in_([u1_id, u2_id])).delete()
    db.commit()
    db.close()


def test_deterministic_checks_numerical_and_dates():
    """Tests deterministic identification of accurate vs altered numbers and dates."""
    # 1. Correct claim
    correct_claim = ClaimVerificationItem(
        claim_index=0,
        claim_text="Helios Capital deployed $450 million in storage.",
        claim_type="numerical",
        classification="requires_review",
        confidence_score=0.8,
        reasoning="Initial",
    )
    # 2. Altered numerical value
    altered_num_claim = ClaimVerificationItem(
        claim_index=1,
        claim_text="Helios Capital deployed $950 million in storage.",
        claim_type="numerical",
        classification="supported",
        confidence_score=0.9,
        reasoning="Initial",
    )
    # 3. Altered date
    altered_date_claim = ClaimVerificationItem(
        claim_index=2,
        claim_text="The transaction was completed in 1998.",
        claim_type="date_event",
        classification="supported",
        confidence_score=0.9,
        reasoning="Initial",
    )

    results = fact_verification_engine.run_deterministic_checks(
        claims=[correct_claim, altered_num_claim, altered_date_claim],
        source_text=SAMPLE_SOURCE_TEXT,
        structured_analysis=SAMPLE_ANALYSIS,
    )

    # Correct number should be resolved to supported
    assert results[0].classification == "supported"
    assert results[0].is_deterministic is True
    assert results[0].source_excerpt is not None

    # Altered number should be flagged as contradicts_source
    assert results[1].classification == "contradicts_source"
    assert results[1].is_deterministic is True

    # Altered date (1998) not in source should be flagged as unsupported
    assert results[2].classification == "unsupported"
    assert results[2].is_deterministic is True
    # Anti-fabrication check: unsupported claim must have no fabricated source excerpt
    assert results[2].source_excerpt is None


def test_verification_api_lifecycle(setup_verification_test_data):
    """
    Tests the complete verification endpoint lifecycle:
    1. Initial verification call on transformation output
    2. Verification persistence in PostgreSQL
    3. Retrieval of verification result
    4. Editing output with altered/contradictory facts and reverifying
    """
    data = setup_verification_test_data
    trans_id = data["transformation"].id
    output_id = data["output"].id
    auth_headers = {"Authorization": f"Bearer {data['token1']}"}

    # 1. Verify Output via POST
    response = client.post(
        f"/api/v1/transformations/{trans_id}/outputs/{output_id}/verify",
        headers=auth_headers,
        json={"custom_instructions": "Focus on capital expenditure figures and dates."},
    )
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["output_id"] == output_id
    assert res_data["status"] == "completed"
    assert res_data["overall_grounding_score"] >= 0.5
    assert len(res_data["claims"]) > 0
    assert "supported" in res_data["classification_counts"]

    # 2. Retrieve Verification via GET
    get_res = client.get(
        f"/api/v1/transformations/{trans_id}/outputs/{output_id}/verification",
        headers=auth_headers,
    )
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["id"] == res_data["id"]
    assert len(get_data["claims"]) == len(res_data["claims"])

    # 3. Edit Output with an altered number ($890M instead of $450M) and a fake year (2015)
    edit_res = client.put(
        f"/api/v1/transformations/{trans_id}/outputs/{output_id}",
        headers=auth_headers,
        json={"content": "Helios Capital deployed $890 million back in 2015. Solar capacity fell by 75%."},
    )
    assert edit_res.status_code == 200

    # 4. Rerun Verification on the edited output
    reverify_res = client.post(
        f"/api/v1/transformations/{trans_id}/outputs/{output_id}/verify",
        headers=auth_headers,
    )
    assert reverify_res.status_code == 200
    reverify_data = reverify_res.json()
    assert reverify_data["id"] == res_data["id"]  # Same verification record updated
    
    # Check that altered numbers/dates are flagged
    flagged = [c for c in reverify_data["claims"] if c["classification"] in {"contradicts_source", "unsupported"}]
    assert len(flagged) > 0


def test_verification_unauthorized_access(setup_verification_test_data):
    """Verifies that User B cannot access or run verification on User A's outputs."""
    data = setup_verification_test_data
    trans_id = data["transformation"].id
    output_id = data["output"].id
    user2_headers = {"Authorization": f"Bearer {data['token2']}"}

    # User 2 tries to verify User 1's output
    post_res = client.post(
        f"/api/v1/transformations/{trans_id}/outputs/{output_id}/verify",
        headers=user2_headers,
    )
    assert post_res.status_code == 404

    # User 2 tries to get verification
    get_res = client.get(
        f"/api/v1/transformations/{trans_id}/outputs/{output_id}/verification",
        headers=user2_headers,
    )
    assert get_res.status_code == 404
