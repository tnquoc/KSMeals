"""Settings from .env. The LLM provider is swappable: any OpenAI-compatible endpoint works."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

GEMINI_OPENAI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

LLM_BASE_URL = os.getenv("LLM_BASE_URL", GEMINI_OPENAI_URL)
LLM_API_KEY = os.getenv("LLM_API_KEY") or os.getenv("GEMINI_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-3.5-flash-lite")
# Seconds between LLM calls; the free tier allows only a few requests per minute.
LLM_MIN_INTERVAL = float(os.getenv("LLM_MIN_INTERVAL", "12"))

# Accept both https://<ref>.supabase.co and the .../rest/v1/ form shown in the dashboard.
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/").removesuffix("/rest/v1")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")

DATA_DIR = ROOT / "data"
IMAGE_DIR = DATA_DIR / "images"
