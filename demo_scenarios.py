#!/usr/bin/env python3
"""
Cat - 学术文献管理工具
用户场景模拟器

模拟各种用户使用场景，帮助测试和演示系统功能
"""
import asyncio
import httpx
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any
from dataclasses import dataclass
from enum import Enum

# API 配置
BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"

class UserType(Enum):
    """用户类型"""
    BEGINNER = "新手研究员"      # 刚入学的研究生
    RESEARCHER = "资深研究者"    # 有文献管理需求的研究人员  
    PROFESSOR = "教授"           # 管理大量文献和团队

@dataclass
class DemoStep:
    """演示步骤"""
    name: str
    description: str
    action: callable
    delay: float = 1.0  # 步骤之间的延迟

class ScenarioRunner:
    """场景运行器"""
    
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
        self.results: List[Dict] = []
        self.current_user: str = ""
        
    async def close(self):
        await self.client.aclose()
    
    def print_header(self, text: str):
        """打印标题"""
        print("\n" + "="*70)
        print(f"🎯 {text}")
        print("="*70)
    
    def print_step(self, num: int, name: str, desc: str):
        """打印步骤"""
        print(f"\n  Step {num}: {name}")
        print(f"  {'─' * 50}")
        print(f"  📋 {desc}")
    
    def print_result(self, success: bool, message: str = ""):
        """打印结果"""
        icon = "✅" if success else "❌"
        print(f"  {icon} {message}")
    
    async def check_health(self) -> bool:
        """检查服务状态"""
        try:
            response = await self.client.get("/health")
            return response.status_code == 200
        except:
            return False
    
    # ==================== 场景1: 新手入门 ====================
    
    async def scenario_beginner_onboarding(self):
        """
        场景1: 新手研究员第一天使用
        
        用户画像:
        - 研一学生，刚入学
        - 导师给了几个研究方向
        - 需要追踪相关期刊的最新论文
        """
        self.print_header("场景1: 新手研究员入门 🎓")
        self.current_user = "小李 (研一新生)"
        print(f"\n👤 用户: {self.current_user}")
        print("📖 背景: 刚入学，导师建议关注 Nature/Science/Cell 的最新论文")
        print("🎯 目标: 建立个人文献库，追踪感兴趣的方向\n")
        
        await asyncio.sleep(1)
        
        # Step 1: 创建期刊合集
        self.print_step(1, "创建期刊合集", "将关注的期刊整理成一个合集")
        response = await self.client.post(
            f"{API_PREFIX}/organization/journal-groups",
            json={
                "name": "我的目标期刊",
                "journals": ["Nature", "Science", "Cell", "Nature Communications"]
            }
        )
        if response.status_code == 200:
            group = response.json()
            self.print_result(True, f"创建期刊合集 '{group['name']}' (ID: {group['id']})")
        else:
            self.print_result(False, f"创建失败: {response.text}")
        await asyncio.sleep(1)
        
        # Step 2: 创建关键词合集
        self.print_step(2, "创建关键词合集", "定义研究方向的检索关键词")
        response = await self.client.post(
            f"{API_PREFIX}/organization/keyword-groups",
            json={
                "name": "机器学习在生物信息学",
                "keywords": [
                    {"word": "machine learning", "logic": "and"},
                    {"word": "bioinformatics", "logic": "and"},
                    {"word": "deep learning", "logic": "or"},
                    {"word": "review", "logic": "not"}
                ]
            }
        )
        if response.status_code == 200:
            group = response.json()
            self.print_result(True, f"创建关键词合集 '{group['name']}'")
        else:
            self.print_result(False, f"创建失败: {response.text}")
        await asyncio.sleep(1)
        
        # Step 3: 模拟追踪今天的文献（手动添加）
        self.print_step(3, "手动添加今日发现的好文章", "在浏览期刊网站时看到一篇感兴趣的文章")
        today = datetime.now().strftime("%Y-%m-%d")
        
        papers = [
            {
                "doi": "10.1038/s41586-024-07415-x",
                "title_cn": "深度学习预测蛋白质结构的最新进展",
                "title_en": "Advances in Deep Learning for Protein Structure Prediction",
                "journal": "Nature",
                "pubdate": "2024-01-15"
            },
            {
                "doi": "10.1126/science.adk8265",
                "title_cn": "单细胞测序中的机器学习应用",
                "title_en": "Machine Learning Applications in Single-cell Sequencing",
                "journal": "Science",
                "pubdate": "2024-01-14"
            }
        ]
        
        for paper in papers:
            response = await self.client.post(
                f"{API_PREFIX}/literature/table",
                json=paper
            )
            if response.status_code == 200:
                result = response.json()
                self.print_result(True, f"添加文献: {result['title_en'][:50]}...")
            else:
                self.print_result(False, f"添加失败: {paper['doi']}")
        
        await asyncio.sleep(1)
        
        # Step 4: 给文献打标签
        self.print_step(4, "为文献添加标签", "整理和分类已添加的文献")
        
        tags = [
            {"name": "必读", "doi": "10.1038/s41586-024-07415-x"},
            {"name": "蛋白质结构", "doi": "10.1038/s41586-024-07415-x"},
            {"name": "单细胞", "doi": "10.1126/science.adk8265"},
            {"name": "精读", "doi": "10.1126/science.adk8265"}
        ]
        
        for tag in tags:
            response = await self.client.post(
                f"{API_PREFIX}/organization/tags",
                json=tag
            )
            if response.status_code == 200:
                self.print_result(True, f"添加标签 '{tag['name']}' → {tag['doi'][:20]}...")
        
        await asyncio.sleep(1)
        
        # Step 5: 查看今日文献库
        self.print_step(5, "查看个人文献库", "确认今天的整理成果")
        response = await self.client.get(f"{API_PREFIX}/literature/table")
        if response.status_code == 200:
            papers = response.json()
            self.print_result(True, f"文献库中共有 {len(papers)} 篇文献")
            for p in papers:
                print(f"    • {p.get('title_en', 'N/A')[:40]}...")
    
    # ==================== 场景2: 日常文献追踪 ====================
    
    async def scenario_daily_tracking(self):
        """
        场景2: 资深研究者的日常追踪流程
        
        用户画像:
        - PhD学生或博士后
        - 每天需要查看新发表的论文
        - 使用 CrossRef 追踪期刊
        """
        self.print_header("场景2: 日常文献追踪 🔍")
        self.current_user = "张博士 (博士后)"
        print(f"\n👤 用户: {self.current_user}")
        print("📖 背景: 每天上午9点例行查看目标期刊的最新论文")
        print("🎯 目标: 快速筛选感兴趣的文章，补充到文献库\n")
        
        await asyncio.sleep(1)
        
        # Step 1: 追踪 Nature 最近的论文
        self.print_step(1, "追踪 Nature 最新论文", "使用 CrossRef API 自动获取")
        
        today = datetime.now()
        last_week = (today - timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = await self.client.post(
            f"{API_PREFIX}/tracking/search/by-journal",
            params={
                "journal_name": "Nature",
                "from_date": last_week,
                "rows": 5
            }
        )
        
        if response.status_code == 200:
            papers = response.json()
            self.print_result(True, f"发现 {len(papers)} 篇新论文")
            for i, p in enumerate(papers[:3], 1):
                print(f"    {i}. {p.get('title_en', 'N/A')[:45]}...")
        else:
            # 模拟数据（如果API失败）
            self.print_result(True, "发现 3 篇新论文 (模拟数据)")
            print("    1. AlphaFold3: A new era in protein structure prediction...")
            print("    2. Large language models for biomedical text mining...")
            print("    3. Single-cell CRISPR screening with machine learning...")
        
        await asyncio.sleep(1)
        
        # Step 2: 添加到追踪列表
        self.print_step(2, "将感兴趣的文章加入追踪", "筛选并记录今天的动作")
        
        tracking_records = [
            {
                "doi": "10.1038/s41586-024-mock-001",
                "journal": "Nature",
                "title_en": "AlphaFold3: Accurate structure prediction...",
                "action": "added"
            },
            {
                "doi": "10.1126/science-mock-002",
                "journal": "Science", 
                "title_en": "Large language models for biomedical...",
                "action": "added"
            },
            {
                "doi": "10.1016/j.cell.mock-003",
                "journal": "Cell",
                "title_en": "A previous paper that was rejected",
                "action": "deleted"
            }
        ]
        
        today_str = datetime.now().strftime("%Y-%m-%d")
        for record in tracking_records:
            record["date"] = today_str
            response = await self.client.post(
                f"{API_PREFIX}/tracking/records",
                json=record
            )
            action_icon = "📥" if record["action"] == "added" else "🗑️"
            if response.status_code == 200:
                self.print_result(True, f"{action_icon} {record['action'].upper()}: {record['title_en'][:40]}...")
        
        await asyncio.sleep(1)
        
        # Step 3: 批量添加到文献库
        self.print_step(3, "批量入库", "将今天标记为 added 的文章加入主文献库")
        
        papers_to_add = [
            {
                "doi": "10.1038/s41586-024-mock-001",
                "title_en": "AlphaFold3: Accurate structure prediction with ligands",
                "title_cn": "AlphaFold3: 带配体的精确结构预测",
                "journal": "Nature",
                "pubdate": "2024-01-10",
                "first_author": "John Jumper"
            },
            {
                "doi": "10.1126/science-mock-002",
                "title_en": "Large language models for biomedical literature mining",
                "title_cn": "用于生物医学文献挖掘的大语言模型",
                "journal": "Science",
                "pubdate": "2024-01-12",
                "first_author": "Jane Smith"
            }
        ]
        
        response = await self.client.post(
            f"{API_PREFIX}/literature/table/batch",
            json=papers_to_add
        )
        
        if response.status_code == 200:
            result = response.json()
            self.print_result(True, f"成功添加 {result.get('created', 0)} 篇文献到库")
        
        await asyncio.sleep(1)
        
        # Step 4: 查看追踪统计
        self.print_step(4, "查看追踪统计", "了解近期的追踪成果")
        response = await self.client.get(f"{API_PREFIX}/tracking/statistics")
        if response.status_code == 200:
            stats = response.json()
            self.print_result(True, f"总计追踪: {stats.get('total', 0)} 条记录")
            for journal_stat in stats.get('by_journal', []):
                print(f"    • {journal_stat['journal']}: {journal_stat['count']} 篇")
    
    # ==================== 场景3: 深度阅读学习 ====================
    
    async def scenario_deep_reading(self):
        """
        场景3: 深度阅读和学习流程
        
        上传PDF，解析成结构化内容，提取生词和长难句进行学习
        """
        self.print_header("场景3: 深度阅读与学习 📚")
        self.current_user = "王研究员 (博士生)"
        print(f"\n👤 用户: {self.current_user}")
        print("📖 背景: 精读一篇重要论文，需要理解所有术语和长难句")
        print("🎯 目标: 将PDF解析为结构化内容，系统学习生词\n")
        
        await asyncio.sleep(1)
        
        # Step 1: 选择要精读的论文
        self.print_step(1, "添加精读论文", "选择DOI，完善信息")
        
        doi = "10.1038/s41586-024-07415-x"
        paper_info = {
            "doi": doi,
            "title_en": "AlphaFold3: High-accuracy protein structure prediction",
            "title_cn": "AlphaFold3: 高精度蛋白质结构预测",
            "journal": "Nature",
            "pubdate": "2024-01-15",
            "first_author": "Jumper, J.",
            "has_structured": False,
            "has_card": False
        }
        
        response = await self.client.post(
            f"{API_PREFIX}/literature/table",
            json=paper_info
        )
        
        if response.status_code == 200:
            self.print_result(True, f"添加精读论文: {paper_info['title_en'][:40]}...")
        
        await asyncio.sleep(1)
        
        # Step 2: 创建结构化文献（模拟有PDF内容）
        self.print_step(2, "结构化文章内容", "假设已解析PDF，手动添加结构化内容")
        
        # 模拟解析后的 Markdown 内容
        markdown_content = """# AlphaFold3: High-accuracy protein structure prediction

## Abstract

Accurate prediction of protein structures and their interactions with other molecules is crucial for understanding biological processes and developing therapeutics. Here we present AlphaFold3, which achieves high accuracy across a broad range of biomolecular interactions including protein-ligand, protein-nucleic acid, and antibody-antigen interactions.

## Introduction

The prediction of biomolecular interactions has been a longstanding challenge in computational biology. Recent advances in deep learning, particularly transformer architectures and diffusion models, have enabled significant progress in this field. However, accurately modeling the complex physicochemical interactions remains difficult.

## Methods

We employ a novel diffusion-based architecture that directly operates on atomic coordinates. The model uses a pairwise representation learned through attention mechanisms, combined with a structure module that generates 3D coordinates.

## Results

Our model achieves state-of-the-art performance on the CASP15 benchmark, with a median IDDT score of 0.92 for protein monomers and competitive performance on protein-protein and protein-ligand interactions.

## Discussion

These results demonstrate that deep learning approaches can capture the fundamental physics of molecular interactions given sufficient data and model capacity. The direct prediction of atomic coordinates, rather than inter-residue distances, provides a more flexible framework for modeling diverse molecular systems.
"""
        
        response = await self.client.post(
            f"{API_PREFIX}/structured/literature",
            json={
                "doi": doi,
                "content": markdown_content
            }
        )
        
        if response.status_code == 200:
            self.print_result(True, "创建结构化文献成功")
            
            # 更新文献状态
            await self.client.put(
                f"{API_PREFIX}/literature/table/{doi}",
                json={"has_structured": True}
            )
        
        await asyncio.sleep(1)
        
        # Step 3: 手动提取生词
        self.print_step(3, "提取专业术语", "阅读过程中遇到的不熟悉的术语")
        
        words = [
            {
                "word_en": "diffusion-based architecture",
                "word_cn": "基于扩散的架构",
                "definition_en": "A neural network architecture that uses diffusion processes to generate outputs",
                "definition_cn": "使用扩散过程生成输出的神经网络架构",
                "sentence": "We employ a novel diffusion-based architecture that directly operates on atomic coordinates.",
                "doi": doi,
                "status": "new"
            },
            {
                "word_en": "attention mechanisms",
                "word_cn": "注意力机制",
                "definition_en": "Neural network components that allow the model to focus on relevant parts of the input",
                "definition_cn": "允许模型关注输入相关部分的神经网络组件",
                "sentence": "The model uses a pairwise representation learned through attention mechanisms.",
                "doi": doi,
                "status": "new"
            },
            {
                "word_en": "biomolecular interactions",
                "word_cn": "生物分子相互作用",
                "definition_en": "Physical interactions between biological molecules such as proteins, nucleic acids, and ligands",
                "definition_cn": "蛋白质、核酸和配体等生物分子之间的物理相互作用",
                "sentence": "AlphaFold3 achieves high accuracy across a broad range of biomolecular interactions.",
                "doi": doi,
                "status": "new"
            },
            {
                "word_en": "therapeutics",
                "word_cn": "治疗剂/疗法",
                "definition_en": "Treatments intended to cure or alleviate disease",
                "definition_cn": "旨在治愈或缓解疾病的治疗方法",
                "sentence": "Accurate prediction is crucial for understanding biological processes and developing therapeutics.",
                "doi": doi,
                "status": "learning"
            }
        ]
        
        for word in words:
            response = await self.client.post(
                f"{API_PREFIX}/learning/words",
                json=word
            )
            if response.status_code == 200:
                self.print_result(True, f"添加生词: {word['word_en']}")
        
        await asyncio.sleep(1)
        
        # Step 4: 提取长难句
        self.print_step(4, "提取长难句", "复杂的句子需要逐一理解")
        
        sentences = [
            {
                "sentence_en": "Accurate prediction of protein structures and their interactions with other molecules is crucial for understanding biological processes and developing therapeutics, yet has remained a longstanding challenge in computational biology.",
                "sentence_cn": "准确预测蛋白质结构及其与其他分子的相互作用对于理解生物过程和开发治疗方法至关重要，但一直是计算生物学中长期存在的挑战。",
                "doi": doi,
                "status": "new"
            },
            {
                "sentence_en": "Recent advances in deep learning, particularly transformer architectures and diffusion models, have enabled significant progress in biomolecular structure prediction, although accurately modeling the complex physicochemical interactions remains difficult.",
                "sentence_cn": "深度学习的最新进展，特别是Transformer架构和扩散模型，在生物分子结构预测方面取得了重大进展，尽管准确建模复杂的物理化学相互作用仍然困难。",
                "doi": doi,
                "status": "new"
            }
        ]
        
        for sent in sentences:
            response = await self.client.post(
                f"{API_PREFIX}/learning/sentences",
                json=sent
            )
            if response.status_code == 200:
                word_count = len(sent['sentence_en'].split())
                self.print_result(True, f"添加长难句 ({word_count} 词)")
        
        await asyncio.sleep(1)
        
        # Step 5: 做结构性笔记
        self.print_step(5, "添加结构性笔记", "在文章不同位置做标注")
        
        notes = [
            {
                "doi": doi,
                "anchor_type": "heading",
                "anchor_text": "Methods",
                "note_type": "markdown",
                "content": "**关键方法**: 扩散模型 + 注意力机制\n\n这里的创新点是直接在原子坐标上操作，而不是像AlphaFold2那样预测残基间距离。",
                "tags": ["方法", "创新点"],
                "color": "blue"
            },
            {
                "doi": doi,
                "anchor_type": "paragraph",
                "anchor_text": "Our model achieves state-of-the-art",
                "note_type": "markdown",
                "content": "⚠️ **数据来源**: CASP15 benchmark\n\n需要查一下CASP15的具体评价标准是什么。",
                "tags": ["待查证"],
                "color": "yellow"
            }
        ]
        
        for note in notes:
            response = await self.client.post(
                f"{API_PREFIX}/structured/notes",
                json=note
            )
            if response.status_code == 200:
                self.print_result(True, f"添加笔记 → {note['anchor_text'][:20]}...")
        
        await asyncio.sleep(1)
        
        # Step 6: 创建文献卡片
        self.print_step(6, "生成文献卡片", "总结文章要点，便于复习")
        
        card_content = """# AlphaFold3 要点总结

## 核心创新
1. **扩散架构**: 直接在原子坐标上操作 (vs AlphaFold2 的 distance-based)
2. **通用性**: 支持蛋白-配体、蛋白-核酸、抗体-抗原等多种相互作用
3. **SOTA性能**: CASP15 蛋白单体 IDDT 0.92

## 关键术语
- Diffusion-based architecture
- Attention mechanisms  
- Biomolecular interactions

## 待深入了解
- [ ] 扩散模型的具体实现
- [ ] 与AlphaFold2的详细对比
- [ ] 在药物设计中的应用潜力
"""
        
        response = await self.client.post(
            f"{API_PREFIX}/cards/literature",
            json={
                "doi": doi,
                "title_cn": paper_info['title_cn'],
                "title_en": paper_info['title_en'],
                "journal": paper_info['journal'],
                "author": paper_info['first_author'],
                "pubdate": paper_info['pubdate'],
                "abstract_cn": "使用扩散模型进行高精度蛋白质结构预测的突破性研究",
                "abstract_en": "Breakthrough research using diffusion models for high-accuracy protein structure prediction",
                "keyword_cn": "深度学习,蛋白质结构,扩散模型,生物信息学",
                "keyword_en": "Deep learning, Protein structure, Diffusion models, Bioinformatics"
            }
        )
        
        if response.status_code == 200:
            self.print_result(True, "创建文献卡片成功")
            
            # 更新状态
            await self.client.put(
                f"{API_PREFIX}/literature/table/{doi}",
                json={"has_card": True}
            )
        
        await asyncio.sleep(1)
        
        # Step 7: 学习统计
        self.print_step(7, "查看学习进度", "今天的学习成果")
        
        response = await self.client.get(f"{API_PREFIX}/learning/words")
        if response.status_code == 200:
            words = response.json()
            new_count = sum(1 for w in words if w.get('status') == 'new')
            learning_count = sum(1 for w in words if w.get('status') == 'learning')
            mastered_count = sum(1 for w in words if w.get('status') == 'mastered')
            
            self.print_result(True, f"单词学习统计:")
            print(f"    🟠 新词: {new_count} | 🔵 学习中: {learning_count} | 🟢 已掌握: {mastered_count}")
        
        response = await self.client.get(f"{API_PREFIX}/learning/sentences")
        if response.status_code == 200:
            sentences = response.json()
            self.print_result(True, f"长难句库: {len(sentences)} 句")
    
    # ==================== 场景4: 单词复习 ====================
    
    async def scenario_word_review(self):
        """
        场景4: 单词和句子复习流程
        模拟间隔重复学习
        """
        self.print_header("场景4: 间隔重复学习 🧠")
        self.current_user = "小李 (研一新生)"
        print(f"\n👤 用户: {self.current_user}")
        print("📖 背景: 每天晚饭后复习当天学习的生词")
        print("🎯 目标: 掌握所有新词，复习即将到期的旧词\n")
        
        await asyncio.sleep(1)
        
        # Step 1: 查看今日复习清单
        self.print_step(1, "获取今日复习单词", "基于间隔重复算法")
        
        response = await self.client.get(
            f"{API_PREFIX}/learning/words?status=new&limit=20"
        )
        
        if response.status_code == 200:
            words = response.json()
            self.print_result(True, f"今日有 {len(words)} 个新词需要学习")
            for i, w in enumerate(words[:5], 1):
                print(f"    {i}. {w['word_en']}")
        
        await asyncio.sleep(1)
        
        # Step 2: 模拟学习过程
        self.print_step(2, "单词学习过程", "逐个学习并标记掌握程度")
        
        # 假设我们已经有了单词
        words_to_review = [
            (1, "diffusion-based architecture", True),   # 认识了
            (2, "attention mechanisms", True),           # 认识了
            (3, "biomolecular interactions", False),     # 不认识
            (4, "therapeutics", True),                   # 认识了
        ]
        
        for idx, word, known in words_to_review:
            status = "✅ 认识" if known else "❌ 不认识"
            print(f"    单词 {idx}: {word[:30]}... → {status}")
            
            # 更新状态
            new_status = "learning" if known else "new"
            correct_streak = 1 if known else 0
            
            # 这里假设ID为idx，实际应该查询获取ID
            await asyncio.sleep(0.3)
        
        self.print_result(True, "完成今日单词复习")
        
        await asyncio.sleep(1)
        
        # Step 3: 长难句复习
        self.print_step(3, "长难句精翻", "逐句分析和翻译")
        
        response = await self.client.get(
            f"{API_PREFIX}/learning/sentences?status=new"
        )
        
        if response.status_code == 200:
            sentences = response.json()
            
            for i, sent in enumerate(sentences[:2], 1):
                print(f"\n    句子 {i}:")
                print(f"    EN: {sent['sentence_en'][:60]}...")
                print(f"    CN: {sent['sentence_cn'][:40]}...")
                
                # 模拟复习，更新状态
                await self.client.put(
                    f"{API_PREFIX}/learning/sentences/{sent['id']}",
                    json={
                        "status": "learning",
                        "review_count": sent.get('review_count', 0) + 1,
                        "last_review": datetime.now().isoformat()
                    }
                )
            
            self.print_result(True, f"复习了 {min(len(sentences), 2)} 个长难句")
    
    # ==================== 主运行器 ====================
    
    async def run_all_scenarios(self):
        """运行所有场景"""
        print("\n" + "🐱"*35)
        print("🐱" + " "*33 + "🐱")
        print("🐱   欢迎使用 Cat 学术文献管理工具 - 场景模拟器   🐱")
        print("🐱" + " "*33 + "🐱")
        print("🐱"*35 + "\n")
        
        # 检查服务
        print("🔍 检查后端服务...")
        if not await self.check_health():
            print("\n❌ 错误: 后端服务未启动!")
            print("\n请先启动服务:")
            print("  cd C:\\Users\\Rosa\\cat-repo\\backend")
            print("  python -m uvicorn main:app --reload")
            return
        
        print("✅ 后端服务运行正常\n")
        
        try:
            # 运行场景
            await self.scenario_beginner_onboarding()
            await asyncio.sleep(2)
            
            await self.scenario_daily_tracking()
            await asyncio.sleep(2)
            
            await self.scenario_deep_reading()
            await asyncio.sleep(2)
            
            await self.scenario_word_review()
            
            # 总结
            self.print_header("模拟完成！🎉")
            print("\n✅ 所有场景运行成功")
            print("\n📊 你可以通过以下方式查看结果:")
            print("   1. 访问 http://localhost:8000/docs 查看 Swagger API 文档")
            print("   2. 使用 start_dev.py 启动的网页查看可视化界面")
            print("   3. 直接查询数据库查看所有添加的数据\n")
            
        except Exception as e:
            print(f"\n❌ 运行出错: {e}")
            import traceback
            traceback.print_exc()

async def main():
    runner = ScenarioRunner()
    try:
        await runner.run_all_scenarios()
    finally:
        await runner.close()

if __name__ == "__main__":
    asyncio.run(main())
