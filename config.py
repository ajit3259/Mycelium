import os
from pathlib import Path

LM_STUDIO_URL = os.getenv("LM_STUDIO_URL", "http://localhost:1234/v1")
# Set to a specific model ID or leave empty to auto-pick the first loaded model
LM_MODEL = os.getenv("LM_MODEL", "google/gemma-4-e4b")
SCREENSHOTS_DIR = os.getenv("SCREENSHOTS_DIR", str(Path.home() / "Desktop"))
DB_PATH = Path(os.getenv("DB_PATH", "mind.db"))
UPLOADS_DIR = Path("uploads")
