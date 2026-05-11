/**
 * DeepRead专用状态管理 - 修正版
 * 
 * 布局说明：
 * - 学者模式 (30%:70%): 左=颜色结构栏, 右=文献+行间笔记
 * - 双栏模式 (30%:50%:20%): 左=颜色结构栏, 中=纯文献, 右=边栏笔记
 * 
 * 笔记位置：
 * - 学者模式：笔记在文献对应段落旁边（行间）
 * - 双栏模式：笔记集中在右栏（边栏），但仍锚定到文献位置
 */
import { create } from 'zustand'
import { structuredAPI, learningAPI } from '../api/client'

// ==================== 常量 ====================

export const LAYOUT_MODES = {
  scholar: { 
    id: 'scholar', 
    label: '学者模式', 
    // 左30%: 颜色结构+长难句+单词, 右70%: 文献+行间笔记
    grid: 'grid-cols-[300px_1fr]',
    leftWidth: 'w-[300px]',
    centerWidth: 'flex-1',
    rightWidth: null, // 无独立右栏，笔记在文献内
    notePosition: 'inline' // 行间笔记
  },
  dual: { 
    id: 'dual', 
    label: '双栏模式', 
    // 左30%: 颜色结构+长难句+单词, 中50%: 纯文献, 右20%: 边栏笔记
    grid: 'grid-cols-[280px_1fr_280px]',
    leftWidth: 'w-[280px]',
    centerWidth: 'flex-1',
    rightWidth: 'w-[280px]',
    notePosition: 'sidebar' // 边栏笔记
  }
}

export const READ_MODES = {
  read: { id: 'read', label: '阅读', icon: '📖', description: '可高亮批注，不可改原文' },
  edit: { id: 'edit', label: '编辑', icon: '✏️', description: '可直接修改原文' }
}

// 颜色-结构映射（用于高亮文献）
export const COLOR_STRUCTURE = [
  { id: 'yellow', name: '方法', color: '#FEF08A', textColor: '#854D0E', keywords: ['method', 'approach', 'procedure'] },
  { id: 'green', name: '结果', color: '#BBF7D0', textColor: '#166534', keywords: ['result', 'finding', 'demonstrated'] },
  { id: 'blue', name: '讨论', color: '#BFDBFE', textColor: '#1E40AF', keywords: ['discuss', 'suggest', 'indicate'] },
  { id: 'pink', name: '结论', color: '#FBCFE8', textColor: '#9D174D', keywords: ['conclusion', 'therefore', 'thus'] },
  { id: 'orange', name: '背景', color: '#FED7AA', textColor: '#9A3412', keywords: ['background', 'introduction', 'previous'] }
]

// 单词状态样式
export const WORD_STATUS_COLORS = {
  new: { color: '#DC2626', fontWeight: 'bold', borderBottom: '2px solid #DC2626' },      // 红-新词
  learning: { color: '#D97706', fontWeight: 'bold', borderBottom: '2px solid #F59E0B' }, // 黄-学习中  
  mastered: { color: 'inherit', fontWeight: 'normal', borderBottom: 'none' }              // 正常-已掌握
}

// 长难句样式
export const SENTENCE_STYLES = {
  color: '#DC2626',
  background: 'rgba(254, 226, 226, 0.3)',
  padding: '2px 4px',
  borderRadius: '4px'
}

// ==================== 辅助函数 ====================

const parseParagraphs = (content) => {
  if (!content) return []
  const lines = content.split('\n')
  const paragraphs = []
  
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    if (!trimmed) return
    
    const type = detectType(trimmed)
    const suggestedColor = detectColor(trimmed)
    const plainText = stripMarkdown(trimmed)
    
    paragraphs.push({
      id: `p-${idx}`,
      index: idx,
      type,
      raw: trimmed,
      plainText,
      suggestedColor
    })
  })
  
  return paragraphs
}

const detectType = (line) => {
  if (line.startsWith('#')) return 'heading'
  if (line.startsWith('- ')) return 'bullet'
  if (/^\d+\./.test(line)) return 'numbered'
  if (line.startsWith('```')) return 'code'
  if (line.startsWith('>')) return 'quote'
  return 'paragraph'
}

const detectColor = (text) => {
  const lower = text.toLowerCase()
  for (const cs of COLOR_STRUCTURE) {
    if (cs.keywords.some(k => lower.includes(k))) return cs
  }
  return null
}

