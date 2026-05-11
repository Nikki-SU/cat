/**
 * 设置页面
 */
import { useState, useEffect } from 'react'
import useAppStore from '../stores/useAppStore'
import { organizationAPI, literatureAPI } from '../api/client'
import { 
  DISPLAY_LANGUAGES, 
  DISPLAY_DETAILS, 
  TRACKING_INTERVALS, 
  WORD_QUEUE_LENGTHS,
  JUMP_MODES,
  EXPORT_FORMATS,
} from '../utils/constants'
import { downloadFile, formatDate } from '../utils/helpers'

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
  const [mineruToken, setMineruToken] = useState(localStorage.getItem('mineruToken') || '')
  
  // 合集管理
  const [showJournalModal, setShowJournalModal] = useState(false)
  const [showKeywordModal, setShowKeywordModal] = useState(false)
  const [newJournalName, setNewJournalName] = useState('')
  const [newJournalList, setNewJournalList] = useState('')
  const [newKeywordName, setNewKeywordName] = useState('')
  const [newKeywordList, setNewKeywordList] = useState('')
  const [editingJournal, setEditingJournal] = useState(null)
  const [editingKeyword, setEditingKeyword] = useState(null)

  useEffect(() => {
    fetchJournalGroups()
    fetchKeywordGroups()
  }, [])

  // 保存API Key（仅本地存储）
  const handleSaveApiKey = () => {
    localStorage.setItem('aiApiKey', aiApiKey)
    alert('AI API Key 已保存（仅存储在本地）')
  }

  const handleSaveMineruToken = () => {
    localStorage.setItem('mineruToken', mineruToken)
    alert('MinerU Token 已保存（仅存储在本地）')
  }

  // 期刊合集管理
  const handleCreateJournalGroup = async () => {
    if (!newJournalName.trim()) {
      alert('请输入合集名称')
      return
    }
    
    const journals = newJournalList
      .split('\n')
      .map(j => j.trim())
      .filter(j => j)
    
    if (journals.length === 0) {
      alert('请至少输入一个期刊名')
      return
    }
    
    try {
      if (editingJournal) {
        await organizationAPI.updateJournalGroup(editingJournal.id, {
          name: newJournalName,
          journals,
        })
      } else {
        await organizationAPI.createJournalGroup({
          name: newJournalName,
          journals,
        })
      }
      
      fetchJournalGroups()
      resetJournalForm()
      alert(editingJournal ? '更新成功' : '创建成功')
    } catch (error) {
      console.error('Failed to save journal group:', error)
      alert('保存失败')
    }
  }

  const handleDeleteJournalGroup = async (id) => {
    if (!confirm('确定删除该期刊合集？')) return
    
    try {
      await organizationAPI.deleteJournalGroup(id)
      fetchJournalGroups()
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const handleEditJournalGroup = (group) => {
    setEditingJournal(group)
    setNewJournalName(group.name)
    setNewJournalList(group.journals.join('\n'))
    setShowJournalModal(true)
  }

  const resetJournalForm = () => {
    setShowJournalModal(false)
    setNewJournalName('')
    setNewJournalList('')
    setEditingJournal(null)
  }

  // 关键词合集管理
  const handleCreateKeywordGroup = async () => {
    if (!newKeywordName.trim()) {
      alert('请输入合集名称')
      return
    }
    
    const keywords = newKeywordList
      .split('\n')
      .map(k => {
        const trimmed = k.trim()
        // 简单解析：word 或 word:and/or/not
        const parts = trimmed.split(':')
        return {
          word: parts[0],
          logic: parts[1] || 'and',
        }
      })
      .filter(k => k.word)
    
    if (keywords.length === 0) {
      alert('请至少输入一个关键词')
      return
    }
    
    try {
      if (editingKeyword) {
        await organizationAPI.updateKeywordGroup(editingKeyword.id, {
          name: newKeywordName,
          keywords,
        })
      } else {
        await organizationAPI.createKeywordGroup({
          name: newKeywordName,
          keywords,
        })
      }
      
      fetchKeywordGroups()
      resetKeywordForm()
      alert(editingKeyword ? '更新成功' : '创建成功')
    } catch (error) {
      console.error('Failed to save keyword group:', error)
      alert('保存失败')
    }
  }

  const handleDeleteKeywordGroup = async (id) => {
    if (!confirm('确定删除该关键词合集？')) return
    
    try {
      await organizationAPI.deleteKeywordGroup(id)
      fetchKeywordGroups()
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const handleEditKeywordGroup = (group) => {
    setEditingKeyword(group)
    setNewKeywordName(group.name)
    setNewKeywordList(
      group.keywords
        .map(k => `${k.word}:${k.logic}`)
        .join('\n')
    )
    setShowKeywordModal(true)
  }

  const resetKeywordForm = () => {
    setShowKeywordModal(false)
    setNewKeywordName('')
    setNewKeywordList('')
    setEditingKeyword(null)
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
        // CSV格式
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
      console.error('Export failed:', error)
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
          } catch (e) {
            // 可能已存在，跳过
          }
        }
        fetchJournalGroups()
      }
      
      if (data.keyword_groups) {
        for (const group of data.keyword_groups) {
          try {
            await organizationAPI.createKeywordGroup(group)
          } catch (e) {
            // 可能已存在，跳过
          }
        }
        fetchKeywordGroups()
      }
      
      if (data.settings) {
        updateSettings(data.settings)
      }
      
      alert('导入成功')
    } catch (error) {
      console.error('Import failed:', error)
      alert('导入失败：文件格式错误')
    }
    
    event.target.value = ''
  }

  // 清除数据
  const handleClearData = async () => {
    if (!confirm('确定清除所有数据？此操作不可恢复！')) return
    if (!confirm('再次确认：所有数据将被永久删除！')) return
    
    try {
      // 清除本地存储
      localStorage.clear()
      
      // 清除API数据（需要后端支持）
      await fetch('/api/v1/clear-all', { method: 'POST' })
      
      alert('数据已清除')
      window.location.reload()
    } catch (error) {
      console.error('Clear failed:', error)
      alert('清除失败，请手动清除')
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* 页面标题 */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-primary-blue mb-2">⚙️ 设置</h1>
        <p className="text-text-secondary">个性化配置与数据管理</p>
      </div>

      {/* 文献追踪设置 */}
      <section className="bg-white rounded-xl p-4 card-shadow">
        <h2 className="text-lg font-semibold text-text-main mb-4">📡 文献追踪设置</h2>
        
        <div className="space-y-4">
          {/* 追踪周期 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              追踪周期
            </label>
            <select
              value={settings.trackingInterval || 24}
              onChange={(e) => updateSettings({ trackingInterval: Number(e.target.value) })}
              className="input"
            >
              {TRACKING_INTERVALS.map(hours => (
                <option key={hours} value={hours}>
                  {hours >= 24 ? `${hours / 24} 天` : `${hours} 小时`}
                </option>
              ))}
            </select>
          </div>
          
          {/* 显示语言 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              显示语言
            </label>
            <div className="flex gap-3">
              {DISPLAY_LANGUAGES.map(lang => (
                <button
                  key={lang.id}
                  onClick={() => updateSettings({ displayLanguage: lang.id })}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
                    settings.displayLanguage === lang.id
                      ? 'border-primary-blue bg-blue-50 text-primary-blue'
                      : 'border-gray-200 text-text-secondary hover:border-gray-300'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* 显示详情 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              显示详情
            </label>
            <div className="flex gap-3">
              {DISPLAY_DETAILS.map(detail => (
                <button
                  key={detail.id}
                  onClick={() => updateSettings({ displayDetail: detail.id })}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
                    settings.displayDetail === detail.id
                      ? 'border-primary-blue bg-blue-50 text-primary-blue'
                      : 'border-gray-200 text-text-secondary hover:border-gray-300'
                  }`}
                >
                  {detail.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* 默认跳转模式 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              默认跳转模式
            </label>
            <select
              value={settings.defaultJumpMode || 'doi'}
              onChange={(e) => updateSettings({ defaultJumpMode: e.target.value })}
              className="input"
            >
              {JUMP_MODES.map(mode => (
                <option key={mode.id} value={mode.id}>
                  {mode.label} - {mode.description}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 学习设置 */}
      <section className="bg-white rounded-xl p-4 card-shadow">
        <h2 className="text-lg font-semibold text-text-main mb-4">📚 学习设置</h2>
        
        <div className="space-y-4">
          {/* 单词队列长度 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              单词队列长度
            </label>
            <select
              value={settings.wordQueueLength || 20}
              onChange={(e) => updateSettings({ wordQueueLength: Number(e.target.value) })}
              className="input"
            >
              {WORD_QUEUE_LENGTHS.map(len => (
                <option key={len} value={len}>{len} 个</option>
              ))}
            </select>
          </div>
          
          {/* 复习模式 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              复习模式
            </label>
            <select
              value={settings.reviewMode || 'interval'}
              onChange={(e) => updateSettings({ reviewMode: e.target.value })}
              className="input"
            >
              <option value="interval">间隔模式（艾宾浩斯遗忘曲线）</option>
              <option value="strict">严格模式（必须连续答对）</option>
            </select>
          </div>
          
          {/* 翻译练习模式 */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              翻译练习模式
            </label>
            <select
              value={settings.translationMode || 'normal'}
              onChange={(e) => updateSettings({ translationMode: e.target.value })}
              className="input"
            >
              <option value="normal">突击模式（直接显示原文）</option>
              <option value="strict">严格模式（先回忆后对照）</option>
            </select>
          </div>
          
          {/* 允许斩 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">允许斩</p>
              <p className="text-xs text-text-secondary">跳过不认识的单词</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowSkip || false}
                onChange={(e) => updateSettings({ allowSkip: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-blue"></div>
            </label>
          </div>
          
          {/* 提醒学习 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">提醒学习</p>
              <p className="text-xs text-text-secondary">定时推送学习提醒</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.remindLearn || false}
                onChange={(e) => updateSettings({ remindLearn: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-blue"></div>
            </label>
          </div>
        </div>
      </section>

      {/* 期刊合集管理 */}
      <section className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-text-main">📰 期刊合集</h2>
          <button
            onClick={() => setShowJournalModal(true)}
            className="btn btn-primary text-sm"
          >
            + 新建
          </button>
        </div>
        
        {journalGroups.length === 0 ? (
          <p className="text-center py-4 text-text-secondary">暂无期刊合集</p>
        ) : (
          <div className="space-y-2">
            {journalGroups.map(group => (
              <div
                key={group.id}
                className="p-3 border border-gray-200 rounded-lg flex justify-between items-start"
              >
                <div className="flex-1">
                  <p className="font-medium">{group.name}</p>
                  <p className="text-xs text-text-secondary mt-1">
                    {group.journals?.length || 0} 个期刊
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {group.journals?.slice(0, 3).join(', ')}
                    {group.journals?.length > 3 && '...'}
                  </p>
                </div>
                <div className="flex gap-2 ml-2">
                  <button
                    onClick={() => handleEditJournalGroup(group)}
                    className="p-1 text-text-secondary hover:text-primary-blue"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteJournalGroup(group.id)}
                    className="p-1 text-text-secondary hover:text-status-error"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 关键词合集管理 */}
      <section className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-text-main">🔑 关键词合集</h2>
          <button
            onClick={() => setShowKeywordModal(true)}
            className="btn btn-primary text-sm"
          >
            + 新建
          </button>
        </div>
        
        {keywordGroups.length === 0 ? (
          <p className="text-center py-4 text-text-secondary">暂无关键词合集</p>
        ) : (
          <div className="space-y-2">
            {keywordGroups.map(group => (
              <div
                key={group.id}
                className="p-3 border border-gray-200 rounded-lg flex justify-between items-start"
              >
                <div className="flex-1">
                  <p className="font-medium">{group.name}</p>
                  <p className="text-xs text-text-secondary mt-1">
                    {group.keywords?.length || 0} 个关键词
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {group.keywords?.slice(0, 3).map(k => k.word).join(', ')}
                    {group.keywords?.length > 3 && '...'}
                  </p>
                </div>
                <div className="flex gap-2 ml-2">
                  <button
                    onClick={() => handleEditKeywordGroup(group)}
                    className="p-1 text-text-secondary hover:text-primary-blue"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteKeywordGroup(group.id)}
                    className="p-1 text-text-secondary hover:text-status-error"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* API配置 */}
      <section className="bg-white rounded-xl p-4 card-shadow">
        <h2 className="text-lg font-semibold text-text-main mb-4">🔐 API 配置</h2>
        <p className="text-xs text-text-secondary mb-4">
          ⚠️ 以下信息仅存储在本地浏览器中
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              AI API Key (OpenAI兼容格式)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="sk-..."
                className="input flex-1"
              />
              <button onClick={handleSaveApiKey} className="btn btn-secondary">
                保存
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              MinerU API Token
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={mineruToken}
                onChange={(e) => setMineruToken(e.target.value)}
                placeholder="输入 MinerU API Token"
                className="input flex-1"
              />
              <button onClick={handleSaveMineruToken} className="btn btn-secondary">
                保存
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 数据管理 */}
      <section className="bg-white rounded-xl p-4 card-shadow">
        <h2 className="text-lg font-semibold text-text-main mb-4">💾 数据管理</h2>
        
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {EXPORT_FORMATS.map(format => (
              <button
                key={format}
                onClick={() => handleExportData(format)}
                className="btn btn-secondary text-sm"
              >
                导出 {format.toUpperCase()}
              </button>
            ))}
          </div>
          
          <div className="flex flex-wrap gap-2">
            <label className="btn btn-secondary text-sm cursor-pointer">
              导入 JSON
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
            </label>
          </div>
          
          <button
            onClick={handleClearData}
            className="btn w-full bg-red-50 text-status-error hover:bg-red-100"
          >
            🗑️ 清除所有数据
          </button>
        </div>
      </section>

      {/* 关于 */}
      <section className="bg-white rounded-xl p-4 card-shadow">
        <h2 className="text-lg font-semibold text-text-main mb-4">ℹ️ 关于</h2>
        <div className="text-center py-4">
          <p className="text-3xl mb-2">🐱</p>
          <p className="font-medium text-text-main">Cat - 学术文献全流程工具</p>
          <p className="text-sm text-text-secondary mt-1">Version 1.0.0</p>
          <p className="text-xs text-text-secondary mt-4">
            追踪 → 入库 → 阅读 → 笔记 → 学习
          </p>
          <p className="text-xs text-text-secondary">
            以 DOI 为唯一锚点串联全流程
          </p>
        </div>
      </section>

      {/* 底部占位 */}
      <div className="h-8" />

      {/* 期刊合集弹窗 */}
      {showJournalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingJournal ? '编辑期刊合集' : '新建期刊合集'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">合集名称</label>
                <input
                  type="text"
                  value={newJournalName}
                  onChange={(e) => setNewJournalName(e.target.value)}
                  placeholder="例如：物理"
                  className="input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">期刊列表（每行一个）</label>
                <textarea
                  value={newJournalList}
                  onChange={(e) => setNewJournalList(e.target.value)}
                  placeholder="Nature&#10;Science&#10;Cell"
                  className="input min-h-[150px]"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={resetJournalForm} className="btn btn-secondary">
                取消
              </button>
              <button onClick={handleCreateJournalGroup} className="btn btn-primary">
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 关键词合集弹窗 */}
      {showKeywordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingKeyword ? '编辑关键词合集' : '新建关键词合集'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">合集名称</label>
                <input
                  type="text"
                  value={newKeywordName}
                  onChange={(e) => setNewKeywordName(e.target.value)}
                  placeholder="例如：机器学习"
                  className="input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  关键词列表（每行一个，支持 word:and/or/not 格式）
                </label>
                <textarea
                  value={newKeywordList}
                  onChange={(e) => setNewKeywordList(e.target.value)}
                  placeholder="machine learning&#10;deep learning:or&#10;neural network:not"
                  className="input min-h-[150px]"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={resetKeywordForm} className="btn btn-secondary">
                取消
              </button>
              <button onClick={handleCreateKeywordGroup} className="btn btn-primary">
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
