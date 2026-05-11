/**
 * 文件管理弹窗组件 - 重写版
 */
import { useState, useEffect } from 'react'
import useAppStore from '../stores/useAppStore'
import { 
  literatureAPI, trackingAPI, learningAPI, noteAPI, 
  organizationAPI, attachmentAPI, structuredAPI 
} from '../api/client'

const tabs = [
  { id: 'tracking', label: '追踪管理' },
  { id: 'literature', label: '文献表' },
  { id: 'learning', label: '学习管理' },
  { id: 'notes', label: '笔记管理' },
  { id: 'organization', label: '标签合集' },
  { id: 'attachments', label: '附件管理' },
]

function FileManage({ isOpen, onClose, defaultTab = 'tracking' }) {
  const { fetchLiteratureTable } = useAppStore()
  const [activeTab, setActiveTab] = useState(defaultTab)
  
  // 各Tab数据
  const [trackingRecords, setTrackingRecords] = useState([])
  const [literatureTable, setLiteratureTable] = useState([])
  const [words, setWords] = useState([])
  const [sentences, setSentences] = useState([])
  const [notes, setNotes] = useState([])
  const [tags, setTags] = useState([])
  const [collections, setCollections] = useState([])
  const [attachments, setAttachments] = useState([])
  
  // 加载状态
  const [loading, setLoading] = useState(false)
  
  // 文献表相关状态
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [editingEntry, setEditingEntry] = useState(null)
  const [showExportModal, setShowExportModal] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab)
      fetchData()
    }
  }, [isOpen, defaultTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      const promises = [
        literatureAPI.listTable({ sort_by: sortBy, sort_order: sortOrder }),
        trackingAPI.listRecords(),
        learningAPI.listWords(),
        learningAPI.listSentences(),
        noteAPI.listGeneralNotes(),
        organizationAPI.listTags(),
        organizationAPI.listCollections(),
        attachmentAPI.list(),
      ]
      
      const [
        literature, tracking, wordsData, sentencesData, 
        notesData, tagsData, collectionsData, attachmentsData
      ] = await Promise.all(promises)
      
      setLiteratureTable(literature)
      setTrackingRecords(tracking)
      setWords(wordsData)
      setSentences(sentencesData)
      setNotes(notesData)
      setTags(tagsData)
      setCollections(collectionsData)
      setAttachments(attachmentsData)
      
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 文献表搜索和排序
  const filteredLiterature = literatureTable.filter(item => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      item.doi?.toLowerCase().includes(query) ||
      item.title_cn?.toLowerCase().includes(query) ||
      item.title_en?.toLowerCase().includes(query) ||
      item.journal?.toLowerCase().includes(query) ||
      item.first_author?.toLowerCase().includes(query)
    )
  })

  // 删除处理
  const handleDelete = async (type, id, cascade = false) => {
    const messages = {
      tracking: '确定要删除这条追踪记录吗？',
      literature: cascade 
        ? '确定要删除这篇文献及其所有关联数据（附件、结构性文献、卡片）吗？追踪记录将保留。'
        : '确定要删除这篇文献吗？',
      word: '确定要删除这个单词吗？',
      sentence: '确定要删除这个长难句吗？',
      note: '确定要删除这条笔记吗？',
      tag: '确定要删除这个标签吗？',
      collection: '确定要删除这个合集吗？',
      attachment: '确定要删除这个附件吗？',
    }

    if (!confirm(messages[type] || '确定要删除吗？')) return
    
    try {
      switch (type) {
        case 'tracking':
          await trackingAPI.deleteRecord(id)
          setTrackingRecords(prev => prev.filter(r => r.id !== id))
          break
        case 'literature':
          await literatureAPI.deleteTableEntry(id, cascade)
          setLiteratureTable(prev => prev.filter(l => l.doi !== id))
          break
        case 'word':
          await learningAPI.deleteWord(id)
          setWords(prev => prev.filter(w => w.id !== id))
          break
        case 'sentence':
          await learningAPI.deleteSentence(id)
          setSentences(prev => prev.filter(s => s.id !== id))
          break
        case 'note':
          await noteAPI.deleteGeneralNote(id)
          setNotes(prev => prev.filter(n => n.id !== id))
          break
        case 'tag':
          await organizationAPI.deleteTag(id)
          setTags(prev => prev.filter(t => t.id !== id))
          break
        case 'collection':
          await organizationAPI.deleteCollection(id)
          setCollections(prev => prev.filter(c => c.id !== id))
          break
        case 'attachment':
          await attachmentAPI.delete(id)
          setAttachments(prev => prev.filter(a => a.id !== id))
          break
      }
    } catch (error) {
      alert('删除失败: ' + error.message)
    }
  }

  // 更新文献条目
  const handleUpdateEntry = async (doi, data) => {
    try {
      await literatureAPI.updateTableEntry(doi, data)
      setLiteratureTable(prev => prev.map(l => 
        l.doi === doi ? { ...l, ...data } : l
      ))
      setEditingEntry(null)
    } catch (error) {
      alert('更新失败: ' + error.message)
    }
  }

  // 导出文献表
  const handleExport = async (format) => {
    try {
      const response = await fetch(
        `/api/v1/literature/table/export?format=${format}&sort_by=${sortBy}&sort_order=${sortOrder}`,
        { method: 'GET' }
      )
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `literature_table.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      setShowExportModal(false)
    } catch (error) {
      alert('导出失败: ' + error.message)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        {/* 弹窗头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-text-main">📁 文件管理</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab切换 */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'text-primary-blue border-b-2 border-primary-blue'
                  : 'text-text-secondary hover:text-primary-blue'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-primary-blue border-t-transparent rounded-full"></div>
              <p className="mt-4 text-text-secondary">加载中...</p>
            </div>
          ) : (
            <>
              {/* 追踪管理 */}
              {activeTab === 'tracking' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-text-main">追踪记录 ({trackingRecords.length})</h3>
                    <select
                      className="text-sm px-2 py-1 border rounded"
                      onChange={async (e) => {
                        const date = e.target.value
                        if (date) {
                          const records = await trackingAPI.getRecordsByDate(date)
                          setTrackingRecords(records)
                        } else {
                          const records = await trackingAPI.listRecords()
                          setTrackingRecords(records)
                        }
                      }}
                    >
                      <option value="">所有日期</option>
                    </select>
                  </div>
                  {trackingRecords.length === 0 ? (
                    <p className="text-text-secondary text-center py-8">暂无追踪记录</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-3 py-2 text-left">日期</th>
                            <th className="px-3 py-2 text-left">期刊</th>
                            <th className="px-3 py-2 text-left">标题</th>
                            <th className="px-3 py-2 text-left">DOI</th>
                            <th className="px-3 py-2 text-left">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trackingRecords.slice(0, 100).map((record) => (
                            <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-2">{record.date || '-'}</td>
                              <td className="px-3 py-2 max-w-[120px] truncate">{record.journal || '-'}</td>
                              <td className="px-3 py-2 max-w-[200px] truncate">{record.title_cn || record.title_en || '-'}</td>
                              <td className="px-3 py-2 max-w-[120px] truncate text-xs">{record.doi || '-'}</td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => handleDelete('tracking', record.id)}
                                  className="text-xs px-2 py-1 text-status-error hover:bg-red-50 rounded"
                                >
                                  删除
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 文献表 - 最详细 */}
              {activeTab === 'literature' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    <h3 className="font-medium text-text-main">文献表 ({filteredLiterature.length})</h3>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索 DOI、标题、期刊、作者..."
                      className="input flex-1 min-w-[200px]"
                    />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="text-sm px-2 py-1 border rounded"
                    >
                      <option value="created_at">按加入时间</option>
                      <option value="pubdate">按出版日期</option>
                      <option value="title_cn">按标题</option>
                      <option value="journal">按期刊</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="text-sm px-2 py-1 border rounded"
                    >
                      {sortOrder === 'asc' ? '↑ 升序' : '↓ 降序'}
                    </button>
                    <button
                      onClick={() => setShowExportModal(true)}
                      className="btn btn-secondary text-sm"
                    >
                      📥 导出
                    </button>
                  </div>

                  {filteredLiterature.length === 0 ? (
                    <p className="text-text-secondary text-center py-8">暂无文献</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-2 py-2 text-left font-medium text-text-secondary">DOI</th>
                            <th className="px-2 py-2 text-left font-medium text-text-secondary">中文标题</th>
                            <th className="px-2 py-2 text-left font-medium text-text-secondary">英文标题</th>
                            <th className="px-2 py-2 text-left font-medium text-text-secondary">期刊</th>
                            <th className="px-2 py-2 text-left font-medium text-text-secondary">出版日期</th>
                            <th className="px-2 py-2 text-left font-medium text-text-secondary">第一作者</th>
                            <th className="px-2 py-2 text-center font-medium text-text-secondary">附件</th>
                            <th className="px-2 py-2 text-center font-medium text-text-secondary">结构</th>
                            <th className="px-2 py-2 text-center font-medium text-text-secondary">卡片</th>
                            <th className="px-2 py-2 text-center font-medium text-text-secondary">笔记</th>
                            <th className="px-2 py-2 text-left font-medium text-text-secondary">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLiterature.slice(0, 200).map((item) => (
                            <tr key={item.doi} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-2 py-2 text-xs text-text-secondary max-w-[120px] truncate">
                                {item.doi}
                              </td>
                              <td className="px-2 py-2 max-w-[150px] truncate">{item.title_cn || '-'}</td>
                              <td className="px-2 py-2 max-w-[150px] truncate">{item.t