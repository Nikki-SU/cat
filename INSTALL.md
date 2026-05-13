# Cat 学术文献全流程工具 - 安装指南

## Windows
1. 下载解压到 `C:\Cat`
2. 双击 `build.bat` 构建
3. 双击 `start.bat` 启动
4. 访问 http://localhost:8000

## Linux/macOS
1. 确保安装 Python 3.8+ 和 Node.js 16+
2. `./build.sh && ./start.sh`

## Termux
```bash
./start_termux.sh
```

## 常见问题
- 端口占用：修改 `backend/main.py` 端口
- 构建失败：确保 Node.js 已安装

技术支持: https://github.com/Nikki-SU/cat/issues
