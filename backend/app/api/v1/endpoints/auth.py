from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse, MessageResponse, SocialAuthRequest

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user account with hashed password and return access token.
    """
    # Normalize email to lowercase
    normalized_email = user_in.email.strip().lower()

    # Check for duplicate user
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    # Hash the password
    hashed_pwd = get_password_hash(user_in.password)

    # Create new user record
    new_user = User(
        email=normalized_email,
        full_name=user_in.full_name.strip() if user_in.full_name else None,
        hashed_password=hashed_pwd,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate token
    token = create_access_token(subject=new_user.id)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.from_orm(new_user)
    )


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user with email and password, returning JWT access token.
    """
    normalized_email = login_data.email.strip().lower()

    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated."
        )

    token = create_access_token(subject=user.id)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.from_orm(user)
    )


@router.post("/logout", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def logout(current_user: User = Depends(get_current_user)):
    """
    Logout session. Tokens are stateless; client clears local storage/cookies.
    """
    return MessageResponse(message="Successfully logged out.")


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """
    Return currently authenticated user profile. Protected endpoint.
    """
    return current_user


@router.post("/social-login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def social_login(social_in: SocialAuthRequest, db: Session = Depends(get_db)):
    """
    Authenticate or create a user via Google OAuth.
    """
    import secrets
    normalized_email = social_in.email.strip().lower()

    user = db.query(User).filter(User.email == normalized_email).first()

    if not user:
        # Create user account linked to Google OAuth
        random_pwd = secrets.token_urlsafe(32)
        hashed_pwd = get_password_hash(random_pwd)
        user = User(
            email=normalized_email,
            full_name=social_in.full_name.strip() if social_in.full_name else None,
            hashed_password=hashed_pwd,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # If user exists and missing full_name, update it
        if not user.full_name and social_in.full_name:
            user.full_name = social_in.full_name.strip()
            db.commit()
            db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated."
        )

    token = create_access_token(subject=user.id)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.from_orm(user)
    )


def _get_server_origin(request: Request) -> str:
    """
    Extract the server origin dynamically from incoming request headers,
    correctly respecting reverse proxies (Render, Cloudflare, etc.).
    """
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or "localhost:8000"
    if host == "testserver" or not host:
        return "http://localhost:8000"
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "http"
    return f"{proto}://{host}".rstrip("/")


@router.get("/google/url")
def get_neon_google_auth_url(
    request: Request,
    frontend_origin: Optional[str] = None,
    callback_url: Optional[str] = None
):
    """
    Obtains the Google OAuth initiation URL.
    Uses Direct Google OAuth 2.0 (accounts.google.com) if GOOGLE_CLIENT_ID is set,
    with automatic Neon Auth fallback if credentials are not yet configured.
    """
    import urllib.parse
    import secrets
    import json

    server_origin = _get_server_origin(request)

    # Determine target frontend base for post-auth redirect
    if frontend_origin:
        target_frontend = frontend_origin.rstrip("/")
    elif "localhost" in server_origin or "127.0.0.1" in server_origin:
        target_frontend = "http://localhost:5173"
    else:
        target_frontend = server_origin

    backend_callback = f"{server_origin}/api/v1/auth/google/callback"

    # 1. Direct Google OAuth 2.0 (Zero Intermediaries, 100% Reliable)
    if settings.GOOGLE_CLIENT_ID:
        state_payload = json.dumps({"target_origin": target_frontend, "csrf": secrets.token_hex(16)})
        encoded_state = urllib.parse.quote(state_payload)
        google_params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": backend_callback,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account",
            "state": encoded_state,
        }
        google_auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(google_params)}"
        return {"url": google_auth_url}

    # 2. Fallback to Neon Auth if GOOGLE_CLIENT_ID is not yet configured
    import socket
    import ssl
    from app.core.database import _resolve_host_fallback

    target_encoded = urllib.parse.quote(target_frontend, safe="")
    neon_callback = f"{backend_callback}?target_origin={target_encoded}"

    neon_host = "ep-aged-frog-b3927eke.neonauth.c-4.ap-southeast-1.aws.neon.tech"
    ip = _resolve_host_fallback(neon_host) or "47.130.56.154"

    try:
        ctx = ssl.create_default_context()
        s = ctx.wrap_socket(socket.socket(), server_hostname=neon_host)
        s.connect((ip, 443))

        payload = json.dumps({"provider": "google", "callbackURL": neon_callback}).encode("utf-8")
        req = (
            f"POST /neondb/auth/sign-in/social HTTP/1.1\r\n"
            f"Host: {neon_host}\r\n"
            f"Content-Type: application/json\r\n"
            f"Content-Length: {len(payload)}\r\n"
            f"User-Agent: ContentFlowAI/1.0\r\n"
            f"Connection: close\r\n\r\n"
        ).encode("utf-8") + payload

        s.sendall(req)
        response = s.recv(4096).decode("utf-8", errors="ignore")
        s.close()

        body = response[response.find("{"):]
        data = json.loads(body)

        if "url" in data:
            return {"url": data["url"]}

        err_msg = data.get("error") or data.get("message") or "Unknown error from Neon Auth"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not connect to Neon Auth server: {str(e)}"
        )


