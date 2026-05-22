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

from database import init_db, setup_change_tracking, SessionLocal
from config import settings
from routers import (
    literature, tracking, card, attachment, structured, 
    learning, note, organization, translation, ai_proxy, backup,
    settings as settings_router, note_image, sync_v2
)
from services.hub_manager import get_hub_manager
from services.discovery import start_broadcaster, stop_broadcaster, start_scanner, stop_scanner


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 初始化数据库
    init_db()
    
    # 设置变更追踪
    setup_change_tracking()
    
    # 检测角色并启动相应的网络服务
    db = SessionLocal()
    try:
        manager = get_hub_manager()
        role = manager.detect_role(db)
        
        if role == "hub":
            # Hub启动广播
            start_broadcaster(
                device_id=manager.get_device_id(),
                device_name=manager.get_device_name()
            )
            print(f"[Cat] Started as Hub: {manager.get_device_id()}")
        else:
            # Leaf启动扫描
            start_scanner()
            print(f"[Cat] Started as Leaf: {manager.get_device_id()}")
    finally:
        db.close()
    
    yield
    
    # 关闭时停止网络服务
    stop_broadcaster()
    stop_scanner()
    
    # 关闭其他服务
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

# API routes
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
app.include_router(note_image.router, prefix=settings.API_PREFIX)

# 新的同步v2路由
app.include_router(sync_v2.router, prefix=settings.API_PREFIX)


# Static files configuration
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

# 笔记图片目录 - 支持上传后直接通过 URL 访问
NOTE_IMAGES_DIR = os.path.join(
    os.getenv("CAT_DATA_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"),
    "note_images"
)
os.makedirs(NOTE_IMAGES_DIR, exist_ok=True)
app.mount("/note-images", StaticFiles(directory=NOTE_IMAGES_DIR), name="note-images")


@app.get("/health")
def health():
    return {"status": "healthy"}


# Serve root-level static files (cat.svg, manifest.json, sw.js, icons)
@app.get("/cat.svg")
async def cat_svg():
    path = os.path.join(STATIC_DIR, "cat.svg")
    if os.path.exists(path):
        return FileResponse(path, media_type="image/svg+xml")
    return {"error": "not found"}, 404


@app.get("/manifest.json")
async def manifest():
    path = os.path.join(STATIC_DIR, "manifest.json")
    if os.path.exists(path):
        return FileResponse(path, media_type="application/json")
    return {"error": "not found"}, 404


@app.get("/sw.js")
async def sw():
    path = os.path.join(STATIC_DIR, "sw.js")
    if os.path.exists(path):
        return FileResponse(path, media_type="application/javascript")
    return {"error": "not found"}, 404


@app.get("/icon-192.png")
async def icon_192():
    path = os.path.join(STATIC_DIR, "icon-192.png")
    if os.path.exists(path):
        return FileResponse(path, media_type="image/png")
    return {"error": "not found"}, 404


@app.get("/icon-512.png")
async def icon_512():
    path = os.path.join(STATIC_DIR, "icon-512.png")
    if os.path.exists(path):
        return FileResponse(path, media_type="image/png")
    return {"error": "not found"}, 404


# Mount assets directory at /assets/ (Vite build output)
ASSETS_DIR = os.path.join(STATIC_DIR, "assets")
if os.path.exists(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

# Mount /static/ for any other static resources
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR, html=False), name="static")


# Root route and SPA catch-all - must be LAST route
@app.get("/")
async def root():
    """根路径 - serve index.html"""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "name": "Cat - 学术文献全流程工具 API",
        "version": "2.0.0",
        "docs": "/docs",
        "message": "前端未构建，请运行 build.sh 或 build.bat"
    }


@app.get("/{full_path:path}")
async def spa_catchall(full_path: str):
    """SPA catch-all: serve static file if exists, otherwise index.html"""
    # Check if it's a static file that exists
    file_path = os.path.join(STATIC_DIR, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    # SPA fallback: serve index.html for client-side routing
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "not found"}, 404


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
    uvicorn.run("main:app", host="0.0.0.0", port=7860, reload=False)
