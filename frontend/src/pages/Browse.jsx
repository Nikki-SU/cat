/**
 * 略读页面 - 文献卡片展示
 */
import { useState, useEffect } from 'react'
import useAppStore from '../stores/useAppStore'
import { cardAPI, literatureAPI } from '../api/client'

function Browse() {
  const { fetchLiteratureCards, literatureCards, isLoading, settings } = useAppStore()
  const [viewMode, setViewMode] = useState('grid') // grid | list
  const [selectedCard, setSelectedCard] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchLiteratureCards()
  }, [])

  const filteredCards = literatureCards.filter(card => {
    const query = searchQuery.toLowerCase()
    return (
      card.title_cn?.toLowerCase().includes(query) ||
      card.title_en?.toLowerCase().includes(query) ||
      card.keyword_cn?.toLowerCase().includes(query) ||
      card.keyword_en?.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-primary-blue mb-2">📑 文献略读</h1>
        <p className="text-text-secondary">快速浏览文献卡片，筛选重要文献</p>
      </div>

      {/* 搜索和视图切换 */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索标题、关键词..."
            className="input flex-1"
          />
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded text-sm ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}
            >
              ▦
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded text-sm ${viewMode === 'list' ? 'bg-white shadow' : ''}`}
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* 文献卡片列表 */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-text-main">
            文献卡片 ({filteredCards.length})
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary text-sm"
          >
            + 新建卡片
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-text-secondary">加载中...</div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-secondary mb-4">暂无文献卡片</p>
            <p className="text-sm text-text-secondary">
              从追踪页面添加文献，或点击上方按钮新建卡片
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCards.map((card) => (
              <div
                key={card.doi}
                onClick={() => setSelectedCard(card)}
                className="p-4 border border-gray-200 rounded-xl cursor-pointer hover:border-primary-blue hover:shadow-md transition-all"
              >
                <h3 className="font-medium text-sm line-clamp-2 mb-2">
                  {settings.displayLanguage === 'cn' ? card.title_cn : card.title_en}
                </h3>
                <p className="text-xs text-text-secondary mb-2">{card.journal}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(settings.displayLanguage === 'cn' ? card.keyword_cn : card.keyword_en || '')
                    .split(/[,，]/)
                    .slice(0, 3)
                    .map((kw, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-primary-blue rounded text-xs">
                        {kw.trim()}
                      </span>
                    ))}
                </div>
                <p className="text-xs text-text-secondary">
                  {card.author?.split(',')[0] || ''} · {card.pubdate}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCards.map((card) => (
              <div
                key={card.doi}
                onClick={() => setSelectedCard(card)}
                className="p-3 border border-gray-100 rounded-lg cursor-pointer hover:border-primary-blue hover:bg-blue-50/30 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm">
                      {settings.displayLanguage === 'cn' ? card.title_cn : card.title_en}
                    </h3>
                    <p className="text-xs text-text-secondary mt-1">
                      {card.journal} · {card.author?.split(',')[0]} · {card.pubdate}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 文献卡片详情弹窗 */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-semibold">文献卡片详情</h2>
              <button onClick={() => setSelectedCard(null)} className="text-2xl">×</button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <label className="text-xs text-text-secondary">中文标题</label>
                <p className="font-medium">{selectedCard.title_cn}</p>
              </div>
              <div>
                <label className="text-xs text-text-secondary">英文标题</label>
                <p>{selectedCard.title_en}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-text-secondary">期刊</label>
                  <p>{selectedCard.journal}</p>
                </div>
                <div>
                  <label className="text-xs text-text-secondary">出版日期</label>
                  <p>{selectedCard.pubdate}</p>
                </div>
              </div>
              <div>
                <label className="text-xs text-text-secondary">作者</label>
                <p>{selectedCard.author}</p>
              </div>
              <div>
                <label className="text-xs text-text-secondary">中文摘要</label>
                <p className="text-sm">{selectedCard.abstract_cn}</p>
              </div>
              <div>
                <label className="text-xs text-text-secondary">英文摘要</label>
                <p className="text-sm">{selectedCard.abstract_en}</p>
              </div>
              <div>
                <label className="text-xs text-text-secondary">关键词</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedCard.keyword_cn?.split(/[,，]/).map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-primary-blue rounded text-xs">
                      {kw.trim()}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-text-secondary">DOI</label>
                <p className="text-sm font-mono">{selectedCard.doi}</p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => window.open(`https://doi.org/${selectedCard.doi}`, '_blank')}
                className="btn btn-primary flex-1"
              >
                查看原文
              </button>
              <button className="btn btn-secondary flex-1">
                编辑
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新建卡片弹窗 */}
      {showCreateModal && (
        <CreateCardModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}

function CreateCardModal({ onClose }) {
  const [formData, setFormData] = useState({
    doi: '',
    title_cn: '',
    title_en: '',
    journal: '',
    author: '',
    pubdate: '',
    abstract_cn: '',
    abstract_en: '',
    keyword_cn: '',
    keyword_en: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await cardAPI.createCard(formData)
      alert('创建成功')
      onClose()
    } catch (error) {
      alert('创建失败: ' + error.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-semibold">新建文献卡片</h2>
          <button onClick={onClose} className="text-2xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-3">
          <div>
            <label className="block text-sm text-text-secondary mb-1">DOI *</label>
            <input
              type="text"
              value={formData.doi}
              onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">中文标题 *</label>
            <input
              type="text"
              value={formData.title_cn}
              onChange={(e) => setFormData({ ...formData, title_cn: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">英文标题 *</label>
            <input
              type="text"
              value={formData.title_en}
              onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
              className="input"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1">期刊 *</label>
              <input
                type="text"
                value={formData.journal}
                onChange={(e) => setFormData({ ...formData, journal: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">出版日期 *</label>
              <input
                type="text"
                value={formData.pubdate}
                onChange={(e) => setFormData({ ...formData, pubdate: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">作者 *</label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">中文摘要 *</label>
            <textarea
              value={formData.abstract_cn}
              onChange={(e) => setFormData({ ...formData, abstract_cn: e.target.value })}
              className="input"
              rows={3}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">英文摘要 *</label>
            <textarea
              value={formData.abstract_en}
              onChange={(e) => setFormData({ ...formData, abstract_en: e.target.value })}
              className="input"
              rows={3}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">中文关键词 *</label>
            <input
              type="text"
              value={formData.keyword_cn}
              onChange={(e) => setFormData({ ...formData, keyword_cn: e.target.value })}
              className="input"
              placeholder="用逗号分隔"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">英文关键词 *</label>
            <input
              type="text"
              value={formData.keyword_en}
              onChange={(e) => setFormData({ ...formData, keyword_en: e.target.value })}
              className="input"
              placeholder="用逗号分隔"
              required
            />
          </div>
          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              取消
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Browse
