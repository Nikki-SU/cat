/**
 * 主布局组件 - 增强版
 */
import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { literatureAPI, learningAPI, noteAPI } from '../api/client'

const tabs = [
  { path: '/', icon: '📡', label: '追踪' },
  { path: '/browse', icon: '📑', label: '略读' },
  { path: '/deep-read', icon: '📖', label: '精读' },
  { path: '/manage', icon: '📁', label: '管理' },
  { path: '/notes', icon: '📝', label: '笔记' },
  { path: '/learn', icon: '📚', label: '学习' },
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
        // 在客户端过滤搜索结果
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
            {loading && <div className="animate-spin w-5 h-5 border-2 border-[#4DBBD5] border-t-transparent rounded-full"></div>}
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

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K: 打开全局搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
      // ESC: 关闭搜索
      if (e.key === 'Escape') {
        setShowSearch(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h1 className="text-lg font-semibold text-[#4DBBD5] flex items-center gap-2">
            <span className="text-2xl">🐱</span>
            <span className="hidden sm:inline">Cat - 学术文献全流程工具</span>
          </h1>
          
          <div className="flex items-center gap-2">
            {/* 搜索按钮 */}
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
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto pb-20">
        <div className="max-w-4xl mx-auto p-4">
          <Outlet />
        </div>
      </main>

      {/* 底部Tab导航 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-inset-bottom">
        <div className="max-w-4xl mx-auto flex justify-around">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-3 text-xs transition-colors min-w-[60px] ${
                  isActive
                    ? 'text-[#4DBBD5]'
                    : 'text-gray-500 hover:text-[#4DBBD5]'
                }`
              }
            >
              <span className="text-xl mb-0.5">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* 全局搜索 */}
      <GlobalSearch isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  )
}

export default Layout
