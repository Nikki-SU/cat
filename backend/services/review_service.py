"""
复习调度服务 - 艾宾浩斯遗忘曲线和严格模式
"""
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from models.learning import Word, LongSentence


# 间隔模式复习间隔（天）
INTERVAL_MODE_DAYS = [1, 2, 4, 7, 15, 30, 60]

# 严格模式配置
STRICT_MODE_FIRST_ROUNDS = 3  # 前三轮每天复习
STRICT_MODE_BI_MONTHLY_ROUNDS = 3  # 半月复习需连续3轮全对
STRICT_MODE_BI_MONTHLY_DAYS = 15  # 半月复习间隔


def calculate_next_review(
    word_or_sentence,
    mode: str,
    correct: bool,
    now: datetime = None
) -> dict:
    """
    计算下次复习时间
    
    Args:
        word_or_sentence: 单词或长难句对象
        mode: 'interval' 或 'strict'
        correct: 本次是否正确
        now: 当前时间（可选，默认datetime.now）
    
    Returns:
        dict: 包含 next_review, review_count, correct_streak, status 的字典
    """
    if now is None:
        now = datetime.now()
    
    result = {
        'last_review': now,
    }
    
    if mode == 'interval':
        # 间隔模式：艾宾浩斯遗忘曲线
        result.update(_calculate_interval_mode(word_or_sentence, correct, now))
    
    elif mode == 'strict':
        # 严格模式：连续正确次数决定复习频率
        result.update(_calculate_strict_mode(word_or_sentence, correct, now))
    
    return result


def _calculate_interval_mode(item, correct: bool, now: datetime) -> dict:
    """间隔模式计算逻辑"""
    intervals = INTERVAL_MODE_DAYS
    
    if correct:
        # 答对：进入下一个间隔
        new_review_count = (item.review_count or 0) + 1
        new_streak = (item.correct_streak or 0) + 1
        
        # 获取对应间隔
        idx = min(new_review_count - 1, len(intervals) - 1)
        days_to_add = intervals[idx]
        next_review = now + timedelta(days=days_to_add)
        
        # 判断是否已掌握（走完整个序列）
        status = 'mastered' if new_review_count >= len(intervals) else 'learning'
        
        return {
            'review_count': new_review_count,
            'correct_streak': new_streak,
            'next_review': next_review,
            'status': status,
        }
    else:
        # 答错：回到第一个间隔
        return {
            'review_count': 1,
            'correct_streak': 0,
            'next_review': now + timedelta(days=intervals[0]),
            'status': 'learning',
        }


def _calculate_strict_mode(item, correct: bool, now: datetime) -> dict:
    """严格模式计算逻辑"""
    current_count = (item.review_count or 0)
    current_streak = (item.correct_streak or 0)
    
    if correct:
        # 答对
        new_count = current_count + 1
        new_streak = current_streak + 1
        
        if new_count <= STRICT_MODE_FIRST_ROUNDS:
            # 前三轮：每天复习
            next_review = now + timedelta(days=1)
        else:
            # 半月复习
            next_review = now + timedelta(days=STRICT_MODE_BI_MONTHLY_DAYS)
        
        # 判断是否已掌握：半月复习且连续3轮全对
        is_mastered = (
            new_count > STRICT_MODE_FIRST_ROUNDS and
            new_streak >= STRICT_MODE_BI_MONTHLY_ROUNDS
        )
        
        return {
            'review_count': new_count,
            'correct_streak': new_streak,
            'next_review': next_review,
            'status': 'mastered' if is_mastered else 'learning',
        }
    else:
        # 答错：重置连续正确次数，但不重置总复习次数
        return {
            'correct_streak': 0,
            'next_review': now + timedelta(days=1),  # 明天继续
            'status': 'learning',
        }


def get_review_queue(db: Session, model_class, limit: int = 20) -> List:
    """
    获取待复习队列
    
    Args:
        db: 数据库会话
        model_class: Word 或 LongSentence
        limit: 返回数量限制
    
    Returns:
        待复习项列表
    """
    now = datetime.now()
    
    return db.query(model_class).filter(
        model_class.status != 'mastered',
        (model_class.next_review == None) | (model_class.next_review <= now)
    ).order_by(
        # 优先：新学 > 即将到期 > 其他
        model_class.status.asc(),  # 'new' < 'learning'
        model_class.next_review.asc().nullsfirst()
    ).limit(limit).all()


def get_stats(db: Session, model_class) -> dict:
    """
    获取统计数据
    
    Args:
        db: 数据库会话
        model_class: Word 或 LongSentence
    
    Returns:
        dict: {new: count, learning: count, mastered: count, total: count}
    """
    new_count = db.query(model_class).filter(model_class.status == 'new').count()
    learning_count = db.query(model_class).filter(model_class.status == 'learning').count()
    mastered_count = db.query(model_class).filter(model_class.status == 'mastered').count()
    
    return {
        'new': new_count,
        'learning': learning_count,
        'mastered': mastered_count,
        'total': new_count + learning_count + mastered_count,
    }


def update_review_status(
    db: Session,
    item_id: int,
    model_class,
    mode: str,
    correct: bool
) -> Optional[dict]:
    """
    更新复习状态
    
    Args:
        db: 数据库会话
        item_id: 项目ID
        model_class: Word 或 LongSentence
        mode: 'interval' 或 'strict'
        correct: 是否正确
    
    Returns:
        更新后的对象，或 None（如果不存在）
    """
    item = db.query(model_class).filter(model_class.id == item_id).first()
    if not item:
        return None
    
    updates = calculate_next_review(item, mode, correct)
    
    for key, value in updates.items():
        setattr(item, key, value)
    
    db.commit()
    db.refresh(item)
    return item


def mark_as_mastered(
    db: Session,
    item_id: int,
    model_class
) -> Optional[dict]:
    """
    直接标记为已掌握（斩）
    """
    item = db.query(model_class).filter(model_class.id == item_id).first()
    if not item:
        return None
    
    item.status = 'mastered'
    item.correct_streak = 999  # 标记为已斩
    item.next_review = None
    
    db.commit()
    db.refresh(item)
    return item
