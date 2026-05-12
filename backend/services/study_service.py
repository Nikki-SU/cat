"""
学习服务 - 处理单词学习逻辑
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models.learning import Word, WordStudyStatus, StudySession, StudySettings
from schemas.learning import Question, AnswerResult

# 艾宾浩斯复习间隔（天）
ANKI_INTERVALS = [1, 3, 7, 14, 30, 60, 90, 180]

# 六种题型定义
QUESTION_TYPES = {
    "en_select_cn": {"name": "英选中", "question_field": "word_en", "answer_field": "word_cn"},
    "cn_select_en": {"name": "中选英", "question_field": "word_cn", "answer_field": "word_en"},
    "en_select_def": {"name": "英选定义", "question_field": "word_en", "answer_field": "definition_cn"},  # 学习时用中文定义
    "def_select_en": {"name": "定义选英", "question_field": "definition_cn", "answer_field": "word_en"},
    "sent_select_cn": {"name": "例句选中", "question_field": "sentence", "answer_field": "word_cn", "blank": True},
    "sent_select_def": {"name": "例句选定义", "question_field": "sentence", "answer_field": "definition_cn", "blank": True},  # 学习时用中文定义
}


class StudyService:
    """学习服务"""

    def __init__(self, db: Session):
        self.db = db

    def get_or_create_settings(self) -> StudySettings:
        """获取或创建设置"""
        settings = self.db.query(StudySettings).first()
        if not settings:
            settings = StudySettings()
            self.db.add(settings)
            self.db.commit()
            self.db.refresh(settings)
        return settings

    def initialize_all_words_status(self):
        """为所有没有学习状态的单词创建状态记录"""
        from models.learning import Word

        # 获取所有单词
        all_words = self.db.query(Word).all()

        # 获取已有状态的单词ID
        existing_status_ids = {s.word_id for s in self.db.query(WordStudyStatus.word_id).all()}

        # 为新单词创建状态
        new_statuses = []
        for word in all_words:
            if word.id not in existing_status_ids:
                status = WordStudyStatus(
                    word_id=word.id,
                    status="new"
                )
                new_statuses.append(status)

        if new_statuses:
            self.db.bulk_save_objects(new_statuses)
            self.db.commit()
            print(f"Initialized {len(new_statuses)} word study statuses")

    def update_settings(self, **kwargs) -> StudySettings:
        """更新设置"""
        settings = self.get_or_create_settings()
        for key, value in kwargs.items():
            if hasattr(settings, key):
                setattr(settings, key, value)
        self.db.commit()
        self.db.refresh(settings)
        return settings

    def get_or_create_word_status(self, word_id: int) -> WordStudyStatus:
        """获取或创建单词学习状态"""
        status = self.db.query(WordStudyStatus).filter(
            WordStudyStatus.word_id == word_id
        ).first()
        if not status:
            status = WordStudyStatus(word_id=word_id, status="new")
            self.db.add(status)
            self.db.commit()
            self.db.refresh(status)
        return status

    def calculate_next_review(self, review_stage: int) -> Optional[datetime]:
        """计算下次复习时间（艾宾浩斯）"""
        if review_stage >= len(ANKI_INTERVALS):
            return None  # 已掌握，无需复习
        days = ANKI_INTERVALS[review_stage]
        return datetime.now() + timedelta(days=days)

    def get_learning_queue(self, queue_length: int) -> List[int]:
        """
        获取学习队列
        优先级：studying状态（未完成的）> new状态
        """
        # 先初始化所有单词的状态
        self.initialize_all_words_status()

        # 1. 先取studying状态的词（已开始但未完成一轮）
        studying_words = self.db.query(WordStudyStatus).filter(
            WordStudyStatus.status == "studying"
        ).order_by(WordStudyStatus.updated_at.asc()).limit(queue_length).all()

        queue = [s.word_id for s in studying_words]

        # 2. 如果不足，补充new状态的词
        if len(queue) < queue_length:
            need_more = queue_length - len(queue)
            new_words = self.db.query(WordStudyStatus).filter(
                WordStudyStatus.status == "new"
            ).order_by(WordStudyStatus.created_at.asc()).limit(need_more).all()
            queue.extend([s.word_id for s in new_words])

        return queue

    def get_review_queue(self, queue_length: int) -> List[int]:
        """
        获取复习队列
        取learned状态且到达复习时间的词
        """
        now = datetime.now()
        review_words = self.db.query(WordStudyStatus).filter(
            WordStudyStatus.status == "learned",
            WordStudyStatus.next_review_at <= now
        ).order_by(WordStudyStatus.next_review_at.asc()).limit(queue_length).all()

        return [s.word_id for s in review_words]

    def get_error_book_queue(self, queue_length: int) -> List[int]:
        """获取错词本队列"""
        error_words = self.db.query(WordStudyStatus).filter(
            WordStudyStatus.in_error_book == True
        ).order_by(WordStudyStatus.error_count.desc()).limit(queue_length).all()

        return [s.word_id for s in error_words]

    def generate_question(
        self,
        word_id: int,
        q_type: str,
        mode: str,  # "learn" | "review"
        all_word_ids: List[int]
    ) -> Optional[Question]:
        """生成一道题目"""
        word = self.db.query(Word).filter(Word.id == word_id).first()
        if not word:
            return None

        type_config = QUESTION_TYPES.get(q_type)
        if not type_config:
            return None

        # 获取问题和答案字段
        question_field = type_config["question_field"]
        answer_field = type_config["answer_field"]

        # 学习/复习语言切换（英选定义、例句选定义）
        if q_type in ["en_select_def", "sent_select_def"]:
            if mode == "review":
                answer_field = "definition_en"  # 复习时用英文定义

        # 获取值
        question_value = getattr(word, question_field, "")
        correct_answer = getattr(word, answer_field, "")

        # 检查是否有值，没有则跳过此题型
        if not question_value or not correct_answer:
            return None

        # 例句题型需要挖空
        if type_config.get("blank") and word.word_en:
            question_value = question_value.replace(word.word_en, "_____")

        # 生成干扰项（从其他单词的相同字段取）
        distractors = self._generate_distractors(
            correct_answer, all_word_ids, answer_field, exclude_word_id=word_id
        )

        # 组合选项（1正确 + 3干扰）
        options = [correct_answer] + distractors[:3]
        import random
        random.shuffle(options)

        return Question(
            word_id=word_id,
            type=q_type,
            type_name=type_config["name"],
            question=question_value,
            options=options,
            correct_answer=correct_answer,
            word_data={
                "word_en": word.word_en,
                "word_cn": word.word_cn,
                "definition_en": word.definition_en,
                "definition_cn": word.definition_cn,
                "sentence": word.sentence
            }
        )

    def _generate_distractors(
        self,
        correct: str,
        all_word_ids: List[int],
        field: str,
        exclude_word_id: int,
        count: int = 3
    ) -> List[str]:
        """生成干扰项"""
        distractors = []
        candidates = self.db.query(Word).filter(
            Word.id.in_([wid for wid in all_word_ids if wid != exclude_word_id])
        ).all()

        for word in candidates:
            value = getattr(word, field, "")
            if value and value.strip() and value != correct and value not in distractors:
                distractors.append(value)
                if len(distractors) >= count:
                    break

        return distractors

    def start_study_session(
        self,
        mode: str,  # "learn" | "review" | "error_book"
        queue_length: int,
        selected_types: List[str]
    ) -> StudySession:
        """开始学习会话"""
        # 获取队列
        if mode == "learn":
            queue = self.get_learning_queue(queue_length)
        elif mode == "review":
            queue = self.get_review_queue(queue_length)
        else:  # error_book
            queue = self.get_error_book_queue(queue_length)

        if not queue:
            raise ValueError("没有可用的单词")

        # 清理旧会话
        self.db.query(StudySession).filter(StudySession.is_active == True).update({
            "is_active": False
        })

        # 创建新会话
        first_type = selected_types[0] if selected_types else "en_select_cn"
        session = StudySession(
            mode=mode,
            queue_length=queue_length,
            selected_types=selected_types,
            queue=queue,
            current_word_idx=0,
            current_type=first_type,
            wrong_queue=[],
            completed_words_in_type=[]
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

        return session

    def get_current_question(self, session_id: int) -> Optional[Dict]:
        """获取当前题目"""
        session = self.db.query(StudySession).filter(
            StudySession.id == session_id,
            StudySession.is_active == True
        ).first()

        if not session or not session.queue:
            return None

        current_word_id = session.queue[session.current_word_idx]

        # 如果有错题队列，优先做错的
        if session.wrong_queue:
            current_word_id = session.wrong_queue[0]

        question = self.generate_question(
            current_word_id,
            session.current_type,
            session.mode,
            session.queue
        )

        return {
            "session_id": session.id,
            "mode": session.mode,
            "total_words": len(session.queue),
            "current_idx": session.current_word_idx + 1,
            "current_type": session.current_type,
            "type_name": QUESTION_TYPES.get(session.current_type, {}).get("name", ""),
            "question": question,
            "is_retry": len(session.wrong_queue) > 0
        }

    def submit_answer(
        self,
        session_id: int,
        word_id: int,
        answer: str
    ) -> AnswerResult:
        """提交答案"""
        session = self.db.query(StudySession).filter(
            StudySession.id == session_id,
            StudySession.is_active == True
        ).first()

        if not session:
            raise ValueError("会话不存在或已结束")

        # 获取题目
        question = self.generate_question(
            word_id, session.current_type, session.mode, session.queue
        )

        if not question:
            raise ValueError("题目生成失败")

        is_correct = (answer == question.correct_answer)

        # 更新单词状态
        word_status = self.get_or_create_word_status(word_id)

        if is_correct:
            # 答对
            if word_id not in session.completed_words_in_type:
                session.completed_words_in_type.append(word_id)

            # 如果是重做题，从错题队列移除
            if word_id in session.wrong_queue:
                session.wrong_queue.remove(word_id)

            # 更新学习进度
            if not word_status.completed_types:
                word_status.completed_types = []
            if session.current_type not in word_status.completed_types:
                word_status.completed_types.append(session.current_type)

            # 检查是否完成本轮所有题型
            all_types_completed = all(t in word_status.completed_types for t in session.selected_types)

            if all_types_completed and word_status.status in ["new", "studying"]:
                # 完成一轮，进入learned状态
                word_status.status = "learned"
                word_status.learned_at = datetime.now()
                word_status.review_stage = 0
                word_status.next_review_at = self.calculate_next_review(0)

            elif not all_types_completed and word_status.status == "new":
                # 开始学习中
                word_status.status = "studying"
                word_status.card_shown = True

            # 检查是否要进入下一轮题型
            type_finished = len(session.completed_words_in_type) >= len(session.queue)

            return AnswerResult(
                is_correct=True,
                show_card=False,
                word_status=word_status.status,
                type_finished=type_finished,
                session_finished=False
            )

        else:
            # 答错
            word_status.error_count += 1
            if word_status.error_count >= 3 and not word_status.in_error_book:
                word_status.in_error_book = True

            # 加入错题队列（如果还没在）
            if word_id not in session.wrong_queue:
                session.wrong_queue.append(word_id)

            return AnswerResult(
                is_correct=False,
                show_card=True,
                word_status=word_status.status,
                type_finished=False,
                session_finished=False,
                card_data=question.word_data
            )

    def show_card_and_continue(self, session_id: int, word_id: int) -> Dict:
        """显示卡片后继续（重做同一题）"""
        session = self.db.query(StudySession).filter(
            StudySession.id == session_id,
            StudySession.is_active == True
        ).first()

        if not session:
            raise ValueError("会话不存在")

        # 返回同一题重做
        return self.get_current_question(session_id)

    def next_question(self, session_id: int) -> Optional[Dict]:
        """下一题"""
        session = self.db.query(StudySession).filter(
            StudySession.id == session_id,
            StudySession.is_active == True
        ).first()

        if not session:
            return None

        # 如果还有错题，继续做题对队错题
        if session.wrong_queue:
            return self.get_current_question(session_id)

        # 当前题型已完成所有词
        if session.current_word_idx >= len(session.queue) - 1:
            # 检查是否还有下一题型
            current_type_idx = session.selected_types.index(session.current_type)
            if current_type_idx < len(session.selected_types) - 1:
                # 切换到下一题型
                session.current_type = session.selected_types[current_type_idx + 1]
                session.current_word_idx = 0
                session.completed_words_in_type = []
                session.wrong_queue = []
                self.db.commit()
                return self.get_current_question(session_id)
            else:
                # 所有题型完成，结束会话
                session.is_active = False
                self.db.commit()
                return None
        else:
            # 同一题型的下一词
            session.current_word_idx += 1
            self.db.commit()
            return self.get_current_question(session_id)

    def skip_word(self, word_id: int) -> WordStudyStatus:
        """斩词（直接标记为已掌握）"""
        settings = self.get_or_create_settings()
        if not settings.allow_skip:
            raise ValueError("当前设置不允许斩词")

        word_status = self.get_or_create_word_status(word_id)
        word_status.status = "mastered"
        word_status.mastered_at = datetime.now()
        self.db.commit()
        self.db.refresh(word_status)

        return word_status

    def get_study_stats(self) -> Dict:
        """获取学习统计"""
        stats = {
            "new": self.db.query(WordStudyStatus).filter(WordStudyStatus.status == "new").count(),
            "studying": self.db.query(WordStudyStatus).filter(WordStudyStatus.status == "studying").count(),
            "learned": self.db.query(WordStudyStatus).filter(WordStudyStatus.status == "learned").count(),
            "mastered": self.db.query(WordStudyStatus).filter(WordStudyStatus.status == "mastered").count(),
            "error_book": self.db.query(WordStudyStatus).filter(WordStudyStatus.in_error_book == True).count(),
            "today_to_review": self.db.query(WordStudyStatus).filter(
                WordStudyStatus.status == "learned",
                WordStudyStatus.next_review_at <= datetime.now()
            ).count()
        }
        return stats

    def complete_review(self, word_id: int) -> WordStudyStatus:
        """完成一次复习"""
        word_status = self.get_or_create_word_status(word_id)

        if word_status.status != "learned":
            raise ValueError("单词不在复习状态")

        # 推进艾宾浩斯阶段
        word_status.review_stage += 1
        word_status.last_review_at = datetime.now()

        # 检查是否已掌握（完成所有艾宾浩斯间隔）
        if word_status.review_stage >= len(ANKI_INTERVALS):
            word_status.status = "mastered"
            word_status.mastered_at = datetime.now()
            word_status.next_review_at = None
        else:
            # 设置下次复习时间
            word_status.next_review_at = self.calculate_next_review(word_status.review_stage)

        self.db.commit()
        self.db.refresh(word_status)
        return word_status
