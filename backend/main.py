"""
Cat - 学术文献全流程工具 后端服务
"""
import os
import sys
import webbrowser
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from database import init_db
from config import settings
from routers import (
    literature, tracking, card, attachment, structured, 
    learning, note, organization, translation, ai_proxy, backup,
    settings as settings_router
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    init_db()
    yield
    from services import close_crossref_service, close_mineru_service, close_ai_service
    await close_crossref_service()
    await close_mineru_service()
    await close_ai_service()


app = FastAPI(
    title="Cat - 学术文献全流程工具 API",
    description="追踪 → 入库 → 阅读 → 笔记 → 学习，全流程学术文献管理",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(literature.router, prefix=settings.API_PREFIX)
app.include_router(tracking.router, prefix=settings.API_PREFIX)
app.include_router(card.router, prefix=settings.API_PREFIX)
app.include_router(attachment.router, prefix=settings.API_PREFIX)
app.include_router(structured.router, prefix=settings.API_PREFIX)
app.include_router(learning.router, prefix=settings.API_PREFIX)
app.include_router(note.router, prefix=settings.API_PREFIX)
app.include_router(organization.router, prefix=settings.API_PREFIX)
app.include_router(translation.router, prefix=settings.API_PREFIX)
app.include_router(ai_proxy.router, prefix=settings.API_PREFIX)
app.include_router(backup.router, prefix=settings.API_PREFIX)
app.include_router(backup.sync_router, prefix=settings.API_PREFIX)
app.include_router(settings_router.router, prefix=settings.API_PREFIX)


@app.get("/")
async def root():
    """根路径"""
    # Android/Chaquopy: static files are in the same directory as main.py
    # Desktop: static files are in backend/static
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "name": "Cat - 学术文献全流程工具 API",
        "version": "2.0.0",
        "docs": "/docs",
        "message": "前端未构建，请运行 build.sh 或 build.bat"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


# Mount static files - support both desktop and Android
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR, html=False), name="static")


def startup_with_browser():
    """Open browser on desktop (disabled on Android)"""
    # Skip browser opening on Android
    if os.getenv("CAT_NO_BROWSER"):
        return
    import threading
    def open_browser():
        import time
        time.sleep(1.5)
        webbrowser.open("http://localhost:8000")
    threading.Thread(target=open_browser, daemon=True).start()


if __name__ == "__main__":
    if "--no-browser" not in sys.argv:
        startup_with_browser()
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
