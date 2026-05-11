/**
 * 精读页面 - 文献深度阅读与笔记
 */
import { useState, useEffect, useRef } from 'react'
import useAppStore from '../stores/useAppStore'
import { structuredAPI, literatureAPI } from '../api/client'
import { formatDate, truncate, isMobile, isPortrait } from '../utils/helpers'
import { NOTE_MODES, LAYOUT_MODES, HIGHLIGHT_COLORS } from '../utils/constants'

function DeepRead() {
  const { settings, literatureTable, fetchLiteratureTable } = useAppStore()
  const [recentReadings, setRecentReadings] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLiterature, setSelectedLiterature] = useState(null)
  const [structuredContent, setStructuredContent] = useState('')
  const [notes, setNotes] = useState([])
  const [noteMode, setNoteMode] = useState(NOTE_MODES.inline.id)
  const [layoutMode, setLayoutMode] = useState('3:7')
  const [showTooltips, setShowTooltips] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0])
  const [isEditing, setIsEditing] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const contentRef = useRef(null)
  const textareaRef = useRef(null)

  // 加载文献表和最近阅读
  useEffect(() => {
    fetchLiteratureTable()
    loadRecentReadings()
  }, [])

  const loadRecentReadings = () => {
    // 从localStorage读取最近阅读
    const stored = localStorage.getItem('recentReadings')
    if (stored) {
      setRecentReadings(JSON.parse(stored))
    }
  }

  const saveRecentReading = (literature) => {
    const updated = [
      { ...literature, lastRead: new Date().toISOString() },
      ...recentReadings.filter(r => r.doi !== literature.doi)
    ].slice(0, 10)
    setRecentReadings(updated)
    localStorage.setItem('recentReadings', JSON.stringify(updated))
  }

  const handleSelectLiterature = async (item) => {
    setSelectedLiterature(item)
    saveRecentReading(item)
    
    // 加载结构化内容
    try {
      const content = await structuredAPI.getContent(item.doi)
      setStructuredContent(content?.content || '')
      
      // 加载笔记
      const notesData = await structuredAPI.listNotes(item.doi)
      setNotes(notesData || [])
    } catch (error) {
      console.error('Failed to load content:', error)
      setStructuredContent('')
      setNotes([])
    }
    
    setHasUnsavedChanges(false)
    setIsEditing(false)
  }

  const handleSearch = () => {
    if (!searchQuery.trim()) return
    
    // 搜索文献
    const results = literatureTable.filter(item => {
      const query = searchQuery.toLowerCase()
      return (
        item.doi?.toLowerCase().includes(query) ||
        item.title_cn?.toLowerCase().includes(query) ||
        item.title_en?.toLowerCase().includes(query)
      )
    })
    
    if (results.length > 0) {
      handleSelectLiterature(results[0])
    }
  }

  const handleTextSelection = () => {
    const selection = window.getSelection()
    const text = selection.toString().trim()
    if (text) {
      setSelectedText(text)
    }
  }

  const handleAddToWordList = async () => {
    if (!selectedText) return
    try {
      await fetch('/api/v1/learning/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word_en: selectedText,
          doi: selectedLiterature?.doi,
        }),
      })
      alert('已添加到单词本')
    } catch (error) {
      console.error('Failed to add word:', error)
    }
  }

  const handleAddToSentenceList = async () => {
    if (!selectedText) return
    try {
      await fetch('/api/v1/learning/sentences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence_en: selectedText,
          doi: selectedLiterature?.doi,
        }),
      })
      alert('已添加到长难句本')
    } catch (error) {
      console.error('Failed to add sentence:', error)
    }
  }

  const handleHighlight = () => {
    if (!selectedText) return
    // 简单的文本替换高亮（实际应保存到后端）
    const selection = window.getSelection()
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const span = document.createElement('span')
      span.style.backgroundColor = highlightColor.color
      span.style.padding = '2px 4px'
      span.style.borderRadius = '2px'
      range.surroundContents(span)
    }
  }

  const handleSaveContent = async () => {
    if (!selectedLiterature) return
    
    try {
      await structuredAPI.saveContent(selectedLiterature.doi, {
        content: structuredContent,
      })
      setHasUnsavedChanges(false)
      setIsEditing(false)
      alert('保存成功')
    } catch (error) {
      console.error('Failed to save:', error)
      alert('保存失败')
    }
  }

  const handleContentChange = (e) => {
    setStructuredContent(e.target.value)
    setHasUnsavedChanges(true)
  }

  const filteredLiterature = literatureTable.filter(item => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      item.doi?.toLowerCase().includes(query) ||
      item.title_cn?.toLowerCase().includes(query) ||
      item.title_en?.toLowerCase().includes(query)
    )
  })

  // 响应式布局判断
  const isMobileDevice = isMobile()
  const isPortraitMode = isPortrait()
  const effectiveLayoutMode = isMobileDevice && isPortraitMode ? 'vertical' : layoutMode

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-primary-blue mb-2">📖 文献精读</h1>
        <p className="text-text-secondary">深度阅读文献，添加笔记</p>
      </div>

      {/* 搜索栏 */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索 DOI 或标题..."
            className="input flex-1"
          />
          <button onClick={handleSearch} className="btn btn-primary">
            搜索
          </button>
        </div>
      </div>

      {/* 最近阅读列表（移动端横向滚动） */}
      {recentReadings.length > 0 && (
        <div className="bg-white rounded-xl p-4 card-shadow">
          <h3 className="font-semibold text-sm text-text-secondary mb-3">最近阅读</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {recentReadings.map((item) => (
              <div
                key={item.doi}
                onClick={() => handleSelectLiterature(item)}
                className={`flex-shrink-0 w-32 p-2 border rounded-lg cursor-pointer transition-all ${
                  selectedLiterature?.doi === item.doi
                    ? 'border-primary-blue bg-blue-50'
                    : 'border-gray-200 hover:border-primary-blue'
                }`}
              >
                <p className="text-xs font-medium line-clamp-2 mb-1">
                  {settings.displayLanguage === 'cn' ? item.title_cn : item.title_en}
                </p>
                <p className="text-xs text-text-secondary">{truncate(item.journal, 15)}</p>
                <p className="text-xs text-text-secondary mt-1">
                  {formatDate(item.lastRead, 'relative')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 文献列表（未选中时显示） */}
      {!selectedLiterature && (
        <div className="bg-white rounded-xl p-4 card-shadow">
          <h3 className="font-semibold text-text-main mb-3">文献列表 ({filteredLiterature.length})</h3>
          {filteredLiterature.length === 0 ? (
            <p className="text-center py-8 text-text-secondary">暂无文献，请先添加</p>
          ) : (
            <div className="space-y-2">
              {filteredLiterature.slice(0, 20).map((item) => (
                <div
                  key={item.doi}
                  onClick={() => handleSelectLiterature(item)}
                  className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-primary-blue hover:bg-gray-50 transition-all"
                >
                  <p className="font-medium text-sm">
                    {settings.displayLanguage === 'cn' ? item.title_cn : item.title_en}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">{item.journal}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 阅读区域（选中文献后显示） */}
      {selectedLiterature && (
        <div className="bg-white rounded-xl card-shadow overflow-hidden">
          {/* 工具栏 */}
          <div className="p-3 border-b border-gray-200 flex flex-wrap gap-2 items-center">
            <button
              onClick={() => setSelectedLiterature(null)}
              className="px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              ← 返回
            </button>
            
            <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block" />
            
            {/* 笔记模式切换 */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {Object.values(NOTE_MODES).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setNoteMode(mode.id)}
                  className={`px-2 py-1 text-xs rounded ${
                    noteMode === mode.id ? 'bg-white shadow' : 'hover:bg-gray-200'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            
            {/* 排版模式切换 */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {Object.values(LAYOUT_MODES).map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => setLayoutMode(layout.id)}
                  className={`px-2 py-1 text-xs rounded ${
                    layoutMode === layout.id ? 'bg-white shadow' : 'hover:bg-gray-200'
                  }`}
                >
                  {layout.id}
                </button>
              ))}
            </div>
            
            <div className="h-6 w-px bg-gray-300 mx-1" />
            
            {/* 高亮颜色 */}
            <div className="flex gap-1">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setHighlightColor(color)}
                  className={`w-5 h-5 rounded-full border-2 ${
                    highlightColor.id === color.id ? 'border-gray-800' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color.color }}
                  title={color.label}
                />
              ))}
            </div>
            
            <div className="h-6 w-px bg-gray-300 mx-1" />
            
            <button
              onClick={() => setShowTooltips(!showTooltips)}
              className={`px-2 py-1 text-xs rounded ${
                showTooltips ? 'bg-primary-blue text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              功能提示
            </button>
            
            <div className="flex-1" />
            
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveContent}
                  disabled={!hasUnsavedChanges}
                  className={`px-3 py-1 text-sm rounded-lg ${
                    hasUnsavedChanges
                      ? 'bg-primary-green text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setHasUnsavedChanges(false)
                  }}
                  className="px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  取消
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1 text-sm bg-primary-blue text-white rounded-lg hover:bg-opacity-90"
              >
                编辑
              </button>
            )}
          </div>
          
          {/* 功能提示 */}
          {showTooltips && (
            <div className="p-3 bg-blue-50 border-b border-blue-100 text-sm">
              <p className="text-text-secondary mb-2">📌 操作提示：</p>
              <ul className="list-disc list-inside space-y-1 text-text-main">
                <li>选中文字后点击右键添加词汇/长难句</li>
                <li>选中文字后选择颜色进行标记</li>
                <li>工具栏可切换笔记模式和排版</li>
                <li>点击编辑按钮进入原文编辑模式</li>
              </ul>
            </div>
          )}
          
          {/* 文献标题 */}
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-text-main">
              {settings.displayLanguage === 'cn' 
                ? selectedLiterature.title_cn 
                : selectedLiterature.title_en}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {selectedLiterature.journal} • {selectedLiterature.first_author}
            </p>
          </div>
          
          {/* 阅读区域 */}
          <div 
            ref={contentRef}
            onMouseUp={handleTextSelection}
            onContextMenu={(e) => {
              e.preventDefault()
              if (selectedText) {
                // 显示右键菜单
                const menu = document.createElement('div')
                menu.className = 'fixed bg-white shadow-lg rounded-lg py-2 z-50 border'
                menu.style.left = `${e.clientX}px`
                menu.style.top = `${e.clientY}px`
                menu.innerHTML = `
                  <button class="w-full px-4 py-2 text-sm text-left hover:bg-gray-100" data-action="word">📝 添加到单词本</button>
                  <button class="w-full px-4 py-2 text-sm text-left hover:bg-gray-100" data-action="sentence">📋 添加到长难句</button>
                  <button class="w-full px-4 py-2 text-sm text-left hover:bg-gray-100" data-action="highlight">🎨 高亮标记</button>
                  <button class="w-full px-4 py-2 text-sm text-left hover:bg-gray-100" data-action="copy">📋 复制</button>
                `
                document.body.appendChild(menu)
                
                const handleMenuClick = (event) => {
                  const action = event.target.dataset.action
                  if (action === 'word') handleAddToWordList()
                  else if (action === 'sentence') handleAddToSentenceList()
                  else if (action === 'highlight') handleHighlight()
                  else if (action === 'copy') navigator.clipboard.writeText(selectedText)
                  document.body.removeChild(menu)
                  document.removeEventListener('click', handleMenuClick)
                }
                
                setTimeout(() => {
                  document.addEventListener('click', handleMenuClick)
                }, 0)
              }
            }}
            className={`p-4 ${noteMode === NOTE_MODES.sidebar.id ? 'flex gap-4' : ''}`}
          >
            {/* 原文区域 */}
            <div className={noteMode === NOTE_MODES.sidebar.id 
              ? effectiveLayoutMode === '3:7' ? 'w-3/5' : 'w-3/10'
              : 'w-full'}>
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  value={structuredContent}
                  onChange={handleContentChange}
                  className="w-full min-h-[500px] p-4 border border-gray-200 rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  placeholder="在此输入 Markdown 格式的文献内容..."
                />
              ) : (
                <div className="prose prose-sm max-w-none">
                  {structuredContent ? (
                    <div className="whitespace-pre-wrap">{structuredContent}</div>
                  ) : (
                    <p className="text-text-secondary italic">
                      暂无结构化内容，请点击编辑按钮添加
                    </p>
                  )}
                </div>
              )}
            </div>
            
            {/* 笔记区域（边栏模式） */}
            {noteMode === NOTE_MODES.sidebar.id && (
              <div className={effectiveLayoutMode === '3:5:2' ? 'w-2/10' : 'w-2/5'}>
                <div className="sticky top-4">
                  <h3 className="font-semibold text-sm mb-2">📝 笔记</h3>
                  <div className="space-y-2">
                    {notes.length === 0 ? (
                      <p className="text-xs text-text-secondary">暂无笔记</p>
                    ) : (
                      notes.map((note) => (
                        <div key={note.id} className="p-2 bg-yellow-50 rounded text-sm">
                          <p className="text-xs text-text-secondary mb-1">
                            {formatDate(note.created_at, 'relative')}
                          </p>
                          <p>{note.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 底部占位 */}
      <div className="h-8" />
    </div>
  )
}

export default DeepRead
