/**
 * 追踪页面 - 重写版
 * 功能：
 * - 文献检索：输入DOI或关键词，选择跳转模式
 * - 追踪设置：选择期刊合集+关键词合集，支持手动输入
 * - 空追踪验证：首次使用期刊合集自动验证
 * - 追踪结果：按期刊折叠，左滑删除右滑添加
 * - DOI直接添加：手动输入DOI添加文献
 */
import { useState, useEffect, useCallback } from 'react'
import useAppStore from '../stores/useAppStore'
import { trackingAPI, literatureAPI, organizationAPI } from '../api/client'
import { isMobile, isPortrait } from '../utils/helpers'

const jumpModes = [
  { id: 'xml', label: 'XML源', description: '查看DOI元数据', baseUrl: 'https://api.crossref.org/works/' },
  { id: 'doi', label: 'DOI直达', description: '跳转出版商页面', baseUrl: 'https://doi.org/' },
  { id: 'gff', label: '谷粉学术', description: '谷粉学术论坛搜索', baseUrl: 'https://gff.scholarscope.com/?k=' },
]

function Tracking() {
  const { 
    settings, 
    journalGroups, 
    keywordGroups, 
    fetchJournalGroups, 
    fetchKeywordGroups,
    literatureTable,
    fetchLiteratureTable
  } = useAppStore()

  // 检索相关状态
  const [searchInput, setSearchInput] = useState('')
  const [jumpMode, setJumpMode] = useState(settings.defaultJumpMode || 'doi')

  // 追踪设置相关状态
  const [selectedJournalGroup, setSelectedJournalGroup] = useState(null)
  const [selectedKeywordGroup, setSelectedKeywordGroup] = useState(null)
  const [customJournals, setCustomJournals] = useState('')
  const [customKeywords, setCustomKeywords] = useState('')
  const [tempJournals, setTempJournals] = useState([])
  const [tempKeywords, setTempKeywords] = useState([])
  const [isTempModified, setIsTempModified] = useState(false)

  // 追踪执行相关状态
  const [isTracking, setIsTracking] = useState(false)
  const [trackingProgress, setTrackingProgress] = useState({ current: 0, total: 0, journal: '', count: 0 })
  const [trackingResults, setTrackingResults] = useState({}) // {journal: [{work}, ...]}
  const [pendingRecords, setPendingRecords] = useState({}) // {journal: [{work, action}, ...]}

  // 空追踪验证相关状态
  const [showValidation, setShowValidation] = useState(false)
  const [validationResults, setValidationResults] = useState([])
  const [isValidating, setIsValidating] = useState(false)

  // 文献检索相关状态
  const [doiDirectInput, setDoiDirectInput] = useState('')
  const [isAddingByDoi, setIsAddingByDoi] = useState(false)

  // Tab状态
  const [activeTab, setActiveTab] = useState('search') // search | tracking | results

  // 加载数据
  useEffect(() => {
    fetchJournalGroups()
    fetchKeywordGroups()
    fetchLiteratureTable()
  }, [])

  // 选择期刊合集后设置临时期刊
  useEffect(() => {
    if (selectedJournalGroup && !isTempModified) {
      setTempJournals(selectedJournalGroup.journals || [])
    }
  }, [selectedJournalGroup])

  // 选择关键词合集后设置临时关键词
  useEffect(() => {
    if (selectedKeywordGroup && !isTempModified) {
      setTempKeywords(selectedKeywordGroup.keywords?.map(k => k.word) || [])
    }
  }, [selectedKeywordGroup])

  // 获取用于追踪的期刊列表
  const getTrackingJournals = useCallback(() => {
    if (customJournals.trim()) {
      return customJournals.split('\n').map(j => j.trim()).filter(j => j)
    }
    return tempJournals
  }, [customJournals, tempJournals])

  // 获取用于追踪的关键词列表
  const getTrackingKeywords = useCallback(() => {
    if (customKeywords.trim()) {
      return customKeywords.split('\n').map(k => k.trim()).filter(k => k)
    }
    return tempKeywords
  }, [customKeywords, tempKeywords])

  // 文献检索
  const handleSearch = () => {
    if (!searchInput.trim()) return

    let url = ''
    if (searchInput.startsWith('10.')) {
      // DOI格式 - 跳转
      const mode = jumpModes.find(m => m.id === jumpMode)
      url = mode ? `${mode.baseUrl}${searchInput}` : `https://doi.org/${searchInput}`
      window.open(url, '_blank')
    } else {
      // 关键词搜索 - 使用谷粉学术
      url = `https://gff.scholarscope.com/?k=${encodeURIComponent(searchInput)}`
      window.open(url, '_blank')
    }
  }

  // DOI直接添加
  const handleAddByDOI = async () => {
    if (!doiDirectInput.trim()) {
      alert('请输入DOI')
      return
    }

    let doi = doiDirectInput.trim()
    if (!doi.startsWith('10.')) {
      alert('请输入有效的DOI（以10.开头）')
      return
    }

    // 清理DOI
    doi = doi.replace(/^https?:\/\/doi\.org\//, '')

    setIsAddingByDoi(true)
    try {
      const result = await trackingAPI.addByDoi(doi, true)
      if (result.table_entry) {
        alert('文献添加成功！')
        setDoiDirectInput('')
        fetchLiteratureTable()
      }
    } catch (error) {
      alert('添加失败: ' + (error.response?.data?.detail || error.message))
    } finally {
      setIsAddingByDoi(false)
    }
  }

  // 验证期刊
  const handleValidateJournals = async () => {
    const journals = getTrackingJournals()
    if (journals.length === 0) {
      alert('请先输入期刊')
      return
    }

    setIsValidating(true)
    setShowValidation(true)
    setValidationResults([])

    try {
      const response = await trackingAPI.validateJournals(journals)
      setValidationResults(response.results || [])

      // 检查是否有无效期刊
      const invalidJournals = response.results?.filter(r => !r.valid) || []
      if (invalidJournals.length > 0) {
        // 不阻止，可以选择忽略继续
      }
    } catch (error) {
      alert('验证失败: ' + error.message)
      setShowValidation(false)
    } finally {
      setIsValidating(false)
    }
  }

  // 保存当前配置为新合集
  const handleSaveAsNewGroup = async (type) => {
    const name = prompt('请输入合集名称:')
    if (!name) return

    try {
      if (type === 'journal') {
        await organizationAPI.createJournalGroup({
          name,
          journals: tempJournals
        })
        alert('期刊合集保存成功！')
      } else {
        await organizationAPI.createKeywordGroup({
          name,
          keywords: tempKeywords.map(w => ({ word: w, logic: 'or' }))
        })
        alert('关键词合集保存成功！')
      }
      // 刷新合集列表
      if (type === 'journal') {
        fetchJournalGroups()
      } else {
        fetchKeywordGroups()
      }
    } catch (error) {
      alert('保存失败: ' + error.message)
    }
  }

  // 执行追踪
  const handleStartTracking = async () => {
    const journals = getTrackingJournals()
    const keywords = getTrackingKeywords()

    if (journals.length === 0) {
      alert('请先选择或输入期刊')
      return
    }

    setIsTracking(true)
    setTrackingResults({})
    setPendingRecords({})
    setActiveTab('results')

    try {
      // 逐个期刊追踪
      for (let i = 0; i < journals.length; i++) {
        const journal = journals[i]
        setTrackingProgress({ current: i + 1, total: journals.length, journal, count: 0 })

        try {
          // 搜索该期刊的文献
          const response = await trackingAPI.searchByJournal(journal, keywords)
          const works = response.results || []

          setTrackingResults(prev => ({
            ...prev,
            [journal]: works
          }))

          // 初始化为全部添加
          setPendingRecords(prev => ({
            ...prev,
            [journal]: works.map(w => ({ ...w, action: 'added' }))
          }))

          setTrackingProgress(prev => ({ ...prev, count: works.length }))

        } catch (error) {
          console.error(`搜索期刊 ${journal} 失败:`, error)
          setTrackingResults(prev => ({
            ...prev,
            [journal]: []
          }))
        }
      }
    } catch (error) {
      alert('追踪执行失败: ' + error.message)
    } finally {
      setIsTracking(false)
      setTrackingProgress({ current: 0, total: 0, journal: '', count: 0 })
    }
  }

  // 单个文献操作
  const handleRecordAction = (journal, doi, action) => {
    setPendingRecords(prev => {
      const updated = { ...prev }
      if (updated[journal]) {
        updated[journal] = updated[journal].map(w => 
          w.doi === doi ? { ...w, action } : w
        )
      }
      return updated
    })
  }

  // 一键全部添加/删除
  const handleBatchAction = (journal, action) => {
    setPendingRecords(prev => {
      const updated = { ...prev }
      if (updated[journal]) {
        updated[journal] = updated[journal].map(w => ({ ...w, action }))
      }
      return updated
    })
  }

  // 确认追踪结果
  const handleConfirmResults = async () => {
    // 收集所有需要添加的记录
    const recordsToAdd = []
    const tableEntriesToAdd = []

    for (const [journal, works] of Object.entries(pendingRecords)) {
      for (const work of works) {
        if (work.action === 'added') {
          recordsToAdd.push({
            journal,
            title_cn: work.title_cn || work.title_en,
            title_en: work.title_en || work.title,
            doi: work.doi,
            action: 'added'
          })

          tableEntriesToAdd.push({
            doi: work.doi,
            title_cn: work.title_cn,
            title_en: work.title_en,
            journal: work.journal || journal,
            pubdate: work.pubdate,
            first_author: work.first_author,
            communication_author: work.communication_author
          })
        }
      }
    }

    if (recordsToAdd.length === 0) {
      alert('没有要添加的文献')
      return
    }

    try {
      // 批量创建追踪记录
      await trackingAPI.createRecordsBatch(recordsToAdd)

      // 批量创建文献表条目
      await literatureAPI.createTableBatch(tableEntriesToAdd)

      alert(`成功添加 ${recordsToAdd.length} 篇文献！`)
      
      // 清空追踪结果
      setTrackingResults({})
      setPendingRecords({})
      fetchLiteratureTable()
      setActiveTab('search')

    } catch (error) {
      alert('保存失败: ' + error.message)
    }
  }

  // 清空追踪结果
  const handleClearResults = () => {
    if (confirm('确定要清空当前追踪结果吗？（不会删除已保存的记录）')) {
      setTrackingResults({})
      setPendingRecords({})
    }
  }

  // 渲染期刊验证弹窗
  const renderValidationModal = () => {
    if (!showValidation) return null

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-semibold text-lg">期刊验证结果</h3>
            <button onClick={() => setShowValidation(false)} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {isValidating ? (
              <div className="text-center py-8">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-primary-blue border-t-transparent rounded-full"></div>
                <p className="mt-4 text-text-secondary">正在验证期刊...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {validationResults.map((result, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border ${
                    result.valid ? 'border-primary-green bg-green-50' : 'border-status-error bg-red-50'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{result.original_name}</p>
                        {result.valid && (
                          <p className="text-sm text-text-secondary">
                            匹配: {result.suggested_name || result.original_name}
                            {result.issn && ` (ISSN: ${result.issn})`}
                          </p>
                        )}
                        {result.article_count > 0 && (
                          <p className="text-sm text-text-secondary">
                            一年内文章数: {result.article_count}
                          </p>
                        )}
                        {!result.valid && result.ai_suggestions?.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm font-medium">建议修正:</p>
                            {result.ai_suggestions.map((s, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  const newJournals = [...tempJournals]
                                  newJournals[idx] = s
                                  setTempJournals(newJournals)
                                  setIsTempModified(true)
                                }}
                                className="text-sm text-primary-blue hover:underline mr-2"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        result.valid ? 'bg-primary-green text-white' : 'bg-status-error text-white'
                      }`}>
                        {result.valid ? '✓ 有效' : '✕ 无效'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t flex justify-end gap-2">
            <button onClick={() => setShowValidation(false)} className="btn btn-secondary">
              关闭
            </button>
            {validationResults.some(r => !r.valid) && (
              <button onClick={handleStartTracking} className="btn btn-primary">
                忽略无效期刊，继续追踪
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Tab切换
  const tabs = [
    { id: 'search', label: '🔍 文献检索', icon: '🔍' },
    { id: 'tracking', label: '⚙️ 追踪设置', icon: '⚙️' },
    { id: 'results', label: '📋 追踪结果', icon: '📋' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Tab导航 */}
      <div className="bg-white border-b px-4">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 ${
                activeTab === tab.id 
                  ? 'border-primary-blue text-primary-blue' 
                  : 'border-transparent text-text-secondary hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* 文献检索 */}
        {activeTab === 'search' && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* DOI直接添加 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold mb-4">📥 DOI直接添加</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={doiDirectInput}
                  onChange={(e) => setDoiDirectInput(e.target.value)}
                  placeholder="输入DOI（如：10.1000/xyz123）"
                  className="input flex-1"
                />
                <button
                  onClick={handleAddByDOI}
                  disabled={isAddingByDoi}
                  className="btn btn-primary"
                >
                  {isAddingByDoi ? '添加中...' : '添加'}
                </button>
              </div>
            </div>

            {/* 文献检索跳转 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold mb-4">🔍 文献检索跳转</h2>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="输入DOI或关键词"
                  className="input flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button onClick={handleSearch} className="btn btn-primary">
                  搜索
                </button>
              </div>
              
              {/* 跳转模式选择 */}
              <div className="flex flex-wrap gap-2">
                {jumpModes.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setJumpMode(mode.id)}
                    className={`px-3 py-2 rounded-lg border text-sm ${
                      jumpMode === mode.id 
                        ? 'border-primary-blue bg-primary-blue/10 text-primary-blue' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {mode.label}
                    <span className="block text-xs text-text-secondary">{mode.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 最近添加 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold mb-4">📚 文献库最近添加</h2>
              <div className="space-y-2">
                {literatureTable.slice(0, 10).map(item => (
                  <div key={item.doi} className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-sm truncate">
                      {item.title_cn || item.title_en || '无标题'}
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                      {item.journal} • {item.first_author || '未知作者'}
                    </p>
                  </div>
                ))}
                {literatureTable.length === 0 && (
                  <p className="text-center text-text-secondary py-8">暂无文献</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 追踪设置 */}
        {activeTab === 'tracking' && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* 期刊合集选择 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold">📰 期刊合集</h2>
                <button
                  onClick={() => handleSaveAsNewGroup('journal')}
                  className="text-sm text-primary-blue hover:underline"
                >
                  保存当前配置
                </button>
              </div>
              
              {/* 合集选择 */}
              <select
                value={selectedJournalGroup?.id || ''}
                onChange={(e) => {
                  const group = journalGroups.find(g => g.id === e.target.value)
                  setSelectedJournalGroup(group || null)
                  setIsTempModified(false)
                }}
                className="input w-full mb-3"
              >
                <option value="">选择期刊合集...</option>
                {journalGroups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.journals?.length || 0}个期刊)
                  </option>
                ))}
              </select>
              
              {/* 期刊列表 */}
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">
                  当前期刊 ({tempJournals.length})：
                </p>
                <textarea
                  value={tempJournals.join('\n')}
                  onChange={(e) => {
                    setTempJournals(e.target.value.split('\n').map(j => j.trim()).filter(j => j))
                    setIsTempModified(true)
                  }}
                  placeholder="每行一个期刊名..."
                  className="input min-h-[120px]"
                />
              </div>
            </div>

            {/* 关键词合集选择 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold">🔑 关键词合集</h2>
                <button
                  onClick={() => handleSaveAsNewGroup('keyword')}
                  className="text-sm text-primary-blue hover:underline"
                >
                  保存当前配置
                </button>
              </div>
              
              {/* 合集选择 */}
              <select
                value={selectedKeywordGroup?.id || ''}
                onChange={(e) => {
                  const group = keywordGroups.find(g => g.id === e.target.value)
                  setSelectedKeywordGroup(group || null)
                  setIsTempModified(false)
                }}
                className="input w-full mb-3"
              >
                <option value="">选择关键词合集...</option>
                {keywordGroups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.keywords?.length || 0}个关键词)
                  </option>
                ))}
              </select>
              
              {/* 关键词列表 */}
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">
                  当前关键词 ({tempKeywords.length})：
                </p>
                <textarea
                  value={tempKeywords.join('\n')}
                  onChange={(e) => {
                    setTempKeywords(e.target.value.split('\n').map(k => k.trim()).filter(k => k))
                    setIsTempModified(true)
                  }}
                  placeholder="每行一个关键词..."
                  className="input min-h-[100px]"
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold mb-4">🚀 开始追踪</h2>
              
              {/* 追踪进度 */}
              {isTracking && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm">
                    正在追踪: {trackingProgress.journal}
                  </p>
                  <p className="text-xs text-text-secondary">
                    进度: {trackingProgress.current}/{trackingProgress.total} 
                    {trackingProgress.count > 0 && ` • 已找到 ${trackingProgress.count} 篇`}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-primary-blue h-2 rounded-full transition-all"
                      style={{ width: `${(trackingProgress.current / trackingProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <button
                  onClick={handleValidateJournals}
                  disabled={isTracking}
                  className="btn btn-secondary flex-1"
                >
                  🔍 验证期刊
                </button>
                <button
                  onClick={handleStartTracking}
                  disabled={isTracking || getTrackingJournals().length === 0}
                  className="btn btn-primary flex-1"
                >
                  {isTracking ? '追踪中...' : '▶️ 开始追踪'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 追踪结果 */}
        {activeTab === 'results' && (
          <div className="max-w-3xl mx-auto">
            {/* 结果操作栏 */}
            {Object.keys(trackingResults).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex justify-between items-center">
                <div>
                  <span className="font-semibold">
                    共 {Object.values(trackingResults).flat().length} 篇文献
                  </span>
                  <span className="text-sm text-text-secondary ml-2">
                    （来自 {Object.keys(trackingResults).length} 个期刊）
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleClearResults} className="btn btn-secondary text-sm">
                    清空
                  </button>
                  <button onClick={handleConfirmResults} className="btn btn-primary text-sm">
                    ✓ 确认添加全部
                  </button>
                </div>
              </div>
            )}

            {/* 按期刊分组显示结果 */}
            <div className="space-y-4">
              {Object.entries(trackingResults).map(([journal, works]) => (
                <div key={journal} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b flex justify-between items-center">
                    <h3 className="font-semibold">{journal}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleBatchAction(journal, 'added')}
                        className="text-xs text-primary-blue hover:underline"
                      >
                        全选
                      </button>
                      <button
                        onClick={() => handleBatchAction(journal, 'removed')}
                        className="text-xs text-status-error hover:underline"
                      >
                        取消全部
                      </button>
                    </div>
                  </div>
                  
                  <div className="divide-y">
                    {works.map((work, idx) => {
                      const pending = pendingRecords[journal]?.find(w => w.doi === work.doi)
                      const action = pending?.action || 'added'
                      
                      return (
                        <div 
                          key={work.doi || idx} 
                          className={`p-4 flex items-start gap-3 ${
                            action === 'added' ? 'bg-white' : 'bg-gray-50'
                          }`}
                        >
                          {/* 操作按钮 */}
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleRecordAction(journal, work.doi, 'added')}
                              className={`w-8 h-6 rounded text-xs ${
                                action === 'added' 
                                  ? 'bg-primary-green text-white' 
                                  : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                              }`}
                            >
                              +
                            </button>
                            <button
                              onClick={() => handleRecordAction(journal, work.doi, 'removed')}
                              className={`w-8 h-6 rounded text-xs ${
                                action === 'removed' 
                                  ? 'bg-status-error text-white' 
                                  : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                              }`}
                            >
                              -
                            </button>
                          </div>
                          
                          {/* 文献信息 */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-2">
                              {work.title_cn || work.title_en || work.title || '无标题'}
                            </p>
                            <p className="text-xs text-text-secondary mt-1">
                              {work.first_author && `作者: ${work.first_author}`}
                              {work.pubdate && ` • ${work.pubdate}`}
                            </p>
                            <p className="text-xs text-text-secondary">
                              DOI: {work.doi}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 空状态 */}
            {Object.keys(trackingResults).length === 0 && (
              <div className="text-center text-text-secondary py-20">
                <p className="text-4xl mb-4">📋</p>
                <p>暂无追踪结果</p>
                <p className="text-sm mt-2">
                  在「追踪设置」中配置期刊和关键词后开始追踪
                </p>
                <button
                  onClick={() => setActiveTab('tracking')}
                  className="btn btn-primary mt-4"
                >
                  去设置追踪
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 期刊验证弹窗 */}
      {renderValidationModal()}
    </div>
  )
}

export default Tracking
