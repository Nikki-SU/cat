# Cat - 学术文献全流程工具

**追踪 → 入库 → 阅读 → 笔记 → 学习**，全流程学术文献管理工具

## 特性
- 文献追踪：自动追踪 arXiv、CrossRef 等学术数据库
- 批量入库：一键导入 DOI、arXiv ID 或批量 PDF
- 深度阅读：内置 PDF 阅读器，支持高亮、标注
- 结构化笔记：Markdown 笔记，连接文献卡片
- 闪卡学习：基于笔记自动生成记忆卡片
- AI 辅助：集成 Ollama/OpenAI 智能分析

## 一键启动

**Windows：**
1. 双击 `build.bat` 构建前端
2. 双击 `start.bat` 启动

**Linux/macOS：**
```bash
chmod +x build.sh start.sh
./build.sh && ./start.sh
```

**Termux (Android)：**
```bash
./start_termux.sh
```

访问 http://localhost:8000

详细说明请参考 [INSTALL.md](INSTALL.md)

## License
MIT
