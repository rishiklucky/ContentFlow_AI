import sys
import io
import zipfile
import uuid
from pathlib import Path
from docx import Document
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.source import Source
from app.models.transformation import Transformation, TransformationOutput
from app.core.security import get_password_hash, create_access_token
from app.services.export_service import markdown_to_plain_text, sanitize_filename

client = TestClient(app)


SAMPLE_PRESENTATION_MD = """# 📊 Nordic Clean Grid 2026 Strategy

---
### Slide 1: Executive Overview
*Layout Recommendation: Split-screen visual with KPI callout*

- Helios deployed $450 million in regional battery storage.
- Interconnection lead times average 38 months due to equipment bottlenecks.

> 🗣️ **Speaker Notes:** Emphasize that while capital is deployed, supply chain constraints remain the critical risk factor.

---
### Slide 2: Regional Market Growth
*Layout Recommendation: 3-column comparative metric cards*

- Solar capacity surged 24.5% year-over-year.
- Total assets under management reached $3.2 billion across 14 facilities.

> 🗣️ **Speaker Notes:** Walk board members through the revenue projection trajectory.
"""


@pytest.fixture(scope="module")
def setup_export_test_data():
    db = SessionLocal()
    u1_id = str(uuid.uuid4())
    u2_id = str(uuid.uuid4())

    user1 = User(
        id=u1_id,
        email=f"export_u1_{u1_id[:8]}@contentflow.ai",
        full_name="Export Owner",
        hashed_password=get_password_hash("Password123!"),
        is_active=True,
    )
    user2 = User(
        id=u2_id,
        email=f"export_u2_{u2_id[:8]}@contentflow.ai",
        full_name="Unauthorized User",
        hashed_password=get_password_hash("Password123!"),
        is_active=True,
    )
    db.add(user1)
    db.add(user2)
    db.flush()

    source = Source(
        user_id=user1.id,
        title="Nordic Infrastructure Brief",
        source_type="pasted_text",
        extracted_text="Nordic infrastructure market data 2026.",
        character_count=100,
        word_count=20,
        paragraph_count=1,
    )
    db.add(source)
    db.flush()

    transformation = Transformation(
        user_id=user1.id,
        source_id=source.id,
        title="Nordic Grid 2026 Expansion Plan",
        target_audience="Board of Directors",
        tone="Executive",
        language="English",
        detail_level="Standard",
        communication_objective="Strategic Briefing",
        selected_formats=["presentation", "executive_summary"],
        status="completed",
    )
    db.add(transformation)
    db.flush()

    out1 = TransformationOutput(
        transformation_id=transformation.id,
        format_type="presentation",
        title="Presentation Deck: Nordic Strategy",
        content=SAMPLE_PRESENTATION_MD,
        status="completed",
        version=1,
    )
    out2 = TransformationOutput(
        transformation_id=transformation.id,
        format_type="executive_summary",
        title="Executive Summary: Nordic Grid",
        content="# Executive Briefing\nDeployment of $450M confirmed in Q3 2026.",
        status="completed",
        version=1,
    )
    out3_failed = TransformationOutput(
        transformation_id=transformation.id,
        format_type="video_script",
        title="Failed Video Script",
        content="",
        status="failed",
        error_message="Model timed out during script rendering.",
        version=1,
    )
    db.add_all([out1, out2, out3_failed])
    db.commit()

    token1 = create_access_token(subject=u1_id)
    token2 = create_access_token(subject=u2_id)

    yield {
        "user1": user1,
        "user2": user2,
        "token1": token1,
        "token2": token2,
        "transformation": transformation,
        "out_presentation": out1,
        "out_exec": out2,
        "out_failed": out3_failed,
    }

    # Teardown
    db.query(TransformationOutput).filter(TransformationOutput.transformation_id == transformation.id).delete()
    db.query(Transformation).filter(Transformation.id == transformation.id).delete()
    db.query(Source).filter(Source.id == source.id).delete()
    db.query(User).filter(User.id.in_([u1_id, u2_id])).delete()
    db.commit()
    db.close()


def test_markdown_to_plain_text_converter():
    """Verify that headings, slide numbers, bullets, and speaker notes are preserved in plain text."""
    plain = markdown_to_plain_text(SAMPLE_PRESENTATION_MD)
    
    assert "NORDIC CLEAN GRID 2026 STRATEGY" in plain
    assert "Slide 1: Executive Overview" in plain
    assert "• Helios deployed $450 million in regional battery storage." in plain
    assert "| 🗣️ Speaker Notes: Emphasize that while capital is deployed" in plain
    assert "**" not in plain  # Bold markers stripped
    assert "###" not in plain  # Hash marks stripped


