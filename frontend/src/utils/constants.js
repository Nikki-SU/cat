/**
 * 常量定义
 */

// 颜色方案
export const COLORS = {
  primary: {
    blue: '#4DBBD5',
    green: '#00A087',
  },
  text: {
    main: '#3C5488',
    secondary: '#8491B4',
  },
  status: {
    error: '#E64B35',
    warning: '#F39B7F',
    success: '#00A087',
  },
}

// API 地址
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

// 文献跳转模式
export const JUMP_MODES = [
  { id: 'xml', label: 'XML源', description: '查看DOI元数据' },
  { id: 'doi', label: 'DOI直达', description: '跳转出版商页面' },
  { id: 'gff', label: '谷粉学术', description: '谷粉学术论坛搜索' },
]

// 学习模式
export const LEARNING_MODES = {
  word: 'word',
  sentence: 'sentence',
  translation: 'translation',
}

// 单词状态
export const WORD_STATUS = {
  new: { label: '新学', color: '#4DBBD5' },
  learning: { label: '学习中', color: '#F39B7F' },
  mastered: { label: '已掌握', color: '#00A087' },
}

// 复习模式
export const REVIEW_MODES = {
  interval: { id: 'interval', label: '间隔模式', description: '艾宾浩斯遗忘曲线' },
  strict: { id: 'strict', label: '严格模式', description: '必须连续答对' },
}

// 翻译练习模式
export const TRANSLATION_MODES = {
  normal: { id: 'normal', label: '突击模式', description: '直接显示原文' },
  strict: { id: 'strict', label: '严格模式', description: '先回忆后对照' },
}

// 文件类型
export const FILE_TYPES = {
  pdf: { icon: '📄', label: 'PDF' },
  doc: { icon: '📝', label: 'Word' },
  docx: { icon: '📝', label: 'Word' },
  epub: { icon: '📖', label: 'EPUB' },
  markdown: { icon: '📋', label: 'Markdown' },
}

// 笔记模式
export const NOTE_MODES = {
  inline: { id: 'inline', label: '行间模式', description: '笔记嵌入原文' },
  sidebar: { id: 'sidebar', label: '边栏模式', description: '右侧显示笔记' },
}

// 排版模式
export const LAYOUT_MODES = {
  '3:7': { id: '3:7', label: '3:7 布局', description: '左侧30%，右侧70%' },
  '3:5:2': { id: '3:5:2', label: '3:5:2 布局', description: '左侧30%，中间50%，右侧20%' },
}

// 翻译类型
export const TRANSLATION_TYPES = {
  en_to_cn: '英译中',
  cn_to_en: '中译英',
}

// 显示语言
export const DISPLAY_LANGUAGES = [
  { id: 'cn', label: '中文' },
  { id: 'en', label: 'English' },
]

// 显示详情
export const DISPLAY_DETAILS = [
  { id: 'detailed', label: '详细' },
  { id: 'brief', label: '简洁' },
]

// 追踪周期（小时）
export const TRACKING_INTERVALS = [6, 12, 24, 48, 72, 168]

// 单词队列长度选项
export const WORD_QUEUE_LENGTHS = [10, 20, 30, 50, 100]

// 题型
export const QUESTION_TYPES = [
  { id: 'en_select_cn', label: '英选义', description: '英文选中文释义' },
  { id: 'cn_select_en', label: '中选英', description: '中文选英文' },
  { id: 'en_select_def', label: '英选义详', description: '英文选详细释义' },
  { id: 'def_select_en', label: '义选英', description: '详细释义选英文' },
  { id: 'sent_select_cn', label: '句选中', description: '句子选中文翻译' },
  { id: 'sent_select_def', label: '句选义', description: '句子选释义' },
]

// 间隔复习天数
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60, 90, 180]

// 高亮颜色
export const HIGHLIGHT_COLORS = [
  { id: 'yellow', color: '#FEF3C7', label: '黄色' },
  { id: 'green', color: '#D1FAE5', label: '绿色' },
  { id: 'blue', color: '#DBEAFE', label: '蓝色' },
  { id: 'pink', color: '#FCE7F3', label: '粉色' },
  { id: 'purple', color: '#EDE9FE', label: '紫色' },
]

// 文献表导出格式
export const EXPORT_FORMATS = ['xlsx', 'csv', 'json']

// 数据同步状态
export const SYNC_STATUS = {
  idle: 'idle',
  syncing: 'syncing',
  success: 'success',
  error: 'error',
}
