# -*- mode: python ; coding: utf-8 -*-
"""
Cat - PyInstaller 打包配置
生成单个 Cat.exe，双击即可运行
"""
import os
import sys

block_cipher = None

# 项目根目录
ROOT = os.path.dirname(os.path.abspath(SPEC))

# 后端目录
BACKEND = os.path.join(ROOT, 'backend')

# 前端构建产物
STATIC_DIR = os.path.join(BACKEND, 'static')

# 收集所有后端 Python 文件
def collect_py_datas(base_dir, prefix=''):
    """收集所有 .py 文件作为数据文件（保留目录结构）"""
    datas = []
    for root, dirs, files in os.walk(base_dir):
        # 跳过 __pycache__
        dirs[:] = [d for d in dirs if d != '__pycache__']
        for f in files:
            if f.endswith('.py'):
                full = os.path.join(root, f)
                rel = os.path.relpath(root, os.path.dirname(base_dir))
                datas.append((full, rel))
    return datas

a = Analysis(
    [os.path.join(BACKEND, 'cat_launcher.py')],
    pathex=[BACKEND],
    binaries=[],
    datas=[
        # 前端静态文件
        (STATIC_DIR, 'static'),
        # 后端 Python 模块（保留目录结构）
        (os.path.join(BACKEND, 'models'), 'models'),
        (os.path.join(BACKEND, 'routers'), 'routers'),
        (os.path.join(BACKEND, 'schemas'), 'schemas'),
        (os.path.join(BACKEND, 'services'), 'services'),
        (os.path.join(BACKEND, 'config.py'), '.'),
        (os.path.join(BACKEND, 'database.py'), '.'),
        (os.path.join(BACKEND, 'main.py'), '.'),
    ],
    hiddenimports=[
        # FastAPI + uvicorn
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        # SQLAlchemy
        'sqlalchemy.dialects.sqlite',
        'sqlalchemy.sql.default_comparator',
        # 项目模块
        'models',
        'models.literature',
        'models.tracking',
        'models.card',
        'models.attachment',
        'models.structured',
        'models.learning',
        'models.note',
        'models.organization',
        'models.translation',
        'models.sync',
        'routers',
        'routers.literature',
        'routers.tracking',
        'routers.card',
        'routers.attachment',
        'routers.structured',
        'routers.learning',
        'routers.note',
        'routers.organization',
        'routers.translation',
        'routers.ai_proxy',
        'routers.backup',
        'routers.settings',
        'routers.note_image',
        'routers.sync_v2',
        'routers.pairing',
        'schemas',
        'schemas.literature',
        'schemas.tracking',
        'schemas.card',
        'schemas.attachment',
        'schemas.structured',
        'schemas.learning',
        'schemas.note',
        'schemas.organization',
        'schemas.translation',
        'services',
        'services.crossref_service',
        'services.mineru_service',
        'services.ai_service',
        'services.export_service',
        'services.sync_service',
        'services.sentence_service',
        'services.config_service',
        'services.review_service',
        'services.study_service',
        'services.ollama_service',
        'services.change_tracker',
        'services.sync_engine',
        'services.discovery',
        'services.hub_manager',
        'services.pairing',
        'services.relay_client',
        'services.attachment_sync',
        # 其他依赖
        'httpx',
        'aiofiles',
        'openpyxl',
        'python_multipart',
        'jinja2',
        'pydantic',
        'starlette',
        'starlette.responses',
        'starlette.routing',
        'starlette.middleware',
        'starlette.middleware.cors',
        'starlette.staticfiles',
        'email.mime.multipart',
        'email.mime.text',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'PIL',
        'PyQt5',
        'PyQt6',
        'pytest',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='Cat',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # TODO: 添加 .ico 图标
)
