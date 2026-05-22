"""
导出服务 - 多格式数据导出
"""
from io import BytesIO, StringIO
from typing import List, Dict, Any, Optional
from datetime import datetime
import csv
import zipfile
import os
import json

import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter


class ExportService:
    """数据导出服务"""
    
    # 颜色定义
    HEADER_FILL = PatternFill(start_color="4DBBD5", end_color="4DBBD5", fill_type="solid")
    HEADER_FONT = Font(bold=True, color="FFFFFF")
    BORDER = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    def export_literature_table(
        self,
        entries: List[Dict[str, Any]],
        columns: List[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        from_date: str = None,
        until_date: str = None
    ) -> BytesIO:
        """
        导出文献表为Excel
        
        Args:
            entries: 文献表条目列表
            columns: 要导出的列
            sort_by: 排序字段
            sort_order: 排序方向
            from_date: 开始日期
            until_date: 结束日期
        """
        # 默认列
        default_columns = [
            "doi", "title_cn", "title_en", "journal", "pubdate",
            "first_author", "communication_author",
            "has_attachment", "has_structured", "has_card", "has_notes",
            "created_at", "updated_at"
        ]
        
        columns = columns or default_columns
        column_names = {
            "doi": "DOI",
            "title_cn": "中文标题",
            "title_en": "英文标题",
            "journal": "期刊",
            "pubdate": "出版日期",
            "first_author": "第一作者",
            "communication_author": "通讯作者",
            "has_attachment": "有附件",
            "has_structured": "有结构",
            "has_card": "有卡片",
            "has_notes": "有笔记",
            "created_at": "加入时间",
            "updated_at": "更新时间"
        }
        
        # 过滤日期范围
        if from_date:
            entries = [e for e in entries if e.get("created_at", "") >= from_date]
        if until_date:
            entries = [e for e in entries if e.get("created_at", "") <= until_date]
        
        # 创建工作簿
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "文献表"
        
        # 写入表头
        for col_idx, col in enumerate(columns, 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.value = column_names.get(col, col)
            cell.fill = self.HEADER_FILL
            cell.font = self.HEADER_FONT
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = self.BORDER
        
        # 写入数据
        for row_idx, entry in enumerate(entries, 2):
            for col_idx, col in enumerate(columns, 1):
                cell = ws.cell(row=row_idx, column=col_idx)
                value = entry.get(col, "")
                
                # 处理布尔值
                if col.startswith("has_"):
                    value = "✓" if value else "✗"
                
                # 处理日期
                if "date" in col or "at" in col:
                    if value:
                        try:
                            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                            value = dt.strftime("%Y-%m-%d %H:%M")
                        except:
                            pass
                
                # DOI添加超链接
                if col == "doi" and value:
                    cell.hyperlink = f"https://doi.org/{value}"
                    cell.font = Font(color="0563C1", underline="single")
                
                cell.value = value
                cell.border = self.BORDER
                cell.alignment = Alignment(vertical="center", wrap_text=True)
        
        # 自动调整列宽
        for col_idx, col in enumerate(columns, 1):
            max_length = len(column_names.get(col, col))
            for row_idx in range(2, len(entries) + 2):
                cell = ws.cell(row=row_idx, column=col_idx)
                if cell.value:
                    max_length = max(max_length, len(str(cell.value)))
            ws.column_dimensions[get_column_letter(col_idx)].width = min(max_length + 2, 50)
        
        # 保存
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output
    
    def export_literature_table_csv(
        self,
        entries: List[Dict[str, Any]],
        columns: List[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        from_date: str = None,
        until_date: str = None
    ) -> BytesIO:
        """
        导出文献表为CSV (UTF-8 BOM编码，Excel兼容)
        """
        default_columns = [
            "doi", "title_cn", "title_en", "journal", "pubdate",
            "first_author", "communication_author",
            "has_attachment", "has_structured", "has_card", "has_notes",
            "created_at", "updated_at"
        ]
        
        columns = columns or default_columns
        column_names = {
            "doi": "DOI",
            "title_cn": "中文标题",
            "title_en": "英文标题",
            "journal": "期刊",
            "pubdate": "出版日期",
            "first_author": "第一作者",
            "communication_author": "通讯作者",
            "has_attachment": "有附件",
            "has_structured": "有结构",
            "has_card": "有卡片",
            "has_notes": "有笔记",
            "created_at": "加入时间",
            "updated_at": "更新时间"
        }
        
        # 过滤日期范围
        if from_date:
            entries = [e for e in entries if e.get("created_at", "") >= from_date]
        if until_date:
            entries = [e for e in entries if e.get("created_at", "") <= until_date]
        
        # UTF-8 BOM for Excel compatibility (使用 StringIO + UTF-8-SIG 编码)
        output = StringIO()
        
        writer = csv.writer(output)
        
        # 写入表头
        writer.writerow([column_names.get(col, col) for col in columns])
        
        # 写入数据
        for entry in entries:
            row = []
            for col in columns:
                value = entry.get(col, "")
                if col.startswith("has_"):
                    value = "是" if value else "否"
                row.append(value)
            writer.writerow(row)
        
        # 转换为 BytesIO with UTF-8 BOM
        output.seek(0)
        result = BytesIO()
        result.write(output.getvalue().encode('utf-8-sig'))
        result.seek(0)
        return result
    
    def export_words(
        self,
        words: List[Dict[str, Any]],
        doi: str = None,
        status: str = None,
        format: str = "xlsx"
    ) -> BytesIO:
        """
        导出单词表
        
        Args:
            words: 单词列表
            doi: 按DOI过滤
            status: 按状态过滤 (new/learning/mastered)
            format: 导出格式
        """
        # 过滤
        if doi:
            words = [w for w in words if w.get("doi") == doi]
        if status:
            words = [w for w in words if w.get("status") == status]
        
        if format == "csv":
            return self._export_words_csv(words)
        return self._export_words_excel(words)
    
    def _export_words_excel(self, words: List[Dict[str, Any]]) -> BytesIO:
        """导出单词为Excel"""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "单词表"
        
        headers = ["ID", "英文单词", "中文释义", "英文定义", "中文定义", "例句", "DOI", "状态", "复习次数", "创建时间"]
        columns = ["id", "word_en", "word_cn", "definition_en", "definition_cn", "sentence", "doi", "status", "review_count", "created_at"]
        
        # 表头
        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.value = header
            cell.fill = self.HEADER_FILL
            cell.font = self.HEADER_FONT
            cell.border = self.BORDER
        
        # 数据
        status_colors = {
            "new": "F39B7F",
            "learning": "4DBBD5",
            "mastered": "00A087"
        }
        
        for row_idx, word in enumerate(words, 2):
            for col_idx, col in enumerate(columns, 1):
                cell = ws.cell(row=row_idx, column=col_idx)
                value = word.get(col, "")
                
                # 状态颜色
                if col == "status":
                    color = status_colors.get(value, "FFFFFF")
                    cell.fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
                    value = {"new": "新词", "learning": "学习中", "mastered": "已掌握"}.get(value, value)
                
                cell.value = value
                cell.border = self.BORDER
        
        # 列宽
        ws.column_dimensions['A'].width = 8
        ws.column_dimensions['B'].width = 20
        ws.column_dimensions['C'].width = 20
        ws.column_dimensions['D'].width = 30
        ws.column_dimensions['E'].width = 20
        ws.column_dimensions['F'].width = 50
        ws.column_dimensions['G'].width = 25
        ws.column_dimensions['H'].width = 10
        ws.column_dimensions['I'].width = 10
        ws.column_dimensions['J'].width = 18
        
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output
    
    def _export_words_csv(self, words: List[Dict[str, Any]]) -> BytesIO:
        """导出单词为CSV (UTF-8 BOM编码，Excel兼容)"""
        output = StringIO()
        
        writer = csv.writer(output)
        writer.writerow(["ID", "英文单词", "中文释义", "英文定义", "中文定义", "例句", "DOI", "状态", "复习次数", "创建时间"])
        
        status_map = {"new": "新词", "learning": "学习中", "mastered": "已掌握"}
        
        for word in words:
            writer.writerow([
                word.get("id", ""),
                word.get("word_en", ""),
                word.get("word_cn", ""),
                word.get("definition_en", ""),
                word.get("definition_cn", ""),
                word.get("sentence", ""),
                word.get("doi", ""),
                status_map.get(word.get("status", ""), ""),
                word.get("review_count", 0),
                word.get("created_at", "")
            ])
        
        # 转换为 BytesIO with UTF-8 BOM
        output.seek(0)
        result = BytesIO()
        result.write(output.getvalue().encode('utf-8-sig'))
        result.seek(0)
        return result
    
    def export_sentences(
        self,
        sentences: List[Dict[str, Any]],
        doi: str = None,
        status: str = None,
        format: str = "xlsx"
    ) -> BytesIO:
        """导出长难句表"""
        # 过滤
        if doi:
            sentences = [s for s in sentences if s.get("doi") == doi]
        if status:
            sentences = [s for s in sentences if s.get("status") == status]
        
        if format == "csv":
            return self._export_sentences_csv(sentences)
        return self._export_sentences_excel(sentences)
    
    def _export_sentences_excel(self, sentences: List[Dict[str, Any]]) -> BytesIO:
        """导出长难句为Excel"""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "长难句表"
        
        headers = ["ID", "英文句子", "中文翻译", "DOI", "状态", "复习次数", "创建时间"]
        columns = ["id", "sentence_en", "sentence_cn", "doi", "status", "review_count", "created_at"]
        
        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.value = header
            cell.fill = self.HEADER_FILL
            cell.font = self.HEADER_FONT
            cell.border = self.BORDER
        
        status_colors = {
            "new": "F39B7F",
            "learning": "4DBBD5",
            "mastered": "00A087"
        }
        
        for row_idx, sentence in enumerate(sentences, 2):
            for col_idx, col in enumerate(columns, 1):
                cell = ws.cell(row=row_idx, column=col_idx)
                value = sentence.get(col, "")
                
                if col == "status":
                    color = status_colors.get(value, "FFFFFF")
                    cell.fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
                    value = {"new": "新句", "learning": "学习中", "mastered": "已掌握"}.get(value, value)
                
                cell.value = value
                cell.border = self.BORDER
        
        ws.column_dimensions['A'].width = 8
        ws.column_dimensions['B'].width = 60
        ws.column_dimensions['C'].width = 40
        ws.column_dimensions['D'].width = 25
        ws.column_dimensions['E'].width = 10
        ws.column_dimensions['F'].width = 10
        ws.column_dimensions['G'].width = 18
        
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output
    
    def _export_sentences_csv(self, sentences: List[Dict[str, Any]]) -> BytesIO:
        """导出长难句为CSV (UTF-8 BOM编码，Excel兼容)"""
        output = StringIO()
        
        writer = csv.writer(output)
        writer.writerow(["ID", "英文句子", "中文翻译", "DOI", "状态", "复习次数", "创建时间"])
        
        status_map = {"new": "新句", "learning": "学习中", "mastered": "已掌握"}
        
        for sentence in sentences:
            writer.writerow([
                sentence.get("id", ""),
                sentence.get("sentence_en", ""),
                sentence.get("sentence_cn", ""),
                sentence.get("doi", ""),
                status_map.get(sentence.get("status", ""), ""),
                sentence.get("review_count", 0),
                sentence.get("created_at", "")
            ])
        
        # 转换为 BytesIO with UTF-8 BOM
        output.seek(0)
        result = BytesIO()
        result.write(output.getvalue().encode('utf-8-sig'))
        result.seek(0)
        return result
    
    def export_translation_cards_markdown(self, cards: List[Dict[str, Any]]) -> BytesIO:
        """导出翻译卡片为Markdown"""
        output = BytesIO()
        content = "# 翻译练习卡片\n\n"
        content += f"导出时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        content += "---\n\n"
        
        for i, card in enumerate(cards, 1):
            content += f"## 卡片 {i}\n\n"
            content += f"**DOI**: {card.get('doi', 'N/A')}\n\n"
            content += f"**原文摘要**:\n\n{card.get('original_text', '')}\n\n"
            content += f"**用户翻译**:\n\n{card.get('user_translation', '')}\n\n"
            content += f"**AI反馈**:\n\n{card.get('ai_feedback', '')}\n\n"
            
            # 错词列表
            error_words = card.get('error_words', [])
            if error_words:
                content += f"**错词列表**:\n\n"
                for word in error_words:
                    content += f"- {word}\n"
                content += "\n"
            
            content += "---\n\n"
        
        output.write(content.encode('utf-8'))
        output.seek(0)
        return output


# 全局实例
export_service = ExportService()