@router.get("/google/callback")
async def google_oauth_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    target_origin: Optional[str] = None,
    neon_auth_session_verifier: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Handles Google OAuth redirect for both Direct Google OAuth (via authorization code)
    and Neon Auth (fallback).
    Creates or updates the user, issues a JWT token, and redirects to frontend /auth/callback.
    """
    import secrets
    import urllib.parse
    import json

    server_origin = _get_server_origin(request)
    frontend_base = server_origin

    # Decode target_origin from state parameter if present
    if state:
        try:
            state_unquoted = urllib.parse.unquote(state)
            state_json = json.loads(state_unquoted)
            if isinstance(state_json, dict) and state_json.get("target_origin"):
                frontend_base = state_json["target_origin"].rstrip("/")
        except Exception:
            pass

    if target_origin and frontend_base == server_origin:
        frontend_base = urllib.parse.unquote(target_origin).rstrip("/")
    elif ("localhost" in server_origin or "127.0.0.1" in server_origin) and frontend_base == server_origin:
        frontend_base = "http://localhost:5173"

    if error:
        return RedirectResponse(
            url=f"{frontend_base}/login?error={urllib.parse.quote(error)}",
            status_code=status.HTTP_302_FOUND
        )

    # PATH A: Direct Google OAuth 2.0 (Authorization Code exchange)
    if code and settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
        try:
            import httpx
            backend_callback = f"{server_origin}/api/v1/auth/google/callback"

            async with httpx.AsyncClient(timeout=10.0) as client:
                token_resp = await client.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "code": code,
                        "client_id": settings.GOOGLE_CLIENT_ID,
                        "client_secret": settings.GOOGLE_CLIENT_SECRET,
                        "redirect_uri": backend_callback,
                        "grant_type": "authorization_code",
                    },
                    headers={"Accept": "application/json"}
                )

                if token_resp.status_code != 200:
                    err_text = token_resp.text
                    return RedirectResponse(
                        url=f"{frontend_base}/login?error={urllib.parse.quote('Google token exchange failed: ' + err_text)}",
                        status_code=status.HTTP_302_FOUND
                    )

                tokens = token_resp.json()
                access_token = tokens.get("access_token")

                userinfo_resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"}
                )

                if userinfo_resp.status_code != 200:
                    return RedirectResponse(
                        url=f"{frontend_base}/login?error=Failed+to+retrieve+Google+profile",
                        status_code=status.HTTP_302_FOUND
                    )

                profile = userinfo_resp.json()
                email = profile.get("email")
                full_name = profile.get("name")

                if not email:
                    return RedirectResponse(
                        url=f"{frontend_base}/login?error=Google+account+email+not+provided",
                        status_code=status.HTTP_302_FOUND
                    )

                normalized_email = email.strip().lower()
                user = db.query(User).filter(User.email == normalized_email).first()

                if not user:
                    random_pwd = secrets.token_urlsafe(32)
                    hashed_pwd = get_password_hash(random_pwd)
                    user = User(
                        email=normalized_email,
                        full_name=full_name,
                        hashed_password=hashed_pwd,
                        is_active=True,
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                else:
                    if not user.full_name and full_name:
                        user.full_name = full_name
                        db.commit()
                        db.refresh(user)

                if not user.is_active:
                    return RedirectResponse(
                        url=f"{frontend_base}/login?error=account_deactivated",
                        status_code=status.HTTP_302_FOUND
                    )

                token = create_access_token(subject=user.id)
                return RedirectResponse(
                    url=f"{frontend_base}/auth/callback?token={token}",
                    status_code=status.HTTP_302_FOUND
                )

        except Exception as e:
            err_msg = urllib.parse.quote(str(e))
            return RedirectResponse(
                url=f"{frontend_base}/login?error={err_msg}",
                status_code=status.HTTP_302_FOUND
            )

    # PATH B: Neon Auth fallback (session query)
    try:
        sql = text("""
            SELECT 
                s.id as session_id,
                s."userId" as user_id,
                s."createdAt" as session_created_at,
                u.email,
                u.name,
                u.image
            FROM neon_auth.session s
            JOIN neon_auth.user u ON s."userId" = u.id
            WHERE s."expiresAt" > NOW()
            ORDER BY s."createdAt" DESC
            LIMIT 1
        """)
        session_row = db.execute(sql).fetchone()

        if not session_row:
            return RedirectResponse(url=f"{frontend_base}/login?error=no_active_session", status_code=status.HTTP_302_FOUND)

        normalized_email = session_row.email.strip().lower()
        full_name = session_row.name.strip() if session_row.name else None

        user = db.query(User).filter(User.email == normalized_email).first()
        if not user:
            random_pwd = secrets.token_urlsafe(32)
            hashed_pwd = get_password_hash(random_pwd)
            user = User(
                email=normalized_email,
                full_name=full_name,
                hashed_password=hashed_pwd,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            if not user.full_name and full_name:
                user.full_name = full_name
                db.commit()
                db.refresh(user)

        if not user.is_active:
            return RedirectResponse(url=f"{frontend_base}/login?error=account_deactivated", status_code=status.HTTP_302_FOUND)

        token = create_access_token(subject=user.id)
        return RedirectResponse(url=f"{frontend_base}/auth/callback?token={token}", status_code=status.HTTP_302_FOUND)

    except Exception as e:
        err_msg = urllib.parse.quote(str(e))
        return RedirectResponse(url=f"{frontend_base}/login?error={err_msg}", status_code=status.HTTP_302_FOUND)


@router.post("/google/verify-session", response_model=TokenResponse)
def verify_neon_session(db: Session = Depends(get_db)):
    """
    Direct session verification endpoint called from frontend AuthCallbackPage
    as a secondary fallback if query parameter token is not present.
    """
    import secrets

    sql = text("""
        SELECT 
            s.id as session_id,
            s."userId" as user_id,
            s."createdAt" as session_created_at,
            u.email,
            u.name,
            u.image
        FROM neon_auth.session s
        JOIN neon_auth.user u ON s."userId" = u.id
        WHERE s."expiresAt" > NOW()
        ORDER BY s."createdAt" DESC
        LIMIT 1
    """)
    session_row = db.execute(sql).fetchone()

    if not session_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active Google authentication session found in Neon Auth."
        )

    normalized_email = session_row.email.strip().lower()
    full_name = session_row.name.strip() if session_row.name else None

    user = db.query(User).filter(User.email == normalized_email).first()
    if not user:
        random_pwd = secrets.token_urlsafe(32)
        hashed_pwd = get_password_hash(random_pwd)
        user = User(
            email=normalized_email,
            full_name=full_name,
            hashed_password=hashed_pwd,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if not user.full_name and full_name:
            user.full_name = full_name
            db.commit()
            db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated."
        )

    token = create_access_token(subject=user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.from_orm(user)
    )


@router.get("/google")
def redirect_to_google(request: Request, frontend_origin: Optional[str] = None):
    """
    Directly redirects the user's browser to the Google OAuth consent screen via Neon Auth.
    """
    result = get_neon_google_auth_url(request=request, frontend_origin=frontend_origin)
    return RedirectResponse(url=result["url"])
