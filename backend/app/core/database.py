import json
import socket
import urllib.parse
import urllib.request
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings


def _resolve_host_fallback(hostname: str) -> str:
    """
    Attempt normal DNS resolution. If local router DNS blocks or fails,
    query public DNS over HTTPS to find the real IP address.
    """
    try:
        socket.gethostbyname(hostname)
        return ""  # System DNS is functioning normally
    except Exception:
        # Local DNS failed; query Google Public DNS over HTTPS
        try:
            url = f"https://dns.google/resolve?name={hostname}"
            req = urllib.request.urlopen(url, timeout=3)
            data = json.loads(req.read().decode())
            for ans in data.get("Answer", []):
                if ans.get("type") == 1:  # Type 1 = IPv4 A record
                    return ans.get("data")
        except Exception:
            pass
    return ""


def get_engine():
    db_url = settings.DATABASE_URL
    if not db_url:
        raise ValueError("DATABASE_URL is not configured in environment settings.")

    # Normalize legacy postgres:// scheme to postgresql:// if needed
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    # Parse connection string to inspect host
    parsed = urllib.parse.urlparse(db_url)
    hostname = parsed.hostname

    # If already has hostaddr in query, keep it; otherwise check if DNS resolution is needed
    query_params = urllib.parse.parse_qs(parsed.query)
    if "hostaddr" not in query_params and hostname:
        fallback_ip = _resolve_host_fallback(hostname)
        if fallback_ip:
            sep = "&" if parsed.query else "?"
            db_url = f"{db_url}{sep}hostaddr={fallback_ip}"

    # Create SQLAlchemy engine with pre-ping connection check and recycling
    return create_engine(
        db_url,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=5,
        max_overflow=10,
    )


engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator:
    """
    FastAPI dependency yielding an isolated database session per request,
    ensuring connections are closed cleanly.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
