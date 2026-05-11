# Cat 🐱 - 学术文献全流程工具

学术文献全流程工具：追踪 → 入库 → 阅读 → 笔记 → 学习，全部以 **DOI 为唯一锚点**串联。

## 功能特性

### 📡 文献追踪
- 支持期刊合集 + 关键词合集追踪
- 三种跳转模式：XML源 / DOI直达 / 谷粉学术
- DOI 直接添加文献

### 📑 略读
- 文献卡片展示（网格/列表视图）
- 创建/编辑/删除文献卡片
- 文献卡片模板管理

### 📖 精读
- 最近阅读列表
- Markdown 编辑器
- 笔记模式：行间/边栏
- 高亮标记、颜色分类
- 右键添加词汇本/长难句本

### 📚 学习
- 单词学习（新学/学习中/已掌握）
- 长难句练习
- 翻译练习（突击/严格模式）
- 间隔复习 + 严格复习模式

### ⚙️ 设置
- 文献追踪设置
- 学习参数配置
- 期刊/关键词合集管理
- API 配置（本地存储）
- 数据导入/导出

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite + TailwindCSS |
| 后端 | Python FastAPI |
| 数据库 | SQLite |
| 状态管理 | Zustand |
| 路由 | React Router v6 |

### 颜色方案
- `#4DBBD5` - 主基调蓝
- `#00A087` - 主基调绿
- `#3C5488` - 主要文字
- `#8491B4` - 次要信息
- `#E64B35` - 错误提示
- `#F39B7F` - 警告提示

## 快速开始

### 前端

```bash
cd cat/frontend
npm install
npm run dev
```

访问 http://localhost:3000

### 后端

```bash
cd cat/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API 文档：http://localhost:8000/docs

### Docker Compose

```bash
docker-compose up -d
```

## 项目结构

```
cat/
├── backend/                    # 后端
│   ├── main.py                 # FastAPI 应用入口
│   ├── config.py               # 配置
│   ├── database.py             # 数据库连接
│   ├── models/                 # 数据模型
│   ├── routers/                # API 路由
│   ├── schemas/                # Pydantic 模型
│   └── requirements.txt
├── frontend/                   # 前端
│   ├── src/
│   │   ├── api/               # API 客户端
│   │   ├── components/        # 组件
│   │   ├── pages/             # 页面
│   │   ├── stores/            # 状态管理
│   │   ├── utils/             # 工具函数
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── router.jsx         # 路由配置
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
└── data/                       # 数据目录（运行时创建）
    ├── cat.db                  # SQLite 数据库
    └── attachments/            # 附件存储
```

## 数据存储

- **数据库**：SQLite（`./data/cat.db`）
- **附件**：`./data/attachments/` 目录
- **敏感信息**：仅存储在浏览器本地（localStorage）
  - AI API Key
  - MinerU Token

## 开发说明

### API 代理
前端开发时，Vite 配置了 `/api` 代理到后端：
- 前端：`http://localhost:3000`
- 后端：`http://localhost:8000`
- 代理：`/api/v1/*` → `http://localhost:8000/api/v1/*`

### 环境变量
前端支持以下环境变量：
- `VITE_API_BASE_URL` - API 地址（默认 `/api/v1`）

## 许可证

MIT License
