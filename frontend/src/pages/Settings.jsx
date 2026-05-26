/**
 * 设置页面 - 增强版
 */
import { useState, useEffect } from 'react'
import useAppStore from '../stores/useAppStore'
import { organizationAPI, literatureAPI, aiAPI, backupAPI, syncAPI, syncV2API, settingsAPI, pairingAPI } from '../api/client'
import { 
  DISPLAY_LANGUAGES, 
  DISPLAY_DETAILS, 
  TRACKING_INTERVALS, 
  WORD_QUEUE_LENGTHS,
  JUMP_MODES,
  EXPORT_FORMATS,
} from '../utils/constants'
import { downloadFile, formatDate } from '../utils/helpers'
import { syncManager } from '../utils/syncWorker'
import PairingModal from '../components/PairingModal'
import ConflictModal from '../components/ConflictModal'
import { SENTENCE_COLOR_SCHEMES } from '../stores/useDeepReadStore'

// AI提供商配置
const AI_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', defaultModel: 'gpt-3.5-turbo', baseUrl: 'https://api.openai.com/v1' },
  { id: 'deepseek', name: 'DeepSeek', defaultModel: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'qwen', name: '通义千问', defaultModel: 'qwen-turbo', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'custom', name: '自定义', defaultModel: '', baseUrl: '' },
]

// 同步间隔选项
const SYNC_INTERVALS = [
  { value: 30, label: '30秒' },
  { value: 300, label: '5分钟' },
  { value: 1800, label: '30分钟' },
  { value: 3600, label: '1小时' },
  { value: 86400, label: '1天' },
]

