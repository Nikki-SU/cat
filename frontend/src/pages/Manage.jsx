/**
 * 鏂囩尞绠＄悊鐙珛椤甸潰
 */
import { useState, useEffect, useMemo } from 'react'
import { literatureAPI, trackingAPI, learningAPI, noteAPI, organizationAPI, attachmentAPI } from '../api/client'

const tabs = [
  { id: 'tracking', label: '杩借釜绠＄悊' },
  { id: 'literature', label: '鏂囩尞琛? },
  { id: 'learning', label: '瀛︿範绠＄悊' },
  { id: 'notes', label: '绗旇绠＄悊' },
  { id: 'organization', label: '鏍囩鍚堥泦' },
]

// 鏍囩棰滆壊
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

// 鍚堥泦鍒涘缓/缂栬緫寮圭獥
function CollectionModal({ editing, onSave, onClose }) {
  const [name, setName] = useState(editing?.name || '')
  const [description, setDescription] = useState(editing?.description || '')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-4 w-full max-w-md">
        <h3 className="font-medium mb-4">{editing ? '缂栬緫鍚堥泦' : '鏂板缓鍚堥泦'}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">鍚嶇О</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="鍚堥泦鍚嶇О"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">鎻忚堪</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              rows={3}
              placeholder="鍚堥泦鎻忚堪锛堝彲閫夛級"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">鍙栨秷</button>
          <button onClick={() => onSave(name, description)} className="px-4 py-2 bg-[#4DBBD5] text-white rounded hover:bg-[#3a9ab5]">淇濆瓨</button>
        </div>
      </div>
    </div>
  )
}

