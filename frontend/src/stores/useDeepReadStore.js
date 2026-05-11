/**
 * DeepRead涓撶敤鐘舵€佺鐞?- 淇鐗? * 
 * 甯冨眬璇存槑锛? * - 瀛﹁€呮ā寮?(30%:70%): 宸?棰滆壊缁撴瀯鏍? 鍙?鏂囩尞+琛岄棿绗旇
 * - 鍙屾爮妯″紡 (30%:50%:20%): 宸?棰滆壊缁撴瀯鏍? 涓?绾枃鐚? 鍙?杈规爮绗旇
 * 
 * 绗旇浣嶇疆锛? * - 瀛﹁€呮ā寮忥細绗旇鍦ㄦ枃鐚搴旀钀芥梺杈癸紙琛岄棿锛? * - 鍙屾爮妯″紡锛氱瑪璁伴泦涓湪鍙虫爮锛堣竟鏍忥級锛屼絾浠嶉敋瀹氬埌鏂囩尞浣嶇疆
 */
import { create } from 'zustand'
import { structuredAPI, learningAPI } from '../api/client'

// ==================== 甯搁噺 ====================

export const LAYOUT_MODES = {
  scholar: { 
    id: 'scholar', 
    label: '瀛﹁€呮ā寮?, 
    // 宸?0%: 棰滆壊缁撴瀯+闀块毦鍙?鍗曡瘝, 鍙?0%: 鏂囩尞+琛岄棿绗旇
    grid: 'grid-cols-[300px_1fr]',
    leftWidth: 'w-[300px]',
    centerWidth: 'flex-1',
    rightWidth: null, // 鏃犵嫭绔嬪彸鏍忥紝绗旇鍦ㄦ枃鐚唴
    notePosition: 'inline' // 琛岄棿绗旇
  },
  dual: { 
    id: 'dual', 
    label: '鍙屾爮妯″紡', 
    // 宸?0%: 棰滆壊缁撴瀯+闀块毦鍙?鍗曡瘝, 涓?0%: 绾枃鐚? 鍙?0%: 杈规爮绗旇
    grid: 'grid-cols-[280px_1fr_280px]',
    leftWidth: 'w-[280px]',
    centerWidth: 'flex-1',
    rightWidth: 'w-[280px]',
    notePosition: 'sidebar' // 杈规爮绗旇
  }
}

export const READ_MODES = {
  read: { id: 'read', label: '闃呰', icon: '馃摉', description: '鍙珮浜壒娉紝涓嶅彲鏀瑰師鏂? },
  edit: { id: 'edit', label: '缂栬緫', icon: '鉁忥笍', description: '鍙洿鎺ヤ慨鏀瑰師鏂? }
}

// 棰滆壊-缁撴瀯鏄犲皠锛堢敤浜庨珮浜枃鐚級
export const COLOR_STRUCTURE = [
  { id: 'yellow', name: '鏂规硶', color: '#FEF08A', textColor: '#854D0E', keywords: ['method', 'approach', 'procedure'] },
  { id: 'green', name: '缁撴灉', color: '#BBF7D0', textColor: '#166534', keywords: ['result', 'finding', 'demonstrated'] },
  { id: 'blue', name: '璁ㄨ', color: '#BFDBFE', textColor: '#1E40AF', keywords: ['discuss', 'suggest', 'indicate'] },
  { id: 'pink', name: '缁撹', color: '#FBCFE8', textColor: '#9D174D', keywords: ['conclusion', 'therefore', 'thus'] },
  { id: 'orange', name: '鑳屾櫙', color: '#FED7AA', textColor: '#9A3412', keywords: ['background', 'introduction', 'previous'] }
]

// 鍗曡瘝鐘舵€佹牱寮?export const WORD_STATUS_COLORS = {
  new: { color: '#DC2626', fontWeight: 'bold', borderBottom: '2px solid #DC2626' },      // 绾?鏂拌瘝
  learning: { color: '#D97706', fontWeight: 'bold', borderBottom: '2px solid #F59E0B' }, // 榛?瀛︿範涓? 
  mastered: { color: 'inherit', fontWeight: 'normal', borderBottom: 'none' }              // 姝ｅ父-宸叉帉鎻?}

// 闀块毦鍙ユ牱寮?export const SENTENCE_STYLES = {
  color: '#DC2626',
  background: 'rgba(254, 226, 226, 0.3)',
  padding: '2px 4px',
  borderRadius: '4px'
}

// ==================== 杈呭姪鍑芥暟 ====================

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
  // ========== 鏍稿績鐘舵€?==========
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
  
  // ========== UI鐘舵€?==========
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
  
  // 鑾峰彇鏌愭钀界殑鍗曡瘝
  getWordsForParagraph: (pId) => {
    const { words, paragraphs } = get()
    const p = paragraphs.find(x => x.id === pId)
    if (!p) return []
    
    return words.filter(w => {
      const regex = new RegExp(`\\b${w.word_en}\\b`, 'i')
      return regex.test(p.plainText)
    })
  },
  
  // 鑾峰彇鏌愭钀界殑闀块毦鍙?  getSentencesForParagraph: (pId) => {
    const { sentences, paragraphs } = get()
    const p = paragraphs.find(x => x.id === pId)
    if (!p) return []
    
    return sentences.filter(s => {
      // 绠€鍗曞寘鍚尮閰?      return p.plainText.includes(s.sentence_en.substring(0, 30))
    })
  },
  
  // 鑾峰彇鏌愭钀界殑绗旇
  getNotesForParagraph: (pId) => {
    return get().notes.filter(n => n.anchor_id === pId)
  },
  
  // 鎸夐鑹插垎缁勭殑鍐呭
  getContentByColor: (colorId) => {
    const { paragraphs } = get()
    return paragraphs.filter(p => p.suggestedColor?.id === colorId)
  },
  
  // 娣诲姞楂樹寒
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
  
  // 娣诲姞绗旇
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
