import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from core.database import init_db
from routers import auth, chat, graph, quiz
from eda.routes import router as eda_router

app = FastAPI(title="DocChat AI API")

# ---------- STATIC FILES ----------
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/view-pdf", StaticFiles(directory=UPLOAD_DIR), name="static_pdfs")

# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- GLOBAL STATE ----------
app.state.chat_data = {}

# ---------- DATABASE INIT ----------
@app.on_event("startup")
async def startup_event():
    await init_db()

@app.on_event("shutdown")
async def shutdown_event():
    from services.rag_service import close_http_client
    await close_http_client()

# ---------- HEALTH ----------
@app.get("/")
async def home():
    from core.database import db
    mongo_status = "error"
    try:
        await db.command("ping")
        mongo_status = "connected"
    except Exception:
        pass

    return {
        "status":       "running",
        "database":     mongo_status,
        "groq_key_set": bool(os.getenv("GROQ_API_KEY")),
        "mongo_set":    bool(os.getenv("MONGO_URL")),
        "models": {
            "default": "llama-3.3-70b-versatile",
            "fast": "llama-3.1-8b-instant"
        }
    }

# ---------- ROUTERS ----------
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(graph.router)
app.include_router(quiz.router)
app.include_router(eda_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
