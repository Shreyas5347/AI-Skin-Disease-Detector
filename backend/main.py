"""
main.py — FastAPI app entry point
==================================
Run command:  uvicorn main:app --reload
API docs:     http://localhost:8000/docs
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.predict import router as predict_router

# ── Load .env locally (ignored in production — Render sets env vars directly)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed in production — that's fine

app = FastAPI(
    title="Skin Disease Detection API",
    description="AI-powered skin disease detection using transfer learning",
    version="1.0.0"
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Set ALLOWED_ORIGINS in Render's environment variables as a comma-separated list.
# Example: https://your-app.vercel.app,https://your-custom-domain.com
# Falls back to localhost:3000 for local development.
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000"
)
ALLOWED_ORIGINS: list[str] = [
    o.strip() for o in _raw_origins.split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the /api/predict route
app.include_router(predict_router, prefix="/api")


@app.get("/")
def root():
    return {
        "status": "running",
        "message": "Skin Disease Detection API is live",
        "docs": "/docs",
        "predict_endpoint": "/api/predict"
    }


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

