/**
 * 文献管理独立页面
 */
import { useState, useEffect, useMemo } from 'react'
import { literatureAPI, trackingAPI, learningAPI, noteAPI, organizationAPI, attachmentAPI } from '../api/client'

const tabs = [
  { id: 'tracking', label: '追踪管理' },
  { id: 'literature', label: '文献表' },
  { id: 'learning', label: '学习管理' },
  { id: 'notes', label: '笔记管理' },
  { id: 'organization', label: '标签合集' },
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
          <button onClick={() => onSave(name, description)} className="px-4 py-2 bg-[#4DBBD5] text-white rounded hover:bg-[#3a9ab5]">保存</button>
        </div>
      </div>
    </div>
  )
}

function Manage({ defaultTab = 'tracking' }) {
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
  const [editingLiterature, setEditingLiterature] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  
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
    fetchData()
    fetchAllTagNames()
  }, [])

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
        setCollections(prev => prev.map(c => c.id === updated.id ? updated : c))
      } else {
        const newCollection = await organizationAPI.createCollection({ name, description })
        setCollections(prev => [...prev, newCollection])
      }
      setShowCollectionModal(false)
      setEditingCollection(null)
    } catch (error) {
      alert('保存合集失败: ' + error.message)
    }
  }

  // 选择合集
  const handleSelectCollection = async (collection) => {
    setSelectedCollection(collection)
    try {
      const items = await organizationAPI.getCollectionItems(collection.id)
      setCollectionItems(items || [])
    } catch (error) {
      setCollectionItems([])
    }
  }

  // 导出文献表
  const handleExport = async (format, useTagFilter = false) => {
    const url = useTagFilter && exportTags.length > 0
      ? literatureAPI.exportTableByTags(exportTags.join(','), format)
      : literatureAPI.exportTable({ format })
    
    const link = document.createElement('a')
    link.href = url
    link.download = `literature_table.${format}`
    link.click()
    setShowExportModal(false)
  }

  // 切换导出标签
  const toggleExportTag = (tagName) => {
    setExportTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部标题栏 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-[#4DBBD5] mb-4">📁 文献管理</h1>
          
          {/* Tab切换 */}
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[#4DBBD5] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-[#4DBBD5] border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            {/* 追踪管理 */}
            {activeTab === 'tracking' && (
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-[#3C5488]">追踪记录 ({trackingRecords.length})</h2>
                {trackingRecords.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">暂无追踪记录</p>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">期刊</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">标题</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {trackingRecords.slice(0, 50).map(record => (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600">{record.date}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{record.journal}</td>
                            <td className="px-4 py-3 text-sm">
                              <div className="truncate max-w-[300px]" title={record.title_en}>
                                {record.title_cn || record.title_en || '无标题'}
                              </div>
                              {record.doi && <span className="text-xs text-[#4DBBD5]">{record.doi}</span>}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleDelete('tracking', record.id)}
                                className="text-red-400 hover:text-red-600 text-sm"
                              >
                                删除
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {trackingRecords.length > 50 && (
                      <p className="text-center text-gray-500 py-2">显示前50条，共{trackingRecords.length}条</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 文献表 */}
            {activeTab === 'literature' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-[#3C5488]">文献表 ({filteredLiterature.length})</h2>
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="px-4 py-2 bg-[#00A087] text-white rounded hover:bg-[#00876d] text-sm"
                  >
                    导出
                  </button>
                </div>
                
                {/* 搜索和排序 */}
                <div className="flex gap-4 items-center">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索文献标题、DOI、期刊、作者..."
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#4DBBD5] focus:border-transparent"
                  />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border rounded text-sm"
                  >
                    <option value="created_at">创建时间</option>
                    <option value="pubdate">发表日期</option>
                    <option value="title_en">标题</option>
                    <option value="journal">期刊</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 border rounded text-sm hover:bg-gray-50"
                  >
                    {sortOrder === 'desc' ? '↓ 降序' : '↑ 升序'}
                  </button>
                </div>
                
                {filteredLiterature.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">暂无文献</p>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">标题</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">期刊/年份</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">作者</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">标签</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">跳转</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">DOI</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredLiterature.map(item => (
                          <tr key={item.doi} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="max-w-[300px]">
                                <div className="font-medium text-sm text-[#3C5488] truncate" title={item.title_cn || item.title_en}>
                                  {item.title_cn || item.title_en || '无标题'}
                                </div>
                                {item.title_cn && item.title_en && (
                                  <div className="text-xs text-[#8491B4] truncate mt-1" title={item.title_en}>
                                    {item.title_en}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              <div className="truncate max-w-[120px]" title={item.journal}>{item.journal}</div>
                              <div className="text-xs text-gray-400">{item.pubdate}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              <div className="truncate max-w-[100px]" title={item.first_author}>{item.first_author || '-'}</div>
                              <div className="truncate max-w-[100px] text-gray-400" title={item.communication_author}>{item.communication_author || '-'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1 max-w-[150px]">
                                {tagsByDoi[item.doi]?.slice(0, 3).map(tag => (
                                  <span key={tag.id} className={`px-2 py-0.5 text-xs rounded ${getTagColor(tag.name)}`}>
                                    {tag.name}
                                  </span>
                                ))}
                                {tagsByDoi[item.doi]?.length > 3 && (
                                  <span className="text-xs text-gray-400">+{tagsByDoi[item.doi].length - 3}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 text-xs">
                                {item.has_attachment ? (
                                  <a href={`/attachments/by-doi/${item.doi}`} className="px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200">附件</a>
                                ) : (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded">附件</span>
                                )}
                                {item.has_structured ? (
                                  <a href={`/deep-read?doi=${item.doi}`} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">结构</a>
                                ) : (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded">结构</span>
                                )}
                                {item.has_card ? (
                                  <a href={`/browse?doi=${item.doi}`} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">卡片</a>
                                ) : (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded">卡片</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-[#4DBBD5] font-mono">{item.doi}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingLiterature(item)
                                    setEditFormData({...item})
                                  }}
                                  className="text-blue-400 hover:text-blue-600 text-sm"
                                >
                                  编辑
                                </button>
                                <button
                                  onClick={() => handleDelete('literature', item.doi, false)}
                                  className="text-red-400 hover:text-red-600 text-sm"
                                >
                                  删除
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {/* 编辑弹窗 */}
                {editingLiterature && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
                      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                        <h2 className="font-semibold">编辑文献</h2>
                        <button onClick={() => setEditingLiterature(null)} className="text-2xl">×</button>
                      </div>
                      <form onSubmit={async (e) => {
                        e.preventDefault()
                        try {
                          await literatureAPI.updateTableEntry(editFormData.doi, {
                            title_cn: editFormData.title_cn,
                            title_en: editFormData.title_en,
                            journal: editFormData.journal,
                            pubdate: editFormData.pubdate,
                            first_author: editFormData.first_author,
                            communication_author: editFormData.communication_author,
                          })
                          setEditingLiterature(null)
                          fetchData()
                          alert('更新成功')
                        } catch (error) {
                          alert('更新失败: ' + error.message)
                        }
                      }} className="flex-1 overflow-auto p-4 space-y-3">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">DOI (不可编辑)</label>
                          <input type="text" value={editFormData.doi} disabled className="w-full px-3 py-2 border rounded bg-gray-100" />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">中文标题</label>
                          <input type="text" value={editFormData.title_cn || ''} onChange={(e) => setEditFormData({...editFormData, title_cn: e.target.value})} className="w-full px-3 py-2 border rounded" />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">英文标题</label>
                          <input type="text" value={editFormData.title_en || ''} onChange={(e) => setEditFormData({...editFormData, title_en: e.target.value})} className="w-full px-3 py-2 border rounded" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">期刊</label>
                            <input type="text" value={editFormData.journal || ''} onChange={(e) => setEditFormData({...editFormData, journal: e.target.value})} className="w-full px-3 py-2 border rounded" />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">出版日期</label>
                            <input type="text" value={editFormData.pubdate || ''} onChange={(e) => setEditFormData({...editFormData, pubdate: e.target.value})} className="w-full px-3 py-2 border rounded" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">第一作者</label>
                            <input type="text" value={editFormData.first_author || ''} onChange={(e) => setEditFormData({...editFormData, first_author: e.target.value})} className="w-full px-3 py-2 border rounded" />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">通讯作者</label>
                            <input type="text" value={editFormData.communication_author || ''} onChange={(e) => setEditFormData({...editFormData, communication_author: e.target.value})} className="w-full px-3 py-2 border rounded" />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-4">
                          <button type="button" onClick={() => setEditingLiterature(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded flex-1">取消</button>
                          <button type="submit" className="px-4 py-2 bg-[#4DBBD5] text-white rounded hover:bg-[#3a9ab5] flex-1">保存</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 学习管理 */}
            {activeTab === 'learning' && (
              <div className="space-y-6">
                {/* 单词 */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-medium text-[#3C5488] mb-3">单词 ({words.length})</h3>
                  {words.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">暂无单词</p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-auto">
                      {words.slice(0, 100).map(word => (
                        <div key={word.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <span className="font-medium text-[#3C5488]">{word.word_en}</span>
                            <span className="text-[#8491B4] ml-2">{word.word_cn}</span>
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                              word.status === 'mastered' ? 'bg-green-100 text-green-700' :
                              word.status === 'learning' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-500'
                            }`}>
                              {word.status === 'mastered' ? '已掌握' : word.status === 'learning' ? '学习中' : '新词'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDelete('word', word.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {words.length > 100 && (
                        <p className="text-center text-gray-500 py-2">显示前100条，共{words.length}条</p>
                      )}
                    </div>
                  )}
                </div>
                
                {/* 长难句 */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-medium text-[#3C5488] mb-3">长难句 ({sentences.length})</h3>
                  {sentences.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">暂无长难句</p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-auto">
                      {sentences.slice(0, 50).map(sentence => (
                        <div key={sentence.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex-1 truncate">
                            <span className="text-sm text-[#3C5488]">{sentence.sentence_en?.slice(0, 100)}...</span>
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                              sentence.status === 'mastered' ? 'bg-green-100 text-green-700' :
                              sentence.status === 'learning' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-500'
                            }`}>
                              {sentence.status === 'mastered' ? '已掌握' : sentence.status === 'learning' ? '学习中' : '新句'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDelete('sentence', sentence.id)}
                            className="text-red-400 hover:text-red-600 ml-2"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {sentences.length > 50 && (
                        <p className="text-center text-gray-500 py-2">显示前50条，共{sentences.length}条</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 笔记管理 */}
            {activeTab === 'notes' && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-medium text-[#3C5488] mb-3">笔记 ({notes.length})</h3>
                {notes.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">暂无笔记</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-auto">
                    {notes.map(note => (
                      <div key={note.id} className="p-3 bg-gray-50 rounded">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-[#3C5488]">{note.title || '无标题'}</h4>
                          <button onClick={() => handleDelete('note', note.id)} className="text-red-400 hover:text-red-600">×</button>
                        </div>
                        <p className="text-sm text-[#8491B4] mt-1 line-clamp-2">{note.content?.slice(0, 100)}...</p>
                        {note.doi && <span className="text-xs text-[#4DBBD5] mt-1">关联: {note.doi}</span>}
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
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-[#3C5488]">标签管理</h3>
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
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-[#3C5488]">合集管理</h3>
                    <button
                      onClick={() => { setEditingCollection(null); setShowCollectionModal(true) }}
                      className="px-3 py-1 bg-[#4DBBD5] text-white rounded hover:bg-[#3a9ab5] text-sm"
                    >
                      + 新建合集
                    </button>
                  </div>
                  
                  {selectedCollection ? (
                    <div className="border rounded p-3">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-[#3C5488]">{selectedCollection.name}</h4>
                        <button onClick={() => setSelectedCollection(null)} className="text-sm text-[#8491B4]">← 返回</button>
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
                            <h4 className="font-medium text-[#3C5488]">{collection.name}</h4>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete('collection', collection.id) }}
                              className="text-red-400 hover:text-red-600"
                            >
                              ×
                            </button>
                          </div>
                          <p className="text-sm text-[#8491B4] mt-1">{collection.description || '无描述'}</p>
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
          </>
        )}
      </div>

      {/* 导出弹窗 */}
      {showExportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-4 w-full max-w-md">
            <h3 className="font-medium mb-4 text-[#3C5488]">导出文献表</h3>
            
            {/* 按标签导出 */}
            <div className="mb-4">
              <label className="block text-sm text-[#8491B4] mb-2">按标签导出（可选）</label>
              <div className="flex flex-wrap gap-2 max-h-[150px] overflow-auto p-2 bg-gray-50 rounded">
                {allTagNames.map(name => (
                  <button
                    key={name}
                    onClick={() => toggleExportTag(name)}
                    className={`px-2 py-1 text-sm rounded ${exportTags.includes(name) ? 'bg-[#4DBBD5] text-white' : 'bg-gray-200'}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-[#8491B4] hover:bg-gray-100 rounded">取消</button>
              <button onClick={() => handleExport('xlsx', exportTags.length > 0)} className="px-4 py-2 bg-[#00A087] text-white rounded hover:bg-[#00876d]">导出 Excel</button>
              <button onClick={() => handleExport('csv', exportTags.length > 0)} className="px-4 py-2 bg-[#4DBBD5] text-white rounded hover:bg-[#3a9ab5]">导出 CSV</button>
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
  )
}

export default Manage
