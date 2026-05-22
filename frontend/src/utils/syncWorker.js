/**
 * 同步管理器 - 自动同步模块
 * Phase 3: 离线模式 + 冲突检测 + 附件同步
 */
import { syncV2API } from '../api/client'

class SyncManager {
  constructor() {
    this.autoSyncEnabled = localStorage.getItem('autoSync') !== 'false'
    this.syncInterval = null
    this.isSyncing = false
    this.lastSyncTime = null
    this.lastLogId = parseInt(localStorage.getItem('lastLogId') || '0')
    this.listener = null  // 状态变化回调
    this.isOnline = navigator.onLine
    
    // 离线检测
    this.setupOfflineDetection()
  }

  setupOfflineDetection() {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.notify({ online: true })
      // 联网后立即同步
      this.doSync()
    })
    
    window.addEventListener('offline', () => {
      this.isOnline = false
      this.notify({ online: false })
    })
  }

  start() {
    if (this.syncInterval) return
    if (!this.autoSyncEnabled) return
    
    // 每30秒同步一次
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.doSync()
      }
    }, 30000)
    
    // 立即同步一次
    if (this.isOnline) {
      this.doSync()
    }
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  async doSync() {
    if (this.isSyncing) return
    if (!this.isOnline) {
      this.notify({ online: false, syncing: false, message: '离线模式' })
      return
    }
    
    this.isSyncing = true
    this.notify({ syncing: true, online: true })

    try {
      const status = await syncV2API.getStatus()
      const role = status.role

      if (role === 'leaf') {
        // Leaf: pull -> check conflicts -> apply -> push
        
        // 1. Pull from Hub
        const pullResult = await syncV2API.pull(status.device_id, this.lastLogId)
        
        // 2. Check for conflicts
        if (pullResult.conflicts && pullResult.conflicts.length > 0) {
          this.notify({ 
            syncing: false, 
            hasConflicts: true, 
            conflicts: pullResult.conflicts,
            message: `发现 ${pullResult.conflicts.length} 个冲突需要解决`
          })
          return  // 有冲突时暂停同步，等用户解决
        }
        
        // 3. Apply changes (backend pull API already applies)
        // 已在后端自动应用
        
        // 4. Update lastLogId
        if (pullResult.latest_log_id) {
          this.lastLogId = pullResult.latest_log_id
          localStorage.setItem('lastLogId', String(this.lastLogId))
        }
        
        // 5. Push local changes
        const unsyncedChanges = await syncV2API.getUnsynced(status.device_id)
        if (unsyncedChanges.count > 0) {
          // 获取本地变更并推送
          const localChanges = this.getLocalChanges()
          if (localChanges.length > 0) {
            await syncV2API.push(status.device_id, localChanges)
          }
        }
      }
      // Hub不需要主动同步

      this.lastSyncTime = new Date()
      localStorage.setItem('lastSyncTime', this.lastSyncTime.toISOString())
      this.notify({ 
        syncing: false, 
        success: true, 
        lastSyncTime: this.lastSyncTime,
        message: '同步完成'
      })
    } catch (error) {
      console.error('Sync error:', error)
      this.notify({ 
        syncing: false, 
        success: false, 
        error: error.message,
        message: '同步失败: ' + error.message
      })
    } finally {
      this.isSyncing = false
    }
  }

  // 获取本地未同步的变更
  getLocalChanges() {
    // 从本地IndexedDB或内存获取变更
    const localChanges = localStorage.getItem('localChanges')
    if (localChanges) {
      try {
        return JSON.parse(localChanges)
      } catch {
        return []
      }
    }
    return []
  }

  // 保存本地变更
  saveLocalChange(change) {
    const changes = this.getLocalChanges()
    changes.push({
      ...change,
      timestamp: new Date().toISOString(),
      synced: false
    })
    localStorage.setItem('localChanges', JSON.stringify(changes))
  }

  // 标记变更已同步
  markChangesSynced(logIds) {
    const changes = this.getLocalChanges()
    const remaining = changes.filter(c => !logIds.includes(c.id))
    localStorage.setItem('localChanges', JSON.stringify(remaining))
  }

  onStatusChange(callback) {
    this.listener = callback
  }

  notify(status) {
    if (this.listener) this.listener(status)
  }

  setAutoSync(enabled) {
    this.autoSyncEnabled = enabled
    localStorage.setItem('autoSync', enabled)
    if (enabled) this.start()
    else this.stop()
  }

  // 获取同步状态
  getStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      lastLogId: this.lastLogId,
      autoSyncEnabled: this.autoSyncEnabled
    }
  }

  // 附件同步
  async syncAttachments() {
    if (!this.isOnline) {
      throw new Error('离线模式无法同步附件')
    }

    try {
      // 1. 获取本地清单
      const localManifest = await syncV2API.getAttachmentManifest()
      
      // 2. 获取远程清单
      const remoteManifest = await fetch('/api/attachments/manifest').then(r => r.json())
      
      // 3. 对比获取缺少的附件
      const missingResponse = await fetch(`/api/attachments/missing?manifest=${encodeURIComponent(JSON.stringify(remoteManifest))}`)
      const { missing } = await missingResponse.json()
      
      // 4. 下载缺少的附件
      for (const att of missing) {
        await this.downloadAttachment(att.doi)
      }
      
      return { success: true, downloaded: missing.length }
    } catch (error) {
      console.error('Attachment sync error:', error)
      throw error
    }
  }

  async downloadAttachment(doi) {
    const response = await fetch(`/api/attachments/download/${encodeURIComponent(doi)}`)
    if (!response.ok) throw new Error('下载附件失败')
    
    const blob = await response.blob()
    // 保存到本地IndexedDB或文件系统
    // ...
    return blob
  }

  // 解决冲突后继续同步
  async continueSyncAfterConflict() {
    await this.doSync()
  }
}

export const syncManager = new SyncManager()
export default syncManager
