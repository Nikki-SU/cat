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
                        {result.va