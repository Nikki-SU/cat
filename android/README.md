# Cat Android APK

将 Cat 学术文献管理工具打包为 Android APK，无需 Termux，无需命令，一键安装即用。

## 功能特点

- 📱 独立 APK，用户下载安装即可使用
- 🚀 内嵌 Python 环境（Chaquopy）
- 🌐 内置 WebView，直接访问本地服务
- 💾 数据存储在 App 私有目录
- 🔒 支持 Android 权限管理

## 系统要求

- Android 7.0 (API 24) 或更高版本
- Android Studio Hedgehog (2023.1.1) 或更高版本
- JDK 17
- Node.js 18+ (仅构建时需要)
- Android SDK 34

## 构建步骤

### 方式一：使用构建脚本（推荐）

#### Linux / macOS

```bash
cd cat/android
chmod +x build_apk.sh
./build_apk.sh
```

#### Windows

```cmd
cd cat\android
build_apk.bat
```

### 方式二：手动构建

#### 1. 安装依赖

确保已安装：
- Android Studio
- Android SDK 34
- Node.js 18+

#### 2. 复制后端代码

```bash
cd android/app/src/main/python
# 如果后端代码不在这里，手动复制：
cp -r ../../backend/* .
```

#### 3. 构建前端

```bash
cd ../../frontend
npm install
npm run build
# 复制到后端
cp -r dist ../android/app/src/main/python/static
```

#### 4. 使用 Android Studio 打开

1. 打开 Android Studio
2. 选择 "Open an Existing Project"
3. 选择 `cat/android` 目录
4. 等待 Gradle sync 完成
5. 点击 Run > Run 'app'

#### 5. 生成 APK

1. 点击 Build > Generate Signed Bundle / APK
2. 选择 APK
3. 选择或创建签名密钥
4. 选择 debug 或 release
5. 完成

## APK 输出位置

- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release APK: `android/app/build/outputs/apk/release/app-release.apk`

## 签名配置

### 使用 Android Studio 自动签名

1. 打开项目结构：File > Project Structure
2. 选择 Modules > app
3. 勾选 "Signing Configs"
4. 添加新的签名配置
5. 选择签名文件、设置密码、别名等

### 使用命令行签名

```bash
# 生成签名密钥
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-key-alias

# 签名 APK
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore my-release-key.jks app-release-unsigned.apk my-key-alias

# 优化 APK
zipalign -v 4 app-release-unsigned.apk app-release.apk
```

## 架构说明

```
APK
├── Android Shell (Kotlin)
│   ├── MainActivity → WebView 加载 localhost:8000
│   └── PythonService → Chaquopy 启动 FastAPI 后端
├── Chaquopy (内嵌 CPython)
│   ├── FastAPI + uvicorn + SQLite
│   ├── 所有后端 Python 代码
│   └── 前端静态文件
└── 本地数据
    ├── cat.db (SQLite)
    ├── attachments/
    └── structured/
```

## 工作原理

1. 用户点击图标
2. MainActivity 启动
3. PythonService 在后台启动
4. Chaquopy 初始化 Python 环境
5. cat_server.py 被调用，启动 uvicorn
6. FastAPI 后端在 localhost:8000 运行
7. WebView 加载 http://localhost:8000

## 数据存储

所有数据存储在 App 的私有目录：
- `/data/data/com.cat.app/files/`
  - `cat.db` - SQLite 数据库
  - `attachments/` - 附件文件
  - `structured/` - 结构化数据

## 常见问题

### Q: 构建失败，提示 NDK 错误

确保已安装 Android NDK：
1. 打开 Android Studio > Settings > SDK Manager
2. 选择 SDK Tools
3. 勾选 NDK (Side by side)
4. 点击 Apply

### Q: Python 依赖安装失败

确保 gradle.properties 中已配置正确的 pip 镜像：

```properties
android.enableJetifier=true
```

### Q: WebView 无法加载页面

检查：
1. PythonService 是否正常启动
2. 通知栏是否显示 "Cat is running"
3. 健康检查端点是否可用：http://localhost:8000/health

### Q: 如何调试？

1. 连接设备后运行：
   ```bash
   adb logcat | grep -i cat
   ```
2. 查看 Python 日志：
   ```bash
   adb logcat | grep -i python
   ```

## 卸载与重装

卸载时不会删除数据（默认），如需彻底清除：
- 卸载后重新安装即可
- 或在设置中清除应用数据

## 许可证

与主项目一致，采用 MIT 许可证。

## 技术栈

- [Chaquopy](https://chaquo.com/chaquopy/) - Android 上的 Python
- [FastAPI](https://fastapi.tiangolo.com/) - 现代 Python Web 框架
- [Uvicorn](https://www.uvicorn.org/) - ASGI 服务器
- [Material Components](https://material.io/develop/android) - Material Design 组件
