/**
 * 同步管理器 - 自动同步模块
 * 不使用Web Worker，就是一个普通的同步管理单例
 */
import { syncV2API } from '../api/client'

class SyncManager {
  constructor() {
    this.autoSyncEnabled = localStorage.getItem('autoSync') !== 'false'
    this.syncInterval = null
    this.isSyncing = false
    this.lastSyncTime = null
    this.listener = null  // 状态变化回调
  }

  start() {
    if (this.syncInterval) return
    if (!this.autoSyncEnabled) return
    this.syncInterval = setInterval(() => this.doSync(), 30000)  // 30秒
    this.doSync()  // 立即同步一次
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  async doSync() {
    if (this.isSyncing) return
    this.isSyncing = true
    this.notify({ syncing: true })

    try {
      const status = await syncV2API.getStatus()
      const role = status.role

      if (role === 'leaf') {
        // Leaf: pull then push
        await syncV2API.pull(status.device_id, status.last_sync_log_id || 0)
        await syncV2API.push(status.device_id, status.unsynced_changes || [])
      }
      // Hub不需要主动同步

      this.lastSyncTime = new Date()
      this.notify({ syncing: false, success: true, lastSyncTime: this.lastSyncTime })
    } catch (error) {
      this.notify({ syncing: false, success: false, error: error.message })
    } finally {
      this.isSyncing = false
    }
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
}

export const syncManager = new SyncManager()
export default syncManager