def test_export_markdown_and_txt_endpoints(setup_export_test_data):
    """Verify exporting output as .md and .txt preserves content and user edits."""
    data = setup_export_test_data
    trans_id = data["transformation"].id
    out_id = data["out_presentation"].id
    headers = {"Authorization": f"Bearer {data['token1']}"}

    # 1. Export as Markdown
    resp_md = client.get(
        f"/api/v1/transformations/{trans_id}/outputs/{out_id}/export?format=md",
        headers=headers,
    )
    assert resp_md.status_code == 200
    assert "text/markdown" in resp_md.headers["content-type"]
    assert 'attachment; filename="Nordic_Grid_2026_Expansion_Plan_presentation.md"' in resp_md.headers["content-disposition"]
    assert "# 📊 Nordic Clean Grid 2026 Strategy" in resp_md.text

    # 2. Update output content (Simulate user edit)
    edited_text = SAMPLE_PRESENTATION_MD + "\n- NEW EDIT: Verified battery storage latency under 12ms."
    resp_edit = client.put(
        f"/api/v1/transformations/{trans_id}/outputs/{out_id}",
        json={"content": edited_text},
        headers=headers,
    )
    assert resp_edit.status_code == 200

    # 3. Export as Plain Text - verify latest saved edit is present
    resp_txt = client.get(
        f"/api/v1/transformations/{trans_id}/outputs/{out_id}/export?format=txt",
        headers=headers,
    )
    assert resp_txt.status_code == 200
    assert "text/plain" in resp_txt.headers["content-type"]
    assert "NEW EDIT: Verified battery storage latency under 12ms." in resp_txt.text
    assert "Slide 1: Executive Overview" in resp_txt.text


def test_export_docx_binary(setup_export_test_data):
    """Verify DOCX export endpoint generates a valid Word document."""
    data = setup_export_test_data
    trans_id = data["transformation"].id
    out_id = data["out_presentation"].id
    headers = {"Authorization": f"Bearer {data['token1']}"}

    resp = client.get(
        f"/api/v1/transformations/{trans_id}/outputs/{out_id}/export?format=docx",
        headers=headers,
    )
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in resp.headers["content-type"]
    assert ".docx" in resp.headers["content-disposition"]

    # Verify binary is a valid docx file
    doc_file = io.BytesIO(resp.content)
    doc = Document(doc_file)
    paragraphs = [p.text for p in doc.paragraphs if p.text]
    full_doc_text = " ".join(paragraphs)
    assert "Helios deployed $450 million" in full_doc_text


def test_export_batch_zip(setup_export_test_data):
    """Verify batch export endpoint bundles all completed outputs into a ZIP archive."""
    data = setup_export_test_data
    trans_id = data["transformation"].id
    headers = {"Authorization": f"Bearer {data['token1']}"}

    resp = client.get(
        f"/api/v1/transformations/{trans_id}/export-all",
        headers=headers,
    )
    assert resp.status_code == 200
    assert "application/zip" in resp.headers["content-type"]
    assert ".zip" in resp.headers["content-disposition"]

    # Inspect zip contents
    zip_buf = io.BytesIO(resp.content)
    with zipfile.ZipFile(zip_buf, "r") as zf:
        namelist = zf.namelist()
        assert "MANIFEST.txt" in namelist
        assert any(n.startswith("markdown/") and n.endswith(".md") for n in namelist)
        assert any(n.startswith("plain_text/") and n.endswith(".txt") for n in namelist)

        manifest_text = zf.read("MANIFEST.txt").decode("utf-8")
        assert "Nordic Grid 2026 Expansion Plan" in manifest_text
        assert "export_u1_" in manifest_text
        assert "[SKIPPED] video_script" in manifest_text  # Failed output properly flagged as skipped


def test_export_empty_or_failed_output(setup_export_test_data):
    """Verify attempting to export an empty or failed output returns 400 Bad Request."""
    data = setup_export_test_data
    trans_id = data["transformation"].id
    failed_id = data["out_failed"].id
    headers = {"Authorization": f"Bearer {data['token1']}"}

    resp = client.get(
        f"/api/v1/transformations/{trans_id}/outputs/{failed_id}/export?format=md",
        headers=headers,
    )
    assert resp.status_code == 400
    assert "Cannot export output with status 'failed'" in resp.json()["detail"]


def test_export_tenant_isolation(setup_export_test_data):
    """Verify unauthorized users cannot export other users' transformations."""
    data = setup_export_test_data
    trans_id = data["transformation"].id
    out_id = data["out_presentation"].id
    user2_headers = {"Authorization": f"Bearer {data['token2']}"}

    # User 2 single output export
    resp1 = client.get(
        f"/api/v1/transformations/{trans_id}/outputs/{out_id}/export?format=md",
        headers=user2_headers,
    )
    assert resp1.status_code == 404

    # User 2 batch export
    resp2 = client.get(
        f"/api/v1/transformations/{trans_id}/export-all",
        headers=user2_headers,
    )
    assert resp2.status_code == 404
