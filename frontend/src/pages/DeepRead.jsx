/**
 * 精读页面 - 重构版
 * 
 * 布局：
 * - 学者模式: 左栏(颜色结构+长难句+单词) + 右栏(文献+行间笔记)
 * - 双栏模式: 左栏(颜色结构+长难句+单词) + 中栏(纯文献) + 右栏(边栏笔记)
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
import { splitSentences, getSentenceBackgroundColor, isSentenceColoringEnabled } from '../utils/sentenceColors'

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
      
      {/* 行间笔记（学者模式） */}
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
    sentenceColorScheme,  // 新增
    loadLiterature,
    setLayoutMode,
    setReadMode,
    toggleEditMode,
    setSentenceColorScheme,  // 新增
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
  const [selectedParagraph, setSelectedParagraph] = useState(null)
  const [editContent, setEditContent] = useState('')
  const contentRef = useRef(null)
  
  // 加载文献
  const handleSelectLiterature = async (item) => {
    if (!item) return
    await loadLiterature(item)
    setEditContent(item.content || '')
  }
  
  // 文本选择
  const handleTextSelect = (e, paragraphId) => {
    const selection = window.getSelection()
    const text = selection.toString().trim()
    if (text) {
      console.log('选中:', text, '在段落:', paragraphId)
      // 可以在这里添加高亮逻辑
    }
  }
  
  // 添加笔记
  const handleAddNote = async (paragraphId, content) => {
    if (!content.trim()) return
    
    try {
      await addNote({
        anchor_id: paragraphId,
        note_type: 'markdown',
        content,
        position: ''
      })
      setEditingNote(null)
    } catch (error) {
      alert('添加笔记失败: ' + (error?.message || '未知错误'))
    }
  }
  
  // 处理删除笔记
  const handleDeleteNote = async (id) => {
    if (!confirm('确定要删除这条笔记吗？')) return
    
    try {
      await deleteNote(id)
    } catch (error) {
      alert('删除失败: ' + (error?.message || '未知错误'))
    }
  }
  
  // 处理编辑笔记
  const handleEditNote = (note) => {
    setEditingNote({ ...note, isEditing: true })
  }
  
  // 处理保存编辑后的笔记
  const handleUpdateNote = async (noteId, content) => {
    try {
      await updateNote(noteId, { content })
      setEditingNote(null)
    } catch (error) {
      alert('更新失败: ' + (error?.message || '未知错误'))
    }
  }
  
  // 保存编辑
  const handleSaveEdit = async () => {
    try {
      await saveContent(editContent)
      alert('保存成功')
    } catch (error) {
      alert('保存失败: ' + (error?.message || '未知错误'))
    }
  }
  
  // 处理颜色点击 - 滚动到对应段落
  const handleColorClick = (color) => {
    const content = getContentByColor(color.id)
    if (content.length > 0) {
      const firstParagraph = content[0]
      document.getElementById(firstParagraph.id)?.scrollIntoView({ behavior: 'smooth' })
    }
  }
  
  // 处理长难句点击
  const handleSentenceClick = (sentence) => {
    const paragraph = paragraphs.find(p => 
      p.plainText?.includes(sentence.sentence_en?.substring(0, 30) || '')
    )
    if (paragraph) {
      document.getElementById(paragraph.id)?.scrollIntoView({ behavior: 'smooth' })
    }
  }
  
  // 处理单词点击
  const handleWordClick = (word) => {
    const paragraph = paragraphs.find(p => 
      p.plainText?.toLowerCase().includes(word.word_en?.toLowerCase() || '')
    )
    if (paragraph) {
      document.getElementById(paragraph.id)?.scrollIntoView({ behavior: 'smooth' })
    }
  }
  
  // 当前布局配置
  const currentLayout = LAYOUT_MODES[layoutMode] || LAYOUT_MODES.scholar
  const isInlineMode = currentLayout.notePosition === 'inline'
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 顶部工具栏 */}
      <header className="bg-white border-b px-4 py-2 flex items-center gap-4">
        {/* 文献选择 */}
        <select 
          className="border rounded px-3 py-1 min-w-[200px]"
          onChange={e => {
            const item = literatureTable?.find(l => l.doi === e.target.value)
            handleSelectLiterature(item)
          }}
          value={selectedLiterature?.doi || ''}
        >
          <option value="">选择文献...</option>
          {literatureTable?.map(l => (
            <option key={l.doi} value={l.doi}>{l.title_cn || l.title_en || l.doi}</option>
          ))}
        </select>
        
        {/* 布局切换 */}
        <div className="flex border rounded">
          {Object.values(LAYOUT_MODES).map(mode => (
            <button
              key={mode.id}
              onClick={() => setLayoutMode(mode.id)}
              className={`px-3 py-1 text-sm ${layoutMode === mode.id ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        
        {/* 编辑模式开关 */}
        <button
          onClick={toggleEditMode}
          className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
            readMode === 'edit' ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'
          }`}
        >
          {readMode === 'edit' ? '✏️ 编辑中' : '📖 阅读'}
        </button>
        
        {readMode === 'edit' && (
          <button
            onClick={handleSaveEdit}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            💾 保存
          </button>
        )}
        
        {/* 句子着色切换 */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-600">句子着色:</span>
          <select
            value={sentenceColorScheme}
            onChange={(e) => setSentenceColorScheme(e.target.value)}
            className="text-sm border rounded px-2 py-1"
            title="选择句子交替着色方案，帮助区分不同句子"
          >
            {Object.values(SENTENCE_COLOR_SCHEMES).map(scheme => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.name}
              </option>
            ))}
          </select>
        </div>
      </header>
      
      {/* 主内容区 */}
      {selectedLiterature ? (
        <div className={`flex-1 overflow-hidden grid ${currentLayout.grid}`}>
          
          {/* ========== 左栏：颜色结构 + 长难句 + 单词 ========== */}
          <aside className="bg-white border-r overflow-y-auto p-4">
            <ColorStructurePanel 
              paragraphs={paragraphs}
              onColorClick={handleColorClick}
            />
            <SentenceList 
              sentences={sentences}
              paragraphs={paragraphs}
              onSentenceClick={handleSentenceClick}
            />
            <WordList 
              words={words}
              paragraphs={paragraphs}
              onWordClick={handleWordClick}
            />
          </aside>
          
          {/* ========== 学者模式：右栏(文献+行间笔记) ========== */}
          {isInlineMode && (
            <main className="overflow-y-auto p-6" ref={contentRef}>
              <div className="max-w-3xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">
                  {selectedLiterature?.title_cn || selectedLiterature?.title_en || '无标题'}
                </h1>
                
                {readMode === 'edit' ? (
                  // 编辑模式
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="w-full min-h-[600px] p-4 border rounded font-mono text-sm"
                  />
                ) : (
                  // 阅读模式
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
          )}
          
          {/* ========== 双栏模式：中栏(纯文献) + 右栏(边栏笔记) ========== */}
          {!isInlineMode && (
            <>
              {/* 中栏：纯文献 */}
              <main className="overflow-y-auto p-6" ref={contentRef}>
                <div className="max-w-3xl mx-auto">
                  <h1 className="text-2xl font-bold mb-6">
                    {selectedLiterature?.title_cn || selectedLiterature?.title_en || '无标题'}
                  </h1>
                  
                  {readMode === 'edit' ? (
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="w-full min-h-[600px] p-4 border rounded font-mono text-sm"
                    />
                  ) : (
                    <div className="prose prose-lg max-w-none space-y-4">
                      {paragraphs.map(p => (
                        <ParagraphRenderer
                          key={p.id}
                          paragraph={p}
                          words={getWordsForParagraph(p.id)}
                          sentences={getSentencesForParagraph(p.id)}
                          notes={[]} // 双栏模式不显示行间笔记
                          isInlineMode={false}
                          onTextSelect={handleTextSelect}
                          readMode={readMode}
                          colorScheme={sentenceColorScheme}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </main>
              
              {/* 右栏：边栏笔记 */}
              <aside className="bg-gray-50 border-l overflow-y-auto p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">📝 笔记</h3>
                  <button 
                    onClick={() => {
                      if (paragraphs.length > 0) {
                        setEditingNote({ paragraphId: paragraphs[0].id, content: '' })
                      }
                    }}
                    disabled={paragraphs.length === 0}
                    className="text-sm px-2 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
                  >
                    + 添加
                  </button>
                </div>
                
                <div className="space-y-3">
                  {notes.map(note => {
                    const paragraph = paragraphs.find(p => p.id === note.anchor_id)
                    return (
                      <SidebarNote
                        key={note.id}
                        note={note}
                        paragraph={paragraph}
                        onEdit={handleEditNote}
                        onDelete={handleDeleteNote}
                      />
                    )
                  })}
                </div>
                
                {/* 编辑器 */}
                {editingNote && (
                  <div className="mt-4">
                    {editingNote.isEditing ? (
                      <NoteEditor
                        initialContent={editingNote.content}
                        onSave={(content) => handleUpdateNote(editingNote.id, content)}
                        onCancel={() => setEditingNote(null)}
                      />
                    ) : (
                      <NoteEditor
                        initialContent={editingNote.content}
                        onSave={(content) => handleAddNote(editingNote.paragraphId, content)}
                        onCancel={() => setEditingNote(null)}
                      />
                    )}
                  </div>
                )}
              </aside>
            </>
          )}
          
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <p>请选择一篇文献开始阅读</p>
        </div>
      )}
      
      {/* 全局样式 */}
      <style>{`
        .word-new {
          color: #DC2626;
          font-weight: bold;
          border-bottom: 2px solid #DC2626;
        }
        .word-learning {
          color: #D97706;
          font-weight: bold;
          border-bottom: 2px solid #F59E0B;
        }
        .word-mastered {
          color: inherit;
        }
        .sentence-highlight {
          color: #DC2626;
          background: rgba(254, 226, 226, 0.3);
          border-radius: 2px;
          padding: 1px 2px;
        }
        .paragraph-block {
          position: relative;
          padding: 8px 0;
        }
      `}</style>
    </div>
  )
}

export default DeepRead
