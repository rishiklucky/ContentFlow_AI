import ipaddress
import socket
import urllib.parse
from typing import Tuple, Dict, Any
import httpx
from bs4 import BeautifulSoup


MAX_URL_CONTENT_SIZE = 5 * 1024 * 1024  # 5 MB
REQUEST_TIMEOUT_SECONDS = 10.0
MAX_REDIRECTS = 3

USER_AGENT = "ContentFlowAI-ArticleFetcher/1.0 (+https://contentflow.ai)"


def is_ip_allowed(ip_str: str) -> bool:
    """
    Check if the resolved IP address is a safe, publicly routable address.
    Strictly forbids private, loopback, link-local, multicast, and cloud metadata addresses.
    """
    try:
        ip = ipaddress.ip_address(ip_str)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return False
        
        # Specific cloud metadata checks
        if ip_str in ["169.254.169.254", "fd00:ec2::254"]:
            return False

        return True
    except ValueError:
        return False


def validate_and_resolve_url(target_url: str) -> str:
    """
    Validates URL scheme, resolves hostname to IP, and checks for SSRF risks.
    Returns normalized URL if safe, raises ValueError if unsafe.
    """
    parsed = urllib.parse.urlparse(target_url.strip())
    if parsed.scheme.lower() not in ["http", "https"]:
        raise ValueError("Invalid URL scheme. Only HTTP and HTTPS URLs are permitted.")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL must include a valid hostname.")

    # Check for direct localhost aliases
    lower_host = hostname.lower()
    if lower_host in ["localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"]:
        raise ValueError("Access to internal or local addresses is prohibited.")

    # Resolve hostname to all associated IP addresses
    port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
    try:
        addr_info = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise ValueError(f"Could not resolve hostname '{hostname}': {str(e)}")

    for entry in addr_info:
        sockaddr = entry[4]
        ip_str = sockaddr[0]
        if not is_ip_allowed(ip_str):
            raise ValueError(
                f"URL resolves to a restricted or private network address ({ip_str}). Access denied."
            )

    return target_url.strip()


def fetch_url_article(target_url: str) -> Tuple[str, str, Dict[str, Any]]:
    """
    Safely fetches a web article with SSRF protection and non-redirect loops.
    Extracts article title, clean readable text, and metadata.
    Returns: (title, extracted_text, metadata_dict)
    """
    current_url = validate_and_resolve_url(target_url)

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    client = httpx.Client(timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=False)
    redirects_followed = 0

    try:
        while True:
            response = client.get(current_url, headers=headers)
            
            # Check for redirect responses
            if response.status_code in [301, 302, 303, 307, 308]:
                redirects_followed += 1
                if redirects_followed > MAX_REDIRECTS:
                    raise ValueError(f"Exceeded maximum redirect limit ({MAX_REDIRECTS}).")
                
                location = response.headers.get("Location")
                if not location:
                    raise ValueError("Received redirect status with no Location header.")
                
                # Resolve relative redirects
                next_url = urllib.parse.urljoin(current_url, location)
                # Re-validate the redirect target against SSRF!
                current_url = validate_and_resolve_url(next_url)
                continue

            if response.status_code != 200:
                raise ValueError(f"Target web server returned status {response.status_code}.")

            content_type = response.headers.get("Content-Type", "").lower()
            if "html" not in content_type and "text" not in content_type:
                raise ValueError(f"Unsupported content type '{content_type}'. Expected HTML or text web page.")

            # Check response body size
            raw_bytes = response.content
            if len(raw_bytes) > MAX_URL_CONTENT_SIZE:
                raise ValueError("Web page exceeds maximum permitted size of 5MB.")

            break

    except httpx.RequestError as e:
        raise ValueError(f"Network request to URL failed: {str(e)}")
    finally:
        client.close()

    # Parse HTML using BeautifulSoup
    soup = BeautifulSoup(raw_bytes, "html.parser")

    # Remove non-content elements
    for element in soup(["script", "style", "nav", "footer", "header", "aside", "form", "noscript", "svg", "button"]):
        element.extract()

    # Extract title
    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    elif soup.h1:
        title = soup.h1.get_text().strip()
    if not title:
        title = urllib.parse.urlparse(target_url).hostname or "Web Article"

    # Extract article text paragraphs
    paragraphs = []
    for p in soup.find_all(["p", "h1", "h2", "h3", "h4", "h5", "li"]):
        text = p.get_text().strip()
        if len(text) > 20:  # Ignore tiny navigation crumbs
            paragraphs.append(text)

    if not paragraphs:
        # Fallback to general body text
        body_text = soup.get_text(separator="\n\n").strip()
        paragraphs = [p.strip() for p in body_text.split("\n\n") if len(p.strip()) > 20]

    extracted_text = "\n\n".join(paragraphs).strip()
    if not extracted_text or len(extracted_text) < 50:
        raise ValueError("Could not extract meaningful article text from the provided URL.")

    metadata = {
        "source_url": target_url,
        "final_url": current_url,
        "content_length_bytes": len(raw_bytes),
        "extracted_paragraphs": len(paragraphs),
    }

    return title, extracted_text, metadata
