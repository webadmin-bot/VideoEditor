import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
RENDERS_DIR = STORAGE_DIR / "renders"
TEMP_DIR = STORAGE_DIR / "temp"
PROJECTS_DIR = STORAGE_DIR / "projects"

for d in [STORAGE_DIR, UPLOADS_DIR, RENDERS_DIR, TEMP_DIR, PROJECTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

BACKEND_HOST = os.getenv("BACKEND_HOST", "127.0.0.1")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
