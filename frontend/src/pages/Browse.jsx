/**
 * 文献卡片页面 - 简详切换 + 展开/折叠/编辑/删除
 */
import { useState, useEffect, useCallback } from 'react'
import useAppStore from '../stores/useAppStore'
import { cardAPI } from '../api/client'

// 简要模式显示的字段
function Browse() {
  const { fetchLiteratureCards, literatureCards, isLoading, settings } = useAppStore()
  const [detailMode, setDetailMode] = useState(false) // false=简要, true=详细
  const [expandedCards, setExpandedCards] = useState({}) // doi -> boolean
  const [editingCard, setEditingCard] = useState(null) // 编辑中的卡片
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null) // doi to delete

  useEffect(() => {
    fetchLiteratureCards()
  }, [])

  const filteredCards = literatureCards.filter(card => {
    const query = searchQuery.toLowerCase()
    return (
      card.title_cn?.toLowerCase().includes(query) ||
      card.title_en?.toLowerCase().includes(query) ||
      card.keyword_cn?.toLowerCase().includes(query) ||
      card.keyword_en?.toLowerCase().includes(query) ||
      card.doi?.toLowerCase().includes(query)
    )
  })

  // 展开/折叠切换
  const toggleExpand = useCallback((doi) => {
    setExpandedCards(prev => ({ ...prev, [doi]: !prev[doi] }))
  }, [])

  // 判断卡片是否展开
  const isCardExpanded = useCallback((doi) => {
    if (expandedCards[doi] !== undefined) return expandedCards[doi]
    return detailMode // 默认：简要=折叠，详细=展开
  }, [expandedCards, detailMode])



  // 删除卡片
  const handleDelete = useCallback(async (doi) => {
    try {
      await cardAPI.deleteCard(doi)
      fetchLiteratureCards()
      setDeleteConfirm(null)
    } catch (err) {
      alert('删除失败: ' + err.message)
    }
  }, [fetchLiteratureCards])

  return (
    <div className="space-y-4 p-4 max-w-4xl mx-auto">
      {/* 顶部工具栏 */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex items-center gap-3 flex-wrap">
          {/* 简详切换 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => { setDetailMode(false); setExpandedCards({}) }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                !detailMode ? 'bg-white shadow text-[#4DBBD5]' : 'text-gray-500'
              }`}
            >
              简要
            </button>
            <button
              onClick={() => { setDetailMode(true); setExpandedCards({}) }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                detailMode ? 'bg-white shadow text-[#4DBBD5]' : 'text-gray-500'
              }`}
            >
              详细
            </button>
          </div>

          {/* 搜索 */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索标题、关键词、DOI..."
            className="input flex-1 min-w-[160px]"
          />

          {/* 新建 */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 bg-[#4DBBD5] text-white rounded-lg text-sm hover:bg-[#3a9ab5] transition-colors whitespace-nowrap"
          >
            + 新建卡片
          </button>
        </div>
      </div>

      {/* 卡片数量 */}
      <div className="text-sm text-[#8491B4] px-1">
        共 {filteredCards.length} 张卡片
      </div>

      {/* 卡片列表 */}
      {isLoading ? (
        <div className="text-center py-12 text-[#8491B4]">
          <div className="animate-spin w-8 h-8 border-4 border-[#4DBBD5] border-t-transparent rounded-full mx-auto mb-3" />
          加载中...
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📑</div>
          <p className="text-[#8491B4] mb-2">暂无文献卡片</p>
          <p className="text-sm text-[#8491B4]">从追踪页面添加文献，或点击上方按钮新建卡片</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCards.map((card) => {
            const expanded = isCardExpanded(card.doi)
            return (
              <div
                key={card.doi}
                className="bg-white rounded-xl card-shadow overflow-hidden transition-all"
              >
                {/* 卡片头部：操作按钮 + 基本信息 */}
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    {/* 左侧：标题和基本信息 */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-[#3C5488] line-clamp-2">
                        {settings.displayLanguage === 'cn' ? card.title_cn : card.title_en}
                      </h3>
                      {!detailMode && !expanded && (
                        <p className="text-xs text-[#8491B4] mt-1">
                          {card.journal} · {card.author?.split(',')[0]} · {card.pubdate}
                        </p>
                      )}
                      {/* 关键词 */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(settings.displayLanguage === 'cn' ? card.keyword_cn : card.keyword_en || '')
                          .split(/[,，]/)
                          .filter(Boolean)
                          .slice(0, detailMode || expanded ? undefined : 3)
                          .map((kw, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-[#4DBBD5]/10 text-[#4DBBD5] rounded text-xs">
                              {kw.trim()}
                            </span>
                          ))}
                      </div>
                    </div>

                    {/* 右侧：操作按钮 */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpand(card.doi) }}
                        className="p-1.5 text-[#8491B4] hover:text-[#4DBBD5] hover:bg-[#4DBBD5]/10 rounded transition-colors"
                        title={expanded ? '折叠' : '展开'}
                      >
                        <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingCard(card) }}
                        className="p-1.5 text-[#8491B4] hover:text-[#00A087] hover:bg-[#00A087]/10 rounded transition-colors"
                        title="编辑"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(card.doi) }}
                        className="p-1.5 text-[#8491B4] hover:text-[#E64B35] hover:bg-[#E64B35]/10 rounded transition-colors"
                        title="删除"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 展开区域：详细信息 */}
                <div className={`transition-all duration-200 ease-in-out overflow-hidden ${
                  expanded || detailMode ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-3">
                    {/* 期刊+日期 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-[#8491B4]">期刊</label>
                        <p className="text-sm">{card.journal}</p>
                      </div>
                      <div>
                        <label className="text-xs text-[#8491B4]">出版日期</label>
                        <p className="text-sm">{card.pubdate}</p>
                      </div>
                    </div>
                    {/* 作者 */}
                    <div>
                      <label className="text-xs text-[#8491B4]">作者</label>
                      <p className="text-sm">{card.author}</p>
                    </div>
                    {/* 中文摘要 */}
                    {card.abstract_cn && (
                      <div>
                        <label className="text-xs text-[#8491B4]">中文摘要</label>
                        <p className="text-sm leading-relaxed">{card.abstract_cn}</p>
                      </div>
                    )}
                    {/* 英文摘要 */}
                    {card.abstract_en && (
                      <div>
                        <label className="text-xs text-[#8491B4]">英文摘要</label>
                        <p className="text-sm leading-relaxed">{card.abstract_en}</p>
                      </div>
                    )}
                    {/* DOI */}
                    <div>
                      <label className="text-xs text-[#8491B4]">DOI</label>
                      <a
                        href={`https://doi.org/${card.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#4DBBD5] hover:underline font-mono"
                        onClick={e => e.stopPropagation()}
                      >
                        {card.doi}
                      </a>
                    </div>
                  </div>
                </div>

                {/* 删除确认条 */}
                {deleteConfirm === card.doi && (
                  <div className="px-4 py-2 bg-[#E64B35]/5 border-t border-[#E64B35]/20 flex items-center justify-between">
                    <span className="text-sm text-[#E64B35]">确认删除此卡片？</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                      >取消</button>
                      <button
                        onClick={() => handleDelete(card.doi)}
                        className="px-3 py-1 text-sm bg-[#E64B35] text-white rounded hover:bg-[#d43d2c]"
                      >删除</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* AI提示词模板管理 */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#3C5488]">🤖 AI提示词模板</h2>
          <PromptTemplateManager />
        </div>
      </div>

      {/* 卡片模板管理 */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#3C5488]">📐 卡片模板</h2>
          <CardTemplateManager />
        </div>
      </div>

      {/* 编辑卡片弹窗 */}
      {editingCard && (
        <EditCardModal
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSaved={() => { fetchLiteratureCards(); setEditingCard(null) }}
        />
      )}

      {/* 新建卡片弹窗 */}
      {showCreateModal && (
        <CreateCardModal onClose={() => setShowCreateModal(false)} onCreated={() => { fetchLiteratureCards(); setShowCreateModal(false) }} />
      )}
    </div>
  )
}

// 编辑卡片弹窗
function EditCardModal({ card, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    title_cn: card.title_cn || '',
    title_en: card.title_en || '',
    journal: card.journal || '',
    author: card.author || '',
    pubdate: card.pubdate || '',
    abstract_cn: card.abstract_cn || '',
    abstract_en: card.abstract_en || '',
    keyword_cn: card.keyword_cn || '',
    keyword_en: card.keyword_en || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await cardAPI.updateCard(card.doi, formData)
      onSaved()
    } catch (err) {
      alert('保存失败: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-semibold">编辑文献卡片</h2>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-3">
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">中文标题</label>
            <input type="text" value={formData.title_cn} onChange={(e) => setFormData({ ...formData, title_cn: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">英文标题</label>
            <input type="text" value={formData.title_en} onChange={(e) => setFormData({ ...formData, title_en: e.target.value })} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[#8491B4] mb-1">期刊</label>
              <input type="text" value={formData.journal} onChange={(e) => setFormData({ ...formData, journal: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm text-[#8491B4] mb-1">出版日期</label>
              <input type="text" value={formData.pubdate} onChange={(e) => setFormData({ ...formData, pubdate: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">作者</label>
            <input type="text" value={formData.author} onChange={(e) => setFormData({ ...formData, author: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">中文摘要</label>
            <textarea value={formData.abstract_cn} onChange={(e) => setFormData({ ...formData, abstract_cn: e.target.value })} className="input" rows={3} />
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">英文摘要</label>
            <textarea value={formData.abstract_en} onChange={(e) => setFormData({ ...formData, abstract_en: e.target.value })} className="input" rows={3} />
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">中文关键词</label>
            <input type="text" value={formData.keyword_cn} onChange={(e) => setFormData({ ...formData, keyword_cn: e.target.value })} className="input" placeholder="用逗号分隔" />
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">英文关键词</label>
            <input type="text" value={formData.keyword_en} onChange={(e) => setFormData({ ...formData, keyword_en: e.target.value })} className="input" placeholder="用逗号分隔" />
          </div>
          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">取消</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 新建卡片弹窗
function CreateCardModal({ onClose, onCreated }) {
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
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await cardAPI.createCard(formData)
      onCreated()
    } catch (err) {
      alert('创建失败: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-semibold">新建文献卡片</h2>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-3">
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">DOI *</label>
            <input type="text" value={formData.doi} onChange={(e) => setFormData({ ...formData, doi: e.target.value })} className="input" required />
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">中文标题 *</label>
            <input type="text" value={formData.title_cn} onChange={(e) => setFormData({ ...formData, title_cn: e.target.value })} className="input" required />
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">英文标题 *</label>
            <input type="text" value={formData.title_en} onChange={(e) => setFormData({ ...formData, title_en: e.target.value })} className="input" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[#8491B4] mb-1">期刊 *</label>
              <input type="text" value={formData.journal} onChange={(e) => setFormData({ ...formData, journal: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-sm text-[#8491B4] mb-1">出版日期 *</label>
              <input type="text" value={formData.pubdate} onChange={(e) => setFormData({ ...formData, pubdate: e.target.value })} className="input" required />
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">作者 *</label>
            <input type="text" value={formData.author} onChange={(e) => setFormData({ ...formData, author: e.target.value })} className="input" required />
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">中文摘要</label>
            <textarea value={formData.abstract_cn} onChange={(e) => setFormData({ ...formData, abstract_cn: e.target.value })} className="input" rows={3} />
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">英文摘要</label>
            <textarea value={formData.abstract_en} onChange={(e) => setFormData({ ...formData, abstract_en: e.target.value })} className="input" rows={3} />
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">中文关键词</label>
            <input type="text" value={formData.keyword_cn} onChange={(e) => setFormData({ ...formData, keyword_cn: e.target.value })} className="input" placeholder="用逗号分隔" />
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">英文关键词</label>
            <input type="text" value={formData.keyword_en} onChange={(e) => setFormData({ ...formData, keyword_en: e.target.value })} className="input" placeholder="用逗号分隔" />
          </div>
          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">取消</button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">{saving ? '创建中...' : '创建'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}


// AI提示词模板管理组件
function PromptTemplateManager() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState({ name: '', content: '', category: '' })

  const fetchTemplates = async () => {
    setLoading(true)
    try { setTemplates(await cardAPI.listPromptTemplates()) }
    catch { setTemplates([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchTemplates() }, [])

  const handleSave = async () => {
    try {
      if (editing) {
        await cardAPI.updatePromptTemplate(editing.id, formData)
      } else {
        await cardAPI.createPromptTemplate(formData)
      }
      setShowModal(false); setEditing(null); setFormData({ name: '', content: '', category: '' })
      fetchTemplates()
    } catch (err) { alert('保存失败: ' + err.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定删除此模板？')) return
    try { await cardAPI.deletePromptTemplate(id); fetchTemplates() }
    catch (err) { alert('删除失败') }
  }

  const startEdit = (t) => {
    setEditing(t); setFormData({ name: t.name, content: t.content, category: t.category || '' })
    setShowModal(true)
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-end gap-2 mb-3">
        <button onClick={() => { setEditing(null); setFormData({ name: '', content: '', category: '' }); setShowModal(true) }}
          className="px-3 py-1.5 bg-[#4DBBD5] text-white rounded-lg text-xs hover:bg-[#3a9ab5]">+ 新建模板</button>
      </div>
      {loading ? <div className="text-center py-4 text-[#8491B4] text-sm">加载中...</div> :
       templates.length === 0 ? <div className="text-center py-4 text-[#8491B4] text-sm">暂无提示词模板</div> :
       <div className="space-y-2">
        {templates.map(t => (
          <div key={t.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-[#3C5488]">{t.name}</span>
              {t.category && <span className="ml-2 text-xs text-[#8491B4]">{t.category}</span>}
              <p className="text-xs text-[#8491B4] truncate mt-0.5">{t.content?.slice(0, 80)}</p>
            </div>
            <div className="flex gap-1 shrink-0 ml-2">
              <button onClick={() => startEdit(t)} className="p-1 text-[#8491B4] hover:text-[#00A087] text-xs">编辑</button>
              <button onClick={() => handleDelete(t.id)} className="p-1 text-[#8491B4] hover:text-[#E64B35] text-xs">删除</button>
            </div>
          </div>
        ))}
       </div>
      }
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">{editing ? '编辑提示词' : '新建提示词'}</h3>
              <button onClick={() => setShowModal(false)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-[#8491B4] mb-1">名称</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input" />
              </div>
              <div>
                <label className="block text-sm text-[#8491B4] mb-1">分类</label>
                <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="input" placeholder="可选" />
              </div>
              <div>
                <label className="block text-sm text-[#8491B4] mb-1">提示词内容</label>
                <textarea value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} className="input" rows={5} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">取消</button>
                <button onClick={handleSave} className="btn btn-primary flex-1">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 卡片模板管理组件
function CardTemplateManager() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '', fields: '' })

  const fetchTemplates = async () => {
    setLoading(true)
    try { setTemplates(await cardAPI.listTemplates()) }
    catch { setTemplates([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchTemplates() }, [])

  const handleSave = async () => {
    try {
      if (editing) {
        await cardAPI.updateTemplate(editing.id, formData)
      } else {
        await cardAPI.createTemplate(formData)
      }
      setShowModal(false); setEditing(null); setFormData({ name: '', description: '', fields: '' })
      fetchTemplates()
    } catch (err) { alert('保存失败: ' + err.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定删除此模板？')) return
    try { await cardAPI.deleteTemplate(id); fetchTemplates() }
    catch (err) { alert('删除失败') }
  }

  const startEdit = (t) => {
    setEditing(t); setFormData({ name: t.name, description: t.description || '', fields: t.fields || '' })
    setShowModal(true)
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-end gap-2 mb-3">
        <button onClick={() => { setEditing(null); setFormData({ name: '', description: '', fields: '' }); setShowModal(true) }}
          className="px-3 py-1.5 bg-[#4DBBD5] text-white rounded-lg text-xs hover:bg-[#3a9ab5]">+ 新建模板</button>
      </div>
      {loading ? <div className="text-center py-4 text-[#8491B4] text-sm">加载中...</div> :
       templates.length === 0 ? <div className="text-center py-4 text-[#8491B4] text-sm">暂无卡片模板</div> :
       <div className="space-y-2">
        {templates.map(t => (
          <div key={t.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-[#3C5488]">{t.name}</span>
              {t.description && <p className="text-xs text-[#8491B4] truncate mt-0.5">{t.description}</p>}
            </div>
            <div className="flex gap-1 shrink-0 ml-2">
              <button onClick={() => startEdit(t)} className="p-1 text-[#8491B4] hover:text-[#00A087] text-xs">编辑</button>
              <button onClick={() => handleDelete(t.id)} className="p-1 text-[#8491B4] hover:text-[#E64B35] text-xs">删除</button>
            </div>
          </div>
        ))}
       </div>
      }
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">{editing ? '编辑卡片模板' : '新建卡片模板'}</h3>
              <button onClick={() => setShowModal(false)} className="text-2xl text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-[#8491B4] mb-1">名称</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input" />
              </div>
              <div>
                <label className="block text-sm text-[#8491B4] mb-1">描述</label>
                <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="input" />
              </div>
              <div>
                <label className="block text-sm text-[#8491B4] mb-1">字段定义</label>
                <textarea value={formData.fields} onChange={e => setFormData({...formData, fields: e.target.value})} className="input" rows={4} placeholder="JSON格式字段定义" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">取消</button>
                <button onClick={handleSave} className="btn btn-primary flex-1">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Browse