const stripMarkdown = (text) => {
  return text.replace(/[#*`\[\]]/g, '').trim()
}

// ==================== Store ====================

const useDeepReadStore = create((set, get) => ({
  // ========== 核心状态 ==========
  selectedLiterature: null,
  rawContent: '',
  paragraphs: [],
  
  layoutMode: 'scholar',
  readMode: 'read',
  isProtected: true,
  
  words: [],
  sentences: [],
  notes: [],
  highlights: [],
  
  // ========== UI状态 ==========
  selectedColor: COLOR_STRUCTURE[0],
  selectedAnchor: null,
  
  // ========== Actions ==========
  
  loadLiterature: async (literature) => {
    set({ selectedLiterature: literature, isLoading: true })
    
    try {
      const [contentRes, wordsRes, sentencesRes, notesRes] = await Promise.all([
        structuredAPI.getLiterature(literature.doi),
        learningAPI.listWords({ doi: literature.doi }),
        learningAPI.listSentences({ doi: literature.doi }),
        structuredAPI.listNotes({ doi: literature.doi })
      ])
      
      const rawContent = contentRes?.content || ''
      
      set({
        selectedLiterature: literature,
        rawContent,
        paragraphs: parseParagraphs(rawContent),
        words: wordsRes || [],
        sentences: sentencesRes || [],
        notes: notesRes || [],
        isLoading: false
      })
    } catch (error) {
      console.error('Failed to load:', error)
      set({ isLoading: false })
    }
  },
  
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  
  setReadMode: (mode) => set({ 
    readMode: mode,
    isProtected: mode === 'read'
  }),
  
  toggleEditMode: () => set(s => ({
    readMode: s.readMode === 'read' ? 'edit' : 'read',
    isProtected: s.readMode === 'edit'
  })),
  
  // 获取某段落的单词
  getWordsForParagraph: (pId) => {
    const { words, paragraphs } = get()
    const p = paragraphs.find(x => x.id === pId)
    if (!p) return []
    
    return words.filter(w => {
      const regex = new RegExp(`\\b${w.word_en}\\b`, 'i')
      return regex.test(p.plainText)
    })
  },
  
  // 获取某段落的长难句
  getSentencesForParagraph: (pId) => {
    const { sentences, paragraphs } = get()
    const p = paragraphs.find(x => x.id === pId)
    if (!p) return []
    
    return sentences.filter(s => {
      // 简单包含匹配
      return p.plainText.includes(s.sentence_en.substring(0, 30))
    })
  },
  
  // 获取某段落的笔记
  getNotesForParagraph: (pId) => {
    return get().notes.filter(n => n.anchor_id === pId)
  },
  
  // 按颜色分组的内容
  getContentByColor: (colorId) => {
    const { paragraphs } = get()
    return paragraphs.filter(p => p.suggestedColor?.id === colorId)
  },
  
  // 添加高亮
  addHighlight: (pId, text, colorId) => {
    const hl = {
      id: `hl-${Date.now()}`,
      paragraphId: pId,
      text,
      colorId,
      createdAt: new Date().toISOString()
    }
    set(s => ({ highlights: [...s.highlights, hl] }))
  },
  
  // 添加笔记
  addNote: async (data) => {
    const { selectedLiterature } = get()
    if (!selectedLiterature) return
    
    const note = await structuredAPI.createNote({
      doi: selectedLiterature.doi,
      ...data
    })
    set(s => ({ notes: [...s.notes, note] }))
    return note
  },
  
  updateWordStatus: async (wordId, status) => {
    await learningAPI.updateWord(wordId, { status })
    set(s => ({
      words: s.words.map(w => w.id === wordId ? { ...w, status } : w)
    }))
  },
  
  updateSentenceStatus: async (sid, status) => {
    await learningAPI.updateSentence(sid, { status })
    set(s => ({
      sentences: s.sentences.map(x => x.id === sid ? { ...x, status } : x)
    }))
  },
  
  saveContent: async (newContent) => {
    const { selectedLiterature } = get()
    await structuredAPI.updateLiterature(selectedLiterature.doi, { content: newContent })
    set({
      rawContent: newContent,
      paragraphs: parseParagraphs(newContent),
      readMode: 'read',
      isProtected: true
    })
  },
  
  reset: () => set({
    selectedLiterature: null,
    rawContent: '',
    paragraphs: [],
    words: [],
    sentences: [],
    notes: [],
    highlights: [],
    readMode: 'read',
    isProtected: true
  })
}))

export default useDeepReadStore
