/**
 * 主布局组件 - 顶部横向导航 + 卷帘式收起/展开
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { literatureAPI, learningAPI, noteAPI } from '../api/client'

const navItems = [
  { path: '/', icon: '📡', label: '搜索追踪' },
  { path: '/browse', icon: '📑', label: '文献卡片' },
  { path: '/deep-read', icon: '📖', label: '读文献' },
  { path: '/learn', icon: '📚', label: '学习区' },
  { path: '/notes', icon: '✍️', label: '写作' },
  { path: '/manage', icon: '📁', label: '管理' },
  { path: '/settings', icon: '⚙️', label: '设置' },
]

// 全局搜索弹窗
function GlobalSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ literature: [], words: [], sentences: [], notes: [] })
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!query.trim()) {
      setResults({ literature: [], words: [], sentences: [], notes: [] })
      return
    }
    const search = async () => {
      setLoading(true)
      try {
        const [lit, words, sentences, notes] = await Promise.all([
          literatureAPI.searchTable(query, true, true).catch(() => []),
          learningAPI.listWords().catch(() => []),
          learningAPI.listSentences().catch(() => []),
          noteAPI.listGeneralNotes().catch(() => []),
        ])
        const filteredWords = words.filter(w => 
          w.word_en?.toLowerCase().includes(query.toLowerCase()) || 
          w.word_cn?.toLowerCase().includes(query.toLowerCase())
        )
        const filteredSentences = sentences.filter(s =>
          s.sentence_en?.toLowerCase().includes(query.toLowerCase())
        )
        const filteredNotes = notes.filter(n =>
          n.title?.toLowerCase().includes(query.toLowerCase()) ||
          n.content?.toLowerCase().includes(query.toLowerCase())
        )
        setResults({ literature: lit, words: filteredWords, sentences: filteredSentences, notes: filteredNotes })
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setLoading(false)
      }
    }
    const timer = setTimeout(search, 300)
    return () => clearTimeout(timer)
  }, [query])

  if (!isOpen) return null

  const hasResults = results.literature.length > 0 || results.words.length > 0 || 
                     results.sentences.length > 0 || results.notes.length > 0

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索文献、单词、长难句、笔记... (Ctrl+K)"
              className="flex-1 text-lg outline-none"
            />
            {loading && <div className="animate-spin w-5 h-5 border-2 border-[#4DBBD5] border-t-transparent rounded-full" />}
          </div>
        </div>
        <div className="max-h-[400px] overflow-auto p-2">
          {!query.trim() && (
            <p className="text-gray-400 text-center py-8">输入关键词开始搜索</p>
          )}
          {query.trim() && !loading && !hasResults && (
            <p className="text-gray-400 text-center py-8">未找到相关结果</p>
          )}
          {results.literature.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm text-gray-500 px-2 py-1">📚 文献</h4>
              {results.literature.slice(0, 5).map(item => (
                <div key={item.doi} className="px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                  <div className="font-medium text-sm truncate">{item.title_cn || item.title_en || '无标题'}</div>
                  <div className="text-xs text-gray-500">{item.journal} • {item.doi}</div>
                </div>
              ))}
            </div>
          )}
          {results.words.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm text-gray-500 px-2 py-1">📖 单词</h4>
              {results.words.slice(0, 5).map(word => (
                <div key={word.id} className="px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                  <span className="font-medium">{word.word_en}</span>
                  <span className="text-gray-500 ml-2">{word.word_cn}</span>
                </div>
              ))}
            </div>
          )}
          {results.sentences.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm text-gray-500 px-2 py-1">📝 长难句</h4>
              {results.sentences.slice(0, 5).map(sentence => (
                <div key={sentence.id} className="px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                  <div className="text-sm truncate">{sentence.sentence_en?.slice(0, 80)}...</div>
                </div>
              ))}
            </div>
          )}
          {results.notes.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm text-gray-500 px-2 py-1">📋 笔记</h4>
              {results.notes.slice(0, 5).map(note => (
                <div key={note.id} className="px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                  <div className="font-medium text-sm">{note.title || '无标题'}</div>
                  <div className="text-xs text-gray-500 truncate">{note.content?.slice(0, 50)}...</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-2 border-t text-xs text-gray-400 flex justify-between">
          <span>按 ESC 关闭</span>
          <span>按 Enter 跳转</span>
        </div>
      </div>
    </div>
  )
}

function Layout() {
  const [showSearch, setShowSearch] = useState(false)
  const [navExpanded, setNavExpanded] = useState(true)
  const dragState = useRef({ isDragging: false, startY: 0, didDrag: false })

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
      if (e.key === 'Escape') {
        setShowSearch(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 卷帘拖拽：开始
  const handleDragStart = useCallback((clientY) => {
    dragState.current = { isDragging: true, startY: clientY, didDrag: false }
  }, [])

  // 卷帘拖拽：结束
  const handleDragEnd = useCallback((clientY) => {
    if (!dragState.current.isDragging) return
    const delta = dragState.current.startY - clientY
    if (Math.abs(delta) > 25) {
      dragState.current.didDrag = true
      setNavExpanded(delta < 0) // 向下拉 = 展开，向上拉 = 收起
    }
    dragState.current.isDragging = false
  }, [])

  // 卷帘手柄点击（非拖拽时才切换）
  const handleToggle = useCallback(() => {
    if (!dragState.current.didDrag) {
      setNavExpanded(prev => !prev)
    }
    dragState.current.didDrag = false
  }, [])

  // 鼠标拖拽事件
  useEffect(() => {
    const onMouseUp = (e) => handleDragEnd(e.clientY)
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [handleDragEnd])

  // 触摸拖拽事件
  useEffect(() => {
    const onTouchEnd = (e) => handleDragEnd(e.changedTouches[0].clientY)
    window.addEventListener('touchend', onTouchEnd)
    return () => window.removeEventListener('touchend', onTouchEnd)
  }, [handleDragEnd])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 顶部导航栏 - 卷帘式收起/展开 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        {/* 标题行 - 始终可见 */}
        <div className="px-4 py-2.5 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[#4DBBD5] flex items-center gap-2">
            <span className="text-2xl">🐱</span>
            <span className="hidden sm:inline">Cat - 学术文献全流程工具</span>
            <span className="sm:hidden">Cat</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(true)}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
            >
              <span>🔍</span>
              <span className="hidden sm:inline">搜索</span>
              <kbd className="hidden sm:inline text-xs bg-gray-200 px-1 rounded">Ctrl+K</kbd>
            </button>
          </div>
        </div>

        {/* 导航标签行 - 卷帘部分，可收起/展开 */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            navExpanded ? 'max-h-14 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <nav className="px-2 pb-1">
            <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap rounded-lg transition-colors ${
                      isActive
                        ? 'text-[#4DBBD5] bg-[#4DBBD5]/10 font-medium'
                        : 'text-gray-500 hover:text-[#4DBBD5] hover:bg-gray-50'
                    }`
                  }
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        </div>

        {/* 卷帘手柄 - 可拖拽/点击收起展开 */}
        <div
          className="flex flex-col items-center py-0.5 cursor-ns-resize select-none hover:bg-gray-50 active:bg-gray-100 transition-colors"
          onMouseDown={(e) => handleDragStart(e.clientY)}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onClick={handleToggle}
        >
          <div className={`w-10 h-1 rounded-full transition-all duration-300 ${
            navExpanded ? 'bg-gray-300' : 'bg-[#4DBBD5]'
          }`} />
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-300 ${
              navExpanded ? 'rotate-0' : 'rotate-180'
            }`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-4">
          <Outlet />
        </div>
      </main>

      {/* 全局搜索弹窗 */}
      <GlobalSearch isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  )
}

export default Layout
