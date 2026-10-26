import sys
import uuid
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User

client = TestClient(app)


def test_auth_workflow():
    db = SessionLocal()
    # Generate unique test email
    unique_suffix = uuid.uuid4().hex[:8]
    test_email = f"testuser_{unique_suffix}@contentflow.ai"
    test_password = "SecurePassword123!"
    test_name = "Alex Mercer"

    try:
        # 1. Test Registration
        register_payload = {
            "email": test_email,
            "password": test_password,
            "full_name": test_name
        }
        reg_response = client.post("/api/v1/auth/register", json=register_payload)
        assert reg_response.status_code == 201, f"Registration failed: {reg_response.text}"
        reg_data = reg_response.json()
        assert "access_token" in reg_data
        assert reg_data["user"]["email"] == test_email.lower()
        assert reg_data["user"]["full_name"] == test_name
        token = reg_data["access_token"]

        # 2. Verify Database Record & Hashed Password (Acceptance Criteria: Passwords never stored plaintext)
        db_user = db.query(User).filter(User.email == test_email.lower()).first()
        assert db_user is not None, "User record not found in Neon database"
        assert db_user.hashed_password != test_password, "Plaintext password stored in database!"
        assert db_user.hashed_password.startswith("$2b$") or db_user.hashed_password.startswith("$2a$"), "Password not bcrypt hashed"

        # 3. Test Duplicate Registration Prevention
        dup_response = client.post("/api/v1/auth/register", json=register_payload)
        assert dup_response.status_code == 400, "Duplicate registration should return 400"
        assert "already exists" in dup_response.json()["detail"].lower()

        # 4. Test Short Password Validation (< 8 characters)
        short_pwd_payload = {
            "email": f"short_{unique_suffix}@contentflow.ai",
            "password": "short",
            "full_name": "Test Short"
        }
        short_resp = client.post("/api/v1/auth/register", json=short_pwd_payload)
        assert short_resp.status_code == 422, "Short password should fail Pydantic validation with 422"

        # 5. Test Successful Login
        login_payload = {
            "email": test_email,
            "password": test_password
        }
        login_response = client.post("/api/v1/auth/login", json=login_payload)
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        login_data = login_response.json()
        assert "access_token" in login_data
        assert login_data["user"]["email"] == test_email.lower()
        login_token = login_data["access_token"]

        # 6. Test Invalid Password Login
        bad_login_payload = {
            "email": test_email,
            "password": "WrongPassword999!"
        }
        bad_login_resp = client.post("/api/v1/auth/login", json=bad_login_payload)
        assert bad_login_resp.status_code == 401, "Invalid password should return 401"
        assert "incorrect" in bad_login_resp.json()["detail"].lower()

        # 7. Test Non-existent Email Login
        fake_login_payload = {
            "email": "nonexistent_user_xyz@contentflow.ai",
            "password": "AnyPassword123!"
        }
        fake_login_resp = client.post("/api/v1/auth/login", json=fake_login_payload)
        assert fake_login_resp.status_code == 401, "Nonexistent user should return 401"

        # 8. Test Protected Endpoint /api/v1/auth/me with valid token
        auth_headers = {"Authorization": f"Bearer {login_token}"}
        me_resp = client.get("/api/v1/auth/me", headers=auth_headers)
        assert me_resp.status_code == 200, f"Protected /me failed: {me_resp.text}"
        me_data = me_resp.json()
        assert me_data["email"] == test_email.lower()
        assert me_data["id"] == db_user.id

        # Also test the /api/auth/me alias
        me_alias_resp = client.get("/api/auth/me", headers=auth_headers)
        assert me_alias_resp.status_code == 200, f"Protected /api/auth/me failed: {me_alias_resp.text}"

        # 9. Test Protected Endpoint without Token (Unauthorized Access)
        unauth_resp = client.get("/api/v1/auth/me")
        assert unauth_resp.status_code == 401, "Missing token should return 401 Unauthorized"

        # 10. Test Protected Endpoint with Malformed/Forged Token
        forged_headers = {"Authorization": "Bearer fake.malformed.token"}
        forged_resp = client.get("/api/v1/auth/me", headers=forged_headers)
        assert forged_resp.status_code == 401, "Forged token should return 401 Unauthorized"

        # 11. Test Logout Endpoint
        logout_resp = client.post("/api/v1/auth/logout", headers=auth_headers)
        assert logout_resp.status_code == 200

        print("All authentication & authorization test assertions passed successfully!")

    finally:
        # Clean up created test user from Neon database
        try:
            cleanup_user = db.query(User).filter(User.email == test_email.lower()).first()
            if cleanup_user:
                db.delete(cleanup_user)
                db.commit()
        except Exception as e:
            print("Cleanup warning:", e)
        finally:
            db.close()


def test_google_oauth_endpoints():
    # 1. Test get google auth url
    res = client.get("/api/v1/auth/google/url")
    assert res.status_code == 200, f"Google URL retrieval failed: {res.text}"
    assert "url" in res.json()
    assert "neonauth" in res.json()["url"] or "accounts.google.com" in res.json()["url"]

    # 2. Test verify-session endpoint
    verify_res = client.post("/api/v1/auth/google/verify-session")
    assert verify_res.status_code in [200, 404]

    # 3. Test callback redirect handling
    cb_res = client.get("/api/v1/auth/google/callback", follow_redirects=False)
    assert cb_res.status_code in [302, 307]
    assert "location" in cb_res.headers


if __name__ == "__main__":
    test_auth_workflow()
    test_google_oauth_endpoints()
