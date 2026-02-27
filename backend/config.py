import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent


class Config:
    # 🔑 OpenAI
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

    # 🔄 Eski kod uyumluluğu
    EMERGENT_LLM_KEY = OPENAI_API_KEY

    # 🌐 API
    API_PREFIX = "/api"

    # 🌍 CORS (string, çünkü split ediliyor)
    CORS_ORIGINS = "*"

    # 📦 Storage
    STORAGE_FILE = BASE_DIR / "storage" / "data.json"
    UPLOAD_FOLDER = BASE_DIR / "storage" / "uploads"
    MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB


config = Config()
