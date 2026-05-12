/**
 * 辅助函数
 */
import { ANKI_INTERVALS } from './constants'

/**
 * 计算下次复习时间
 * @param {number} stage - 当前艾宾浩斯阶段 (0-7)
 * @returns {Date|null} 下次复习时间
 */
export function calculateNextReview(stage) {
  if (stage >= ANKI_INTERVALS.length) {
    return null // 已掌握，无需复习
  }
  const days = ANKI_INTERVALS[stage]
  const next = new Date()
  next.setDate(next.getDate() + days)
  return next
}

/**
 * 获取艾宾浩斯阶段的天数
 * @param {number} stage - 当前阶段
 * @returns {number} 间隔天数
 */
export function getAnkiInterval(stage) {
  if (stage >= ANKI_INTERVALS.length) {
    return ANKI_INTERVALS[ANKI_INTERVALS.length - 1]
  }
  return ANKI_INTERVALS[stage]
}

/**
 * 格式化日期
 * @param {Date|string} date - 日期
 * @param {string} format - 格式
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date, format = 'YYYY-MM-DD') {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

/**
 * 计算相对时间
 * @param {Date|string} date - 日期
 * @returns {string} 相对时间描述
 */
export function getRelativeTime(date) {
  if (!date) return ''
  const now = new Date()
  const d = new Date(date)
  const diff = d - now
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor(diff / (1000 * 60))
  
  if (days > 0) {
    return `${days}天后`
  } else if (days < 0) {
    return `${Math.abs(days)}天前`
  } else if (hours > 0) {
    return `${hours}小时后`
  } else if (hours < 0) {
    return `${Math.abs(hours)}小时前`
  } else if (minutes > 0) {
    return `${minutes}分钟后`
  } else if (minutes < 0) {
    return `${Math.abs(minutes)}分钟前`
  } else {
    return '现在'
  }
}

/**
 * 生成选项字母
 * @param {number} index - 选项索引 (0-based)
 * @returns {string} 选项字母 (A, B, C, D)
 */
export function getOptionKey(index) {
  return String.fromCharCode(65 + index)
}

/**
 * 打乱数组
 * @param {Array} array - 原始数组
 * @returns {Array} 打乱后的新数组
 */
export function shuffleArray(array) {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

/**
 * 生成选择题选项
 * @param {string} correct - 正确答案
 * @param {Array} candidates - 候选项数组
 * @param {number} count - 选项数量，默认4个
 * @returns {Array} 打乱后的选项数组
 */
export function generateOptions(correct, candidates, count = 4) {
  const distractors = candidates.filter(c => c !== correct && c.trim())
  const shuffled = shuffleArray(distractors)
  const options = [correct, ...shuffled.slice(0, count - 1)]
  return shuffleArray(options)
}

/**
 * 检测是否到期复习
 * @param {Date|string} nextReview - 下次复习时间
 * @returns {boolean} 是否到期
 */
export function isDueReview(nextReview) {
  if (!nextReview) return false
  return new Date(nextReview) <= new Date()
}

/**
 * 获取单词状态对应的颜色
 * @param {string} status - 单词状态
 * @returns {string} 颜色代码
 */
export function getWordStatusColor(status) {
  const colors = {
    new: '#E64B35',
    learning: '#F39B7F',
    learned: '#F39B7F',
    mastered: '#00A087'
  }
  return colors[status] || colors.new
}

/**
 * 文本截断
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的文本
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * 提取例句中的单词（用于挖空）
 * @param {string} sentence - 原始例句
 * @param {string} word - 要挖空的单词
 * @returns {string} 挖空后的例句
 */
export function createBlankSentence(sentence, word) {
  if (!sentence || !word) return sentence
  const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return sentence.replace(regex, '_____', 1)
}

/**
 * 高亮文本中的关键词
 * @param {string} text - 原始文本
 * @param {string} keyword - 关键词
 * @returns {React.ReactNode} 高亮后的文本
 */
export function highlightKeyword(text, keyword) {
  if (!text || !keyword) return text
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) => 
    regex.test(part) ? <mark key={i} className="bg-yellow-200">{part}</mark> : part
  )
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间(毫秒)
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait = 300) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * 深拷贝
 * @param {any} obj - 要拷贝的对象
 * @returns {any} 拷贝后的对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(deepClone)
  const cloned = {}
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  return cloned
}

/**
 * 获取选项的百分比
 * @param {number} value - 当前值
 * @param {number} total - 总数
 * @returns {string} 百分比字符串
 */
export function getPercentage(value, total) {
  if (!total) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

/**
 * 生成UUID
 * @returns {string} UUID
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * 朗读文本
 * @param {string} text - 要朗读的文本
 * @param {string} lang - 语言代码，默认 en-US
 */
export function speakText(text, lang = 'en-US') {
  if (!text || !window.speechSynthesis) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = 0.8
  utterance.pitch = 1
  speechSynthesis.speak(utterance)
}
