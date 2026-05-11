/**
 * 精读页面 - 重写版
 * 功能：
 * - Markdown渲染与编辑
 * - 笔记系统（行间/边栏模式）
 * - 划词功能（翻译、加入词汇本/长难句）
 * - 颜色-结构快捷设置
 * - 响应式布局
 * - 搜索功能
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import useAppStore from '../stores/useAppStore'
import { structuredAPI, literatureAPI, learningAPI, attachmentAPI } from '../api/client'
import { isMobile, isPortrait } from '../utils/helpers'

// 笔记模式
const NOTE_MODES = {
  inline: { id: 'inline', label: '行间模式', icon: '📝' },
  sidebar: { id: 'sidebar', label: '边栏模式', icon: '📑' }
}

// 布局模式
const LAYOUT_MODES = {
  standard: { id: 'standard', label: '标准', ratio: '1:0' },
  split37: { id: 'split37', label: '3:7', ratio: '3:7' },
  split352: { id: 'split352', label: '3:5:2', ratio: '3:5:2' }
}

// 高亮颜色
const HIGHLIGHT_COLORS = [
  { id: 'yellow', color: '#FEF08A', label: '黄色' },
  { id: 'green', color: '#BBF7D0', label: '绿色' },
  { id: 'blue', color: '#BFDBFE', label: '蓝色' },
  { id: 'pink', color: '#FBCFE8', label: '粉色' },
  { id: 'orange', color: '#FED7AA', label: '橙色' },
  { id: 'purple', color: '#DDD6FE', label: '紫色' },
]

// 颜色-结构预设
const COLOR_STRUCTURE_PRESETS = [
  { name: '方法', color: '#BFDBFE', description: 'Methods' },
  { name: '结果', color: '#BBF7D0', description: 'Results' },
  { name: '讨论', color: '#FED7AA', description: 'Discussion' },
  { name: '结论', color: '#FBCFE8', description: 'Conclusion' },
  { name: '背景', color: '#E5E7EB', description: 'Background' },
]

function DeepRead() {
  const { settings, literatureTable, fetchLiteratureTable } = useAppStore()
  
  // 文献选择
  const [selectedLiterature, setSelectedLiterature] = useState(null)
  const [recentReadings, setRecentReadings] = useState([])
  
  // 内容相关
  const [structuredContent, setStructuredContent] = useState('')
  const [notes, setNotes] = useState([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  // 模式相关
  const [noteMode, setNoteMode] = useState(NOTE_MODES.inline)
  const [layoutMode, setLayoutMode] = useState(LAYOUT_MODES.split37)
  const [isEditing, setIsEditing] = useState(false)
  
  // 搜索相关
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState('content') // content | all | notes
  const [searchResults, setSearchResults] = useState([])
  const [currentHighlight, setCurrentHighlight] = useState(0)
  
  // 划词相关
  const [selectedText, setSelectedText] = useState('')
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [translateResult, setTranslateResult] = useState('')
  const [showTranslateModal, setShowTranslateModal] = useState(false)
  
  // 颜色-结构
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0])
  const [colorMappings, setColorMappings] = useState(COLOR_STRUCTURE_PRESETS)
  
  // 上传相关
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [parseProgress, setParseProgress] = useState(0)
  
  // 笔记编辑
  const [editingNote, setEditingNote] = useState(null)
  const [newNoteContent, setNewNoteContent] = useState('')
  
  const contentRef = useRef(null)
  const textareaRef = useRef(null)
  
  // 加载数据
  useEffect(() => {
    fetchLiteratureTable()
    loadRecentReadings()
  }, [])
  
  // 加载最近阅读
  const loadRecentReadings = () => {
    const stored = localStorage.getItem('recentReadings')
    if (stored) {
      setRecentReadings(JSON.parse(stored))
    }
  }
  
  // 保存最近阅读
  const saveRecentReading = (item) => {
    const updated = [
      { ...item, lastRead: new Date().toISOString() },
      ...recentReadings.filter(r => r.doi !== item.doi)
    ].slice(0, 10)
    setRecentReadings(updated)
    localStorage.setItem('recentReadings', JSON.stringify(updated))
  }
  
  // 选择文献
  const handleSelectLiterature = async (item) => {
    // 保存当前未保存的内容
    if (hasUnsavedChanges && selectedLiterature) {
      if (!confirm('当前有未保存的内容，确定要离开吗？')) {
        return
      }
    }
    
    setSelectedLiterature(item)
    saveRecentReading(item)
    
    // 加载结构化内容
    try {
      const content = await structuredAPI.getLiterature(item.doi)
      setStructuredContent(content?.content || '')
      
      // 加载笔记
      const notesData = await structuredAPI.listNotes({ doi: item.doi })
      setNotes(notesData || [])
    } catch (error) {
      console.error('Failed to load content:', error)
      setStructuredContent('')
      setNotes([])
    }
    
    setHasUnsavedChanges(false)
    setIsEditing(false)
  }
  
  // 保存内容
  const handleSaveContent = async () => {
    if (!selectedLiterature) return
    
    try {
      await structuredAPI.updateLiterature(selectedLiterature.doi, {
        content: structuredContent
      })
      setHasUnsavedChanges(false)
      setIsEditing(false)
      alert('保存成功')
    } catch (error) {
      console.error('Failed to save:', error)
      alert('保存失败')
    }
  }
  
  // 内容变化
  const handleContentChange = (value) => {
    setStructuredContent(value || '')
    setHasUnsavedChanges(true)
  }
  
  // 文本选择
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection()
    const text = selection.toString().trim()
    if (text && text.length > 0) {
      setSelectedText(text)
      
      // 获取选择位置
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setContextMenuPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10
      })
    }
  }, [])
  
  // 右键菜单
  const handleContextMenu = (e) => {
    e.preventDefault()
    const selection = window.getSelection()
    const text = selection.toString().trim()
    if (text) {
      setSelectedText(text)
      setContextMenuPosition({ x: e.clientX, y: e.clientY })
      setShowContextMenu(true)
    }
  }
  
  // 关闭右键菜单
  useEffect(() => {
    const handleClick = () => setShowContextMenu(false)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])
  
  // 翻译选中文本
  const handleTranslate = async () => {
    if (!selectedText) return
    setShowTranslateModal(true)
    setTranslateResult('翻译中...')
    
    try {
      const response = await fetch('/api/v1/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText })
      })
      const result = await response.json()
      setTranslateResult(result.translation || result.error || '翻译失败')
    } catch (error) {
      setTranslateResult('翻译失败: ' + error.message)
    }
  }
  
  // 加入词汇本
  const handleAddToWordList = async () => {
    if (!selectedText || !selectedLiterature) return
    
    try {
      const response = await fetch('/api/v1/ai/complete-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          word_en: selectedText,
          context: structuredContent.substring(0, 500)
        })
      })
      const result = await response.json()
      
      if (result.success) {
        await learningAPI.createWord({
          word_en: selectedText,
          word_cn: result.word_cn,
          definition_en: result.definition_en,
          definition_cn: result.definition_cn,
          sentence: result.sentence,
          doi: selectedLiterature.doi,
          status: 'new'
        })
        alert('已添加到单词本')
      } else {
        // 直接添加
        await learningAPI.createWord({
          word_en: selectedText,
          doi: selectedLiterature.doi,
          status: 'new'
        })
        alert('已添加到单词本（请手动补全信息）')
      }
    } catch (error) {
      console.error('Failed to add word:', error)
      alert('添加失败')
    }
  }
  
  // 加入长难句
  const handleAddToSentenceList = async () => {
    if (!selectedText || !selectedLiterature) return
    
    try {
      const response = await fetch('/api/v1/ai/translate-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence_en: selectedText })
      })
      const result = await response.json()
      
      await learningAPI.createSentence({
        sentence_en: selectedText,
        sentence_cn: result.sentence_cn || '',
        doi: selectedLiterature.doi,
        status: 'new'
      })
      alert('已添加到长难句本')
    } catch (error) {
      console.error('Failed to add sentence:', error)
      alert('添加失败')
    }
  }
  
  // 添加笔记
  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !selectedLiterature) return
    
    try {
      const note = await structuredAPI.createNote({
        doi: selectedLiterature.doi,
        note_type: 'markdown',
        content: newNoteContent,
        position: ''
      })
      setNotes([...notes, note])
      setNewNoteContent('')
      setEditingNote(null)
    } catch (error) {
      console.error('Failed to add note:', error)
      alert('添加失败')
    }
  }
  
  // 删除笔记
  const handleDeleteNote = async (noteId) => {
    if (!confirm('确定要删除这条笔记吗？')) return
    
    try {
      await structuredAPI.deleteNote(noteId)
      setNotes(notes.filter(n => n.id !== noteId))
    } catch (error) {
      console.error('Failed to delete note:', error)
      alert('删除失败')
    }
  }
  
  // 搜索
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    
    const results = []
    const query = searchQuery.toLowerCase()
    
    // 搜索文献
    if (searchMode === 'content' || searchMode === 'all') {
      literatureTable.forEach(item => {
        if (
          item.title_cn?.toLowerCase().includes(query) ||
          item.title_en?.toLowerCase().includes(query) ||
          item.doi?.toLowerCase().includes(query)
        ) {
          results.push({ type: 'literature', item })
        }
      })
    }
    
    // 搜索笔记
    if (searchMode === 'notes' || searchMode === 'all') {
      notes.forEach(note => {
        if (note.content?.toLowerCase().includes(query)) {
          results.push({ type: 'note', note, literature: selectedLiterature })
        }
      })
    }
    
    setSearchResults(results)
    setCurrentHighlight(0)
  }
  
  // 下一个搜索结果
  const handleNextResult = () => {
    if (searchResults.length > 0) {
      setCurrentHighlight((prev) => (prev + 1) % searchResults.length)
    }
  }
  
  // 上一个搜索结果
  const handlePrevResult = () => {
    if (searchResults.length > 0) {
      setCurrentHighlight((prev) => (prev - 1 + searchResults.length) % searchResults.length)
    }
  }
  
  // 上传文件
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedLiterature) return
    
    setUploadingFile(file)
    setIsUploading(true)
    setParseProgress(0)
    
    try {
      // 上传并解析
      const response = await attachmentAPI.uploadWithParse(
        selectedLiterature.doi,
        file,
        'auto'
      )
      
      if (response.attachment) {
        setParseProgress(50)
        
        if (response.parse_result?.success) {
          setParseProgress(100)
          // 刷新内容
          const content = await structuredAPI.getLiterature(selectedLiterature.doi)
          setStructuredContent(content?.content || '')
          alert('文件上传并解析成功！')
        } else {
          setParseProgress(100)
          alert('文件上传成功，但解析未完成: ' + (response.parse_result?.error || '未知错误'))
        }
      }
    } catch (error) {
      console.error('Upload failed:', error)
      alert('上传失败: ' + error.message)
    } finally {
      setIsUploading(false)
      setUploadingFile(null)
      setShowUploadModal(false)
    }
  }
  
  // 响应式布局判断
  const isMobileDevice = isMobile()
  const isPortraitMode = isPortrait()
  
  // 渲染笔记内容
  const renderNotes = () => {
    if (noteMode === NOTE_MODES.inline) {
      // 行间模式 - 在内容末尾显示笔记
      return (
        <div className="mt-4 space-y-2">
          {notes.map(note => (
            <div key={note.id} className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r">
              <div className="flex justify-between items-start">
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {note.content}
                  </ReactMarkdown>
                </div>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="text-xs text-status-error hover:bg-red-50 px-1 ml-2"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
          
          {/* 添加笔记 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="输入笔记内容（支持Markdown）..."
              className="input min-h-[80px]"
            />
            <button
              onClick={handleAddNote}
              disabled={!newNoteContent.trim()}
              className="btn btn-primary mt-2"
            >
              添加笔记
            </button>
          </div>
        </div>
      )
    }
    
    // 边栏模式
    return (
      <div className="h-full overflow-auto p-4 bg-gray-50">
        <h3 className="font-semibold mb-3">📝 笔记</h3>
        
        <div className="space-y-2">
          {notes.map(note => (
            <div key={note.id} className="p-3 bg-white rounded shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs text-text-secondary">
                  {new Date(note.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="text-xs text-status-error hover:bg-red-50 px-1"
                >
                  ×
                </button>
              </div>
              <div className="prose prose-sm max-w-none mt-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {note.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4">
          <textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="添加新笔记..."
            className="input min-h-[100px]"
          />
          <button
            onClick={handleAddNote}
            disabled={!newNoteContent.trim()}
            className="btn btn-primary w-full mt-2"
          >
            添加
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* 顶部搜索栏 */}
      <div className="bg-white border-b px-4 py-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索文献或笔记..."
            className="input flex-1"
          />
          <select
            value={searchMode}
            onChange={(e) => setSearchMode(e.target.value)}
            className="text-sm px-2 border rounded"
          >
            <option value="content">只搜文献</option>
            <option value="all">文献+笔记</option>
            <option value="notes">只搜笔记</option>
          </select>
          <button onClick={handleSearch} className="btn btn-primary">搜索</button>
        </div>
        
        {/* 搜索结果导航 */}
        {searchResults.length > 0 && (
          <div className="flex justify-between items-center mt-2 text-sm">
            <span className="text-text-secondary">
              找到 {searchResults.length} 个结果
            </span>
            <div className="flex gap-1">
              <button onClick={handlePrevResult} className="px-2 py-1 bg-gray-100 rounded">↑</button>
              <span>{currentHighlight + 1}/{searchResults.length}</span>
              <button onClick={handleNextResult} className="px-2 py-1 bg-gray-100 rounded">↓</button>
            </div>
          </div>
        )}
      </div>
      
      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧边栏 - 文献列表和颜色设置 */}
        <div className="w-64 border-r overflow-auto bg-gray-50 hidden md:block">
          {/* 文献选择 */}
          <div className="p-4">
            <h3 className="font-semibold mb-2">📚 文献列表</h3>
            <div className="space-y-1">
              {literatureTable.slice(0, 20).map(item => (
                <button
                  key={item.doi}
                  onClick={() => handleSelectLiterature(item)}
                  className={`w-full text-left p-2 rounded text-sm truncate ${
                    selectedLiterature?.doi === item.doi 
                      ? 'bg-primary-blue text-white' 
                      : 'hover:bg-gray-200'
                  }`}
 