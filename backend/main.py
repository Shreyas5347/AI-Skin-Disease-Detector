"""
main.py — FastAPI app entry point
==================================
Run command:  uvicorn main:app --reload
API docs:     http://localhost:8000/docs
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.predict import router as predict_router

app = FastAPI(
    title="Skin Disease Detection API",
    description="AI-powered skin disease detection using transfer learning",
    version="1.0.0"
)

# Allow the React frontend (port 3000) to call this backend (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",           # local React dev server
        "https://*.vercel.app",            # deployed frontend (update after deploy)
    ],
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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

