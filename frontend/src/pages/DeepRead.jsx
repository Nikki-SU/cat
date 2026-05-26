/**
 * 精读页面 - 重构版
 * 
 * 布局：
 * - 双栏模式: 左栏(词汇结构,可折叠) + 右栏(文献+行间批注)
 * - 三栏模式: 左栏(词汇结构,可折叠) + 中栏(文献+行间批注) + 右栏(AI面板,可折叠)
 * 
 * 特性：
 * - 阅读模式：原文只读，可高亮、批注、调整格式
 * - 编辑模式：直接修改原文
 * - 单词/长难句自动根据状态着色
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import useDeepReadStore, { 
  LAYOUT_MODES, 
  READ_MODES, 
  COLOR_STRUCTURE,
  WORD_STATUS_COLORS,
  SENTENCE_STYLES,
  SENTENCE_COLOR_SCHEMES
} from '../stores/useDeepReadStore'
import useAppStore from '../stores/useAppStore'
import ObsidianEditor from '../components/ObsidianEditor'
import { splitSentences, getSentenceBackgroundColor, isSentenceColoringEnabled } from '../utils/sentenceColors.jsx'
import { aiAPI } from '../api/client'

// ==================== 划词选择弹窗 ====================
const SelectionPopup = ({ 
  text, 
  position, 
  onClose, 
  onTranslate,
  onAIExplain,
}) => {
  const [mode, setMode] = useState(null) // null | 'translate' | 'explain'
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const handleTranslate = async () => {
    setMode('translate')
    setLoading(true)
    try {
      const response = await onTranslate(text)
      setResult(response)
    } finally {
      setLoading(false)
    }
  }

  const handleAIExplain = async () => {
    setMode('explain')
    setLoading(true)
    try {
      const response = await onAIExplain(text)
      setResult(response)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 w-96 max-w-[90vw]"
      style={{ 
        left: Math.min(position.x, window.innerWidth - 400),
        top: position.y + 20,
      }}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-600 truncate max-w-[200px]">
          选中: {text.substring(0, 20)}{text.length > 20 ? '...' : ''}
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
      </div>

      {/* 操作按钮 */}
      {!mode && (
        <div className="p-3 grid grid-cols-2 gap-2">
          <button
            onClick={handleTranslate}
            className="flex items-center justify-center gap-2 p-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <span>🌐</span>
            <span className="text-sm font-medium">翻译</span>
          </button>
          <button
            onClick={handleAIExplain}
            className="flex items-center justify-center gap-2 p-3 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <span>🤖</span>
            <span className="text-sm font-medium">AI解读</span>
          </button>
        </div>
      )}

      {/* 结果展示 */}
      {mode && (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{mode === 'translate' ? '🌐' : '🤖'}</span>
            <span className="font-medium text-gray-800">
              {mode === 'translate' ? '翻译结果' : 'AI解读'}
            </span>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <span className="animate-spin mr-2">⏳</span>
              {mode === 'translate' ? '翻译中...' : 'AI思考中...(基于全文)'}
            </div>
          ) : (
            <div className="text-sm text-gray-700 leading-relaxed max-h-60 overflow-y-auto">
              {mode === 'translate' ? (
                <p>{result}</p>
              ) : (
                <div className="space-y-2">
                  {result.split('\n').map((line, idx) => (
                    <p key={idx}>{line}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <button
            onClick={() => { setMode(null); setResult(''); }}
            className="mt-3 text-sm text-gray-500 hover:text-gray-700"
          >
            ← 返回选择
          </button>
        </div>
      )}
    </div>
  )
}

// ==================== 子组件 ====================

// 颜色-结构面板
const ColorStructurePanel = ({ paragraphs, onColorClick }) => {
  const getContentByColor = (colorId) => {
    return paragraphs.filter(p => p.suggestedColor?.id === colorId)
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-gray-700">🎨 颜色-结构</h3>
      {COLOR_STRUCTURE.map(cs => {
        const content = getContentByColor(cs.id)
        return (
          <div key={cs.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => onColorClick(cs)}
              className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium"
              style={{ backgroundColor: cs.color }}
            >
              <span className="w-3 h-3 rounded-full border border-gray-400" 
                style={{ backgroundColor: cs.color }} />
              <span style={{ color: cs.textColor }}>{cs.name}</span>
              <span className="text-xs opacity-60 ml-auto">{content.length}</span>
            </button>
            <div className="max-h-32 overflow-auto text-xs p-2 bg-gray-50">
              {content.map(p => (
                <div key={p.id} className="truncate py-1 text-gray-600 border-b last:border-0">
                  {p.plainText?.substring(0, 60) || ''}...
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 长难句列表
const SentenceList = ({ sentences, paragraphs, onSentenceClick }) => {
  const sentencesWithContext = useMemo(() => {
    return sentences.map(s => {
      const paragraph = paragraphs.find(p => 
        p.plainText?.includes(s.sentence_en?.substring(0, 30) || '')
      )
      return { ...s, paragraphId: paragraph?.id }
    })
  }, [sentences, paragraphs])

  return (
    <div className="mt-4">
      <h3 className="font-semibold text-sm text-gray-700 mb-2">
        📝 长难句 ({sentences.length})
      </h3>
      <div className="space-y-2 max-h-60 overflow-auto">
        {sentencesWithContext.map(s => (
          <div 
            key={s.id}
            onClick={() => onSentenceClick(s)}
            className="p-2 rounded bg-red-50 border border-red-200 cursor-pointer hover:bg-red-100"
          >
            <p className="text-xs text-red-700 line-clamp-2">{s.sentence_en}</p>
            {s.sentence_cn && (
              <p className="text-xs text-gray-500 mt-1">{s.sentence_cn}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// 单词列表
const WordList = ({ words, paragraphs, onWordClick }) => {
  const wordsWithContext = useMemo(() => {
    return words.map(w => {
      const paragraph = paragraphs.find(p => 
        p.plainText?.toLowerCase().includes(w.word_en?.toLowerCase() || '')
      )
      return { ...w, paragraphId: paragraph?.id }
    })
  }, [words, paragraphs])

  const getStatusStyle = (status) => {
    switch (status) {
      case 'new': return 'text-red-600 font-bold border-b-2 border-red-500'
      case 'learning': return 'text-amber-600 font-bold border-b-2 border-amber-500'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="mt-4">
      <h3 className="font-semibold text-sm text-gray-700 mb-2">
        📚 单词 ({words.length})
      </h3>
      <div className="flex flex-wrap gap-1">
        {wordsWithContext.map(w => (
          <span
            key={w.id}
            onClick={() => onWordClick(w)}
            className={`px-2 py-1 text-xs rounded cursor-pointer hover:bg-gray-100 ${getStatusStyle(w.status)}`}
          >
            {w.word_en}
          </span>
        ))}
      </div>
    </div>
  )
}

// 带单词/长难句高亮的文本渲染 + 句子着色
const HighlightedText = ({ text, words, sentences, colorScheme = 'none' }) => {
  if (!text) return null
  
  // 分割句子
  const sentenceList = splitSentences(text)
  
  // 如果关闭着色或只有一句，直接渲染
  if (!isSentenceColoringEnabled(colorScheme) || sentenceList.length <= 1) {
    return <span>{renderColoredText(text, words, sentences)}</span>
  }
  
  // 逐句渲染并着色
  return (
    <span>
      {sentenceList.map((sentence, idx) => (
        <span
          key={idx}
          style={{
            backgroundColor: getSentenceBackgroundColor(idx, colorScheme),
            padding: '2px 4px',
            borderRadius: '3px',
            display: 'inline',
          }}
        >
          {renderColoredText(sentence, words, sentences)}
        </span>
      ))}
    </span>
  )
}

// 渲染带单词/长难句高亮的文本（内部函数）
const renderColoredText = (text, words, sentences) => {
  let highlighted = text
  
  // 标记长难句（先处理长的）
  sentences?.forEach(s => {
    if (!s.sentence_en) return
    const pattern = s.sentence_en.substring(0, Math.min(s.sentence_en.length, 100))
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    try {
      const regex = new RegExp(`(${pattern})`, 'gi')
      highlighted = highlighted.replace(regex, '<span class="sentence-highlight">$1</span>')
    } catch (e) {
      // 忽略正则错误
    }
  })
  
  // 标记单词
  words?.forEach(w => {
    if (!w.word_en) return
    try {
      const regex = new RegExp(`\\b(${w.word_en})\\b`, 'gi')
      const style = w.status === 'new' 
        ? 'word-new' 
        : w.status === 'learning' 
          ? 'word-learning' 
          : 'word-mastered'
      highlighted = highlighted.replace(regex, `<span class="${style}">$1</span>`)
    } catch (e) {
      // 忽略正则错误
    }
  })
  
  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />
}

// 文献段落渲染
const ParagraphRenderer = ({ 
  paragraph, 
  words, 
  sentences, 
  notes, 
  isInlineMode,
  onAddNote,
  onTextSelect,
  readMode,
  colorScheme  // 新增
}) => {
  const paragraphWords = words || []
  const paragraphSentences = sentences || []
  const paragraphNotes = notes || []

  const renderContent = () => {
    const { type, raw } = paragraph
    if (!raw) return null
    
    // 根据类型渲染不同元素
    switch (type) {
      case 'heading':
        const level = raw.match(/^(#+)/)?.[0].length || 1
        const text = raw.replace(/^#+\s*/, '')
        return <Heading level={level} text={text} words={paragraphWords} sentences={paragraphSentences} colorScheme={colorScheme} />
      
      case 'bullet':
        return <li className="ml-4"><HighlightedText text={raw.replace(/^[-*]\s*/, '')} words={paragraphWords} sentences={paragraphSentences} colorScheme={colorScheme} /></li>
      
      case 'numbered':
        return <li className="ml-4"><HighlightedText text={raw.replace(/^\d+\.\s*/, '')} words={paragraphWords} sentences={paragraphSentences} colorScheme={colorScheme} /></li>
      
      default:
        return <p><HighlightedText text={raw} words={paragraphWords} sentences={paragraphSentences} colorScheme={colorScheme} /></p>
    }
  }

  return (
    <div 
      id={paragraph.id}
      data-anchor={paragraph.id}
      className="paragraph-block group relative hover:bg-gray-50"
      onMouseUp={readMode === 'read' ? (e) => onTextSelect(e, paragraph.id) : undefined}
    >
      {/* 段落内容 */}
      <div className={`${paragraph.suggestedColor ? `border-l-4 pl-3` : ''}`}
        style={{ borderColor: paragraph.suggestedColor?.color }}>
        {renderContent()}
      </div>
      
      {/* 行间批注 */}
      {isInlineMode && paragraphNotes.length > 0 && (
        <div className="mt-2 ml-4 space-y-1">
          {paragraphNotes.map(note => (
            <InlineNote key={note.id} note={note} />
          ))}
        </div>
      )}
      
      {/* 添加笔记按钮（悬浮） */}
      {readMode === 'read' && isInlineMode && (
        <button
          onClick={() => onAddNote(paragraph.id)}
          className="absolute -left-6 top-0 opacity-0 group-hover:opacity-100 text-blue-500 text-xs"
        >
          +笔记
        </button>
      )}
    </div>
  )
}

// 标题组件
const Heading = ({ level, text, words, sentences, colorScheme }) => {
  const Tag = `h${Math.min(level + 1, 6)}`
  return (
    <Tag className="font-bold my-4">
      <HighlightedText text={text} words={words} sentences={sentences} colorScheme={colorScheme} />
    </Tag>
  )
}

// 行间笔记
const InlineNote = ({ note }) => (
  <div className="p-2 bg-blue-50 border-l-4 border-blue-400 rounded my-2">
    <ObsidianEditor value={note.content} readOnly />
  </div>
)

// 边栏笔记
const SidebarNote = ({ note, paragraph, onEdit, onDelete }) => (
  <div className="p-3 bg-white rounded shadow-sm border-l-4 border-blue-400">
    <div className="text-xs text-gray-500 mb-1">
      段落 {(paragraph?.index ?? 0) + 1}
    </div>
    <div className="prose prose-sm max-w-none">
      <ObsidianEditor value={note.content} readOnly />
    </div>
    <div className="flex gap-2 mt-2">
      <button onClick={() => onEdit(note)} className="text-xs text-blue-500">编辑</button>
      <button onClick={() => onDelete(note.id)} className="text-xs text-red-500">删除</button>
    </div>
  </div>
)

// 笔记编辑器
const NoteEditor = ({ onSave, onCancel, initialContent = '' }) => {
  const [content, setContent] = useState(initialContent)
  
  return (
    <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
      <ObsidianEditor
        value={content}
        onChange={setContent}
        placeholder="输入笔记（支持图片、代码、思维导图、双链引用等）..."
        className="min-h-[150px]"
      />
      <div className="flex gap-2 mt-2">
        <button 
          onClick={() => onSave(content)}
          disabled={!content.trim()}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
        >
          保存
        </button>
        <button 
          onClick={onCancel}
          className="px-3 py-1 bg-gray-200 rounded text-sm"
        >
          取消
        </button>
      </div>
    </div>
  )
}

// ==================== 主组件 ====================

function DeepRead() {
  const {
    selectedLiterature,
    paragraphs,
    words,
    sentences,
    notes,
    layoutMode,
    readMode,
    isProtected,
    selectedColor,
    sentenceColorScheme,
    loadLiterature,
    setLayoutMode,
    setReadMode,
    toggleEditMode,
    setSentenceColorScheme,
    addNote,
    deleteNote,
    updateNote,
    addHighlight,
    getWordsForParagraph,
    getSentencesForParagraph,
    getNotesForParagraph,
    getContentByColor,
    saveContent
  } = useDeepReadStore()
  
  const { literatureTable } = useAppStore()
  
  // 本地状态
  const [editingNote, setEditingNote] = useState(null)
  const [editContent, setEditContent] = useState('')
  const contentRef = useRef(null)
  const [selectionPopup, setSelectionPopup] = useState(null)
  const [fullText, setFullText] = useState('')
  
  // 布局状态
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  
  // AI面板状态
  const [aiInput, setAiInput] = useState('')
  const [aiMessages, setAiMessages] = useState([])
  const [aiLoading, setAiLoading] = useState(false)

  // 获取完整文本
  useEffect(() => {
    if (paragraphs && paragraphs.length > 0) {
      const text = paragraphs.map(p => p.plainText || p.raw || '').join('\n\n')
      setFullText(text)
    }
  }, [paragraphs])

  // 处理划词选择
  const handleTextSelect = (e, paragraphId) => {
    const selection = window.getSelection()
    const text = selection.toString().trim()
    if (text && text.length > 0) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelectionPopup({
        text,
        position: { x: rect.left + rect.width / 2, y: rect.bottom + window.scrollY },
        paragraphId
      })
    }
  }

  const closeSelectionPopup = () => setSelectionPopup(null)

  // 翻译
  const handleTranslate = async (text) => {
    try {
      const data = await aiAPI.chat(
        [
          { role: 'system', content: '你是专业的学术翻译助手，擅长将英语学术文献翻译成准确、流畅的中文。' },
          { role: 'user', content: `请将以下学术文本翻译成中文，保持学术严谨性：\n\n${text}` }
        ],
        0.3, 2048
      )
      return data.content || data.response || text
    } catch (error) {
      try {
        const resp = await aiAPI.translate(text, 'zh')
        return resp.translation || '翻译失败'
      } catch {
        return '翻译服务暂不可用'
      }
    }
  }

  // AI解读
  const handleAIExplain = async (selectedText, context) => {
    try {
      const prompt = `请基于以下全文内容，解读这段选中的文本：\n\n【全文内容】\n${context.substring(0, 3000)}...\n\n【选中文本】\n${selectedText}\n\n请用中文回答：\n1. 这句话在全文中的作用和意义\n2. 关键概念解释\n3. 与上下文的联系\n4. 学术价值分析`
      const data = await aiAPI.chat(
        [
          { role: 'system', content: '你是资深的学术文献解读专家，擅长分析学术论文的结构、方法和贡献。' },
          { role: 'user', content: prompt }
        ],
        0.7, 2048
      )
      return data.content || data.response || 'AI解读完成'
    } catch (error) {
      return 'AI解读服务暂不可用'
    }
  }

  // AI面板对话
  const handleAiChat = async () => {
    if (!aiInput.trim()) return
    const userMsg = aiInput.trim()
    setAiInput('')
    setAiMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setAiLoading(true)
    try {
      const data = await aiAPI.chat(
        [
          { role: 'system', content: `你是学术文献解读助手。当前正在阅读的文献标题：${selectedLiterature?.title_cn || selectedLiterature?.title_en || '未知'}\n\n全文摘要：${fullText.substring(0, 2000)}...` },
          { role: 'user', content: userMsg }
        ],
        0.7, 2048
      )
      const reply = data.content || data.response || '无法回复'
      setAiMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant', content: 'AI服务暂不可用' }])
    } finally {
      setAiLoading(false)
    }
  }
  
  // 加载文献
  const handleSelectLiterature = async (item) => {
    if (!item) return
    await loadLiterature(item)
    setEditContent(item.content || '')
    setAiMessages([])
  }
  
  const handleAddNote = async (paragraphId, content) => {
    if (!content.trim()) return
    try {
      await addNote({ anchor_id: paragraphId, note_type: 'markdown', content, position: '' })
      setEditingNote(null)
    } catch (error) {
      alert('添加笔记失败: ' + (error?.message || '未知错误'))
    }
  }
  
  const handleDeleteNote = async (id) => {
    if (!confirm('确定删除这条笔记吗？')) return
    try { await deleteNote(id) } catch (error) { alert('删除失败') }
  }
  
  const handleEditNote = (note) => setEditingNote({ ...note, isEditing: true })
  
  const handleUpdateNote = async (noteId, content) => {
    try { await updateNote(noteId, { content }); setEditingNote(null) }
    catch (error) { alert('更新失败') }
  }
  
  const handleSaveEdit = async () => {
    try { await saveContent(editContent); alert('保存成功') }
    catch (error) { alert('保存失败') }
  }
  
  const handleColorClick = (color) => {
    const content = getContentByColor(color.id)
    if (content.length > 0) {
      document.getElementById(content[0].id)?.scrollIntoView({ behavior: 'smooth' })
    }
  }
  
  const handleSentenceClick = (sentence) => {
    const paragraph = paragraphs.find(p => p.plainText?.includes(sentence.sentence_en?.substring(0, 30) || ''))
    if (paragraph) document.getElementById(paragraph.id)?.scrollIntoView({ behavior: 'smooth' })
  }
  
  const handleWordClick = (word) => {
    const paragraph = paragraphs.find(p => p.plainText?.toLowerCase().includes(word.word_en?.toLowerCase() || ''))
    if (paragraph) document.getElementById(paragraph.id)?.scrollIntoView({ behavior: 'smooth' })
  }
  
  const currentLayout = LAYOUT_MODES[layoutMode] || LAYOUT_MODES.dual
  const isTripleMode = currentLayout.hasAIPanel
  
  // 全屏切换
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // 监听全屏状态变化
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // 动态grid类
  const getGridClass = () => {
    if (leftCollapsed && (rightCollapsed || !isTripleMode)) {
      return 'grid-cols-[0px_1fr]'
    } else if (leftCollapsed && isTripleMode && !rightCollapsed) {
      return 'grid-cols-[0px_1fr_300px]'
    } else if (!leftCollapsed && isTripleMode && rightCollapsed) {
      return 'grid-cols-[280px_1fr_0px]'
    } else if (!leftCollapsed && isTripleMode && !rightCollapsed) {
      return 'grid-cols-[280px_1fr_300px]'
    } else if (!leftCollapsed && !isTripleMode) {
      return 'grid-cols-[280px_1fr]'
    } else {
      return 'grid-cols-[0px_1fr]'
    }
  }

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col bg-gray-50">
      {/* 顶部工具栏 */}
      <header className="bg-white border-b px-4 py-2 flex items-center gap-3 shrink-0 z-20">
        {selectedLiterature ? (
          <>
            {/* 文献标题（紧凑） */}
            <div className="flex items-center gap-2 min-w-0 max-w-[240px]">
              <span className="text-lg">📖</span>
              <span className="text-sm font-medium truncate text-[#3C5488]">
                {selectedLiterature.title_cn || selectedLiterature.title_en || '无标题'}
              </span>
            </div>

            <div className="h-5 w-px bg-gray-200" />

            {/* 布局切换 */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {Object.values(LAYOUT_MODES).map(mode => (
                <button
                  key={mode.id}
                  onClick={() => { setLayoutMode(mode.id); setRightCollapsed(false) }}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    layoutMode === mode.id ? 'bg-white shadow text-[#4DBBD5]' : 'text-gray-500 hover:text-[#4DBBD5]'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-gray-200" />

            {/* 编辑/阅读切换 */}
            <button
              onClick={toggleEditMode}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                readMode === 'edit' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
              }`}
            >
              {readMode === 'edit' ? '✏️ 编辑中' : '📖 阅读'}
            </button>
            
            {readMode === 'edit' && (
              <button onClick={handleSaveEdit} className="px-3 py-1 bg-[#4DBBD5] text-white rounded-lg text-xs font-medium hover:bg-[#3a9ab5]">
                💾 保存
              </button>
            )}

            <div className="h-5 w-px bg-gray-200" />

            {/* 句子着色 */}
            <select
              value={sentenceColorScheme}
              onChange={(e) => setSentenceColorScheme(e.target.value)}
              className="text-xs border rounded px-2 py-1 bg-white"
              title="句子着色方案"
            >
              {Object.values(SENTENCE_COLOR_SCHEMES).map(scheme => (
                <option key={scheme.id} value={scheme.id}>{scheme.name}</option>
              ))}
            </select>

            {/* 全屏按钮 */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-[#8491B4] hover:text-[#4DBBD5] hover:bg-[#4DBBD5]/10 rounded-lg transition-colors ml-auto"
              title={isFullscreen ? '退出全屏' : '全屏'}
            >
              {isFullscreen ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              )}
            </button>

            {/* 换文献按钮 */}
            <button
              onClick={() => useDeepReadStore.setState({ selectedLiterature: null, paragraphs: [], words: [], sentences: [], notes: [], rawContent: '' })}
              className="p-1.5 text-[#8491B4] hover:text-[#E64B35] hover:bg-[#E64B35]/10 rounded-lg transition-colors"
              title="关闭文献"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <span className="text-lg">📖</span>
            <span className="text-sm font-medium text-[#3C5488]">读文献</span>
            <div className="h-5 w-px bg-gray-200" />
            <select 
              className="border rounded-lg px-3 py-1.5 min-w-[240px] text-sm bg-white focus:ring-2 focus:ring-[#4DBBD5]"
              onChange={e => {
                const item = literatureTable?.find(l => l.doi === e.target.value)
                if (item) handleSelectLiterature(item)
              }}
              value=""
            >
              <option value="">选择文献开始阅读...</option>
              {literatureTable?.map(l => (
                <option key={l.doi} value={l.doi}>{l.title_cn || l.title_en || l.doi}</option>
              ))}
            </select>
          </>
        )}
      </header>
      
      {/* 主内容区 */}
      {selectedLiterature ? (
        <div className={`flex-1 overflow-hidden grid transition-all duration-200 ${getGridClass()}`}>
          {/* ========== 左栏：词汇结构（可折叠） ========== */}
          <aside className={`bg-white border-r overflow-y-auto transition-all duration-200 ${leftCollapsed ? 'w-0 overflow-hidden' : ''}`}>
            {/* 左栏折叠按钮 */}
            <button
              onClick={() => setLeftCollapsed(true)}
              className="sticky top-0 left-0 z-10 p-1 m-1 text-[#8491B4] hover:text-[#4DBBD5] hover:bg-[#4DBBD5]/10 rounded text-xs"
              title="折叠左栏"
            >
              ◀
            </button>
            <div className="p-4 pt-0">
              <ColorStructurePanel paragraphs={paragraphs} onColorClick={handleColorClick} />
              <SentenceList sentences={sentences} paragraphs={paragraphs} onSentenceClick={handleSentenceClick} />
              <WordList words={words} paragraphs={paragraphs} onWordClick={handleWordClick} />
            </div>
          </aside>
          
          {/* ========== 中栏：文献 + 行间批注 ========== */}
          <main className="overflow-y-auto p-6 relative" ref={contentRef}>
            {/* 左栏展开按钮（当折叠时显示） */}
            {leftCollapsed && (
              <button
                onClick={() => setLeftCollapsed(false)}
                className="fixed left-0 top-1/2 -translate-y-1/2 z-30 bg-white border rounded-r-lg px-1 py-3 text-[#8491B4] hover:text-[#4DBBD5] shadow"
                title="展开左栏"
              >
                ▶
              </button>
            )}

            <div className="max-w-3xl mx-auto">
              <h1 className="text-2xl font-bold mb-6 text-[#3C5488]">
                {selectedLiterature?.title_cn || selectedLiterature?.title_en || '无标题'}
              </h1>
              
              {readMode === 'edit' ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full min-h-[600px] p-4 border rounded-lg font-mono text-sm"
                />
              ) : (
                <div className="prose prose-lg max-w-none space-y-4">
                  {paragraphs.map(p => (
                    <ParagraphRenderer
                      key={p.id}
                      paragraph={p}
                      words={getWordsForParagraph(p.id)}
                      sentences={getSentencesForParagraph(p.id)}
                      notes={getNotesForParagraph(p.id)}
                      isInlineMode={true}
                      onAddNote={(id) => setEditingNote({ paragraphId: id, content: '' })}
                      onTextSelect={handleTextSelect}
                      readMode={readMode}
                      colorScheme={sentenceColorScheme}
                    />
                  ))}
                  
                  {/* 新建笔记编辑器 */}
                  {editingNote && (
                    <div className="mt-4">
                      <NoteEditor
                        onSave={(content) => handleAddNote(editingNote.paragraphId, content)}
                        onCancel={() => setEditingNote(null)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
          
          {/* ========== 右栏：AI工具面板（三栏模式，可折叠） ========== */}
          {isTripleMode && (
            <aside className={`bg-gray-50 border-l overflow-y-auto flex flex-col transition-all duration-200 ${rightCollapsed ? 'w-0 overflow-hidden' : ''}`}>
              {/* 右栏折叠按钮 */}
              <div className="flex items-center justify-between p-3 border-b shrink-0">
                <h3 className="font-semibold text-sm text-[#3C5488]">🤖 AI助手</h3>
                <button
                  onClick={() => setRightCollapsed(true)}
                  className="text-[#8491B4] hover:text-[#4DBBD5] text-xs"
                  title="折叠右栏"
                >
                  ▶
                </button>
              </div>

              {/* 快捷操作 */}
              <div className="p-3 border-b shrink-0">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={async () => {
                      if (!fullText) return
                      setAiMessages(prev => [...prev, { role: 'user', content: '请总结这篇文献的核心内容' }])
                      setAiLoading(true)
                      try {
                        const data = await aiAPI.chat(
                          [
                            { role: 'system', content: '你是学术文献解读助手。' },
                            { role: 'user', content: `请总结以下文献的核心内容、创新点和不足：\n\n${fullText.substring(0, 4000)}` }
                          ],
                          0.5, 2048
                        )
                        setAiMessages(prev => [...prev, { role: 'assistant', content: data.content || data.response || '无法总结' }])
                      } catch { setAiMessages(prev => [...prev, { role: 'assistant', content: 'AI服务不可用' }]) }
                      finally { setAiLoading(false) }
                    }}
                    disabled={aiLoading}
                    className="px-2 py-1 text-xs bg-[#4DBBD5]/10 text-[#4DBBD5] rounded hover:bg-[#4DBBD5]/20 disabled:opacity-50"
                  >📋 总结</button>
                  <button
                    onClick={async () => {
                      if (!fullText) return
                      setAiMessages(prev => [...prev, { role: 'user', content: '请分析这篇文献的研究方法' }])
                      setAiLoading(true)
                      try {
                        const data = await aiAPI.chat(
                          [
                            { role: 'system', content: '你是学术文献解读助手。' },
                            { role: 'user', content: `请详细分析以下文献的研究方法、实验设计和数据分析方式：\n\n${fullText.substring(0, 4000)}` }
                          ],
                          0.5, 2048
                        )
                        setAiMessages(prev => [...prev, { role: 'assistant', content: data.content || data.response || '无法分析' }])
                      } catch { setAiMessages(prev => [...prev, { role: 'assistant', content: 'AI服务不可用' }]) }
                      finally { setAiLoading(false) }
                    }}
                    disabled={aiLoading}
                    className="px-2 py-1 text-xs bg-[#00A087]/10 text-[#00A087] rounded hover:bg-[#00A087]/20 disabled:opacity-50"
                  >🔬 方法</button>
                  <button
                    onClick={async () => {
                      if (!fullText) return
                      setAiMessages(prev => [...prev, { role: 'user', content: '请分析这篇文献的创新点和贡献' }])
                      setAiLoading(true)
                      try {
                        const data = await aiAPI.chat(
                          [
                            { role: 'system', content: '你是学术文献解读助手。' },
                            { role: 'user', content: `请分析以下文献的创新点、学术贡献和潜在影响：\n\n${fullText.substring(0, 4000)}` }
                          ],
                          0.5, 2048
                        )
                        setAiMessages(prev => [...prev, { role: 'assistant', content: data.content || data.response || '无法分析' }])
                      } catch { setAiMessages(prev => [...prev, { role: 'assistant', content: 'AI服务不可用' }]) }
                      finally { setAiLoading(false) }
                    }}
                    disabled={aiLoading}
                    className="px-2 py-1 text-xs bg-[#3C5488]/10 text-[#3C5488] rounded hover:bg-[#3C5488]/20 disabled:opacity-50"
                  >💡 创新</button>
                </div>
              </div>
              
              {/* 对话历史 */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {aiMessages.length === 0 && (
                  <div className="text-center text-[#8491B4] text-sm py-8">
                    <div className="text-2xl mb-2">🤖</div>
                    <p>向AI助手提问关于这篇文献的问题</p>
                  </div>
                )}
                {aiMessages.map((msg, idx) => (
                  <div key={idx} className={`text-sm ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    <div className={`inline-block max-w-[90%] p-2 rounded-lg ${
                      msg.role === 'user' ? 'bg-[#4DBBD5] text-white' : 'bg-white border text-[#3C5488]'
                    }`}>
                      {msg.content.split('\n').map((line, i) => (
                        <span key={i}>{line}<br/></span>
                      ))}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="text-left">
                    <div className="inline-block p-2 bg-white border rounded-lg text-sm text-[#8491B4]">
                      <div className="flex items-center gap-1">
                        <div className="animate-spin w-3 h-3 border-2 border-[#4DBBD5] border-t-transparent rounded-full" />
                        思考中...
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 输入框 */}
              <div className="p-3 border-t shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAiChat()}
                    placeholder="提问关于这篇文献..."
                    className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#4DBBD5]"
                    disabled={aiLoading}
                  />
                  <button
                    onClick={handleAiChat}
                    disabled={aiLoading || !aiInput.trim()}
                    className="px-3 py-1.5 bg-[#4DBBD5] text-white rounded-lg text-sm disabled:opacity-50 hover:bg-[#3a9ab5]"
                  >
                    发送
                  </button>
                </div>
              </div>
            </aside>
          )}

          {/* 右栏展开按钮（三栏模式且折叠时显示） */}
          {isTripleMode && rightCollapsed && (
            <button
              onClick={() => setRightCollapsed(false)}
              className="fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-white border rounded-l-lg px-1 py-3 text-[#8491B4] hover:text-[#4DBBD5] shadow"
              title="展开AI面板"
            >
              ◀
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-6xl mb-4">📖</div>
            <p className="text-[#8491B4] text-lg mb-2">选择一篇文献开始深度阅读</p>
            <p className="text-sm text-[#8491B4]/70">支持双栏/三栏模式、行间批注、AI辅助</p>
          </div>
        </div>
      )}
      
      {/* 划词弹窗 */}
      {selectionPopup && (
        <SelectionPopup
          text={selectionPopup.text}
          position={selectionPopup.position}
          onTranslate={handleTranslate}
          onAIExplain={(text) => handleAIExplain(text, fullText)}
          onClose={closeSelectionPopup}
        />
      )}

      {/* 全局样式 */}
      <style>{`
        .word-new { color: #DC2626; font-weight: bold; border-bottom: 2px solid #DC2626; }
        .word-learning { color: #D97706; font-weight: bold; border-bottom: 2px solid #F59E0B; }
        .word-mastered { color: inherit; }
        .sentence-highlight { color: #DC2626; background: rgba(254, 226, 226, 0.3); border-radius: 2px; padding: 1px 2px; }
        .paragraph-block { position: relative; padding: 8px 0; }
      `}</style>
    </div>
  )
}

export default DeepRead