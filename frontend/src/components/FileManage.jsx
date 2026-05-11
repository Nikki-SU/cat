/**
 * 文件管理弹窗组件 - 增强版
 */
import { useState, useEffect, useMemo } from 'react'
import { literatureAPI, trackingAPI, learningAPI, noteAPI, organizationAPI, attachmentAPI } from '../api/client'

const tabs = [
  { id: 'tracking', label: '追踪管理' },
  { id: 'literature', label: '文献表' },
  { id: 'learning', label: '学习管理' },
  { id: 'notes', label: '笔记管理' },
  { id: 'organization', label: '标签合集' },
  { id: 'attachments', label: '附件管理' },
]

// 标签颜色
const tagColors = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-yellow-100 text-yellow-700',
  'bg-pink-100 text-pink-700',
  'bg-purple-100 text-purple-700',
  'bg-indigo-100 text-indigo-700',
]

function getTagColor(name) {
  const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
  return tagColors[hash % tagColors.length]
}

function FileManage({ isOpen, onClose, defaultTab = 'tracking' }) {
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
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportTags, setExportTags] = useState([])
  
  // 标签管理状态
  const [tagSearchQuery, setTagSearchQuery] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [allTagNames, setAllTagNames] = useState([])
  
  // 合集管理状态
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [collectionItems, setCollectionItems] = useState([])
  const [collectionFilterTag, setCollectionFilterTag] = useState('')
  const [collectionFilterType, setCollectionFilterType] = useState('')
  const [showCollectionModal, setShowCollectionModal] = useState(false)
  const [editingCollection, setEditingCollection] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab)
      fetchData()
      fetchAllTagNames()
    }
  }, [isOpen, defaultTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [literature, tracking, wordsData, sentencesData, notesData, tagsData, collectionsData, attachmentsData] = 
        await Promise.all([
          literatureAPI.listTable({ sort_by: sortBy, sort_order: sortOrder }),
          trackingAPI.listRecords(),
          learningAPI.listWords(),
          learningAPI.listSentences(),
          noteAPI.listGeneralNotes(),
          organizationAPI.listTags(),
          organizationAPI.listCollections(),
          attachmentAPI.list(),
        ])
      
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

  const fetchAllTagNames = async () => {
    try {
      const names = await organizationAPI.getAllTagNames()
      setAllTagNames(names || [])
    } catch (error) {
      console.error('Failed to fetch tag names:', error)
    }
  }

  // 文献表搜索
  const filteredLiterature = useMemo(() => {
    if (!searchQuery.trim()) return literatureTable
    const query = searchQuery.toLowerCase()
    return literatureTable.filter(item =>
      item.doi?.toLowerCase().includes(query) ||
      item.title_cn?.toLowerCase().includes(query) ||
      item.title_en?.toLowerCase().includes(query) ||
      item.journal?.toLowerCase().includes(query) ||
      item.first_author?.toLowerCase().includes(query)
    )
  }, [literatureTable, searchQuery])

  // 获取文献的标签
  const getTagsForDoi = (doi) => tags.filter(t => t.doi === doi)

  // 按DOI分组的标签
  const tagsByDoi = useMemo(() => {
    const grouped = {}
    tags.forEach(tag => {
      if (tag.doi) {
        if (!grouped[tag.doi]) grouped[tag.doi] = []
        grouped[tag.doi].push(tag)
      }
    })
    return grouped
  }, [tags])

  // 过滤后的标签
  const filteredTags = useMemo(() => {
    if (!tagSearchQuery.trim()) return tags
    const query = tagSearchQuery.toLowerCase()
    return tags.filter(t => t.name.toLowerCase().includes(query))
  }, [tags, tagSearchQuery])

  // 合集条目过滤
  const filteredCollectionItems = useMemo(() => {
    if (!collectionItems.length) return []
    let items = collectionItems
    if (collectionFilterTag) {
      const tagDoiSet = new Set(tags.filter(t => t.name === collectionFilterTag && t.doi).map(t => t.doi))
      items = items.filter(i => i.doi && tagDoiSet.has(i.doi))
    }
    if (collectionFilterType) {
      items = items.filter(i => i.item_type === collectionFilterType)
    }
    return items
  }, [collectionItems, collectionFilterTag, collectionFilterType, tags])

  // 删除处理
  const handleDelete = async (type, id, cascade = false) => {
    const messages = {
      tracking: '确定要删除这条追踪记录吗？',
      literature: cascade ? '确定要删除这篇文献及其所有关联数据吗？追踪记录将保留。' : '确定要删除这篇文献吗？',
      word: '确定要删除这个单词吗？',
      sentence: '确定要删除这个长难句吗？',
      note: '确定要删除这条笔记吗？',
      tag: '确定要删除这个标签吗？',
      collection: '确定要删除这个合集吗？',
      collectionItem: '确定要从合集中移除这条记录吗？',
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
        case 'collectionItem':
          await organizationAPI.removeItemFromCollection(selectedCollection.id, id)
          setCollectionItems(prev => prev.filter(i => i.id !== id))
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

  // 添加标签
  const handleAddTag = async (doi, tagName) => {
    if (!tagName.trim()) return
    try {
      const newTag = await organizationAPI.createTag({ name: tagName.trim(), doi })
      setTags(prev => [...prev, newTag])
      setTagInput('')
    } catch (error) {
      alert('添加标签失败: ' + error.message)
    }
  }

  // 删除标签
  const handleRemoveTag = async (tagId) => {
    try {
      await organizationAPI.deleteTag(tagId)
      setTags(prev => prev.filter(t => t.id !== tagId))
    } catch (error) {
      alert('删除标签失败: ' + error.message)
    }
  }

  // 创建/更新合集
  const handleSaveCollection = async (name, description) => {
    try {
      if (editingCollection) {
        const updated = await organizationAPI.updateCollection(editingCollection.id, { name, description })
        setCollections(prev => prev.map(c => c.id === editingCollection.id ? updated : c))
      } else {
        const created = await organizationAPI.createCollection({ name, description })
        setCollections(prev => [...prev, created])
      }
      setShowCollectionModal(false)
      setEditingCollection(null)
    } catch (error) {
      alert('保存失败: ' + error.message)
    }
  }

  // 选择合集
  const handleSelectCollection = async (collection) => {
    setSelectedCollection(collection)
    try {
      const items = await organizationAPI.getCollectionItems(collection.id)
      setCollectionItems(items)
    } catch (error) {
      console.error('Failed to fetch collection items:', error)
      setCollectionItems([])
    }
  }

  // 导出文献表
  const handleExport = async (format, byTags = false) => {
    try {
      let url
      if (byTags && exportTags.length > 0) {
        url = `/api/v1/literature/table/export-by-tags?tags=${exportTags.join(',')}&format=${format}`
      } else {
        url = `/api/v1/literature/table/export?format=${format}&sort_by=${sortBy}&sort_order=${sortOrder}`
      }
      
      const response = await fetch(url)
      const blob = await response.blob()
      const urlObj = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = urlObj
      a.download = byTags ? `literature_by_tags.${format}` : `literature_table.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(urlObj)
      document.body.removeChild(a)
      setShowExportModal(false)
    } catch (error) {
      alert('导出失败: ' + error.message)
    }
  }

  // 切换标签选择
  const toggleExportTag = (tagName) => {
    setExportTags(prev => 
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">📁 文件管理</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
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
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-blue-500'
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
              <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              <p className="mt-4 text-gray-500">加载中...</p>
            </div>
          ) : (
            <>
              {/* 追踪管理 */}
              {activeTab === 'tracking' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-gray-700">追踪记录 ({trackingRecords.length})</h3>
                  </div>
                  {trackingRecords.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">暂无追踪记录</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-3 py-2 text-left text-gray-600">日期</th>
                            <th className="px-3 py-2 text-left text-gray-600">期刊</th>
                            <th className="px-3 py-2 text-left text-gray-600">标题</th>
                            <th className="px-3 py-2 text-left text-gray-600">DOI</th>
                            <th className="px-3 py-2 text-left text-gray-600">操作</th>
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
                                <button onClick={() => handleDelete('tracking', record.id)} className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded">
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

              {/* 文献表 */}
              {activeTab === 'literature' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    <h3 className="font-medium text-gray-700">文献表 ({filteredLiterature.length})</h3>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索..."
                      className="px-3 py-1 text-sm border rounded flex-1 min-w-[200px]"
                    />
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-sm px-2 py-1 border rounded">
                      <option value="created_at">按加入时间</option>
                      <option value="pubdate">按出版日期</option>
                      <option value="title_cn">按标题</option>
                      <option value="journal">按期刊</option>
                    </select>
                    <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="text-sm px-2 py-1 border rounded">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                    <button onClick={() => setShowExportModal(true)} className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded">
                      📥 导出
                    </button>
                  </div>

                  {filteredLiterature.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">暂无文献</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-2 py-2 text-left text-gray-600">标签</th>
                            <th className="px-2 py-2 text-left text-gray-600">DOI</th>
                            <th className="px-2 py-2 text-left text-gray-600">中文标题</th>
                            <th className="px-2 py-2 text-left text-gray-600">期刊</th>
                            <th className="px-2 py-2 text-center text-gray-600">附</th>
                            <th className="px-2 py-2 text-center text-gray-600">结</th>
                            <th className="px-2 py-2 text-center text-gray-600">卡</th>
                            <th className="px-2 py-2 text-left text-gray-600">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLiterature.slice(0, 200).map((item) => {
                            const itemTags = tagsByDoi[item.doi] || []
                            return (
                              <tr key={item.doi} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-2 py-2 max-w-[150px]">
                                  <div className="flex flex-wrap gap-1">
                                    {itemTags.slice(0, 3).map(tag => (
                                      <span key={tag.id} className={`px-1.5 py-0.5 text-xs rounded ${getTagColor(tag.name)}`}>
                                        {tag.name}
                                        <button onClick={() => handleRemoveTag(tag.id)} className="ml-1 hover:text-red-600">×</button>
                                      </span>
                                    ))}
                                    {itemTags.length > 3 && (
                                      <span className="text-xs text-gray-400">+{itemTags.length - 3}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-xs max-w-[100px] truncate text-gray-500">{item.doi}</td>
                                <td className="px-2 py-2 max-w-[150px] truncate">{item.title_cn || '-'}</td>
                                <td className="px-2 py-2 max-w-[100px] truncate text-gray-500">{item.journal || '-'}</td>
                                <td className="px-2 py-2 text-center">{item.has_attachment ? '✓' : '-'}</td>
                                <td className="px-2 py-2 text-center">{item.has_structured ? '✓' : '-'}</td>
                                <td className="px-2 py-2 text-center">{item.has_card ? '✓' : '-'}</td>
                                <td className="px-2 py-2">
                                  <button onClick={() => handleDelete('literature', item.doi, false)} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded">
                                    删除
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 学习管理 */}
              {activeTab === 'learning' && (
                <div className="space-y-6">
                  {/* 单词 */}
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">单词 ({words.length})</h3>
                    {words.length === 0 ? (
                      <p className="text-gray-400">暂无单词</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-auto">
                        {words.slice(0, 100).map(word => (
                          <div key={word.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                            <span className="font-medium">{word.word_en}</span>
                            <span className="text-gray-500 truncate ml-2">{word.word_cn || '-'}</span>
                            <button onClick={() => handleDelete('word', word.id)} className="text-red-400 hover:text-red-600 ml-2">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* 长难句 */}
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">长难句 ({sentences.length})</h3>
                    {sentences.length === 0 ? (
                      <p className="text-gray-400">暂无长难句</p>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-auto">
                        {sentences.slice(0, 50).map(sentence => (
                          <div key={sentence.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                            <span className="truncate flex-1">{sentence.sentence_en?.slice(0, 50)}...</span>
                            <button onClick={() => handleDelete('sentence', sentence.id)} className="text-red-400 hover:text-red-600 ml-2">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 笔记管理 */}
              {activeTab === 'notes' && (
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-700">笔记 ({notes.length})</h3>
                  {notes.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">暂无笔记</p>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-auto">
                      {notes.map(note => (
                        <div key={note.id} className="p-3 bg-gray-50 rounded">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium text-gray-700">{note.title || '无标题'}</h4>
                            <button onClick={() => handleDelete('note', note.id)} className="text-red-400 hover:text-red-600">×</button>
                          </div>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{note.content?.slice(0, 100)}...</p>
                          {note.doi && <span className="text-xs text-blue-500 mt-1">关联: {note.doi}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 标签合集 */}
              {activeTab === 'organization' && (
                <div className="space-y-4">
                  {/* 标签管理 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-700">标签管理</h3>
                      <input
                        type="text"
                        value={tagSearchQuery}
                        onChange={(e) => setTagSearchQuery(e.target.value)}
                        placeholder="搜索标签..."
                        className="px-3 py-1 text-sm border rounded w-48"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-[200px] overflow-auto p-2 bg-gray-50 rounded">
                      {filteredTags.length === 0 ? (
                        <p className="text-gray-400">暂无标签</p>
                      ) : (
                        filteredTags.map(tag => (
                          <span key={tag.id} className={`px-2 py-1 text-sm rounded cursor-pointer ${getTagColor(tag.name)} hover:opacity-80`}>
                            {tag.name}
                            <button onClick={() => handleRemoveTag(tag.id)} className="ml-1 hover:text-red-600">×</button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 合集管理 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-700">合集管理</h3>
                      <button
                        onClick={() => { setEditingCollection(null); setShowCollectionModal(true) }}
                        className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        + 新建合集
                      </button>
                    </div>
                    
                    {selectedCollection ? (
                      <div className="border rounded p-3">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{selectedCollection.name}</h4>
                          <button onClick={() => setSelectedCollection(null)} className="text-sm text-gray-500">← 返回</button>
                        </div>
                        
                        {/* 筛选 */}
                        <div className="flex gap-2 mb-3">
                          <select
                            value={collectionFilterTag}
                            onChange={(e) => setCollectionFilterTag(e.target.value)}
                            className="text-sm px-2 py-1 border rounded"
                          >
                            <option value="">按标签筛选</option>
                            {allTagNames.map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                          <select
                            value={collectionFilterType}
                            onChange={(e) => setCollectionFilterType(e.target.value)}
                            className="text-sm px-2 py-1 border rounded"
                          >
                            <option value="">按类型筛选</option>
                            <option value="word">单词</option>
                            <option value="long_sentence">长难句</option>
                            <option value="literature_card">文献卡片</option>
                            <option value="general_note">普通笔记</option>
                          </select>
                        </div>
                        
                        {/* 条目列表 */}
                        <div className="space-y-2 max-h-[300px] overflow-auto">
                          {filteredCollectionItems.length === 0 ? (
                            <p className="text-gray-400">合集中暂无条目</p>
                          ) : (
                            filteredCollectionItems.map(item => (
                              <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                <span className="truncate flex-1">{item.item_type} - {item.item_id}</span>
                                <button onClick={() => handleDelete('collectionItem', item.id)} className="text-red-400 hover:text-red-600 ml-2">移除</button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {collections.map(collection => (
                          <div
                            key={collection.id}
                            className="p-3 border rounded cursor-pointer hover:bg-gray-50"
                            onClick={() => handleSelectCollection(collection)}
                          >
                            <div className="flex justify-between items-start">
                              <h4 className="font-medium">{collection.name}</h4>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete('collection', collection.id) }}
                                className="text-red-400 hover:text-red-600"
                              >×</button>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">{collection.description || '无描述'}</p>
                          </div>
                        ))}
                        {collections.length === 0 && (
                          <p className="text-gray-400 col-span-full text-center py-8">暂无合集</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 附件管理 */}
              {activeTab === 'attachments' && (
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-700">附件 ({attachments.length})</h3>
                  {attachments.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">暂无附件</p>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-auto">
                      {attachments.map(attachment => (
                        <div key={attachment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <div>
                            <span className="font-medium">{attachment.filename}</span>
                            <span className="text-sm text-gray-500 ml-2">({(attachment.file_size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <button onClick={() => handleDelete('attachment', attachment.id)} className="text-red-400 hover:text-red-600">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 导出弹窗 */}
        {showExportModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg p-4 w-full max-w-md">
              <h3 className="font-medium mb-4">导出文献表</h3>
              
              {/* 按标签导出 */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">按标签导出（可选）</label>
                <div className="flex flex-wrap gap-2 max-h-[150px] overflow-auto p-2 bg-gray-50 rounded">
                  {allTagNames.map(name => (
                    <button
                      key={name}
                      onClick={() => toggleExportTag(name)}
                      className={`px-2 py-1 text-sm rounded ${exportTags.includes(name) ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
                <button onClick={() => handleExport('xlsx', exportTags.length > 0)} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">导出 Excel</button>
                <button onClick={() => handleExport('csv', exportTags.length > 0)} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">导出 CSV</button>
              </div>
            </div>
          </div>
        )}

        {/* 合集创建弹窗 */}
        {showCollectionModal && (
          <CollectionModal
            editing={editingCollection}
            onSave={handleSaveCollection}
            onClose={() => { setShowCollectionModal(false); setEditingCollection(null) }}
          />
        )}
      </div>
    </div>
  )
}

// 合集创建/编辑弹窗
function CollectionModal({ editing, onSave, onClose }) {
  const [name, setName] = useState(editing?.name || '')
  const [description, setDescription] = useState(editing?.description || '')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-4 w-full max-w-md">
        <h3 className="font-medium mb-4">{editing ? '编辑合集' : '新建合集'}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="合集名称"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              rows={3}
              placeholder="合集描述（可选）"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
          <button onClick={() => onSave(name, description)} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">保存</button>
        </div>
      </div>
    </div>
  )
}

export default FileManage
