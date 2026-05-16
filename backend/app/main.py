from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.db.database import create_tables
from app.api.routes import auth, projects, tasks, users, admin_tasks

app = FastAPI(
    title="Team Task Manager API",
    description="Full-stack task management with role-based access control",
    version="1.0.0",
)

# CORS — allow frontend on same origin + localhost for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:3000", "http://127.0.0.1:8000"],
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(users.router)
app.include_router(admin_tasks.router)


@app.on_event("startup")
def on_startup():
    create_tables()
    print("Database tables created/verified")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Team Task Manager API is running"}


from pathlib import Path

# Robust path detection
BASE_DIR = Path(__file__).resolve().parent.parent
frontend_path = BASE_DIR / "frontend"
static_path = frontend_path / "static"
templates_path = frontend_path / "templates"
index_path = templates_path / "index.html"

print(f"--- PATH DEBUG ---")
print(f"BASE_DIR: {BASE_DIR}")
print(f"Frontend: {frontend_path}")
print(f"Index: {index_path}")
print(f"Index Exists: {index_path.exists()}")
print(f"------------------")

if static_path.exists():
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # If the path looks like an API call but isn't handled by routers above, return 404
    if full_path.startswith("api"):
        return {"detail": "Not Found"}

    # If the path looks like a static file call but isn't handled by the mount, return 404
    if full_path.startswith("static"):
        return {"detail": "Static file not found"}

    # Serve index.html for all other GET requests (SPA support)
    if index_path.exists():
        return FileResponse(str(index_path))

    return {"detail": "Frontend not found", "debug_path": str(index_path)}
