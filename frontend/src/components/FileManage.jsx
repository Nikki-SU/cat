/**
 * 文件管理弹窗组件
 */
import { useState, useEffect } from 'react'
import useAppStore from '../stores/useAppStore'
import { literatureAPI, trackingAPI, learningAPI, noteAPI, organizationAPI } from '../api/client'

const tabs = [
  { id: 'tracking', label: '追踪管理' },
  { id: 'literature', label: '文献表' },
  { id: 'learning', label: '学习管理' },
  { id: 'notes', label: '笔记管理' },
  { id: 'organization', label: '标签合集' },
]

function FileManage({ isOpen, onClose, defaultTab = 'tracking' }) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [trackingRecords, setTrackingRecords] = useState([])
  const [literatureTable, setLiteratureTable] = useState([])
  const [words, setWords] = useState([])
  const [sentences, setSentences] = useState([])
  const [notes, setNotes] = useState([])
  const [tags, setTags] = useState([])
  const [collections, setCollections] = useState([])

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab)
      fetchData()
    }
  }, [isOpen, defaultTab])

  const fetchData = async () => {
    try {
      const [tracking, literature, wordsData, sentencesData, notesData, tagsData, collectionsData] = await Promise.all([
        trackingAPI.listRecords(),
        literatureAPI.listTable(),
        learningAPI.listWords(),
        learningAPI.listSentences(),
        noteAPI.listGeneralNotes(),
        organizationAPI.listTags(),
        organizationAPI.listCollections(),
      ])
      setTrackingRecords(tracking)
      setLiteratureTable(literature)
      setWords(wordsData)
      setSentences(sentencesData)
      setNotes(notesData)
      setTags(tagsData)
      setCollections(collectionsData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    }
  }

  const handleDelete = async (type, id) => {
    if (!confirm('确定要删除吗？')) return
    try {
      switch (type) {
        case 'tracking':
          await trackingAPI.deleteRecord(id)
          setTrackingRecords(prev => prev.filter(r => r.id !== id))
          break
        case 'literature':
          await literatureAPI.deleteTableEntry(id, false)
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
      }
    } catch (error) {
      alert('删除失败: ' + error.message)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
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
          {/* 追踪管理 */}
          {activeTab === 'tracking' && (
            <div className="space-y-2">
              <h3 className="font-medium text-text-main mb-3">追踪记录 ({trackingRecords.length})</h3>
              {trackingRecords.length === 0 ? (
                <p className="text-text-secondary text-center py-8">暂无追踪记录</p>
              ) : (
                <div className="space-y-2">
                  {trackingRecords.slice(0, 50).map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{record.title_cn || record.title_en || '无标题'}</p>
                        <p className="text-xs text-text-secondary">{record.journal} · {record.action}</p>
                      </div>
                      <button
                        onClick={() => handleDelete('tracking', record.id)}
                        className="ml-2 px-2 py-1 text-xs text-status-error hover:bg-red-50 rounded"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 文献表 - 最详细 */}
          {activeTab === 'literature' && (
            <div className="space-y-3">
              <h3 className="font-medium text-text-main">文献表 ({literatureTable.length})</h3>
              {literatureTable.length === 0 ? (
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
                        <th className="px-2 py-2 text-left font-medium text-text-secondary">附件</th>
                        <th className="px-2 py-2 text-left font-medium text-text-secondary">卡片</th>
                        <th className="px-2 py-2 text-left font-medium text-text-secondary">笔记</th>
                        <th className="px-2 py-2 text-left font-medium text-text-secondary">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {literatureTable.slice(0, 100).map((item) => (
                        <tr key={item.doi} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-2 py-2 text-xs text-text-secondary max-w-[120px] truncate">{item.doi}</td>
                          <td className="px-2 py-2 max-w-[150px] truncate">{item.title_cn || '-'}</td>
                          <td className="px-2 py-2 max-w-[150px] truncate">{item.title_en || '-'}</td>
                          <td className="px-2 py-2">{item.journal || '-'}</td>
                          <td className="px-2 py-2">{item.pubdate || '-'}</td>
                          <td className="px-2 py-2">{item.first_author || '-'}</td>
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-block w-4 h-4 rounded ${item.has_attachment ? 'bg-primary-green text-white' : 'bg-gray-200'}`}>
                              {item.has_attachment ? '✓' : ''}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-block w-4 h-4 rounded ${item.has_card ? 'bg-primary-green text-white' : 'bg-gray-200'}`}>
                              {item.has_card ? '✓' : ''}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className={`inline-block w-4 h-4 rounded ${item.has_notes ? 'bg-primary-green text-white' : 'bg-gray-200'}`}>
                              {item.has_notes ? '✓' : ''}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex gap-1">
                              <button className="px-1.5 py-0.5 text-xs bg-primary-blue text-white rounded hover:bg-opacity-80">
                                编辑
                              </button>
                              <button
                                onClick={() => handleDelete('literature', item.doi)}
                                className="px-1.5 py-0.5 text-xs text-status-error border border-status-error rounded hover:bg-red-50"
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
            </div>
          )}

          {/* 学习管理 */}
          {activeTab === 'learning' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-text-main mb-2">单词 ({words.length})</h3>
                {words.length === 0 ? (
                  <p className="text-text-secondary text-sm">暂无单词</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {words.slice(0, 20).map((word) => (
                      <span key={word.id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 rounded text-sm">
                        {word.word_en}
                        <button onClick={() => handleDelete('word', word.id)} className="text-status-error">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-medium text-text-main mb-2">长难句 ({sentences.length})</h3>
                {sentences.length === 0 ? (
                  <p className="text-text-secondary text-sm">暂无长难句</p>
                ) : (
                  <div className="space-y-2">
                    {sentences.slice(0, 10).map((sentence) => (
                      <div key={sentence.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <p className="text-sm truncate flex-1">{sentence.sentence_en}</p>
                        <button onClick={() => handleDelete('sentence', sentence.id)} className="ml-2 text-status-error text-sm">删除</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 笔记管理 */}
          {activeTab === 'notes' && (
            <div className="space-y-2">
              <h3 className="font-medium text-text-main">普通笔记 ({notes.length})</h3>
              {notes.length === 0 ? (
                <p className="text-text-secondary text-center py-8">暂无笔记</p>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div key={note.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{note.title || '无标题'}</p>
                        <p className="text-xs text-text-secondary">
                          {note.doi ? `关联: ${note.doi}` : '未关联'} · {new Date(note.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button onClick={() => handleDelete('note', note.id)} className="text-status-error text-sm">删除</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 标签合集 */}
          {activeTab === 'organization' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-text-main mb-2">标签 ({tags.length})</h3>
                {tags.length === 0 ? (
                  <p className="text-text-secondary text-sm">暂无标签</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span key={tag.id} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-blue/10 text-primary-blue rounded text-sm">
                        #{tag.name}
                        <button onClick={() => handleDelete('tag', tag.id)} className="text-status-error">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-medium text-text-main mb-2">合集 ({collections.length})</h3>
                {collections.length === 0 ? (
                  <p className="text-text-secondary text-sm">暂无合集</p>
                ) : (
                  <div className="space-y-2">
                    {collections.map((collection) => (
                      <div key={collection.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{collection.name}</p>
                          <p className="text-xs text-text-secondary">{collection.description || '无描述'}</p>
                        </div>
                        <button onClick={() => handleDelete('collection', collection.id)} className="text-status-error text-sm">删除</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FileManage
