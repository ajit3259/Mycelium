import os
from pathlib import Path

# Persistent storage on HF Spaces is mounted at /data; fall back to cwd locally
_data_dir = Path("/data") if Path("/data").exists() else Path(".")

DB_PATH = Path(os.getenv("DB_PATH", str(_data_dir / "mind.db")))
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", str(_data_dir / "uploads")))

SCREENSHOTS_DIR = os.getenv("SCREENSHOTS_DIR", str(Path.home() / "Desktop"))

# PATH A — LM Studio (local dev). Auto-disabled on HF Spaces (SPACE_ID is set there).
_default_lm_url = "" if os.getenv("SPACE_ID") else "http://localhost:1234/v1"
LM_STUDIO_URL = os.getenv("LM_STUDIO_URL", _default_lm_url)
LM_MODEL = os.getenv("LM_MODEL", "")

# PATH B — HF Transformers (used when LM_STUDIO_URL is not set)
HF_MODEL = os.getenv("HF_MODEL", "nvidia/Nemotron-Mini-4B-Instruct")
HF_VL_MODEL = os.getenv("HF_VL_MODEL", "Qwen/Qwen2.5-VL-7B-Instruct")
EMBED_MODEL = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
