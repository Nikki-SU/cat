/**
 * 辅助函数
 */

/**
 * 格式化日期
 * @param {string|Date} date - 日期
 * @param {string} format - 格式 'full'|'date'|'time'|'relative'
 * @returns {string}
 */
export function formatDate(date, format = 'date') {
  if (!date) return ''
  
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  
  const now = new Date()
  const diff = now - d
  
  switch (format) {
    case 'full':
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    case 'date':
      return d.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    case 'time':
      return d.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    case 'relative':
      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
      return formatDate(d, 'date')
    default:
      return d.toLocaleDateString()
  }
}

/**
 * 截断文本
 * @param {string} text - 文本
 * @param {number} maxLength - 最大长度
 * @param {string} suffix - 省略号
 * @returns {string}
 */
export function truncate(text, maxLength = 50, suffix = '...') {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - suffix.length) + suffix
}

/**
 * 解析作者列表
 * @param {string|Array} authors - 作者字符串或数组
 * @returns {string}
 */
export function parseAuthors(authors) {
  if (!authors) return ''
  if (Array.isArray(authors)) {
    return authors.map(a => {
      if (typeof a === 'string') return a
      return `${a.family || ''} ${a.given || ''}`.trim()
    }).join(', ')
  }
  return authors
}

/**
 * 获取第一作者
 * @param {string|Array} authors - 作者
 * @returns {string}
 */
export function getFirstAuthor(authors) {
  const parsed = parseAuthors(authors)
  const parts = parsed.split(',')
  return parts[0]?.trim() || ''
}

/**
 * 复制到剪贴板
 * @param {string} text - 文本
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      document.body.removeChild(textarea)
      return true
    } catch (e) {
      document.body.removeChild(textarea)
      return false
    }
  }
}

/**
 * 下载文件
 * @param {Blob|string} content - 文件内容
 * @param {string} filename - 文件名
 * @param {string} mimeType - MIME类型
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 防抖
 * @param {Function} fn - 函数
 * @param {number} delay - 延迟（毫秒）
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

/**
 * 节流
 * @param {Function} fn - 函数
 * @param {number} limit - 间隔（毫秒）
 * @returns {Function}
 */
export function throttle(fn, limit = 300) {
  let inThrottle = false
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * 生成随机ID
 * @returns {string}
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 深拷贝
 * @param {any} obj - 对象
 * @returns {any}
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(deepClone)
  const cloned = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  return cloned
}

/**
 * 提取DOI
 * @param {string} text - 文本
 * @returns {string|null}
 */
export function extractDOI(text) {
  if (!text) return null
  const match = text.match(/10\.\d{4,}\/[^\s]+/)
  return match ? match[0] : null
}

/**
 * 验证DOI格式
 * @param {string} doi - DOI
 * @returns {boolean}
 */
export function isValidDOI(doi) {
  if (!doi) return false
  return /^10\.\d{4,}\/[^\s]+$/.test(doi)
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * 获取URL参数
 * @param {string} name - 参数名
 * @returns {string|null}
 */
export function getURLParam(name) {
  const params = new URLSearchParams(window.location.search)
  return params.get(name)
}

/**
 * 设置URL参数
 * @param {object} params - 参数对象
 */
export function setURLParams(params) {
  const url = new URL(window.location)
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      url.searchParams.delete(key)
    } else {
      url.searchParams.set(key, value)
    }
  })
  window.history.pushState({}, '', url)
}

/**
 * 计算下次复习时间（艾宾浩斯）
 * @param {number} correctStreak - 连续正确次数
 * @returns {Date}
 */
export function calculateNextReview(correctStreak) {
  const intervals = [1, 3, 7, 14, 30, 60, 90, 180] // 天数
  const days = intervals[Math.min(correctStreak, intervals.length - 1)]
  const next = new Date()
  next.setDate(next.getDate() + days)
  return next
}

/**
 * 打乱数组顺序
 * @param {Array} array - 数组
 * @returns {Array}
 */
export function shuffleArray(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * 等待指定时间
 * @param {number} ms - 毫秒
 * @returns {Promise}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 清除对象空值
 * @param {object} obj - 对象
 * @returns {object}
 */
export function cleanObject(obj) {
  const cleaned = {}
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      cleaned[key] = value
    }
  })
  return cleaned
}

/**
 * 解析Markdown为纯文本
 * @param {string} markdown - Markdown文本
 * @returns {string}
 */
export function markdownToPlainText(markdown) {
  if (!markdown) return ''
  return markdown
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/!\[.+?\]\(.+?\)/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/**
 * 判断是否为移动设备
 * @returns {boolean}
 */
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

/**
 * 判断是否为竖屏
 * @returns {boolean}
 */
export function isPortrait() {
  return window.innerHeight > window.innerWidth
}
