"""
Cat 桌面启动器 - PyInstaller 打包入口
双击运行 → 自动启动后端 + 打开浏览器
"""
import os
import sys
import threading
import time
import webbrowser


def get_app_data_dir():
    """获取应用数据目录（打包模式）"""
    if sys.platform == "win32":
        base = os.getenv("APPDATA", os.path.expanduser("~"))
        return os.path.join(base, "Cat")
    elif sys.platform == "darwin":
        return os.path.expanduser("~/Library/Application Support/Cat")
    else:
        base = os.getenv("XDG_DATA_HOME", os.path.expanduser("~/.local/share"))
        return os.path.join(base, "Cat")


def get_static_dir():
    """获取前端静态文件目录（打包模式）"""
    if getattr(sys, "frozen", False):
        # PyInstaller 打包模式：静态文件在 _internal/static/
        return os.path.join(sys._MEIPASS, "static")
    else:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")


def main():
    # 设置数据目录环境变量（打包模式优先用用户目录）
    if not os.getenv("CAT_DATA_DIR"):
        if getattr(sys, "frozen", False):
            # 打包模式：数据放 %APPDATA%/Cat/
            data_dir = get_app_data_dir()
        else:
            # 开发模式：数据放 backend/data/
            data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
        os.environ["CAT_DATA_DIR"] = data_dir
        os.makedirs(data_dir, exist_ok=True)

    # 设置静态文件目录环境变量
    os.environ["CAT_STATIC_DIR"] = get_static_dir()

    print("=" * 50)
    print("  Cat - 学术文献全流程工具")
    print("=" * 50)
    print(f"  数据目录: {os.environ['CAT_DATA_DIR']}")
    print(f"  静态目录: {os.environ['CAT_STATIC_DIR']}")
    print("-" * 50)

    # 启动后端
    import uvicorn
    from main import app

    port = int(os.getenv("CAT_PORT", "7860"))

    # 开浏览器
    if not os.getenv("CAT_NO_BROWSER"):
        def open_browser():
            time.sleep(2)
            webbrowser.open(f"http://localhost:{port}")
        threading.Thread(target=open_browser, daemon=True).start()

    print(f"  服务启动中... http://localhost:{port}")
    print("  按 Ctrl+C 退出")
    print("=" * 50)

    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")


if __name__ == "__main__":
    main()
