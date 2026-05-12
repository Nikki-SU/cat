/**
 * 句子着色工具函数
 * 
 * 支持：
 * - 按句子分割文本（支持中英文标点）
 * - 交替着色显示
 * - 自定义配色方案
 */

import { SENTENCE_COLOR_SCHEMES } from '../stores/useDeepReadStore'

/**
 * 按句子分割文本
 * 支持：英文句号、问号、感叹号、中文句号、中文问号、中文感叹号
 * 
 * @param {string} text - 要分割的文本
 * @returns {string[]} - 句子数组
 */
export const splitSentences = (text) => {
  if (!text) return []
  
  // 匹配句子：任何非句末标点的字符 + 句末标点
  // 标点包括：. ! ? 。 ！ ？
  const sentenceRegex = /[^.!?。！？]+[.!?。！？]+/g
  const matches = text.match(sentenceRegex)
  
  if (!matches) {
    // 如果没有找到句子，返回整个文本作为一个句子
    return [text]
  }
  
  // 清理每个句子
  return matches.map(s => s.trim()).filter(s => s.length > 0)
}

/**
 * 获取配色方案
 * 
 * @param {string} schemeId - 配色方案 ID
 * @returns {object} - 配色方案对象
 */
export const getSentenceColorScheme = (schemeId) => {
  return SENTENCE_COLOR_SCHEMES[schemeId] || SENTENCE_COLOR_SCHEMES.none
}

/**
 * 检查是否启用句子着色
 * 
 * @param {string} schemeId - 配色方案 ID
 * @returns {boolean} - 是否启用
 */
export const isSentenceColoringEnabled = (schemeId) => {
  return schemeId && schemeId !== 'none'
}

/**
 * 获取句子的背景色
 * 
 * @param {number} index - 句子索引
 * @param {string} schemeId - 配色方案 ID
 * @returns {string} - CSS 颜色值
 */
export const getSentenceBackgroundColor = (index, schemeId) => {
  const scheme = getSentenceColorScheme(schemeId)
  if (!isSentenceColoringEnabled(schemeId)) {
    return 'transparent'
  }
  return index % 2 === 0 ? scheme.odd : scheme.even
}

/**
 * 渲染带句子着色的文本
 * React JSX 版本
 * 
 * @param {string} text - 原文本
 * @param {string} schemeId - 配色方案 ID
 * @returns {JSX.Element} - 渲染后的元素
 */
export const renderSentenceColoredText = (text, schemeId) => {
  if (!isSentenceColoringEnabled(schemeId)) {
    return <span>{text}</span>
  }
  
  const sentences = splitSentences(text)
  
  return (
    <span>
      {sentences.map((sentence, idx) => (
        <span
          key={idx}
          style={{
            backgroundColor: getSentenceBackgroundColor(idx, schemeId),
            padding: '2px 4px',
            borderRadius: '3px',
            transition: 'background-color 0.2s',
          }}
        >
          {sentence}
        </span>
      ))}
    </span>
  )
}
