/**
 * 追踪页面
 * - 文献检索：输入DOI或关键词，选择跳转模式
 * - 追踪设置：选择期刊合集+关键词合集
 * - 追踪结果：按期刊折叠展示
 */
import { useState, useEffect } from 'react'
import useAppStore from '../stores/useAppStore'
import { literatureAPI, trackingAPI, organizationAPI } from '../api/client'

const jumpModes = [
  { id: 'xml', label: 'XML源', description: '查看DOI元数据' },
  { id: 'doi', label: 'DOI直达', description: '跳转出版商页面' },
  { id: 'gff', label: '谷粉学术', description: '谷粉学术论坛搜索' },
]

function Tracking() {
  const { settings, fetchJournalGroups, fetchKeywordGroups, journalGroups, keywordGroups } = useAppStore()
  const [searchInput, setSearchInput] = useState('')
  const [jumpMode, setJumpMode] = useState(settings.defaultJumpMode || 'doi')
  const [selectedJournalGroup, setSelectedJournalGroup] = useState(null)
  const [selectedKeywordGroup, setSelectedKeywordGroup] = useState(null)
  const [customJournals, setCustomJournals] = useState('')
  const [customKeywords, setCustomKeywords] = useState('')
  const [trackingResults, setTrackingResults] = useState([])
  const [isTracking, setIsTracking] = useState(false)
  const [recentRecords, setRecentRecords] = useState([])

  useEffect(() => {
    fetchJournalGroups()
    fetchKeywordGroups()
    fetchRecentRecords()
  }, [])

  const fetchRecentRecords = async () => {
    try {
      const records = await trackingAPI.listRecords({ limit: 20 })
      setRecentRecords(records)
    } catch (error) {
      console.error('Failed to fetch records:', error)
    }
  }

  const handleSearch = () => {
    if (!searchInput.trim()) return
    
    let url = ''
    if (searchInput.startsWith('10.')) {
      // DOI格式
      switch (jumpMode) {
        case 'xml':
          url = `https://api.crossref.org/works/${searchInput}`
          break
        case 'doi':
          url = `https://doi.org/${searchInput}`
          break
        case 'gff':
          url = `https://gff.scholarscope.com/?k=${searchInput}`
          break
      }
    } else {
      // 关键词搜索 - 使用谷粉学术
      url = `https://gff.scholarscope.com/?k=${encodeURIComponent(searchInput)}`
    }
    
    if (url) {
      window.open(url, '_blank')
    }
  }

  const handleAddByDOI = async () => {
    if (!searchInput.startsWith('10.')) {
      alert('请输入有效的DOI')
      return
    }
    
    try {
      // 尝试从CrossRef获取信息
      const response = await fetch(`https://api.crossref.org/works/${searchInput}`)
      const data = await response.json()
      const work = data.message
      
      const entry = {
        doi: searchInput,
        title_cn: work.title?.[0] || '',
        title_en: work.title?.[0] || '',
        journal: work['container-title']?.[0] || '',
        pubdate: work.published?.['date-parts']?.[0]?.[0]?.toString() || '',
        first_author: work.author?.[0]?.family || '',
      }
      
      await literatureAPI.createTableEntry(entry)
      await literatureAPI.createEntry(entry)
      
      alert('文献添加成功！')
      setSearchInput('')
    } catch (error) {
      // DOI不存在时创建基础条目
      try {
        const entry = {
          doi: searchInput,
          title_cn: '待完善',
          title_en: 'Pending',
          journal: '',
          pubdate: '',
          first_author: '',
        }
        await literatureAPI.createTableEntry(entry)
        alert('文献添加成功（请完善信息）！')
        setSearchInput('')
      } catch (e) {
        alert('添加失败: ' + e.message)
      }
    }
  }

  const handleStartTracking = async () => {
    if (isTracking) return
    setIsTracking(true)
    setTrackingResults([])
    
    // 获取期刊列表
    const journals = customJournals 
      ? customJournals.split('\n').filter(j => j.trim())
      : selectedJournalGroup?.journals || []
    
    const keywords = customKeywords
      ? customKeywords.split('\n').filter(k => k.trim())
      : selectedKeywordGroup?.keywords?.map(k => k.word) || []
    
    // 模拟追踪过程
    for (let i = 0; i < journals.length; i++) {
      // 实际应用中这里会调用 CrossRef API
      await new Promise(resolve => setTimeout(resolve, 500))
      setTrackingResults(prev => [...prev, {
        journal: journals[i],
        progress: Math.round(((i + 1) / journals.length) * 100),
        count: Math.floor(Math.random() * 10)
      }])
    }
    
    setIsTracking(false)
  }

  const handleRecordAction = async (recordId, action) => {
    try {
      await trackingAPI.updateRecord(recordId, { action })
      fetchRecentRecords()
    } catch (error) {
      alert('操作失败: ' + error.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-primary-blue mb-2">📡 文献追踪</h1>
        <p className="text-text-secondary">追踪最新学术文献，不错过任何重要研究</p>
      </div>

      {/* 文献检索区域 */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <h2 className="font-semibold text-text-main mb-3">🔍 文献检索</h2>
        
        <div className="space-y-3">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="输入DOI（如 10.1000/xyz123）或关键词搜索"
            className="input"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          
          {/* 跳转模式选择 */}
          <div className="flex flex-wrap gap-2">
            {jumpModes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setJumpMode(mode.id)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  jumpMode === mode.id
                    ? 'bg-primary-blue text-white'
                    : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2">
            <button onClick={handleSearch} className="btn btn-primary flex-1">
              搜索跳转
            </button>
            <button onClick={handleAddByDOI} className="btn btn-secondary flex-1">
              + DOI直接添加
            </button>
          </div>
        </div>
      </div>

      {/* 追踪设置区域 */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <h2 className="font-semibold text-text-main mb-3">⚙️ 追踪设置</h2>
        
        <div className="space-y-4">
          {/* 期刊合集选择 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">期刊合集</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {journalGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedJournalGroup(group)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedJournalGroup?.id === group.id
                      ? 'bg-primary-green text-white'
                      : 'bg-gray-100 text-text-secondary'
                  }`}
                >
                  {group.name}
                </button>
              ))}
            </div>
            <textarea
              value={customJournals}
              onChange={(e) => setCustomJournals(e.target.value)}
              placeholder="或手动输入期刊名（每行一个）"
              className="input text-sm"
              rows={3}
            />
          </div>
          
          {/* 关键词合集选择 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">关键词合集</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {keywordGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedKeywordGroup(group)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedKeywordGroup?.id === group.id
                      ? 'bg-primary-green text-white'
                      : 'bg-gray-100 text-text-secondary'
                  }`}
                >
                  {group.name}
                </button>
              ))}
            </div>
            <textarea
              value={customKeywords}
              onChange={(e) => setCustomKeywords(e.target.value)}
              placeholder="或手动输入关键词（每行一个）"
              className="input text-sm"
              rows={2}
            />
          </div>
          
          <button
            onClick={handleStartTracking}
            disabled={isTracking}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {isTracking ? '追踪中...' : '🚀 开始追踪'}
          </button>
        </div>
      </div>

      {/* 追踪进度 */}
      {trackingResults.length > 0 && (
        <div className="bg-white rounded-xl p-4 card-shadow">
          <h2 className="font-semibold text-text-main mb-3">📊 追踪进度</h2>
          <div className="space-y-2">
            {trackingResults.map((result, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-sm font-medium w-32 truncate">{result.journal}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-blue h-2 rounded-full transition-all"
                    style={{ width: `${result.progress}%` }}
                  />
                </div>
                <span className="text-xs text-text-secondary">{result.count}篇</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 追踪结果 - 按期刊折叠 */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <h2 className="font-semibold text-text-main mb-3">📋 追踪结果</h2>
        {recentRecords.length === 0 ? (
          <p className="text-text-secondary text-center py-8">暂无追踪记录</p>
        ) : (
          <div className="space-y-3">
            {/* 按期刊分组 */}
            {Object.entries(
              recentRecords.reduce((acc, record) => {
                const journal = record.journal || '未分类'
                if (!acc[journal]) acc[journal] = []
                acc[journal].push(record)
                return acc
              }, {})
            ).map(([journal, records]) => (
              <details key={journal} className="group" open={records.length < 5}>
                <summary className="cursor-pointer p-2 bg-gray-50 rounded-lg hover:bg-gray-100 list-none flex justify-between items-center">
                  <span className="font-medium">{journal}</span>
                  <span className="text-sm text-text-secondary">{records.length}篇</span>
                </summary>
                <div className="mt-2 space-y-2">
                  {records.map((record) => (
                    <div key={record.id} className="p-3 border border-gray-100 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {record.title_cn || record.title_en || '无标题'}
                          </p>
                          <p className="text-xs text-text-secondary mt-1">
                            {record.date} · DOI: {record.doi || '无'}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => handleRecordAction(record.id, 'added')}
                            className={`px-2 py-1 text-xs rounded ${
                              record.action === 'added'
                                ? 'bg-primary-green text-white'
                                : 'bg-gray-100 text-text-secondary'
                            }`}
                          >
                            添加
                          </button>
                          <button
                            onClick={() => handleRecordAction(record.id, 'kept')}
                            className={`px-2 py-1 text-xs rounded ${
                              record.action === 'kept'
                                ? 'bg-status-warning text-white'
                                : 'bg-gray-100 text-text-secondary'
                            }`}
                          >
                            暂存
                          </button>
                          <button
                            onClick={() => handleRecordAction(record.id, 'deleted')}
                            className={`px-2 py-1 text-xs rounded ${
                              record.action === 'deleted'
                                ? 'bg-status-error text-white'
                                : 'bg-gray-100 text-text-secondary'
                            }`}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Tracking
