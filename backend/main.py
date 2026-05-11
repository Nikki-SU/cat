"""
Cat - 学术文献全流程工具 后端服务
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
    # 启动时初始化数据库
    init_db()
    yield
    # 关闭时的清理工作
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

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
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
def root():
    """API根路径"""
    return {
        "name": "Cat - 学术文献全流程工具 API",
        "version": "2.0.0",
        "docs": "/docs"
    }

@app.get("/health")
def health():
    """健康检查"""
    return {"status": "healthy"}
