/**
 * 主布局组件 - 底部Tab导航
 */
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import useAppStore from '../stores/useAppStore'
import FileManage from './FileManage'

const tabs = [
  { path: '/', icon: '📡', label: '追踪' },
  { path: '/browse', icon: '📑', label: '略读' },
  { path: '/deep-read', icon: '📖', label: '精读' },
  { path: '/learn', icon: '📚', label: '学习' },
  { path: '/settings', icon: '⚙️', label: '设置' },
]

function Layout() {
  const { fileManageOpen, openFileManage, closeFileManage, fileManageTab } = useAppStore()
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h1 className="text-lg font-semibold text-primary-blue flex items-center gap-2">
            <span className="text-2xl">🐱</span>
            <span className="hidden sm:inline">Cat - 学术文献全流程工具</span>
          </h1>
          <button
            onClick={() => openFileManage('literature')}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
          >
            <span>📁</span>
            <span className="hidden sm:inline">文件管理</span>
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto pb-20">
        <div className="max-w-4xl mx-auto p-4">
          <Outlet />
        </div>
      </main>

      {/* 底部Tab导航 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-inset-bottom">
        <div className="max-w-4xl mx-auto flex justify-around">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-3 text-xs transition-colors ${
                  isActive
                    ? 'text-primary-blue'
                    : 'text-text-secondary hover:text-primary-blue'
                }`
              }
            >
              <span className="text-xl mb-0.5">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* 文件管理弹窗 */}
      <FileManage
        isOpen={fileManageOpen}
        onClose={closeFileManage}
        defaultTab={fileManageTab}
      />
    </div>
  )
}

export default Layout
