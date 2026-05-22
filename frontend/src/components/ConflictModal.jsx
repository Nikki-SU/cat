/**
 * 冲突解决弹窗 - Phase 3
 * 当同一条记录被两个设备同时修改时，提示用户选择保留哪个版本
 */
import { useState, useEffect } from 'react'
import { syncV2API } from '../api/client'

// 表名中文映射
const TABLE_NAME_LABELS = {
  "literature_entries": "文献条目",
  "literature_table_entries": "文献",
  "words": "单词",
  "long_sentences": "长难句",
  "word_lists": "单词表",
  "sentence_lists": "句子表",
  "general_notes": "笔记",
  "note_templates": "笔记模板",
  "literature_cards": "文献卡片",
  "structured_literature": "结构化文献",
  "structured_notes": "结构化笔记",
  "tags": "标签",
  "collections": "合集",
  "collection_items": "合集项",
  "translation_cards": "翻译卡片",
}

// 获取记录的关键字段用于显示
const getRecordSummary = (tableName, record) => {
  if (!record) return { title: "无数据", time: "" }
  
  // 常见的关键字段
  const titleFields = ['title', 'word_en', 'sentence_en', 'name', 'note_title', 'content']
  
  for (const field of titleFields) {
    if (record[field]) {
      return {
        title: String(record[field]).substring(0, 100),
        time: record.updated_at || record.created_at || ""
      }
    }
  }
  
  // 如果没有找到关键字段，显示第一条文本字段
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string' && value.length > 10) {
      return {
        title: value.substring(0, 100),
        time: record.updated_at || record.created_at || ""
      }
    }
  }
  
  return { 
    title: `${TABLE_NAME_LABELS[tableName] || tableName} #${record.id || 'unknown'}`, 
    time: record.updated_at || record.created_at || "" 
  }
}

function ConflictModal({ 
  conflicts = [], 
  onResolve, 
  onClose,
  onResolveAll 
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [resolving, setResolving] = useState(false)
  const [localDeviceId, setLocalDeviceId] = useState("")
  
  useEffect(() => {
    // 获取本地设备ID
    const deviceId = localStorage.getItem('deviceId') || 'unknown'
    setLocalDeviceId(deviceId)
  }, [])
  
  const currentConflict = conflicts[currentIndex]
  
  if (!currentConflict) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl w-full max-w-2xl p-6">
          <div className="text-center py-8">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">所有冲突已解决</h3>
            <p className="text-gray-500 mb-4">数据已同步完成</p>
            <button 
              onClick={onClose}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  const { table_label, record_pk, conflicting_changes, current_data } = currentConflict
  
  // 找出本地变更和远程变更
  const localChange = conflicting_changes.find(c => c.device_id === localDeviceId)
  const remoteChange = conflicting_changes.find(c => c.device_id !== localDeviceId)
  
  const handleResolve = async (resolution, chosenData = null) => {
    setResolving(true)
    try {
      await onResolve(table_label, record_pk, resolution, chosenData)
      
      // 移动到下一个冲突
      if (currentIndex < conflicts.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        onClose()
      }
    } catch (error) {
      console.error("Failed to resolve conflict:", error)
      alert("解决冲突失败: " + error.message)
    } finally {
      setResolving(false)
    }
  }
  
  const localData = localChange?.record_data ? JSON.parse(localChange.record_data) : null
  const remoteData = remoteChange?.record_data ? JSON.parse(remoteChange.record_data) : null
  
  const localSummary = getRecordSummary(table_label, localData)
  const remoteSummary = getRecordSummary(table_label, remoteData)
  
  const formatTime = (isoString) => {
    if (!isoString) return "未知时间"
    try {
      const date = new Date(isoString)
      return date.toLocaleString('zh-CN')
    } catch {
      return isoString
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="p-4 border-b bg-yellow-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              <h2 className="text-lg font-semibold text-gray-800">数据冲突</h2>
            </div>
            <div className="text-sm text-gray-500">
              {currentIndex + 1} / {conflicts.length}
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            <span className="font-medium">{table_label}</span> 在两个设备上被同时修改，请选择保留哪个版本
          </p>
        </div>
        
        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 本地版本 */}
          <div className={`border-2 rounded-lg p-4 ${localChange ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">📱</span>
                <span className="font-medium text-gray-800">本地版本</span>
                {localChange && <span className="text-xs px-2 py-0.5 bg-blue-200 text-blue-700 rounded">当前设备</span>}
              </div>
              <button
                onClick={() => handleResolve("local")}
                disabled={resolving || !localChange}
                className={`px-4 py-1.5 rounded text-sm font-medium ${
                  localChange 
                    ? 'bg-blue-500 text-white hover:bg-blue-600' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                } disabled:opacity-50`}
              >
                选择此版本
              </button>
            </div>
            {localChange ? (
              <>
                <div className="text-sm text-gray-700 bg-white rounded p-3 border border-blue-100">
                  <div className="font-medium mb-1">内容预览:</div>
                  <div className="line-clamp-3">{localSummary.title}</div>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  修改时间: {formatTime(localChange.timestamp)}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-400 italic">无本地变更</div>
            )}
          </div>
          
          {/* 远程版本 */}
          <div className={`border-2 rounded-lg p-4 ${remoteChange ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">☁️</span>
                <span className="font-medium text-gray-800">远程版本</span>
                {remoteChange && <span className="text-xs px-2 py-0.5 bg-green-200 text-green-700 rounded">其他设备</span>}
              </div>
              <button
                onClick={() => handleResolve("remote", remoteData)}
                disabled={resolving || !remoteChange}
                className={`px-4 py-1.5 rounded text-sm font-medium ${
                  remoteChange 
                    ? 'bg-green-500 text-white hover:bg-green-600' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                } disabled:opacity-50`}
              >
                选择此版本
              </button>
            </div>
            {remoteChange ? (
              <>
                <div className="text-sm text-gray-700 bg-white rounded p-3 border border-green-100">
                  <div className="font-medium mb-1">内容预览:</div>
                  <div className="line-clamp-3">{remoteSummary.title}</div>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  修改时间: {formatTime(remoteChange.timestamp)}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-400 italic">无远程变更</div>
            )}
          </div>
          
          {/* 当前数据库版本（仅供参考） */}
          {current_data && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💾</span>
                <span className="font-medium text-gray-600">数据库中的当前值</span>
              </div>
              <div className="text-sm text-gray-600">
                <div className="line-clamp-2">{getRecordSummary(table_label, current_data).title}</div>
              </div>
            </div>
          )}
        </div>
        
        {/* 底部操作 */}
        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            稍后处理
          </button>
          
          {conflicts.length > 1 && (
            <div className="flex gap-2">
              <button
                onClick={() => onResolveAll && onResolveAll('local')}
                disabled={resolving}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
              >
                全部保留本地
              </button>
              <button
                onClick={() => onResolveAll && onResolveAll('remote')}
                disabled={resolving}
                className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
              >
                全部使用远程
              </button>
            </div>
          )}
        </div>
        
        {/* 加载状态 */}
        {resolving && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-2">⏳</div>
              <div className="text-gray-600">正在解决冲突...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConflictModal
