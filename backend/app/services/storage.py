import os
import re
import uuid
import hashlib
from typing import Optional, Tuple
from pathlib import Path

# Max file size limit: 20 MB
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

UPLOAD_BASE_DIR = Path(
    os.getenv("UPLOAD_DIR", Path(__file__).resolve().parent.parent.parent / "uploads")
)


def get_safe_filename(original_filename: str) -> str:
    """
    Sanitize the filename to prevent path traversal or unsafe characters.
    Prepends a UUID to prevent collisions.
    """
    base_name = os.path.basename(original_filename)
    # Strip any non-alphanumeric, dot, dash, or underscore characters
    clean_name = re.sub(r"[^\w\.-]", "_", base_name)
    if not clean_name or clean_name.startswith("."):
        clean_name = f"document_{clean_name}"
    
    unique_prefix = uuid.uuid4().hex[:12]
    return f"{unique_prefix}_{clean_name}"


class LocalStorageService:
    """
    Provider-neutral storage layer for saving and managing source documents locally.
    Designed for seamless swapping to S3 or cloud object storage in production.
    """

    def __init__(self, base_dir: Path = UPLOAD_BASE_DIR):
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save_file(self, user_id: str, original_filename: str, file_bytes: bytes) -> Tuple[str, str, int]:
        """
        Saves file bytes to isolated user directory.
        Returns: (relative_storage_path, sha256_hash, file_size_bytes)
        """
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise ValueError(f"File size exceeds maximum permitted limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.")

        # Compute SHA-256 hash
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()

        # Isolate storage per user
        user_dir = self.base_dir / user_id
        user_dir.mkdir(parents=True, exist_ok=True)

        safe_filename = get_safe_filename(original_filename)
        destination_path = user_dir / safe_filename

        with open(destination_path, "wb") as f:
            f.write(file_bytes)

        # Store path relative to base directory for portability
        relative_path = f"{user_id}/{safe_filename}"
        return relative_path, sha256_hash, len(file_bytes)

    def delete_file(self, relative_path: str) -> bool:
        """
        Deletes the file on disk if it exists.
        """
        if not relative_path:
            return False
        
        target_file = self.base_dir / relative_path
        try:
            # Ensure path does not escape base directory
            resolved = target_file.resolve()
            if self.base_dir.resolve() in resolved.parents and resolved.is_file():
                resolved.unlink()
                return True
        except Exception:
            pass
        return False

    def get_file(self, relative_path: str) -> Optional[bytes]:
        """
        Reads file content from disk.
        """
        if not relative_path:
            return None
        target_file = self.base_dir / relative_path
        try:
            resolved = target_file.resolve()
            if self.base_dir.resolve() in resolved.parents and resolved.is_file():
                return resolved.read_bytes()
        except Exception:
            pass
        return None


# Global singleton instance
storage_service = LocalStorageService()
