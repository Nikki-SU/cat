/**
 * 追踪页面 - 可配置搜索引擎集成器版
 * 功能：
 * - 文献检索：输入DOI或关键词，选择搜索引擎跳转
 * - 追踪设置：选择期刊合集+关键词合集，支持手动输入
 * - 空追踪验证：首次使用期刊合集自动验证
 * - 追踪结果：按期刊折叠，左滑删除右滑添加
 * - DOI直接添加：手动输入DOI添加文献
 */
import { useState, useEffect, useCallback } from 'react'
import useAppStore from '../stores/useAppStore'
import { trackingAPI, literatureAPI, organizationAPI, settingsAPI } from '../api/client'
import { isMobile, isPortrait } from '../utils/helpers'

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

  // 搜索引擎相关状态
  const [searchEngines, setSearchEngines] = useState([])
  const [showEngineModal, setShowEngineModal] = useState(false)
  const [editingEngine, setEditingEngine] = useState(null)
  const [engineForm, setEngineForm] = useState({ name: '', icon: '🔍', url_template: '', enabled: true })

  // 检索相关状态
  const [searchInput, setSearchInput] = useState('')

  // 追踪设置相关状态
  const [selectedJournalGroup, setSelectedJournalGroup] = useState(null)
  const [selectedKeywordGroup, setSelectedKeywordGroup] = useState(null)
  const [customJournals, setCustomJournals] = useState('')
  const [customKeywords, setCustomKeywords] = useState('')
  const [tempJournals, setTempJournals] = useState([])
  const [tempKeywords, setTempKeywords] = useState([])
  const [isTempModified, setIsTempModified] = useState(false)
  const [showGroupEditModal, setShowGroupEditModal] = useState(false)
  const [editingGroupType, setEditingGroupType] = useState(null) // 'journal' | 'keyword'
  const [editingGroupData, setEditingGroupData] = useState(null)
  const [groupEditName, setGroupEditName] = useState('')
  const [groupEditItems, setGroupEditItems] = useState('')

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
    loadSearchEngines()
  }, [])

  // 加载搜索引擎配置
  const loadSearchEngines = async () => {
    try {
      const engines = await settingsAPI.getSearchEngines()
      setSearchEngines(engines || [])
    } catch (error) {
      console.error('Failed to load search engines:', error)
    }
  }

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

  // 文献检索 - 使用搜索引擎
  const handleSearch = (engine) => {
    if (!searchInput.trim()) return
    const url = engine.url_template.replace('{query}', encodeURIComponent(searchInput.trim()))
    window.open(url, '_blank')
  }

  // DOI直接添加
  const handleAddByDOI = async () => {
    if (!doiDirectInput.trim()) {
      alert('请输入DOI')
      return
    }

    let doi = doiDirectInput.trim()
    // 先清理URL前缀，再校验
    doi = doi.replace(/^https?:\/\/doi\.org\//, '')
    if (!doi.startsWith('10.')) {
      alert('请输入有效的DOI（以10.开头）或DOI链接')
      return
    }

    setIsAddingByDoi(true)
    try {
      // 获取当前日期
      const today = new Date().toISOString().split('T')[0]
      const result = await trackingAPI.addByDoi(doi, true, false, today)
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

  // 编辑合集
  const handleEditGroup = (type, group) => {
    setEditingGroupType(type)
    setEditingGroupData(group)
    setGroupEditName(group.name)
    if (type === 'journal') {
      setGroupEditItems(group.journals?.join('\n') || '')
    } else {
      setGroupEditItems(group.keywords?.map(k => k.word).join('\n') || '')
    }
    setShowGroupEditModal(true)
  }

  // 保存编辑的合集
  const handleSaveEditGroup = async () => {
    if (!groupEditName.trim()) {
      alert('请输入合集名称')
      return
    }
    try {
      if (editingGroupType === 'journal') {
        const journals = groupEditItems.split('\n').map(j => j.trim()).filter(j => j)
        if (journals.length === 0) { alert('请至少输入一个期刊'); return }
        await organizationAPI.updateJournalGroup(editingGroupData.id, { name: groupEditName, journals })
        fetchJournalGroups()
      } else {
        const keywords = groupEditItems.split('\n').map(k => k.trim()).filter(k => k)
        if (keywords.length === 0) { alert('请至少输入一个关键词'); return }
        await organizationAPI.updateKeywordGroup(editingGroupData.id, { 
          name: groupEditName, 
          keywords: keywords.map(w => ({ word: w, logic: 'or' }))
        })
        fetchKeywordGroups()
      }
      setShowGroupEditModal(false)
      alert('更新成功')
    } catch (error) {
      alert('更新失败: ' + error.message)
    }
  }

  // 删除合集
  const handleDeleteGroup = async (type, id) => {
    const typeName = type === 'journal' ? '期刊合集' : '关键词合集'
    if (!confirm(`确定删除该${typeName}？`)) return
    try {
      if (type === 'journal') {
        await organizationAPI.deleteJournalGroup(id)
        if (selectedJournalGroup?.id === id) setSelectedJournalGroup(null)
        fetchJournalGroups()
      } else {
        await organizationAPI.deleteKeywordGroup(id)
        if (selectedKeywordGroup?.id === id) setSelectedKeywordGroup(null)
        fetchKeywordGroups()
      }
      alert('删除成功')
    } catch (error) {
      alert('删除失败: ' + error.message)
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
    Object.entries(pendingRecords).forEach(([journal, records]) => {
      records.forEach(record => {
        if (record.action === 'added') {
          recordsToAdd.push({
            journal,
            doi: record.doi,
            title_cn: record.title_cn,
            title_en: record.title_en,
            first_author: record.first_author,
            pubdate: record.pubdate,
            source: 'crossref'
          })
        }
      })
    })

    if (recordsToAdd.length === 0) {
      alert('没有需要添加的文献')
      return
    }

    try {
      await trackingAPI.createRecordsBatch(recordsToAdd)
      alert(`成功添加 ${recordsToAdd.length} 条追踪记录！`)
      fetchLiteratureTable()
      // 清空结果
      setTrackingResults({})
      setPendingRecords({})
    } catch (error) {
      alert('添加失败: ' + error.message)
    }
  }

  // 清空追踪结果
  const handleClearResults = () => {
    if (!confirm('确定清空所有追踪结果？')) return
    setTrackingResults({})
    setPendingRecords({})
  }

  // 期刊验证弹窗
  const renderValidationModal = () => {
    if (!showValidation) return null

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">期刊验证结果</h3>
            <button onClick={() => setShowValidation(false)} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {isValidating ? (
              <div className="text-center py-8">
                <div className="animate-spin text-3xl mb-4">⏳</div>
                <p>正在验证期刊...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {validationResults.map((result, idx) => (
                  <div key={idx} className={`p-3 rounded-lg ${result.valid ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center gap-2">
                      <span>{result.valid ? '✅' : '❌'}</span>
                      <span className="font-medium">{result.journal}</span>
                    </div>
                    {result.alternatives && result.alternatives.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        建议: {result.alternatives.slice(0, 3).join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-4 border-t">
            <button onClick={() => setShowValidation(false)} className="w-full btn btn-secondary">
              关闭
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 搜索引擎管理弹窗
  const renderEngineModal = () => {
    if (!showEngineModal) return null

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">管理搜索引擎</h3>
            <button onClick={() => { setShowEngineModal(false); setEditingEngine(null); setEngineForm({ name: '', icon: '🔍', url_template: '', enabled: true }); }} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {/* 添加/编辑表单 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="font-medium mb-3">{editingEngine ? '编辑搜索引擎' : '添加搜索引擎'}</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">名称</label>
                  <input
                    type="text"
                    value={engineForm.name}
                    onChange={(e) => setEngineForm({ ...engineForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="例如：DOI直达"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">图标</label>
                  <input
                    type="text"
                    value={engineForm.icon}
                    onChange={(e) => setEngineForm({ ...engineForm, icon: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="🔗"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">URL模板（{`{query}`} 为搜索词占位符）</label>
                  <input
                    type="text"
                    value={engineForm.url_template}
                    onChange={(e) => setEngineForm({ ...engineForm, url_template: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="https://example.com/search?q={query}"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="engine-enabled"
                    checked={engineForm.enabled}
                    onChange={(e) => setEngineForm({ ...engineForm, enabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="engine-enabled" className="text-sm">启用</label>
                </div>
                <button
                  onClick={handleSaveEngine}
                  className="w-full btn btn-primary"
                >
                  {editingEngine ? '保存修改' : '添加'}
                </button>
              </div>
            </div>
            
            {/* 搜索引擎列表 */}
            <div className="space-y-2">
              {searchEngines.map(engine => (
                <div key={engine.id} className={`p-3 border rounded-lg ${engine.enabled ? '' : 'opacity-50'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{engine.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{engine.name}</p>
                      <p className="text-xs text-gray-500 truncate">{engine.url_template}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditEngine(engine)}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                        title="编辑"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteEngine(engine.id)}
                        className="p-1.5 text-status-error hover:bg-red-50 rounded"
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-4 border-t flex gap-2">
            <button onClick={handleResetEngines} className="btn btn-secondary flex-1">
              重置为默认
            </button>
            <button onClick={() => { setShowEngineModal(false); setEditingEngine(null); }} className="btn btn-primary flex-1">
              完成
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 保存搜索引擎
  const handleSaveEngine = async () => {
    if (!engineForm.name.trim()) {
      alert('请输入名称')
      return
    }
    if (!engineForm.url_template.trim()) {
      alert('请输入URL模板')
      return
    }
    if (!engineForm.url_template.includes('{query}')) {
      alert('URL模板必须包含 {query} 占位符')
      return
    }

    try {
      if (editingEngine) {
        await settingsAPI.updateSearchEngine(editingEngine.id, engineForm)
      } else {
        await settingsAPI.addSearchEngine(engineForm)
      }
      await loadSearchEngines()
      setEngineForm({ name: '', icon: '🔍', url_template: '', enabled: true })
      setEditingEngine(null)
    } catch (error) {
      alert('保存失败: ' + (error.response?.data?.detail || error.message))
    }
  }

  // 编辑搜索引擎
  const handleEditEngine = (engine) => {
    setEditingEngine(engine)
    setEngineForm({ name: engine.name, icon: engine.icon, url_template: engine.url_template, enabled: engine.enabled })
  }

  // 删除搜索引擎
  const handleDeleteEngine = async (id) => {
    if (!confirm('确定删除该搜索引擎？')) return
    try {
      await settingsAPI.deleteSearchEngine(id)
      await loadSearchEngines()
    } catch (error) {
      alert('删除失败: ' + error.message)
    }
  }

  // 重置搜索引擎
  const handleResetEngines = async () => {
    if (!confirm('确定重置为默认搜索引擎？')) return
    try {
      await settingsAPI.resetSearchEngines()
      await loadSearchEngines()
    } catch (error) {
      alert('重置失败: ' + error.message)
    }
  }

  // 渲染搜索区域
  const renderSearchSection = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 文献检索 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold mb-4">🔍 文献检索</h2>
        
        {/* 搜索框 */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchEngines.find(e => e.enabled) || searchEngines[0])}
            placeholder="输入DOI、关键词或任意内容..."
            className="input flex-1"
          />
        </div>
        
        {/* 搜索引擎按钮 */}
        <div className="mb-4">
          <p className="text-sm text-text-secondary mb-2">跳转到：</p>
          <div className="flex flex-wrap gap-2">
            {searchEngines.filter(e => e.enabled).map(engine => (
              <button
                key={engine.id}
                onClick={() => handleSearch(engine)}
                className="px-3 py-1.5 border border-gray-200 rounded-full text-sm hover:border-primary-blue hover:text-primary-blue transition-colors flex items-center gap-1"
              >
                <span>{engine.icon}</span>
                <span>{engine.name}</span>
              </button>
            ))}
            <button
              onClick={() => setShowEngineModal(true)}
              className="px-3 py-1.5 border border-gray-200 rounded-full text-sm hover:border-primary-blue hover:text-primary-blue transition-colors flex items-center gap-1"
            >
              ⚙️ 管理
            </button>
          </div>
        </div>
      </div>

      {/* DOI直接添加 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold mb-4">📖 DOI直接添加</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={doiDirectInput}
            onChange={(e) => setDoiDirectInput(e.target.value)}
            placeholder="输入DOI或DOI链接，例如：10.1038/nature12373"
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
        <p className="text-xs text-text-secondary mt-2">
          输入DOI或DOI链接可直接从CrossRef获取文献信息并添加到文献库
        </p>
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
  )

  return (
    <div className={`min-h-screen bg-gray-50 ${isMobile() ? 'pb-16' : ''}`}>
      {/* 顶部Tab */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex">
          {[
            { id: 'search', label: '🔍 检索' },
            { id: 'tracking', label: '📰 追踪' },
            { id: 'results', label: '📋 结果' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-center font-medium border-b-2 transition-colors ${
                activeTab === tab.id 
                  ? 'border-primary-blue text-primary-blue' 
                  : 'border-transparent text-gray-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        {/* 文献检索 */}
        {activeTab === 'search' && renderSearchSection()}

        {/* 追踪设置 */}
        {activeTab === 'tracking' && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* 期刊合集选择 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold">📰 期刊合集</h2>
                <div className="flex gap-2">
                  {selectedJournalGroup && (
                    <>
                      <button onClick={() => handleEditGroup('journal', selectedJournalGroup)} className="text-sm text-primary-blue hover:underline">编辑</button>
                      <button onClick={() => handleDeleteGroup('journal', selectedJournalGroup.id)} className="text-sm text-red-500 hover:underline">删除</button>
                    </>
                  )}
                  <button onClick={() => handleSaveAsNewGroup('journal')} className="text-sm text-primary-blue hover:underline">+ 新建</button>
                </div>
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
                <div className="flex gap-2">
                  {selectedKeywordGroup && (
                    <>
                      <button onClick={() => handleEditGroup('keyword', selectedKeywordGroup)} className="text-sm text-primary-blue hover:underline">编辑</button>
                      <button onClick={() => handleDeleteGroup('keyword', selectedKeywordGroup.id)} className="text-sm text-red-500 hover:underline">删除</button>
                    </>
                  )}
                  <button onClick={() => handleSaveAsNewGroup('keyword')} className="text-sm text-primary-blue hover:underline">+ 新建</button>
                </div>
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
      
      {/* 搜索引擎管理弹窗 */}
      {renderEngineModal()}
    </div>
  )
}


      {/* 合集编辑弹窗 */}
      {showGroupEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">编辑{editingGroupType === 'journal' ? '期刊' : '关键词'}合集</h3>
              <button onClick={() => setShowGroupEditModal(false)} className="text-2xl">&times;</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">名称</label>
                <input type="text" value={groupEditName} onChange={(e) => setGroupEditName(e.target.value)} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">{editingGroupType === 'journal' ? '期刊列表（每行一个）' : '关键词列表（每行一个）'}</label>
                <textarea value={groupEditItems} onChange={(e) => setGroupEditItems(e.target.value)} className="w-full px-3 py-2 border rounded min-h-[150px]" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowGroupEditModal(false)} className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">取消</button>
                <button onClick={handleSaveEditGroup} className="flex-1 px-4 py-2 bg-[#4DBBD5] text-white rounded hover:bg-[#3a9ab5]">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

export default Tracking
