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
    Attempt normal DNS resolution. If local router or cloud container DNS blocks
    or fails to resolve Neon pooled endpoints, query public DNS over HTTPS (DoH)
    or fall back to the known project cluster IP.
    """
    try:
        socket.gethostbyname(hostname)
        return ""  # System DNS is functioning normally
    except Exception:
        pass

    # Local DNS failed; query Google Public DNS over HTTPS
    try:
        import ssl
        ctx = ssl._create_unverified_context()
        req = urllib.request.Request(
            f"https://dns.google/resolve?name={hostname}",
            headers={"User-Agent": "Mozilla/5.0 ContentFlowAI/1.0"}
        )
        with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            for ans in data.get("Answer", []):
                if ans.get("type") == 1:  # Type 1 = IPv4 A record
                    return ans.get("data")
    except Exception:
        pass

    # Fallback to Cloudflare DNS over HTTPS
    try:
        import ssl
        ctx = ssl._create_unverified_context()
        req = urllib.request.Request(
            f"https://cloudflare-dns.com/dns-query?name={hostname}&type=A",
            headers={"Accept": "application/dns-json", "User-Agent": "Mozilla/5.0 ContentFlowAI/1.0"}
        )
        with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            for ans in data.get("Answer", []):
                if ans.get("type") == 1:
                    return ans.get("data")
    except Exception:
        pass

    # Safety net: if this is the project's Neon database cluster, return known working IP
    if "ep-aged-frog-b3927eke" in hostname:
        return "52.76.246.190"

    return ""


def get_engine():
    db_url = settings.DATABASE_URL
    if not db_url:
        raise ValueError("DATABASE_URL is not configured in environment settings.")

    # Guard against placeholder values copied from .env.example
    if any(placeholder in db_url for placeholder in ["YOUR_PASSWORD", "ep-your-pooler", "ep-xxx"]):
        raise ValueError(
            "DATABASE_URL contains placeholder values ('YOUR_PASSWORD', 'ep-your-pooler', or 'ep-xxx'). "
            "Please set your real Neon connection string in the Render Environment Variables tab."
        )

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
