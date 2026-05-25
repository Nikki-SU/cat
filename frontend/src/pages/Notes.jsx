/**
 * 写作页面 - 创建和编辑Markdown/Word/Excel笔记
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { noteAPI } from '../api/client'
import ObsidianEditor from '../components/ObsidianEditor'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-text-style'
import * as XLSX from 'xlsx'

// ==================== Word编辑器工具栏 ====================
function WordToolbar({ editor }) {
  if (!editor) return null
  const btnClass = "px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded"
  const activeClass = "px-2 py-1 text-sm font-medium bg-[#4DBBD5] text-white rounded"

  return (
    <div className="flex items-center gap-1 p-2 bg-gray-50 border-b flex-wrap">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? activeClass : btnClass} title="粗体">B</button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? activeClass : btnClass} title="斜体">I</button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? activeClass : btnClass} title="下划线">U</button>
      <span className="text-gray-300 mx-1">|</span>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? activeClass : btnClass} title="标题1">H1</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? activeClass : btnClass} title="标题2">H2</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? activeClass : btnClass} title="标题3">H3</button>
      <span className="text-gray-300 mx-1">|</span>
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? activeClass : btnClass} title="无序列表">•</button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? activeClass : btnClass} title="有序列表">1.</button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? activeClass : btnClass} title="引用">"</button>
      <span className="text-gray-300 mx-1">|</span>
      <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btnClass} title="左对齐">⬅</button>
      <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btnClass} title="居中">⬌</button>
      <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btnClass} title="右对齐">➡</button>
      <span className="text-gray-300 mx-1">|</span>
      <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className={btnClass} title="插入表格">⊞</button>
      <button onClick={() => editor.chain().focus().insertContent('<img src="https://via.placeholder.com/150" />').run()} className={btnClass} title="插入图片">🖼️</button>
      <button onClick={() => {
        const url = window.prompt('输入链接地址:')
        if (url) editor.chain().focus().setLink({ href: url }).run()
      }} className={editor.isActive('link') ? activeClass : btnClass} title="插入链接">🔗</button>
    </div>
  )
}

// ==================== Excel编辑器 ====================
function ExcelEditor({ data, onChange }) {
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [rows, setRows] = useState(data || [['', '', '', ''], ['', '', '', ''], ['', '', '', ''], ['', '', '', '']])

  useEffect(() => {
    if (data && data.length > 0) {
      setRows(data)
    }
  }, [data])

  const handleCellChange = (rowIdx, colIdx, value) => {
    const newRows = rows.map((row, ri) => 
      ri === rowIdx ? row.map((cell, ci) => ci === colIdx ? value : cell) : row
    )
    setRows(newRows)
    if (onChange) onChange(newRows)
  }

  const addRow = () => {
    const cols = rows[0]?.length || 4
    const newRows = [...rows, new Array(cols).fill('')]
    setRows(newRows)
    if (onChange) onChange(newRows)
  }

  const addCol = () => {
    const newRows = rows.map(row => [...row, ''])
    setRows(newRows)
    if (onChange) onChange(newRows)
  }

  const startEdit = (rowIdx, colIdx) => {
    setEditingCell({ row: rowIdx, col: colIdx })
    setEditValue(rows[rowIdx]?.[colIdx] || '')
  }

  const finishEdit = () => {
    if (editingCell) {
      handleCellChange(editingCell.row, editingCell.col, editValue)
      setEditingCell(null)
    }
  }

  return (
    <div className="overflow-auto">
      <div className="flex gap-2 mb-2">
        <button onClick={addRow} className="px-3 py-1 text-sm bg-[#4DBBD5] text-white rounded hover:bg-[#3a9ab5]">+ 行</button>
        <button onClick={addCol} className="px-3 py-1 text-sm bg-[#4DBBD5] text-white rounded hover:bg-[#3a9ab5]">+ 列</button>
      </div>
      <table className="border-collapse border border-gray-300">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-gray-300 px-2 py-1 min-w-[80px]">
                  {editingCell && editingCell.row === ri && editingCell.col === ci ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={finishEdit}
                      onKeyDown={e => { if (e.key === 'Enter') finishEdit() }}
                      className="w-full outline-none text-sm"
                      autoFocus
                    />
                  ) : (
                    <div onClick={() => startEdit(ri, ci)} className="text-sm cursor-pointer min-h-[20px] hover:bg-gray-50">
                      {cell}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ==================== 导入文件弹窗 ====================
function ImportModal({ onClose, onImport }) {
  const [importing, setImporting] = useState(false)
  const [doi, setDoi] = useState('')
  const fileRef = useRef(null)

  const handleImport = async () => {
    const file = fileRef.current?.files[0]
    if (!file) return
    setImporting(true)
    try {
      await onImport(file, doi)
      onClose()
    } catch (err) {
      alert('导入失败: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="font-medium mb-4 text-[#3C5488]">导入文件</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">选择文件（支持 pdf/word/excel/markdown）</label>
            <input type="file" ref={fileRef} accept=".pdf,.doc,.docx,.xls,.xlsx,.md,.markdown,.txt" className="w-full text-sm" />
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">关联DOI（可选）</label>
            <input type="text" value={doi} onChange={e => setDoi(e.target.value)} placeholder="10.xxxx/xxxxx" className="w-full px-3 py-2 border rounded text-sm" />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-[#8491B4] hover:bg-gray-100 rounded">取消</button>
          <button onClick={handleImport} disabled={importing} className="px-4 py-2 bg-[#00A087] text-white rounded hover:bg-[#00876d] disabled:opacity-50">
            {importing ? '导入中...' : '导入'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== 新建写作弹窗 ====================
function NewNoteModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('')
  const [fileType, setFileType] = useState('markdown')
  const [doi, setDoi] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="font-medium mb-4 text-[#3C5488]">新建写作</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">标题</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="写作标题" className="w-full px-3 py-2 border rounded text-sm" autoFocus />
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-2">类型</label>
            <div className="flex gap-2">
              {[
                { type: 'markdown', icon: '📝', label: 'Markdown' },
                { type: 'word', icon: '📄', label: 'Word' },
                { type: 'excel', icon: '📊', label: 'Excel' },
              ].map(item => (
                <button
                  key={item.type}
                  onClick={() => setFileType(item.type)}
                  className={`flex-1 py-2 px-3 rounded text-sm border transition-colors ${fileType === item.type ? 'border-[#4DBBD5] bg-blue-50 text-[#4DBBD5]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#8491B4] mb-1">关联DOI（可选）</label>
            <input type="text" value={doi} onChange={e => setDoi(e.target.value)} placeholder="10.xxxx/xxxxx" className="w-full px-3 py-2 border rounded text-sm" />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-[#8491B4] hover:bg-gray-100 rounded">取消</button>
          <button onClick={() => onCreate({ title, file_type: fileType, doi })} className="px-4 py-2 bg-[#00A087] text-white rounded hover:bg-[#00876d]">创建</button>
        </div>
      </div>
    </div>
  )
}

// ==================== 主页面 ====================
function Notes() {
  const [searchParams] = useSearchParams()
  const doiFilter = searchParams.get('doi')

  const [notes, setNotes] = useState([])
  const [selectedNote, setSelectedNote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState(doiFilter ? '' : '')
  const [showNewModal, setShowNewModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Markdown编辑状态
  const [mdContent, setMdContent] = useState('')

  // Word编辑器
  const wordEditor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Underline,
      Placeholder.configure({ placeholder: '开始编辑...' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      if (selectedNote && selectedNote.file_type === 'word') {
        setSelectedNote(prev => ({ ...prev, content: editor.getHTML(), _dirty: true }))
      }
    },
  })

  // Excel编辑状态
  const [excelData, setExcelData] = useState(null)

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (doiFilter) params.doi = doiFilter
      const data = await noteAPI.listGeneralNotes(params)
      setNotes(data)
      // Auto-select if doi filter
      if (doiFilter && data.length > 0 && !selectedNote) {
        selectNote(data[0])
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err)
    } finally {
      setLoading(false)
    }
  }, [doiFilter])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const selectNote = (note) => {
    setSelectedNote({ ...note, _dirty: false })
    if (note.file_type === 'markdown' || !note.file_type) {
      setMdContent(note.content || '')
    } else if (note.file_type === 'word') {
      if (wordEditor) {
        wordEditor.commands.setContent(note.content || '<p></p>')
      }
    } else if (note.file_type === 'excel') {
      try {
        const parsed = note.file_data || [['', '', '', ''], ['', '', '', ''], ['', '', '', '']]
        setExcelData(parsed)
      } catch {
        setExcelData([['', '', '', ''], ['', '', '', ''], ['', '', '', '']])
      }
    }
  }

  const handleCreate = async ({ title, file_type, doi }) => {
    try {
      let content = ''
      let file_data = null
      if (file_type === 'excel') {
        file_data = [['', '', '', ''], ['', '', '', ''], ['', '', '', '']]
      }
      const data = await noteAPI.createGeneralNote({
        title: title || '未命名写作',
        content,
        file_type,
        file_data,
        doi: doi || doiFilter || null,
      })
      setShowNewModal(false)
      fetchNotes()
      selectNote(data)
    } catch (err) {
      alert('创建失败: ' + err.message)
    }
  }

  const handleImport = async (file, doi) => {
    const ext = file.name.split('.').pop().toLowerCase()
    
    if (ext === 'xlsx' || ext === 'xls') {
      // Import Excel locally
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = async (e) => {
          try {
            const wb = XLSX.read(e.target.result, { type: 'array' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 })
            const data = await noteAPI.createGeneralNote({
              title: file.name,
              file_type: 'excel',
              file_data: jsonData,
              doi: doi || null,
            })
            fetchNotes()
            selectNote(data)
            resolve()
          } catch (err) {
            reject(err)
          }
        }
        reader.readAsArrayBuffer(file)
      })
    }

    if (ext === 'md' || ext === 'markdown' || ext === 'txt') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = async (e) => {
          try {
            const content = e.target.result
            const data = await noteAPI.createGeneralNote({
              title: file.name,
              content,
              file_type: 'markdown',
              doi: doi || null,
            })
            fetchNotes()
            selectNote(data)
            resolve()
          } catch (err) {
            reject(err)
          }
        }
        reader.readAsText(file)
      })
    }

    // For docx, pdf, etc. - upload to server
    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', file.name)
    if (doi) formData.append('doi', doi)

    const data = await noteAPI.uploadFile(formData)
    fetchNotes()
    selectNote(data)
  }

  const handleSave = async () => {
    if (!selectedNote) return
    setSaving(true)
    try {
      const updateData = {
        title: selectedNote.title,
        doi: selectedNote.doi,
      }
      if (selectedNote.file_type === 'markdown' || !selectedNote.file_type) {
        updateData.content = mdContent
      } else if (selectedNote.file_type === 'word') {
        updateData.content = wordEditor?.getHTML() || selectedNote.content
      } else if (selectedNote.file_type === 'excel') {
        updateData.file_data = excelData
      }
      await noteAPI.updateGeneralNote(selectedNote.id, updateData)
      setSelectedNote(prev => ({ ...prev, ...updateData, _dirty: false }))
      fetchNotes()
    } catch (err) {
      alert('保存失败: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (note) => {
    if (!confirm(`确定删除写作「${note.title || '未命名'}」？`)) return
    try {
      await noteAPI.deleteGeneralNote(note.id)
      if (selectedNote?.id === note.id) {
        setSelectedNote(null)
      }
      fetchNotes()
    } catch (err) {
      alert('删除失败: ' + err.message)
    }
  }

  const handleMarkdownChange = (newContent) => {
    setMdContent(newContent)
    if (selectedNote) {
      setSelectedNote(prev => ({ ...prev, _dirty: true }))
    }
  }

  // Filter notes
  const filteredNotes = notes.filter(n => {
    const matchesSearch = !searchQuery || 
      n.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.doi?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = !filterType || n.file_type === filterType || (!n.file_type && filterType === 'markdown')
    return matchesSearch && matchesType
  })

  const getTypeIcon = (type) => {
    switch (type) {
      case 'word': return '📄'
      case 'excel': return '📊'
      case 'pdf': return '📕'
      default: return '📝'
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'word': return 'Word'
      case 'excel': return 'Excel'
      case 'pdf': return 'PDF'
      case 'other': return '文件'
      default: return 'MD'
    }
  }

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="text-center py-2">
        <h1 className="text-2xl font-bold text-[#3C5488]">✍️ 写作</h1>
        <p className="text-[#8491B4] text-sm mt-1">创建和管理你的写作</p>
      </div>

      {/* 操作栏 */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowNewModal(true)}
          className="px-4 py-2 bg-[#4DBBD5] text-white rounded hover:bg-[#3a9ab5] text-sm"
        >
          + 新建写作
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          className="px-4 py-2 bg-[#00A087] text-white rounded hover:bg-[#00876d] text-sm"
        >
          📥 导入文件
        </button>
        {doiFilter && (
          <span className="px-3 py-2 bg-blue-50 text-[#4DBBD5] rounded text-sm">
            筛选DOI: {doiFilter}
          </span>
        )}
      </div>

      {/* 主体：左侧列表 + 右侧编辑器 */}
      <div className="flex gap-4 min-h-[600px]">
        {/* 左侧笔记列表 */}
        <div className="w-64 flex-shrink-0 bg-white rounded-lg shadow overflow-hidden">
          <div className="p-3 border-b">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索笔记..."
              className="w-full px-3 py-1.5 border rounded text-sm"
            />
            <div className="flex gap-1 mt-2">
              {['', 'markdown', 'word', 'excel'].map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2 py-0.5 text-xs rounded ${filterType === type ? 'bg-[#4DBBD5] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {type || '全部'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-auto max-h-[550px]">
            {loading ? (
              <p className="text-center text-gray-400 py-8">加载中...</p>
            ) : filteredNotes.length === 0 ? (
              <p className="text-center text-gray-400 py-8">暂无笔记</p>
            ) : (
              filteredNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => selectNote(note)}
                  className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedNote?.id === note.id ? 'bg-blue-50 border-l-4 border-l-[#4DBBD5]' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{getTypeIcon(note.file_type)}</span>
                    <span className="text-sm font-medium text-[#3C5488] truncate flex-1">{note.title || '未命名'}</span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(note) }}
                      className="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100"
                      title="删除"
                    >×</button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{getTypeLabel(note.file_type)}</span>
                    {note.doi && <span className="text-xs text-[#4DBBD5] truncate">DOI: {note.doi.slice(0, 15)}...</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右侧编辑区 */}
        <div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
          {selectedNote ? (
            <div className="flex flex-col h-full">
              {/* 编辑器顶栏 */}
              <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm">{getTypeIcon(selectedNote.file_type)}</span>
                  <input
                    type="text"
                    value={selectedNote.title || ''}
                    onChange={e => setSelectedNote(prev => ({ ...prev, title: e.target.value, _dirty: true }))}
                    className="flex-1 text-sm font-medium text-[#3C5488] outline-none bg-transparent"
                    placeholder="写作标题"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-[#8491B4]">DOI:</span>
                    <input
                      type="text"
                      value={selectedNote.doi || ''}
                      onChange={e => setSelectedNote(prev => ({ ...prev, doi: e.target.value, _dirty: true }))}
                      placeholder="可选"
                      className="w-40 px-2 py-1 text-xs border rounded"
                    />
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-1.5 bg-[#00A087] text-white rounded text-sm hover:bg-[#00876d] disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '💾 保存'}
                  </button>
                  <button
                    onClick={() => handleDelete(selectedNote)}
                    className="px-3 py-1.5 text-red-400 hover:text-red-600 text-sm"
                  >
                    🗑️ 删除
                  </button>
                </div>
              </div>

              {/* 编辑器内容区 */}
              <div className="flex-1 overflow-auto">
                {(selectedNote.file_type === 'markdown' || !selectedNote.file_type) && (
                  <ObsidianEditor
                    value={mdContent}
                    onChange={handleMarkdownChange}
                    placeholder="开始写作..."
                  />
                )}
                {selectedNote.file_type === 'word' && (
                  <div>
                    <WordToolbar editor={wordEditor} />
                    <EditorContent editor={wordEditor} className="prose prose-sm max-w-none p-4 min-h-[400px] focus:outline-none" />
                  </div>
                )}
                {selectedNote.file_type === 'excel' && (
                  <div className="p-4">
                    <ExcelEditor
                      data={excelData}
                      onChange={newData => {
                        setExcelData(newData)
                        setSelectedNote(prev => ({ ...prev, _dirty: true }))
                      }}
                    />
                  </div>
                )}
                {selectedNote.file_type === 'pdf' && (
                  <div className="p-8 text-center text-[#8491B4]">
                    <p className="text-4xl mb-4">📕</p>
                    <p>PDF文件仅支持查看，不支持编辑</p>
                    {selectedNote.file_path && (
                      <a href={`/api/v1/notes/files/${selectedNote.id}`} target="_blank" rel="noreferrer" className="text-[#4DBBD5] hover:underline text-sm mt-2 inline-block">
                        下载查看
                      </a>
                    )}
                  </div>
                )}
                {selectedNote.file_type === 'other' && (
                  <div className="p-8 text-center text-[#8491B4]">
                    <p className="text-4xl mb-4">📎</p>
                    <p>此文件类型仅支持查看，不支持在线编辑</p>
                    {selectedNote.file_path && (
                      <a href={`/api/v1/notes/files/${selectedNote.id}`} target="_blank" rel="noreferrer" className="text-[#4DBBD5] hover:underline text-sm mt-2 inline-block">
                        下载查看
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[#8491B4]">
              <div className="text-center">
                <p className="text-4xl mb-4">📝</p>
                <p>选择一个笔记开始编辑，或创建新笔记</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 弹窗 */}
      {showNewModal && (
        <NewNoteModal
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreate}
        />
      )}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
        />
      )}
    </div>
  )
}

export default Notes
