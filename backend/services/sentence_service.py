"""
长难句学习服务
简化版：卡片展示 + 艾宾浩斯复习
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models.learning import LongSentence, SentenceStudyStatus

# 艾宾浩斯复习间隔（天）
ANKI_INTERVALS = [1, 3, 7, 14, 30, 60, 90, 180]


class SentenceStudyService:
    """长难句学习服务"""

    def __init__(self, db: Session):
        self.db = db

    def get_or_create_status(self, sentence_id: int) -> SentenceStudyStatus:
        """获取或创建学习状态"""
        status = self.db.query(SentenceStudyStatus).filter(
            SentenceStudyStatus.sentence_id == sentence_id
        ).first()
        if not status:
            status = SentenceStudyStatus(sentence_id=sentence_id, status="new")
            self.db.add(status)
            self.db.commit()
            self.db.refresh(status)
        return status

    def initialize_all_sentences(self):
        """为所有没有学习状态的长难句创建状态记录"""
        all_sentences = self.db.query(LongSentence).all()
        existing_ids = {s.sentence_id for s in self.db.query(SentenceStudyStatus.sentence_id).all()}

        new_statuses = []
        for sentence in all_sentences:
            if sentence.id not in existing_ids:
                status = SentenceStudyStatus(
                    sentence_id=sentence.id,
                    status="new"
                )
                new_statuses.append(status)

        if new_statuses:
            self.db.bulk_save_objects(new_statuses)
            self.db.commit()

    def calculate_next_review(self, review_stage: int) -> Optional[datetime]:
        """计算下次复习时间"""
        if review_stage >= len(ANKI_INTERVALS):
            return None
        days = ANKI_INTERVALS[review_stage]
        return datetime.now() + timedelta(days=days)

    def get_learning_queue(self, queue_length: int) -> List[int]:
        """获取学习队列（优先studying，不足补new）"""
        self.initialize_all_sentences()

        studying = self.db.query(SentenceStudyStatus).filter(
            SentenceStudyStatus.status == "studying"
        ).order_by(SentenceStudyStatus.updated_at.asc()).limit(queue_length).all()

        queue = [s.sentence_id for s in studying]

        if len(queue) < queue_length:
            need_more = queue_length - len(queue)
            new_items = self.db.query(SentenceStudyStatus).filter(
                SentenceStudyStatus.status == "new"
            ).order_by(SentenceStudyStatus.created_at.asc()).limit(need_more).all()
            queue.extend([s.sentence_id for s in new_items])

        return queue

    def get_review_queue(self, queue_length: int) -> List[int]:
        """获取复习队列"""
        now = datetime.now()
        review_items = self.db.query(SentenceStudyStatus).filter(
            SentenceStudyStatus.status == "learned",
            SentenceStudyStatus.next_review_at <= now
        ).order_by(SentenceStudyStatus.next_review_at.asc()).limit(queue_length).all()

        return [s.sentence_id for s in review_items]

    def get_error_book_queue(self, queue_length: int) -> List[int]:
        """获取错词本队列"""
        error_items = self.db.query(SentenceStudyStatus).filter(
            SentenceStudyStatus.in_error_book == True
        ).order_by(SentenceStudyStatus.error_count.desc()).limit(queue_length).all()

        return [s.sentence_id for s in error_items]

    def show_card(self, sentence_id: int) -> Dict[str, Any]:
        """显示卡片"""
        sentence = self.db.query(LongSentence).filter(LongSentence.id == sentence_id).first()
        if not sentence:
            return None

        status = self.get_or_create_status(sentence_id)
        status.card_shown = True
        if status.status == "new":
            status.status = "studying"
        self.db.commit()

        return {
            "id": sentence.id,
            "sentence_en": sentence.sentence_en,
            "sentence_cn": sentence.sentence_cn,
            "status": status.status
        }

    def mark_as_learned(self, sentence_id: int) -> SentenceStudyStatus:
        """标记为已学完（完成卡片学习）"""
        status = self.get_or_create_status(sentence_id)
        status.status = "learned"
        status.learned_at = datetime.now()
        status.review_stage = 0
        status.next_review_at = self.calculate_next_review(0)
        self.db.commit()
        self.db.refresh(status)
        return status

    def submit_answer(self, sentence_id: int, is_correct: bool) -> Dict[str, Any]:
        """提交答案（学习中）"""
        status = self.get_or_create_status(sentence_id)

        if is_correct:
            # 答对，标记为已学完
            self.mark_as_learned(sentence_id)
            return {
                "is_correct": True,
                "status": "learned",
                "message": "正确！进入复习队列"
            }
        else:
            # 答错，增加错误计数
            status.error_count += 1
            if status.error_count >= 3 and not status.in_error_book:
                status.in_error_book = True
            self.db.commit()

            return {
                "is_correct": False,
                "show_card": True,
                "status": status.status,
                "message": "错误，请查看翻译"
            }

    def complete_review(self, sentence_id: int, is_correct: bool) -> SentenceStudyStatus:
        """完成复习"""
        status = self.get_or_create_status(sentence_id)

        if status.status != "learned":
            raise ValueError("句子不在复习状态")

        if is_correct:
            # 答对，推进艾宾浩斯
            status.review_stage += 1
            status.last_review_at = datetime.now()

            if status.review_stage >= len(ANKI_INTERVALS):
                status.status = "mastered"
                status.mastered_at = datetime.now()
                status.next_review_at = None
            else:
                status.next_review_at = self.calculate_next_review(status.review_stage)
        else:
            # 答错，重置到第一阶段或增加错误计数
            status.error_count += 1
            if status.error_count >= 3 and not status.in_error_book:
                status.in_error_book = True
            # 可以重置复习阶段或保持当前
            # status.review_stage = max(0, status.review_stage - 1)

        self.db.commit()
        self.db.refresh(status)
        return status

    def skip_sentence(self, sentence_id: int) -> SentenceStudyStatus:
        """斩句（直接掌握）"""
        status = self.get_or_create_status(sentence_id)
        status.status = "mastered"
        status.mastered_at = datetime.now()
        self.db.commit()
        self.db.refresh(status)
        return status

    def get_study_stats(self) -> Dict[str, int]:
        """获取学习统计"""
        return {
            "new": self.db.query(SentenceStudyStatus).filter(SentenceStudyStatus.status == "new").count(),
            "studying": self.db.query(SentenceStudyStatus).filter(SentenceStudyStatus.status == "studying").count(),
            "learned": self.db.query(SentenceStudyStatus).filter(SentenceStudyStatus.status == "learned").count(),
            "mastered": self.db.query(SentenceStudyStatus).filter(SentenceStudyStatus.status == "mastered").count(),
            "error_book": self.db.query(SentenceStudyStatus).filter(SentenceStudyStatus.in_error_book == True).count(),
            "today_to_review": self.db.query(SentenceStudyStatus).filter(
                SentenceStudyStatus.status == "learned",
                SentenceStudyStatus.next_review_at <= datetime.now()
            ).count()
        }