function Manage({ defaultTab = 'tracking' }) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  
  // 鍚凾ab鏁版嵁
  const [trackingRecords, setTrackingRecords] = useState([])
  const [literatureTable, setLiteratureTable] = useState([])
  const [words, setWords] = useState([])
  const [sentences, setSentences] = useState([])
  const [notes, setNotes] = useState([])
  const [tags, setTags] = useState([])
  const [collections, setCollections] = useState([])
  const [attachments, setAttachments] = useState([])
  
  // 鍔犺浇鐘舵€?  const [loading, setLoading] = useState(false)
  
  // 鏂囩尞琛ㄧ浉鍏崇姸鎬?  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportTags, setExportTags] = useState([])
  const [editingLiterature, setEditingLiterature] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  
  // 闄勪欢涓婁紶鐘舵€?  const [showAttachmentModal, setShowAttachmentModal] = useState(false)
  const [attachmentDoi, setAttachmentDoi] = useState(null)
  const [attachmentFile, setAttachmentFile] = useState(null)
  const [attachmentLoading, setAttachmentLoading] = useState(false)
  
  // 杩斿洖鐘舵€?  const [returnToManage, setReturnToManage] = useState(false)
  const [tagSearchQuery, setTagSearchQuery] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [allTagNames, setAllTagNames] = useState([])
  
  // 鍚堥泦绠＄悊鐘舵€?  const [selectedCollection, setSelectedCollection] = useState(null)
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

  // 鏂囩尞琛ㄦ悳绱?  const filteredLiterature = useMemo(() => {
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

  // 鑾峰彇鏂囩尞鐨勬爣绛?  const getTagsForDoi = (doi) => tags.filter(t => t.doi === doi)

  // 鎸塂OI鍒嗙粍鐨勬爣绛?  const tagsByDoi = useMemo(() => {
    const grouped = {}
    tags.forEach(tag => {
      if (tag.doi) {
        if (!grouped[tag.doi]) grouped[tag.doi] = []
        grouped[tag.doi].push(tag)
      }
    })
    return grouped
  }, [tags])

  // 杩囨护鍚庣殑鏍囩
  const filteredTags = useMemo(() => {
    if (!tagSearchQuery.trim()) return tags
    const query = tagSearchQuery.toLowerCase()
    return tags.filter(t => t.name.toLowerCase().includes(query))
  }, [tags, tagSearchQuery])

  // 鍚堥泦鏉＄洰杩囨护
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

  // 鍒犻櫎澶勭悊
  const handleDelete = async (type, id, cascade = false) => {
    const messages = {
      tracking: '纭畾瑕佸垹闄よ繖鏉¤拷韪褰曞悧锛?,
      literature: cascade ? '纭畾瑕佸垹闄よ繖绡囨枃鐚強鍏舵墍鏈夊叧鑱旀暟鎹悧锛熻拷韪褰曞皢淇濈暀銆? : '纭畾瑕佸垹闄よ繖绡囨枃鐚悧锛?,
      word: '纭畾瑕佸垹闄よ繖涓崟璇嶅悧锛?,
      sentence: '纭畾瑕佸垹闄よ繖涓暱闅惧彞鍚楋紵',
      note: '纭畾瑕佸垹闄よ繖鏉＄瑪璁板悧锛?,
      tag: '纭畾瑕佸垹闄よ繖涓爣绛惧悧锛?,
      collection: '纭畾瑕佸垹闄よ繖涓悎闆嗗悧锛?,
      collectionItem: '纭畾瑕佷粠鍚堥泦涓Щ闄よ繖鏉¤褰曞悧锛?,
      attachment: '纭畾瑕佸垹闄よ繖涓檮浠跺悧锛?,
    }
    if (!confirm(messages[type] || '纭畾瑕佸垹闄ゅ悧锛?)) return
    
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
      alert('鍒犻櫎澶辫触: ' + error.message)
    }
  }

  // 闄勪欢鐐瑰嚮澶勭悊 - 鏅鸿兘鍒ゆ柇锛氭湁鍒欒烦杞紝鏃犲垯鎸傝浇
  const handleAttachmentClick = (item) => {
    if (item.has_attachment) {
      // 鏈夐檮浠讹紝璺宠浆鍒版煡鐪?      const attachment = attachments.find(a => a.doi === item.doi)
      if (attachment) {
        // 淇濆瓨杩斿洖鐘舵€?        localStorage.setItem('returnToManage', 'true')
        localStorage.setItem('returnTab', 'literature')
        // 璺宠浆鍒伴檮浠惰鎯呮垨涓嬭浇
        window.open(`/api/v1/attachments/${attachment.id}/download`, '_blank')
      } else {
        alert('闄勪欢璁板綍涓嶅瓨鍦?)
      }
    } else {
      // 鏃犻檮浠讹紝鎵撳紑鎸傝浇寮圭獥
      setAttachmentDoi(item.doi)
      setAttachmentFile(null)
      setShowAttachmentModal(true)
    }
  }

  // 涓婁紶闄勪欢
  const handleUploadAttachment = async () => {
    if (!attachmentFile || !attachmentDoi) return
    
    setAttachmentLoading(true)
    try {
      await attachmentAPI.upload(attachmentDoi, attachmentFile)
      alert('闄勪欢鎸傝浇鎴愬姛锛?)
      setShowAttachmentModal(false)
      setAttachmentFile(null)
      setAttachmentDoi(null)
      fetchData() // 鍒锋柊鏁版嵁
    } catch (error) {
      alert('涓婁紶澶辫触: ' + error.message)
    } finally {
      setAttachmentLoading(false)
    }
  }

  // 缂栬緫涓垹闄ら檮浠?  const handleDeleteAttachment = async (doi) => {
    const attachment = attachments.find(a => a.doi === doi)
    if (!attachment) return
    
    if (!confirm('纭畾瑕佸垹闄よ繖涓檮浠跺悧锛?)) return
    
    try {
      await attachmentAPI.delete(attachment.id)
      // 鏇存柊缂栬緫琛ㄥ崟涓殑闄勪欢鐘舵€?      setEditFormData({...editFormData, has_attachment: false})
      fetchData()
      alert('闄勪欢宸插垹闄?)
    } catch (error) {
      alert('鍒犻櫎澶辫触: ' + error.message)
    }
  }

  // 娣诲姞鏍囩
  const handleAddTag = async (doi, tagName) => {
    if (!tagName.trim()) return
    try {
      const newTag = await organizationAPI.createTag({ name: tagName.trim(), doi })
      setTags(prev => [...prev, newTag])
      setTagInput('')
    } catch (error) {
      alert('娣诲姞鏍囩澶辫触: ' + error.message)
    }
  }

  // 鍒犻櫎鏍囩
  const handleRemoveTag = async (tagId) => {
    try {
      await organizationAPI.deleteTag(tagId)
      setTags(prev => prev.filter(t => t.id !== tagId))
    } catch (error) {
      alert('鍒犻櫎鏍囩澶辫触: ' + error.message)
    }
  }

  // 鍒涘缓/鏇存柊鍚堥泦
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
      alert('淇濆瓨鍚堥泦澶辫触: ' + error.message)
    }
  }

  // 閫夋嫨鍚堥泦
  const handleSelectCollection = async (collection) => {
    setSelectedCollection(collection)
    try {
      const items = await organizationAPI.getCollectionItems(collection.id)
      setCollectionItems(items || [])
    } catch (error) {
      setCollectionItems([])
    }
  }

  // 瀵煎嚭鏂囩尞琛?  const handleExport = async (format, useTagFilter = false) => {
    const url = useTagFilter && exportTags.length > 0
      ? literatureAPI.exportTableByTags(exportTags.join(','), format)
      : literatureAPI.exportTable({ format })
    
    const link = document.createElement('a')
    link.href = url
    link.download = `literature_table.${format}`
    link.click()
    setShowExportModal(false)
  }

  // 鍒囨崲瀵煎嚭鏍囩
  const toggleExportTag = (tagName) => {
    setExportTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 椤堕儴鏍囬鏍?*/}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-[#4DBBD5] mb-4">馃搧 鏂囩尞绠＄悊</h1>
          
          {/* Tab鍒囨崲 */}
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

      {/* 鍐呭鍖?*/}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-[#4DBBD5] border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            {/* 杩借釜绠＄悊 */}
            {activeTab === 'tracking' && (
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-[#3C5488]">杩借釜璁板綍 ({trackingRecords.length})</h2>
                {trackingRecords.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">鏆傛棤杩借釜璁板綍</p>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">鏃ユ湡</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">鏈熷垔</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">鏍囬</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">鎿嶄綔</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {trackingRecords.slice(0, 50).map(record => (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600">{record.date}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{record.journal}</td>
                            <td className="px-4 py-3 text-sm">
                              <div className="truncate max-w-[300px]" title={record.title_en}>
                                {record.title_cn || record.title_en || '鏃犳爣棰?}
                              </div>
                              {record.doi && <span className="text-xs text-[#4DBBD5]">{record.doi}</span>}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleDelete('tracking', record.id)}
                                className="text-red-400 hover:text-red-600 text-sm"
                              >
                                鍒犻櫎
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {trackingRecords.length > 50 && (
                      <p className="text-center text-gray-500 py-2">鏄剧ず鍓?0鏉★紝鍏眥trackingRecords.length}鏉?/p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 鏂囩尞琛?*/}
            {activeTab === 'literature' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-[#3C5488]">鏂囩尞琛?({filteredLiterature.length})</h2>
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="px-4 py-2 bg-[#00A087] text-white rounded hover:bg-[#00876d] text-sm"
                  >
                    瀵煎嚭
                  </button>
                </div>
                
                {/* 鎼滅储鍜屾帓搴?*/}
                <div className="flex gap-4 items-center">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="鎼滅储鏂囩尞鏍囬銆丏OI銆佹湡鍒娿€佷綔鑰?.."
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#4DBBD5] focus:border-transparent"
                  />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border rounded text-sm"
                  >
                    <option value="created_at">鍒涘缓鏃堕棿</option>
                    <option value="pubdate">鍙戣〃鏃ユ湡</option>
                    <option value="title_en">鏍囬</option>
                    <option value="journal">鏈熷垔</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 border rounded text-sm hover:bg-gray-50"
                  >
                    {sortOrder === 'desc' ? '鈫?闄嶅簭' : '鈫?鍗囧簭'}
                  </button>
                </div>
                
                {filteredLiterature.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">鏆傛棤鏂囩尞</p>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">鏍囬</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">鏈熷垔/骞翠唤</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">浣滆€?/th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">鏍囩</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">璺宠浆</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">DOI</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">鎿嶄綔</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredLiterature.map(item => (
                          <tr key={item.doi} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="max-w-[300px]">
                                <div className="font-medium text-sm text-[#3C5488] truncate" title={item.title_cn || item.title_en}>
                                  {item.title_cn || item.title_en || '鏃犳爣棰?}
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
                                {/* 闄勪欢鎸夐挳 - 鏅鸿兘鍒ゆ柇 */}
                                <button
                                  onClick={() => handleAttachmentClick(item)}
                                  className={`px-2 py-0.5 rounded hover:opacity-80 ${
                                    item.has_attachment
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                  }`}
                                >
                                  {item.has_attachment ? '鏌ョ湅闄勪欢' : '+ 鎸傝浇闄勪欢'}
                                </button>
                                {item.has_structured ? (
                                  <button
                                    onClick={() => navigateToStructured(item.doi)}
                                    className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                                  >
                                    缁撴瀯
                                  </button>
                                ) : (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded">缁撴瀯</span>
                                )}
                                {item.has_card ? (
                                  <button
                                    onClick={() => navigateToCard(item.doi)}
                                    className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                  >
                                    鍗＄墖
                                  </button>
                                ) : (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded">鍗＄墖</span>
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
                                  缂栬緫
                                </button>
                                <button
                                  onClick={() => handleDelete('literature', item.doi, false)}
                                  className="text-red-400 hover:text-red-600 text-sm"
                                >
                                  鍒犻櫎
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {/* 缂栬緫寮圭獥 */}
                {editingLiterature && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
                      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                        <h2 className="font-semibold">缂栬緫鏂囩尞</h2>
                        <button onClick={() => setEditingLiterature(null)} className="text-2xl">脳</button>
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
                          alert('鏇存柊鎴愬姛')
                        } catch (error) {
                          alert('鏇存柊澶辫触: ' + error.message)
                        }
                      }} className="flex-1 overflow-auto p-4 space-y-3">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">DOI (涓嶅彲缂栬緫)</label>
                          <input type="text" value={editFormData.doi} disabled className="w-full px-3 py-2 border rounded bg-gray-100" />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">涓枃鏍囬</label>
                          <input type="text" value={editFormData.title_cn || ''} onChange={(e) => setEditFormData({...editFormData, title_cn: e.target.value})} className="w-full px-3 py-2 border rounded" />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">鑻辨枃鏍囬</label>
                          <input type="text" value={editFormData.title_en || ''} onChange={(e) => setEditFormData({...editFormData, title_en: e.target.value})} className="w-full px-3 py-2 border rounded" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">鏈熷垔</label>
                            <input type="text" value={editFormData.journal || ''} onChange={(e) => setEditFormData({...editFormData, journal: e.target.value})} className="w-full px-3 py-2 border rounded" />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">鍑虹増鏃ユ湡</label>
                            <input type="text" value={editFormData.pubdate || ''} onChange={(e) => setEditFormData({...editFormData, pubdate: e.target.value})} className="w-full px-3 py-2 border rounded" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">绗竴浣滆€?/label>
                            <input type="text" value={editFormData.first_author || ''} onChange={(e) => setEditFormData({...editFormData, first_author: e.target.value})} className="w-full px-3 py-2 border rounded" />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">閫氳浣滆€?/label>
                            <input type="text" value={editFormData.communication_author || ''} onChange={(e) => setEditFormData({...editFormData, communication_author: e.target.value})} className="w-full px-3 py-2 border rounded" />
                          </div>
                        </div>
                        
                        {/* 闄勪欢绠＄悊鍖哄煙 */}
                        <div className="border rounded p-3 bg-gray-50">
                          <label className="block text-sm text-gray-600 mb-2">闄勪欢绠＄悊</label>
                          {editFormData.has_attachment ? (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-green-600">鉁?宸叉寕杞介檮浠?/span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const attachment = attachments.find(a => a.doi === editFormData.doi)
                                    if (attachment) {
                                      localStorage.setItem('returnToManage', 'true')
                                      localStorage.setItem('returnTab', 'literature')
                                      window.open(`/api/v1/attachments/${attachment.id}/download`, '_blank')
                                    }
                                  }}
                                  className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                                >
                                  鏌ョ湅闄勪欢
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttachment(editFormData.doi)}
                                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                                >
                                  鍒犻櫎闄勪欢
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                                className="flex-1 text-sm"
                                accept=".pdf,.doc,.docx,.epub,.md"
                              />
                              <button
                                type="button"
                                onClick={handleUploadAttachment}
                                disabled={!attachmentFile || attachmentLoading}
                                className="px-3 py-1 text-sm bg-[#4DBBD5] text-white rounded hover:bg-[#3a9ab5] disabled:opacity-50"
                              >
                                {attachmentLoading ? '涓婁紶涓?..' : '涓婁紶'}
                              </button>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-2 pt-4">
                          <button type="button" onClick={() => setEditingLiterature(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded flex-1">鍙栨秷</button>
                          <button type="submit" className="px-4 py-2 bg-[#4DBBD5] text-white rounded hover:bg-[#3a9ab5] flex-1">淇濆瓨</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
                
                {/* 闄勪欢鎸傝浇寮圭獥 */}
                {showAttachmentModal && (
                  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold">鎸傝浇闄勪欢</h3>
                        <button onClick={() => setShowAttachmentModal(false)} className="text-2xl">脳</button>
                      </div>
                      <p className="text-sm text-gray-500 mb-4">DOI: {attachmentDoi}</p>
                      <div className="space-y-4">
                        <input
                          type="file"
                          onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                          className="w-full"
                          accept=".pdf,.doc,.docx,.epub,.md"
                        />
                        {attachmentFile && (
                          <p className="text-sm text-gray-600">
                            宸查€夋嫨: {attachmentFile.name} ({(attachmentFile.size / 1024 / 1024).toFixed(2)} MB)
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowAttachmentModal(false)}
                            className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                          >
                            鍙栨秷
                          </button>
                          <button
                            onClick={handleUploadAttachment}
                            disabled={!attachmentFile || attachmentLoading}
                            className="flex-1 px-4 py-2 bg-[#4DBBD5] text-white rounded hover:bg-[#3a9ab5] disabled:opacity-50"
                          >
                            {attachmentLoading ? '涓婁紶涓?..' : '纭鎸傝浇'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 瀛︿範绠＄悊 */}
            {activeTab === 'learning' && (
              <div className="space-y-6">
                {/* 鍗曡瘝 */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-medium text-[#3C5488] mb-3">鍗曡瘝 ({words.length})</h3>
                  {words.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">鏆傛棤鍗曡瘝</p>
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
                              {word.status === 'mastered' ? '宸叉帉鎻? : word.status === 'learning' ? '瀛︿範涓? : '鏂拌瘝'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDelete('word', word.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            脳
                          </button>
                        </div>
                      ))}
                      {words.length > 100 && (
                        <p className="text-center text-gray-500 py-2">鏄剧ず鍓?00鏉★紝鍏眥words.length}鏉?/p>
                      )}
                    </div>
                  )}
                </div>
                
                {/* 闀块毦鍙?*/}
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-medium text-[#3C5488] mb-3">闀块毦鍙?({sentences.length})</h3>
                  {sentences.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">鏆傛棤闀块毦鍙?/p>
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
                              {sentence.status === 'mastered' ? '宸叉帉鎻? : sentence.status === 'learning' ? '瀛︿範涓? : '鏂板彞'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDelete('sentence', sentence.id)}
                            className="text-red-400 hover:text-red-600 ml-2"
                          >
                            脳
                          </button>
                        </div>
                      ))}
                      {sentences.length > 50 && (
                        <p className="text-center text-gray-500 py-2">鏄剧ず鍓?0鏉★紝鍏眥sentences.length}鏉?/p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 绗旇绠＄悊 */}
            {activeTab === 'notes' && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-medium text-[#3C5488] mb-3">绗旇 ({notes.length})</h3>
                {notes.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">鏆傛棤绗旇</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-auto">
                    {notes.map(note => (
                      <div key={note.id} className="p-3 bg-gray-50 rounded">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-[#3C5488]">{note.title || '鏃犳爣棰?}</h4>
                          <button onClick={() => handleDelete('note', note.id)} className="text-red-400 hover:text-red-600">脳</button>
                        </div>
                        <p className="text-sm text-[#8491B4] mt-1 line-clamp-2">{note.content?.slice(0, 100)}...</p>
                        {note.doi && <span className="text-xs text-[#4DBBD5] mt-1">鍏宠仈: {note.doi}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 鏍囩鍚堥泦 */}
            {activeTab === 'organization' && (
              <div className="space-y-4">
                {/* 鏍囩绠＄悊 */}
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-[#3C5488]">鏍囩绠＄悊</h3>
                    <input
                      type="text"
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
                      placeholder="鎼滅储鏍囩..."
                      className="px-3 py-1 text-sm border rounded w-48"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-[200px] overflow-auto p-2 bg-gray-50 rounded">
                    {filteredTags.length === 0 ? (
                      <p className="text-gray-400">鏆傛棤鏍囩</p>
                    ) : (
                      filteredTags.map(tag => (
                        <span key={tag.id} className={`px-2 py-1 text-sm rounded cursor-pointer ${getTagColor(tag.name)} hover:opacity-80`}>
                          {tag.name}
                          <button onClick={() => handleRemoveTag(tag.id)} className="ml-1 hover:text-red-600">脳</button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* 鍚堥泦绠＄悊 */}
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-[#3C5488]">鍚堥泦绠＄悊</h3>
                    <button
                      onClick={() => { setEditingCollection(null); setShowCollectionModal(true) }}
                      className="px-3 py-1 bg-[#4DBBD5] text-white rounded hover:bg-[#3a9ab5] text-sm"
                    >
                      + 鏂板缓鍚堥泦
                    </button>
                  </div>
                  
                  {selectedCollection ? (
                    <div className="border rounded p-3">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-[#3C5488]">{selectedCollection.name}</h4>
                        <button onClick={() => setSelectedCollection(null)} className="text-sm text-[#8491B4]">鈫?杩斿洖</button>
                      </div>
                      
                      {/* 绛涢€?*/}
                      <div className="flex gap-2 mb-3">
                        <select
                          value={collectionFilterTag}
                          onChange={(e) => setCollectionFilterTag(e.target.value)}
                          className="text-sm px-2 py-1 border rounded"
                        >
                          <option value="">鎸夋爣绛剧瓫閫?/option>
                          {allTagNames.map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                        <select
                          value={collectionFilterType}
                          onChange={(e) => setCollectionFilterType(e.target.value)}
                          className="text-sm px-2 py-1 border rounded"
                        >
                          <option value="">鎸夌被鍨嬬瓫閫?/option>
                          <option value="word">鍗曡瘝</option>
                          <option value="long_sentence">闀块毦鍙?/option>
                          <option value="literature_card">鏂囩尞鍗＄墖</option>
                          <option value="general_note">鏅€氱瑪璁?/option>
                        </select>
                      </div>
                      
                      {/* 鏉＄洰鍒楄〃 */}
                      <div className="space-y-2 max-h-[300px] overflow-auto">
                        {filteredCollectionItems.length === 0 ? (
                          <p className="text-gray-400">鍚堥泦涓殏鏃犳潯鐩?/p>
                        ) : (
                          filteredCollectionItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                              <span className="truncate flex-1">{item.item_type} - {item.item_id}</span>
                              <button onClick={() => handleDelete('collectionItem', item.id)} className="text-red-400 hover:text-red-600 ml-2">绉婚櫎</button>
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
                              脳
                            </button>
                          </div>
                          <p className="text-sm text-[#8491B4] mt-1">{collection.description || '鏃犳弿杩?}</p>
                        </div>
                      ))}
                      {collections.length === 0 && (
                        <p className="text-gray-400 col-span-full text-center py-8">鏆傛棤鍚堥泦</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 瀵煎嚭寮圭獥 */}
      {showExportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-4 w-full max-w-md">
            <h3 className="font-medium mb-4 text-[#3C5488]">瀵煎嚭鏂囩尞琛?/h3>
            
            {/* 鎸夋爣绛惧鍑?*/}
            <div className="mb-4">
              <label className="block text-sm text-[#8491B4] mb-2">鎸夋爣绛惧鍑猴紙鍙€夛級</label>
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
              <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-[#8491B4] hover:bg-gray-100 rounded">鍙栨秷</button>
              <button onClick={() => handleExport('xlsx', exportTags.length > 0)} className="px-4 py-2 bg-[#00A087] text-white rounded hover:bg-[#00876d]">瀵煎嚭 Excel</button>
              <button onClick={() => handleExport('csv', exportTags.length > 0)} className="px-4 py-2 bg-[#4DBBD5] text-white rounded hover:bg-[#3a9ab5]">瀵煎嚭 CSV</button>
            </div>
          </div>
        </div>
      )}

      {/* 鍚堥泦鍒涘缓寮圭獥 */}
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
