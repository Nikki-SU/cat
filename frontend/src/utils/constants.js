/**
 * 常量定义
 */

// 颜色方案
export const COLORS = {
  primary: '#4DBBD5',      // 主蓝
  success: '#00A087',      // 主绿
  text: '#3C5488',        // 正文
  secondary: '#8491B4',   // 次要
  error: '#E64B35',        // 错误
  warning: '#F39B7F',      // 警告
  
  // 单词状态颜色
  newWord: '#E64B35',      // 未学习-红
  learning: '#F39B7F',     // 已学未掌握-黄
  mastered: '#00A087',     // 已掌握-绿
}

// 艾宾浩斯复习间隔（天）
export const ANKI_INTERVALS = [1, 3, 7, 14, 30, 60, 90, 180]

// 题型定义
export const QUESTION_TYPES = {
  en_select_cn: {
    key: 'en_select_cn',
    name: '英选中',
    question_field: 'word_en',
    answer_field: 'word_cn',
    icon: '🔤'
  },
  cn_select_en: {
    key: 'cn_select_en',
    name: '中选英',
    question_field: 'word_cn',
    answer_field: 'word_en',
    icon: '🔤'
  },
  en_select_def: {
    key: 'en_select_def',
    name: '英选定义',
    question_field: 'word_en',
    answer_field: 'definition_cn',
    icon: '📖'
  },
  def_select_en: {
    key: 'def_select_en',
    name: '定义选英',
    question_field: 'definition_cn',
    answer_field: 'word_en',
    icon: '📖'
  },
  sent_select_cn: {
    key: 'sent_select_cn',
    name: '例句选中',
    question_field: 'sentence',
    answer_field: 'word_cn',
    icon: '📝',
    has_blank: true
  },
  sent_select_def: {
    key: 'sent_select_def',
    name: '例句选定义',
    question_field: 'sentence',
    answer_field: 'definition_cn',
    icon: '📝',
    has_blank: true
  },
}

// 题型列表
export const QUESTION_TYPE_LIST = Object.values(QUESTION_TYPES)

// 学习模式
export const STUDY_MODES = {
  learn: {
    key: 'learn',
    name: '学习',
    description: '学习新词和复习'
  },
  review: {
    key: 'review',
    name: '复习',
    description: '复习到期的单词'
  },
  error_book: {
    key: 'error_book',
    name: '错词本',
    description: '复习错词'
  }
}

// 队列长度选项
export const QUEUE_LENGTH_OPTIONS = [5, 7, 9]

// 掌握条件选项
export const MASTER_COUNT_OPTIONS = [6, 12, 18]

// 单词状态
export const WORD_STATUS = {
  new: {
    key: 'new',
    name: '新词',
    color: COLORS.newWord
  },
  learning: {
    key: 'learning',
    name: '学习中',
    color: COLORS.learning
  },
  learned: {
    key: 'learned',
    name: '已学',
    color: COLORS.learning
  },
  mastered: {
    key: 'mastered',
    name: '已掌握',
    color: COLORS.mastered
  }
}

// 默认学习设置
export const DEFAULT_STUDY_SETTINGS = {
  word_queue_length: 5,
  allow_zhan: true,
  master_count: 12,
  question_types: ['en_select_cn'],
  voice_enabled: true
}

// 标签类型
export const TAG_TYPES = {
  keyword: { key: 'keyword', name: '关键词', icon: '🏷️' },
  method: { key: 'method', name: '研究方法', icon: '🔬' },
  result: { key: 'result', name: '研究结果', icon: '📊' },
  conclusion: { key: 'conclusion', name: '结论', icon: '💡' },
  limitation: { key: 'limitation', name: '局限性', icon: '⚠️' },
  future: { key: 'future', name: '未来工作', icon: '🚀' }
}

// 文献阅读状态
export const READING_STATUS = {
  unread: { key: 'unread', name: '未读', color: '#E64B35' },
  reading: { key: 'reading', name: '阅读中', color: '#F39B7F' },
  read: { key: 'read', name: '已读', color: '#00A087' }
}

// 笔记类型
export const NOTE_TYPES = {
  highlight: { key: 'highlight', name: '高亮标注', icon: '🖍️' },
  note: { key: 'note', name: '笔记', icon: '📝' },
  question: { key: 'question', name: '疑问', icon: '❓' },
  idea: { key: 'idea', name: '想法', icon: '💡' },
  reference: { key: 'reference', name: '引用', icon: '📚' }
}

// 导出格式
export const EXPORT_FORMATS = {
  xlsx: { key: 'xlsx', name: 'Excel', icon: '📊', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  csv: { key: 'csv', name: 'CSV', icon: '📄', mime: 'text/csv' },
  json: { key: 'json', name: 'JSON', icon: '📋', mime: 'application/json' }
}

// 日期格式
export const DATE_FORMATS = {
  short: 'YYYY-MM-DD',
  long: 'YYYY-MM-DD HH:mm',
  full: 'YYYY-MM-DD HH:mm:ss'
}