function Settings() {
  const { 
    settings, 
    updateSettings,
    journalGroups, 
    keywordGroups,
    fetchJournalGroups,
    fetchKeywordGroups,
  } = useAppStore()

  // API配置
  const [aiApiKey, setAiApiKey] = useState(localStorage.getItem('aiApiKey') || '')
  const [aiApiBase, setAiApiBase] = useState(localStorage.getItem('aiApiBase') || '')
  const [aiModel, setAiModel] = useState(localStorage.getItem('aiModel') || '')
  const [aiProvider, setAiProvider] = useState(localStorage.getItem('aiProvider') || 'openai')
  const [mineruToken, setMineruToken] = useState(localStorage.getItem('mineruToken') || '')
  const [mineruModelVersion, setMineruModelVersion] = useState(localStorage.getItem('mineruModelVersion') || 'vlm')
  const [mineruLanguage, setMineruLanguage] = useState(localStorage.getItem('mineruLanguage') || 'en')
  const [showMineruToken, setShowMineruToken] = useState(false)
  const [mineruTestResult, setMineruTestResult] = useState(null)
  const [mineruTesting, setMineruTesting] = useState(false)
  
  // OCR配置
  const [ocrAppId, setOcrAppId] = useState(localStorage.getItem('ocrAppId') || '')
  const [ocrAppSecret, setOcrAppSecret] = useState(localStorage.getItem('ocrAppSecret') || '')
  const [showOcrSecret, setShowOcrSecret] = useState(false)
  const [ocrTestResult, setOcrTestResult] = useState(null)
  const [ocrTesting, setOcrTesting] = useState(false)
  const [aiTestResult, setAiTestResult] = useState(null)
  const [aiTesting, setAiTesting] = useState(false)
  
  // 合集管理已移至追踪页和管理页
  
  // 备份同步
  const [backups, setBackups] = useState([])
  const [syncStatus, setSyncStatus] = useState(null)
  const [syncEnabled, setSyncEnabled] = useState(localStorage.getItem('syncEnabled') === 'true')
  const [syncInterval, setSyncInterval] = useState(Number(localStorage.getItem('syncInterval') || 300))
  const [syncServer, setSyncServer] = useState(localStorage.getItem('syncServer') || '')
  const [syncing, setSyncing] = useState(false)
  
  // Phase 1 同步V2状态
// Phase 2 配对状态
  const [showPairingModal, setShowPairingModal] = useState(false)
  const [pairingMode, setPairingMode] = useState('hub')  // 'hub' or 'leaf'
  const [relayUrl, setRelayUrl] = useState(localStorage.getItem('relayUrl') || '')
  const [relayStatus, setRelayStatus] = useState(null)
  const [showRelayConfig, setShowRelayConfig] = useState(false)
  const [syncV2Status, setSyncV2Status] = useState(null)
  const [syncV2Devices, setSyncV2Devices] = useState([])
  const [discoveredHubs, setDiscoveredHubs] = useState([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [isSyncingV2, setIsSyncingV2] = useState(false)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(localStorage.getItem('autoSync') !== 'false')

  // Phase 3: 离线模式 + 冲突解决
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [conflicts, setConflicts] = useState([])
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [attachmentStats, setAttachmentStats] = useState(null)
  const [isSyncingAttachments, setIsSyncingAttachments] = useState(false)
  const [syncLogs, setSyncLogs] = useState([])

  // Phase 2: 获取中继状态
  const fetchRelayStatus = async () => {
    try {
      const status = await pairingAPI.getRelayStatus()
      setRelayStatus(status)
    } catch (error) {
      console.error('Failed to fetch relay status:', error)
    }
  }

  useEffect(() => {
    // 期刊/关键词合集管理已移至追踪页和管理页
    fetchBackups()
    fetchSyncV2Status()
    fetchRelayStatus()
    // Phase 3: 加载离线状态和附件统计
    fetchAttachmentStats()
    
    // 监听网络状态变化
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // 监听同步状态变化
    syncManager.onStatusChange((status) => {
      if (status.hasConflicts) {
        setConflicts(status.conflicts || [])
      }
    })
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Phase 1 同步V2函数
  const fetchSyncV2Status = async () => {
    try {
      const status = await syncV2API.getStatus()
      setSyncV2Status(status)
      
      if (status.role === 'hub') {
        const devices = await syncV2API.getDevices()
        setSyncV2Devices(devices || [])
      }
    } catch (error) {
      console.error('Failed to fetch sync V2 status:', error)
    }
  }

  // Phase 3: 获取冲突列表
  const fetchConflicts = async () => {
    try {
      const result = await syncV2API.getConflicts()
      setConflicts(result.conflicts || [])
    } catch (error) {
      console.error('Failed to fetch conflicts:', error)
    }
  }

  // Phase 3: 获取附件统计
  const fetchAttachmentStats = async () => {
    try {
      const stats = await fetch('/api/attachments/stats').then(r => r.json())
      setAttachmentStats(stats)
    } catch (error) {
      console.error('Failed to fetch attachment stats:', error)
    }
  }

  // Phase 3: 解决单个冲突
  const handleResolveConflict = async (tableName, recordPk, resolution, chosenData) => {
    try {
      await syncV2API.resolveConflict(tableName, recordPk, resolution, chosenData)
      // 刷新冲突列表
      fetchConflicts()
      fetchSyncV2Status()
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      throw error
    }
  }

  // Phase 3: 批量解决所有冲突
  const handleResolveAllConflicts = async (resolution) => {
    try {
      await syncV2API.resolveAllConflicts(resolution)
      setShowConflictModal(false)
      setConflicts([])
      fetchSyncV2Status()
    } catch (error) {
      console.error('Failed to resolve all conflicts:', error)
      alert('批量解决冲突失败: ' + error.message)
    }
  }

  // Phase 3: 同步附件
  const handleSyncAttachments = async () => {
    setIsSyncingAttachments(true)
    try {
      await syncManager.syncAttachments()
      alert('附件同步完成')
      fetchAttachmentStats()
    } catch (error) {
      alert('附件同步失败: ' + error.message)
    } finally {
      setIsSyncingAttachments(false)
    }
  }

  // Phase 3: 打开冲突弹窗
  const openConflictModal = () => {
    fetchConflicts()
    setShowConflictModal(true)
  }

  // Phase 2: 打开配对弹窗
  const openPairingModal = (mode) => {
    setPairingMode(mode)
    setShowPairingModal(true)
  }

  const closePairingModal = () => {
    setShowPairingModal(false)
  }

  const handleDiscoverHubs = async () => {
    setIsDiscovering(true)
    setDiscoveredHubs([])
    try {
      const hubs = await syncV2API.discover()
      setDiscoveredHubs(hubs || [])
    } catch (error) {
      console.error('Failed to discover hubs:', error)
    } finally {
      setIsDiscovering(false)
    }
  }

  const handleConnectToHub = async (hub) => {
    try {
      await syncV2API.register({
        device_id: hub.device_id,
        device_name: hub.device_name,
        device_type: 'desktop',
        hub_url: `http://${hub.host}:${hub.port}`
      })
      alert('已连接到Hub')
      fetchSyncV2Status()
    } catch (error) {
      alert('连接失败: ' + error.message)
    }
  }

  const handleRemoveDevice = async (deviceId) => {
    if (!confirm('确定移除该设备？')) return
    try {
      await syncV2API.unregister(deviceId)
      fetchSyncV2Status()
    } catch (error) {
      console.error('Failed to remove device:', error)
    }
  }

  const handleSwitchRole = async (newRole) => {
    const msg = newRole === 'hub' 
      ? '切换为Hub模式后，本设备将作为数据主机，其他设备可连接同步。确定切换？'
      : '切换为Leaf模式后，本设备将从主机同步数据。确定切换？'
    if (!confirm(msg)) return
    
    try {
      await syncV2API.switchRole(newRole)
      alert('角色切换成功')
      fetchSyncV2Status()
    } catch (error) {
      alert('角色切换失败: ' + error.message)
    }
  }

  const handleManualSyncV2 = async () => {
    setIsSyncingV2(true)
    try {
      await syncManager.doSync()
      fetchSyncV2Status()
      alert('同步完成')
    } catch (error) {
      alert('同步失败: ' + error.message)
    } finally {
      setIsSyncingV2(false)
    }
  }

  const handleToggleAutoSync = (enabled) => {
    setAutoSyncEnabled(enabled)
    syncManager.setAutoSync(enabled)
    if (enabled) {
      syncManager.start()
    } else {
      syncManager.stop()
    }
  }

  // 根据设备类型获取图标
  const getDeviceTypeIcon = (type) => {
    const icons = { desktop: '💻', mobile: '📱', tablet: '📟' }
    return icons[type] || '💻'
  }

  // 获取设备类型名称
  const getDeviceTypeName = (type) => {
    const names = { desktop: '电脑', mobile: '手机', tablet: '平板' }
    return names[type] || '未知'
  }

  // AI配置保存
  const handleSaveAiConfig = async () => {
    localStorage.setItem('aiApiKey', aiApiKey)
    localStorage.setItem('aiApiBase', aiApiBase)
    localStorage.setItem('aiModel', aiModel)
    localStorage.setItem('aiProvider', aiProvider)
    
    // 配置到后端
    try {
      await aiAPI.configure(aiApiKey, aiApiBase || undefined, aiModel || undefined)
      alert('AI配置已保存')
    } catch (error) {
      console.error('Failed to configure AI:', error)
      alert('AI配置已保存到本地')
    }
  }

  const handleProviderChange = (providerId) => {
    setAiProvider(providerId)
    const provider = AI_PROVIDERS.find(p => p.id === providerId)
    if (provider && providerId !== 'custom') {
      setAiApiBase(provider.baseUrl)
      setAiModel(provider.defaultModel)
    }
  }

  const handleTestAi = async () => {
    setAiTesting(true)
    setAiTestResult(null)
    
    try {
      // 先保存配置
      await handleSaveAiConfig()
      
      // 测试连接
      const result = await aiAPI.test()
      setAiTestResult({ success: true, message: '连接成功!' })
    } catch (error) {
      setAiTestResult({ success: false, message: error.message || '连接失败' })
    } finally {
      setAiTesting(false)
    }
  }

  // MinerU配置保存
  const handleSaveMineruConfig = async () => {
    localStorage.setItem('mineruToken', mineruToken)
    localStorage.setItem('mineruModelVersion', mineruModelVersion)
    localStorage.setItem('mineruLanguage', mineruLanguage)
    
    try {
      await settingsAPI.updateMineruConfig({
        api_token: mineruToken,
        model_version: mineruModelVersion,
        language: mineruLanguage
      })
      alert('MinerU配置已保存')
    } catch (error) {
      console.error('Failed to save MinerU config:', error)
      alert('MinerU配置已保存到本地')
    }
  }


  // OCR配置保存
  const saveOcrConfig = async () => {
    localStorage.setItem('ocrAppId', ocrAppId)
    localStorage.setItem('ocrAppSecret', ocrAppSecret)
    try {
      await settingsAPI.updateOcrConfig({
        app_id: ocrAppId,
        app_secret: ocrAppSecret
      })
      alert('OCR配置已保存')
    } catch (error) {
      console.error('Failed to save OCR config:', error)
      alert('OCR配置已保存到本地')
    }
  }

  // 测试OCR配置
  const testOcrConfig = async () => {
    setOcrTesting(true)
    setOcrTestResult(null)
    try {
      const config = await settingsAPI.getOcrConfig()
      setOcrTestResult({
        success: config.has_config,
        message: config.has_config ? 'OCR配置有效' : '未配置SimpleTex凭证，将使用免费额度'
      })
    } catch (error) {
      setOcrTestResult({ success: false, message: '检查配置失败' })
    } finally {
      setOcrTesting(false)
    }
  }
  // 测试MinerU Token
  const handleTestMineru = async () => {
    setMineruTesting(true)
    setMineruTestResult(null)
    
    try {
      // 先保存配置
      await handleSaveMineruConfig()
      
      // 检查Token状态
      const result = await settingsAPI.checkMineruTokenStatus()
      if (result.has_token) {
        setMineruTestResult({ success: true, message: 'Token已设置，可使用Precision API' })
      } else {
        setMineruTestResult({ success: false, message: '请先设置Token（无Token时使用Agent轻量API）' })
      }
    } catch (error) {
      setMineruTestResult({ success: false, message: error.message || '检查失败' })
    } finally {
      setMineruTesting(false)
    }
  }

  // 期刊/关键词合集管理已移至追踪页和管理页

  // 备份功能
  const fetchBackups = async () => {
    try {
      const list = await backupAPI.listBackups()
      setBackups(list)
    } catch (error) {
      console.error('Failed to fetch backups:', error)
    }
  }

  const handleCreateBackup = async () => {
    try {
      const result = await backupAPI.createBackup()
      alert('备份创建成功')
      fetchBackups()
    } catch (error) {
      alert('备份创建失败: ' + error.message)
    }
  }

  const handleRestoreBackup = async (file) => {
    if (!confirm('恢复备份将覆盖当前数据，确定继续？')) return
    try {
      await backupAPI.restoreBackup(file)
      alert('恢复成功，请刷新页面')
      window.location.reload()
    } catch (error) {
      alert('恢复失败: ' + error.message)
    }
  }

  // 同步功能
  const fetchSyncStatus = async () => {
    try {
      const status = await syncAPI.getStatus()
      setSyncStatus(status)
    } catch (error) {
      console.error('Failed to fetch sync status:', error)
    }
  }

  const handleManualSync = async () => {
    if (!syncServer) {
      alert('请先配置同步服务器地址')
      return
    }
    
    setSyncing(true)
    try {
      // 推送本地变更
      const localChanges = {} // 从IndexedDB获取
      await syncAPI.push(localChanges)
      
      // 拉取远程变更
      const lastSync = localStorage.getItem('lastSyncTime')
      await syncAPI.pull(lastSync)
      
      localStorage.setItem('lastSyncTime', new Date().toISOString())
      alert('同步完成')
      fetchSyncStatus()
    } catch (error) {
      alert('同步失败: ' + error.message)
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveSyncConfig = () => {
    localStorage.setItem('syncEnabled', syncEnabled)
    localStorage.setItem('syncInterval', syncInterval)
    localStorage.setItem('syncServer', syncServer)
    alert('同步配置已保存')
  }

  // 数据导出
  const handleExportData = async (format) => {
    try {
      const data = {
        exported_at: new Date().toISOString(),
        journal_groups: journalGroups,
        keyword_groups: keywordGroups,
        settings: settings,
      }
      
      let content, filename, mimeType
      if (format === 'json') {
        content = JSON.stringify(data, null, 2)
        filename = `cat-settings-${Date.now()}.json`
        mimeType = 'application/json'
      } else {
        content = 'data:text/csv;charset=utf-8,'
        content += 'name,journals\n'
        journalGroups.forEach(g => {
          content += `"${g.name}","${g.journals.join(';')}"\n`
        })
        filename = `cat-settings-${Date.now()}.csv`
        mimeType = 'text/csv'
      }
      
      downloadFile(content, filename, mimeType)
    } catch (error) {
      alert('导出失败')
    }
  }

  // 数据导入
  const handleImportData = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      if (data.journal_groups) {
        for (const group of data.journal_groups) {
          try {
            await organizationAPI.createJournalGroup(group)
          } catch (e) {}
        }
        fetchJournalGroups()
      }
      
      if (data.keyword_groups) {
        for (const group of data.keyword_groups) {
          try {
            await organizationAPI.createKeywordGroup(group)
          } catch (e) {}
        }
        fetchKeywordGroups()
      }
      
      if (data.settings) {
        updateSettings(data.settings)
      }
      
      alert('导入成功')
    } catch (error) {
      alert('导入失败：文件格式错误')
    }
    
    event.target.value = ''
  }

  // 清除数据
  const handleClearData = async () => {
    if (!confirm('确定清除所有数据？此操作不可恢复！')) return
    if (!confirm('再次确认：所有数据将被永久删除！')) return
    
    try {
      localStorage.clear()
      await fetch('/api/v1/clear-all', { method: 'POST' })
      alert('数据已清除')
      window.location.reload()
    } catch (error) {
      alert('清除失败，请手动清除')
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 pb-20">
      {/* 页面标题 */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-blue-500 mb-2">⚙️ 设置</h1>
        <p className="text-gray-500">个性化配置与数据管理</p>
      </div>

      {/* AI配置 */}
      <section className="bg-white rounded-xl p-4 shadow">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">🤖 AI 配置</h2>
        <p className="text-xs text-gray-500 mb-4">⚠️ API密钥仅存储在本地浏览器中</p>
        
        <div className="space-y-4">
          {/* AI提供商 */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">AI 提供商</label>
            <div className="flex flex-wrap gap-2">
              {AI_PROVIDERS.map(provider => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderChange(provider.id)}
                  className={`px-3 py-1.5 text-sm rounded ${
                    aiProvider === provider.id 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {provider.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* API配置 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">API 地址</label>
              <input
                type="text"
                value={aiApiBase}
                onChange={(e) => setAiApiBase(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">模型</label>
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="gpt-3.5-turbo"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 border rounded"
              />
            </div>
          </div>
          
          {/* 测试和保存 */}
          <div className="flex gap-2 items-center">
            <button
              onClick={handleTestAi}
              disabled={aiTesting || !aiApiKey}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {aiTesting ? '测试中...' : '测试连接'}
            </button>
            <button
              onClick={handleSaveAiConfig}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              保存配置
            </button>
            {aiTestResult && (
              <span className={aiTestResult.success ? 'text-green-500' : 'text-red-500'}>
                {aiTestResult.message}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* MinerU文档解析设置 */}
      <section className="bg-white rounded-xl p-4 shadow">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">📄 MinerU文档解析设置</h2>
        
        <div className="space-y-4">
          {/* Token输入 */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">API Token</label>
            <div className="flex gap-2">
              <input
                type={showMineruToken ? 'text' : 'password'}
                value={mineruToken}
                onChange={(e) => setMineruToken(e.target.value)}
                placeholder="输入MinerU API Token（可选，不填则使用免费API）"
                className="flex-1 px-3 py-2 border rounded"
              />
              <button
                onClick={() => setShowMineruToken(!showMineruToken)}
                className="px-3 py-2 bg-gray-100 border rounded hover:bg-gray-200"
                title={showMineruToken ? '隐藏Token' : '显示Token'}
              >
                {showMineruToken ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              有Token可使用Precision API（更准确，支持大文件200MB/200页）
              <br />
              无Token使用Agent轻量API（免费，限制10MB/20页）
              <a 
                href="https://mineru.net/apiManage/token" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline ml-1"
              >
                去获取Token
              </a>
            </p>
          </div>
          
          {/* 模型版本 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">模型版本</label>
              <select
                value={mineruModelVersion}
                onChange={(e) => setMineruModelVersion(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="vlm">VLM（推荐，更准确）</option>
                <option value="pipeline">Pipeline（速度更快）</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-gray-600 mb-1">文档语言</label>
              <select
                value={mineruLanguage}
                onChange={(e) => setMineruLanguage(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="en">英文</option>
                <option value="ch">中文</option>
                <option value="ch_server">中文（繁体+日文增强）</option>
              </select>
            </div>
          </div>
          
          {/* 测试和保存 */}
          <div className="flex gap-2 items-center">
            <button
              onClick={handleTestMineru}
              disabled={mineruTesting}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {mineruTesting ? '检查中...' : '检查Token'}
            </button>
            <button
              onClick={handleSaveMineruConfig}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              保存配置
            </button>
            {mineruTestResult && (
              <span className={mineruTestResult.success ? 'text-green-500' : 'text-yellow-500'}>
                {mineruTestResult.message}
              </span>
            )}
          </div>
        </div>
      </section>


      {/* 公式OCR设置 */}
      <section className="bg-white rounded-xl p-4 shadow">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">📷 公式OCR设置</h2>
        <p className="text-sm text-gray-500 mb-3">
          配置 <a href="https://simpletex.cn" target="_blank" rel="noopener" className="text-blue-500 hover:underline">SimpleTex</a> 
          公式识别API，支持手写/印刷体公式自动转为LaTeX。免费额度：轻量模型1000次/月，标准模型500次/月。
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-2">APP ID（可选）</label>
            <input
              type="text"
              value={ocrAppId}
              onChange={(e) => setOcrAppId(e.target.value)}
              placeholder="SimpleTex APP ID（不填则使用免费额度）"
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-2">APP SECRET（可选）</label>
            <div className="flex gap-2">
              <input
                type={showOcrSecret ? 'text' : 'password'}
                value={ocrAppSecret}
                onChange={(e) => setOcrAppSecret(e.target.value)}
                placeholder="SimpleTex APP SECRET"
                className="flex-1 px-3 py-2 border rounded"
              />
              <button
                onClick={() => setShowOcrSecret(!showOcrSecret)}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                {showOcrSecret ? '隐藏' : '显示'}
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={saveOcrConfig}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              保存OCR配置
            </button>
            <button
              onClick={testOcrConfig}
              disabled={ocrTesting}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              {ocrTesting ? '检查中...' : '检查配置'}
            </button>
            {ocrTestResult && (
              <span className={ocrTestResult.success ? 'text-green-500' : 'text-yellow-500'}>
                {ocrTestResult.message}
              </span>
            )}
          </div>
          
          <p className="text-xs text-gray-400">
            💡 不填写凭证也可使用，但仅限免费额度。注册SimpleTex账号可获得更多调用次数。
          </p>
        </div>
      </section>

      {/* 文献追踪设置 */}
      <section className="bg-white rounded-xl p-4 shadow">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">📡 文献追踪设置</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-2">追踪周期</label>
            <select
              value={settings.trackingInterval || 24}
              onChange={(e) => updateSettings({ trackingInterval: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded"
            >
              {TRACKING_INTERVALS.map(hours => (
                <option key={hours.key} value={hours.key}>
                  {hours.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-2">显示语言</label>
            <div className="flex gap-3">
              {DISPLAY_LANGUAGES.map(lang => (
                <button
                  key={lang.key}
                  onClick={() => updateSettings({ displayLanguage: lang.key })}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 ${
                    settings.displayLanguage === lang.key
                      ? 'border-blue-500 bg-blue-50 text-blue-500'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-2">默认跳转模式</label>
            <select
              value={settings.defaultJumpMode || 'doi'}
              onChange={(e) => updateSettings({ defaultJumpMode: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            >
              {JUMP_MODES.map(mode => (
                <option key={mode.key} value={mode.key}>{mode.name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 学习设置 */}
      <section className="bg-white rounded-xl p-4 shadow">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">📚 学习设置</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-2">单词队列长度</label>
            <select
              value={settings.wordQueueLength || 20}
              onChange={(e) => updateSettings({ wordQueueLength: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded"
            >
              {WORD_QUEUE_LENGTHS.map(len => (
                <option key={len.key} value={len.key}>{len.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-2">复习模式</label>
            <select
              value={settings.reviewMode || 'interval'}
              onChange={(e) => updateSettings({ reviewMode: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="interval">间隔模式（艾宾浩斯遗忘曲线）</option>
              <option value="strict">严格模式（必须连续答对）</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">允许斩</p>
              <p className="text-xs text-gray-500">跳过不认识的单词</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowSkip || false}
                onChange={(e) => updateSettings({ allowSkip: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>
          
          {/* 句子着色设置 */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">句子着色</label>
            <select
              value={settings.sentenceColorScheme || 'none'}
              onChange={(e) => updateSettings({ sentenceColorScheme: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            >
              {Object.values(SENTENCE_COLOR_SCHEMES).map(scheme => (
                <option key={scheme.key} value={scheme.key}>{scheme.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              按句子交替着色，帮助区分不同句子，提高阅读效率
            </p>
          </div>
        </div>
      </section>

      {/* 搜索引擎管理 */}
      <section className="bg-white rounded-xl p-4 shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">🔍 搜索引擎管理</h2>
          <a href="#/tracking" className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
            管理搜索引擎
          </a>
        </div>
        <p className="text-sm text-gray-500">
          在追踪页管理文献检索的搜索引擎，支持添加、编辑、删除和重置默认搜索引擎。
        </p>
      </section>
      {/* 备份与同步 */}
      <section className="bg-white rounded-xl p-4 shadow">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">🔄 备份与同步</h2>
        
        <div className="space-y-4">
          {/* 备份 */}
          <div className="border-b pb-4">
            <h3 className="font-medium mb-2">本地备份</h3>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleCreateBackup} className="px-4 py-2 bg-green-500 text-white rounded text-sm">
                创建备份
              </button>
            </div>
            {backups.length > 0 && (
              <div className="mt-2 text-sm text-gray-500">
                {backups.length} 个备份 | 最新: {backups[0]?.created_at?.slice(0, 16)}
              </div>
            )}
          </div>
          
          {/* 同步配置 */}
          <div>
            <h3 className="font-medium mb-2">多设备同步</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={syncEnabled}
                  onChange={(e) => setSyncEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>启用自动同步</span>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">同步服务器地址</label>
                <input
                  type="text"
                  value={syncServer}
                  onChange={(e) => setSyncServer(e.target.value)}
                  placeholder="https://your-sync-server.com"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">同步间隔</label>
                <select
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                >
                  {SYNC_INTERVALS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-2">
                <button onClick={handleSaveSyncConfig} className="px-4 py-2 bg-blue-500 text-white rounded text-sm">
                  保存
                </button>
                <button 
                  onClick={handleManualSync} 
                  disabled={syncing}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm disabled:opacity-50"
                >
                  {syncing ? '同步中...' : '手动同步'}
                </button>
              </div>
              
              {syncStatus && (
                <div className="text-xs text-gray-500">
                  最后同步: {syncStatus.last_sync_time?.slice(0, 16) || '从未同步'}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Phase 2: 配对码同步 (跨网络) */}
      <section className="bg-white rounded-xl p-4 shadow">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">🔗 配对码同步</h2>
        <p className="text-sm text-gray-500 mb-4">
          通过配对码实现跨网络设备同步，无需在同一局域网内。
        </p>
        
        <div className="space-y-4">
          {/* 中继服务器配置 */}
          <div className="border-b pb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">中继服务器</h3>
              <button 
                onClick={() => setShowRelayConfig(!showRelayConfig)}
                className="text-sm text-blue-500"
              >
                {showRelayConfig ? '收起' : '配置'}
              </button>
            </div>
            
            {showRelayConfig && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={relayUrl}
                  onChange={(e) => setRelayUrl(e.target.value)}
                  placeholder="https://your-relay.workers.dev"
                  className="w-full px-3 py-2 border rounded text-sm"
                />
                <div className="flex gap-2">
                  <button 
                    onClick={handleConfigureRelay}
                    className="px-4 py-2 bg-blue-500 text-white rounded text-sm"
                  >
                    保存
                  </button>
                  <button 
                    onClick={handleTestRelay}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm"
                  >
                    测试连接
                  </button>
                </div>
              </div>
            )}
            
            {relayStatus && (
              <div className="text-xs text-gray-500 mt-2">
                状态: {relayStatus.configured ? '已配置' : '未配置'} | 
                {relayStatus.connected ? '已连接' : '未连接'}
                {relayStatus.relay_url && ` | ${relayStatus.relay_url}`}
              </div>
            )}
          </div>
          
          {/* 配对操作 */}
          <div>
            <h3 className="font-medium mb-2">设备配对</h3>
            <div className="flex gap-2">
              {syncV2Status?.role === 'hub' ? (
                <button 
                  onClick={() => openPairingModal('hub')}
                  className="px-4 py-2 bg-blue-500 text-white rounded text-sm"
                >
                  📱 添加设备
                </button>
              ) : (
                <button 
                  onClick={() => openPairingModal('leaf')}
                  className="px-4 py-2 bg-green-500 text-white rounded text-sm"
                >
                  🔗 连接Hub
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {syncV2Status?.role === 'hub' 
                ? '点击生成配对码，让其他设备扫码或输入配对码连接' 
                : '点击输入Hub上的配对码进行连接'}
            </p>
          </div>
          
          {/* 已配对设备 */}
          {syncV2Status?.role === 'hub' && syncV2Devices?.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">已连接设备</h3>
              <div className="space-y-2">
                {syncV2Devices.map((device) => (
                  <div key={device.device_id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <span>{getDeviceTypeIcon(device.device_type)}</span>
                      <span className="text-sm">{device.device_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${device.is_online ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                        {device.is_online ? '在线' : '离线'}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleRemoveDevice(device.device_id)}
                      className="text-red-500 text-sm hover:text-red-600"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Phase 3: 离线模式 + 冲突解决 + 附件同步 */}
      <section className="bg-white rounded-xl p-4 shadow">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">📴 同步状态</h2>
        
        <div className="space-y-4">
          {/* 离线状态提示 */}
          <div className={`flex items-center gap-2 p-3 rounded-lg ${isOnline ? 'bg-green-50' : 'bg-yellow-50'}`}>
            <span className="text-xl">{isOnline ? '🟢' : '📴'}</span>
            <div className="flex-1">
              <div className="font-medium text-sm">
                {isOnline ? '已连接' : '离线模式'}
              </div>
              {!isOnline && (
                <div className="text-xs text-yellow-700">
                  数据保存在本地，联网后自动同步
                </div>
              )}
            </div>
          </div>

          {/* 同步状态详情 */}
          {syncV2Status && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">待同步变更</div>
                <div className="text-2xl font-bold text-blue-600">
                  {syncV2Status.unsynced_changes || 0}
                  <span className="text-sm font-normal text-gray-500"> 条</span>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">冲突记录</div>
                <div className="text-2xl font-bold text-orange-600">
                  {syncV2Status.conflict_count || 0}
                  {syncV2Status.conflict_count > 0 && (
                    <button
                      onClick={openConflictModal}
                      className="ml-2 text-sm font-normal text-blue-500 hover:underline"
                    >
                      [查看]
                    </button>
                  )}
                  <span className="text-sm font-normal text-gray-500"> 条</span>
                </div>
              </div>
            </div>
          )}

          {/* 附件统计 */}
          {attachmentStats && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-blue-800">
                    📎 附件同步
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {attachmentStats.existing_files} / {attachmentStats.total_count} 个文件，{attachmentStats.total_size_mb} MB
                  </div>
                </div>
                <button
                  onClick={handleSyncAttachments}
                  disabled={isSyncingAttachments || !isOnline}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
                >
                  {isSyncingAttachments ? '同步中...' : '同步附件'}
                </button>
              </div>
            </div>
          )}

          {/* 手动同步按钮 */}
          <div className="flex gap-2">
            <button
              onClick={handleManualSyncV2}
              disabled={isSyncingV2 || !isOnline}
              className="flex-1 px-4 py-2 bg-purple-500 text-white rounded text-sm disabled:opacity-50"
            >
              {isSyncingV2 ? '同步中...' : '🔄 手动同步'}
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={(e) => handleToggleAutoSync(e.target.checked)}
                className="w-4 h-4"
              />
              自动同步
            </label>
          </div>

          {/* 最后同步时间 */}
          {syncV2Status?.last_sync_time && (
            <div className="text-xs text-gray-500 text-center">
              最后同步: {new Date(syncV2Status.last_sync_time).toLocaleString('zh-CN')}
            </div>
          )}
        </div>
      </section>

      {/* 数据管理 */}
      <section className="bg-white rounded-xl p-4 shadow">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">💾 数据管理</h2>
        
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {Object.values(EXPORT_FORMATS).map(format => (
              <button
                key={format.key}
                onClick={() => handleExportData(format.key)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
              >
                {format.icon} 导出 {format.name}
              </button>
            ))}
          </div>
          
          <div className="flex flex-wrap gap-2">
            <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm cursor-pointer hover:bg-gray-200">
              导入 JSON
              <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
            </label>
          </div>
          
          <button onClick={handleClearData} className="w-full px-4 py-2 bg-red-50 text-red-600 rounded text-sm hover:bg-red-100">
            🗑️ 清除所有数据
          </button>
        </div>
      </section>

      {/* 关于 */}
      <section className="bg-white rounded-xl p-4 shadow">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">ℹ️ 关于</h2>
        <div className="text-center py-4">
          <p className="text-3xl mb-2">🐱</p>
          <p className="font-medium text-gray-800">Cat - 学术文献全流程工具</p>
          <p className="text-sm text-gray-500 mt-1">Version 2.0.0</p>
          <p className="text-xs text-gray-400 mt-4">追踪 → 入库 → 阅读 → 笔记 → 学习</p>
        </div>
      </section>

      <div className="h-8" />

    </div>
  )
}

export default Settings
