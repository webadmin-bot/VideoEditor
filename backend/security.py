import os
import re
import secrets
from pathlib import Path
from typing import List, Optional
try:
    from fastapi import Request, HTTPException, Security
    from fastapi.security import APIKeyHeader
except ImportError:
    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            self.status_code = status_code
            self.detail = detail
            super().__init__(f"HTTP {status_code}: {detail}")
    Request = object  # type: ignore
    Security = lambda x: None  # type: ignore
    def APIKeyHeader(**kwargs):  # type: ignore
        return None

from .config import STORAGE_DIR, UPLOADS_DIR, RENDERS_DIR, TEMP_DIR, PROJECTS_DIR

# 4 GB max video upload size
MAX_UPLOAD_SIZE = 4 * 1024 * 1024 * 1024 

TOKEN_FILE = STORAGE_DIR / ".session_token"

def get_or_create_session_token() -> str:
    """Retrieves existing studio session token or generates a secure random 64-char token."""
    if TOKEN_FILE.exists():
        try:
            token = TOKEN_FILE.read_text(encoding="utf-8").strip()
            if len(token) >= 32:
                return token
        except Exception:
            pass

    token = os.getenv("STUDIO_SESSION_TOKEN", secrets.token_hex(32))
    try:
        TOKEN_FILE.write_text(token, encoding="utf-8")
    except Exception:
        pass
    return token

STUDIO_SESSION_TOKEN = get_or_create_session_token()
api_key_header = APIKeyHeader(name="X-Studio-Token", auto_error=False)

def verify_session_token(request: Request, token: Optional[str] = Security(api_key_header)):
    """
    Validates request session token or local loopback client.
    Protects against unauthorized cross-site requests or remote unauthorized calls.
    """
    # Accept token if passed in header or query parameter
    query_token = request.query_params.get("token")
    client_token = token or query_token
    
    if client_token and secrets.compare_digest(client_token, STUDIO_SESSION_TOKEN):
        return True

    # If header not passed, allow local loopback origins (http://127.0.0.1 or http://localhost)
    client_host = getattr(request.client, "host", "")
    origin = request.headers.get("origin", "")
    
    is_loopback = client_host in ["127.0.0.1", "::1", "localhost", "testclient"]
    is_valid_origin = any(origin.startswith(prefix) for prefix in ["http://localhost:", "http://127.0.0.1:"]) or not origin

    if is_loopback and is_valid_origin:
        return True

    raise HTTPException(
        status_code=401,
        detail="Invalid or missing X-Studio-Token session token."
    )

def sanitize_filename(filename: str) -> str:
    """
    Sanitizes filename removing directory traversal symbols (..), 
    path separators, null bytes, and illegal shell characters across all OS platforms.
    """
    clean_name = filename.replace("\\", "/")
    clean_name = os.path.basename(clean_name)
    clean_name = re.sub(r'[\x00-\x1f\\/\:\*\?"<>\|]', '_', clean_name)
    clean_name = clean_name.replace("..", "_").strip()
    if not clean_name:
        clean_name = f"video_{secrets.token_hex(4)}"
    return clean_name


ALLOWED_STORAGE_DIRS = [
    STORAGE_DIR.resolve(),
    UPLOADS_DIR.resolve(),
    RENDERS_DIR.resolve(),
    TEMP_DIR.resolve(),
    PROJECTS_DIR.resolve()
]

def validate_safe_path(path_str: str, allowed_dirs: Optional[List[Path]] = None) -> Path:
    """
    Strictly validates that the supplied path resolves to an allowed storage directory.
    Guarantees no arbitrary filesystem reads (e.g. /etc/passwd or C:\\Windows).
    """
    if not path_str or not isinstance(path_str, str):
        raise HTTPException(status_code=400, detail="Invalid file path parameter.")

    try:
        resolved = Path(path_str).resolve()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Malformed path: {e}")

    targets = allowed_dirs or ALLOWED_STORAGE_DIRS
    is_safe = False
    for allowed_dir in targets:
        try:
            resolved.relative_to(allowed_dir)
            is_safe = True
            break
        except ValueError:
            continue

    if not is_safe:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: Requested path is outside authorized local studio storage."
        )

    return resolved
