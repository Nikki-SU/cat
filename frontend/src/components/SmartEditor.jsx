/**
 * SmartEditor - 块式智能文档编辑器
 * 
 * 特性：
 * - 所见即所得，无需编辑/预览切换
 * - 支持多种块类型：文本、图片、公式、表格、思维导图、链表、引用
 * - 通过 / 触发命令菜单插入块
 * - 工具栏支持加粗、斜体、下划线
 * 
 * 数据格式：
 * {
 *   type: "doc",
 *   blocks: [
 *     { id: "xxx", type: "text", content: "HTML content" },
 *     { id: "xxx", type: "image", src: "url", caption: "" },
 *     { id: "xxx", type: "formula", latex: "E=mc^2" },
 *     { id: "xxx", type: "table", data: [[...],[...]] },
 *     { id: "xxx", type: "mindmap", data: { name: "root", children: [...] } },
 *     { id: "xxx", type: "linkedlist", nodes: [{id:1,value:10}] },
 *     { id: "xxx", type: "citation", doi: "10.xxxx", format: "apa", text: "..." }
 *   ]
 * }
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TextStyle } from '@tiptap/extension-text-style'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { noteAPI, trackingAPI } from '../api/client'

// ==================== 工具函数 ====================

const generateId = () => Math.random().toString(36).substring(2, 11)

const parseValue = (value) => {
  if (!value) return { blocks: [] }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      // 兼容旧数据：纯文本转为文本块
      return { type: 'doc', blocks: [{ id: generateId(), type: 'text', content: value }] }
    }
  }
  return value
}

// ==================== 公式块组件 ====================

const FormulaBlock = ({ data, onUpdate, readOnly }) => {
  const [isEditing, setIsEditing] = useState(!data.latex)
  const [latex, setLatex] = useState(data.latex || '')
  const [latexInput, setLatexInput] = useState(data.latex || '')
  const [ocrLoading, setOcrLoading] = useState(false)
  const fileInputRef = useRef(null)

  const renderLatex = useMemo(() => {
    if (!latex) return null
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
      })
    } catch (e) {
      return <span className="text-red-500">公式错误: {e.message}</span>
    }
  }, [latex])

  const handleUploadOcr = async (file) => {
    setOcrLoading(true)
    try {
      const result = await noteAPI.ocrFormula(file, 'turbo')
      if (result.latex) {
        setLatex(result.latex)
        setLatexInput(result.latex)
        onUpdate({ ...data, latex: result.latex })
        setIsEditing(false)
      }
    } catch (err) {
      console.error('OCR failed:', err)
      alert('公式识别失败')
    } finally {
      setOcrLoading(false)
    }
  }

  const handleLatexChange = () => {
    setLatex(latexInput)
    onUpdate({ ...data, latex: latexInput })
    setIsEditing(false)
  }

  return (
    <div className="formula-block border rounded-lg p-4 my-2 bg-gray-50">
      {isEditing || readOnly ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={readOnly || ocrLoading}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {ocrLoading ? '识别中...' : '📷 上传截图识别'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={e => e.target.files?.[0] && handleUploadOcr(e.target.files[0])}
              className="hidden"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">直接输入 LaTeX</label>
            <textarea
              value={latexInput}
              onChange={e => setLatexInput(e.target.value)}
              onBlur={handleLatexChange}
              disabled={readOnly}
              placeholder="E=mc^2"
              className="w-full px-3 py-2 border rounded text-sm font-mono"
              rows={2}
            />
          </div>
        </div>
      ) : (
        <div
          className="cursor-pointer hover:bg-gray-100 rounded p-2"
          onClick={() => !readOnly && setIsEditing(true)}
        >
          <div dangerouslySetInnerHTML={{ __html: renderLatex }} />
        </div>
      )}
    </div>
  )
}

// ==================== 图片块组件 ====================

const ImageBlock = ({ data, onUpdate, readOnly }) => {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [caption, setCaption] = useState(data.caption || '')
  const fileInputRef = useRef(null)

  const handleUpload = async (file) => {
    setUploading(true)
    setError('')
    try {
      const result = await noteAPI.uploadImage(file)
      if (result.url) {
        onUpdate({ ...data, src: result.url })
      }
    } catch (err) {
      setError('上传失败')
    } finally {
      setUploading(false)
    }
  }

  if (uploading) {
    return (
      <div className="image-block border rounded-lg p-8 my-2 bg-gray-50 text-center">
        <span className="text-2xl animate-spin">⏳</span>
        <p className="text-sm text-gray-500 mt-2">上传中...</p>
      </div>
    )
  }

  if (!data.src) {
    return (
      <div className="image-block border border-dashed rounded-lg p-8 my-2 bg-gray-50 text-center">
        <p className="text-gray-500 mb-2">点击按钮选择图片</p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={readOnly}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          选择图片
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
          className="hidden"
        />
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
    )
  }

  return (
    <div className="image-block border rounded-lg p-2 my-2">
      <img src={data.src} alt={caption} className="max-w-full rounded" />
      {!readOnly && (
        <input
          type="text"
          value={caption}
          onChange={e => {
            setCaption(e.target.value)
            onUpdate({ ...data, caption: e.target.value })
          }}
          placeholder="添加图片描述..."
          className="w-full mt-2 px-2 py-1 text-sm border-t border-b-0 border-l-0 border-r-0 bg-transparent"
        />
      )}
      {readOnly && caption && <p className="text-sm text-gray-500 mt-1 text-center">{caption}</p>}
    </div>
  )
}

// ==================== 表格块组件 ====================

const TableBlock = ({ data, onUpdate, readOnly }) => {
  const [rows, setRows] = useState(data.data || [['', '', ''], ['', '', ''], ['', '', '']])
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    if (data.data) setRows(data.data)
  }, [data.data])

  const handleCellChange = (rowIdx, colIdx, value) => {
    const newRows = rows.map((row, ri) =>
      ri === rowIdx ? row.map((cell, ci) => ci === colIdx ? value : cell) : row
    )
    setRows(newRows)
    onUpdate({ ...data, data: newRows })
  }

  const addRow = () => {
    const cols = rows[0]?.length || 3
    setRows([...rows, new Array(cols).fill('')])
    onUpdate({ ...data, data: [...rows, new Array(cols).fill('')] })
  }

  const addCol = () => {
    const newRows = rows.map(row => [...row, ''])
    setRows(newRows)
    onUpdate({ ...data, data: newRows })
  }

  const deleteRow = (rowIdx) => {
    if (rows.length <= 1) return
    const newRows = rows.filter((_, i) => i !== rowIdx)
    setRows(newRows)
    onUpdate({ ...data, data: newRows })
  }

  const deleteCol = (colIdx) => {
    if (rows[0]?.length <= 1) return
    const newRows = rows.map(row => row.filter((_, i) => i !== colIdx))
    setRows(newRows)
    onUpdate({ ...data, data: newRows })
  }

  const startEdit = (rowIdx, colIdx) => {
    if (readOnly) return
    setEditingCell({ row: rowIdx, col: colIdx })
    setEditValue(rows[rowIdx]?.[colIdx] || '')
  }

  const finishEdit = () => {
    if (editingCell) {
      handleCellChange(editingCell.row, editingCell.col, editValue)
      setEditingCell(null)
    }
  }

  const handleKeyDown = (e, rowIdx, colIdx) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        if (colIdx > 0) startEdit(rowIdx, colIdx - 1)
      } else {
        if (colIdx < rows[0].length - 1) startEdit(rowIdx, colIdx + 1)
        else if (rowIdx < rows.length - 1) startEdit(rowIdx + 1, 0)
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (rowIdx < rows.length - 1) startEdit(rowIdx + 1, colIdx)
      else {
        finishEdit()
      }
    }
  }

  return (
    <div className="table-block border rounded-lg p-3 my-2 overflow-x-auto">
      <table className="border-collapse border border-gray-300">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-gray-300 min-w-[80px]">
                  {editingCell && editingCell.row === ri && editingCell.col === ci ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={finishEdit}
                      onKeyDown={e => handleKeyDown(e, ri, ci)}
                      className="w-full px-2 py-1 text-sm outline-none"
                      autoFocus
                    />
                  ) : (
                    <div
                      onClick={() => startEdit(ri, ci)}
                      className="text-sm px-2 py-1 min-h-[24px] cursor-pointer hover:bg-gray-50"
                    >
                      {cell}
                    </div>
                  )}
                </td>
              ))}
              {!readOnly && (
                <td className="border border-gray-300">
                  <button
                    onClick={() => deleteRow(ri)}
                    className="px-1 text-red-500 hover:bg-red-50"
                    title="删除行"
                  >
                    ×
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <div className="flex gap-2 mt-2">
          <button onClick={addRow} className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200">+ 行</button>
          <button onClick={addCol} className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200">+ 列</button>
        </div>
      )}
    </div>
  )
}

// ==================== 思维导图块组件 ====================

const MindmapBlock = ({ data, onUpdate, readOnly }) => {
  const [editingNode, setEditingNode] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [selectedNode, setSelectedNode] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)

  const treeData = useMemo(() => {
    if (!data.data) return { name: '中心主题', children: [] }
    return data.data
  }, [data.data])

  const updateTreeData = (node, targetId, newNode, operation) => {
    if (node.id === targetId) {
      if (operation === 'addChild') {
        return { ...node, children: [...(node.children || []), newNode] }
      } else if (operation === 'addSibling') {
        // 父节点操作，通过遍历处理
      }
    }
    if (node.children) {
      return { ...node, children: node.children.map(child => updateTreeData(child, targetId, newNode, operation)) }
    }
    return node
  }

  const findNodeAndParent = (nodes, targetId, parent = null) => {
    for (const node of nodes) {
      if (node.id === targetId) return { node, parent, siblings: nodes }
      if (node.children) {
        const result = findNodeAndParent(node.children, targetId, node)
        if (result) return result
      }
    }
    return null
  }

  const handleContextMenu = (e, node) => {
    if (readOnly) return
    e.preventDefault()
    setSelectedNode(node)
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleAddChild = () => {
    const newNode = { id: generateId(), name: '新主题', children: [] }
    if (!selectedNode) return
    const result = findNodeAndParent([treeData], selectedNode.id)
    if (result) {
      const { node } = result
      const updated = {
        ...treeData,
        children: addChildToNode(treeData, selectedNode.id, newNode)
      }
      onUpdate({ ...data, data: updated })
    }
    setContextMenu(null)
  }

  const addChildToNode = (node, targetId, newNode) => {
    if (node.id === targetId) {
      return [...(node.children || []), newNode]
    }
    if (node.children) {
      return node.children.map(child => ({
        ...child,
        children: addChildToNode(child, targetId, newNode)
      }))
    }
    return node.children || []
  }

  const addSiblingToNode = (node, targetId, newNode) => {
    if (node.children) {
      const idx = node.children.findIndex(c => c.id === targetId)
      if (idx >= 0) {
        return [
          ...node.children.slice(0, idx + 1),
          newNode,
          ...node.children.slice(idx + 1)
        ]
      }
      return node.children.map(child => ({
        ...child,
        children: addSiblingToNode(child, targetId, newNode)
      }))
    }
    return node.children || []
  }

  const handleAddSibling = () => {
    const newNode = { id: generateId(), name: '新主题', children: [] }
    if (!selectedNode) return
    if (treeData.id === selectedNode.id) {
      // 根节点，直接添加子节点
      onUpdate({ ...data, data: { ...treeData, children: [...(treeData.children || []), newNode] } })
    } else {
      const updated = {
        ...treeData,
        children: addSiblingToNode(treeData, selectedNode.id, newNode)
      }
      onUpdate({ ...data, data: updated })
    }
    setContextMenu(null)
  }

  const handleDeleteNode = () => {
    if (!selectedNode || treeData.id === selectedNode.id) return
    const deleteFromTree = (node, targetId) => {
      if (node.children) {
        return {
          ...node,
          children: node.children
            .filter(c => c.id !== targetId)
            .map(c => deleteFromTree(c, targetId))
        }
      }
      return node
    }
    onUpdate({ ...data, data: deleteFromTree(treeData, selectedNode.id) })
    setContextMenu(null)
  }

  const handleNodeDoubleClick = (e, node) => {
    if (readOnly) return
    e.stopPropagation()
    setEditingNode(node.id)
    setEditValue(node.name)
  }

  const handleNodeNameChange = (nodeId, newName) => {
    const updateNodeName = (node) => {
      if (node.id === nodeId) return { ...node, name: newName }
      if (node.children) return { ...node, children: node.children.map(updateNodeName) }
      return node
    }
    onUpdate({ ...data, data: updateNodeName(treeData) })
    setEditingNode(null)
  }

  const renderMindmap = (node, level = 0) => {
    const children = node.children || []
    const angle = 30
    const radius = level === 0 ? 0 : 120

    return (
      <div key={node.id} className="flex flex-col items-center">
        <div
          className={`px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
            selectedNode?.id === node.id ? 'bg-blue-100 border-blue-400' : 'bg-white border-gray-300 hover:bg-gray-50'
          }`}
          onDoubleClick={e => handleNodeDoubleClick(e, node)}
          onContextMenu={e => handleContextMenu(e, node)}
          onClick={() => setSelectedNode(node)}
        >
          {editingNode === node.id ? (
            <input
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => handleNodeNameChange(node.id, editValue)}
              onKeyDown={e => e.key === 'Enter' && handleNodeNameChange(node.id, editValue)}
              className="px-2 py-1 border rounded text-sm outline-none"
              autoFocus
            />
          ) : (
            <span className="text-sm">{node.name}</span>
          )}
        </div>
        {children.length > 0 && (
          <div className="flex gap-4 mt-2">
            {children.map(child => renderMindmap(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

  return (
    <div className="mindmap-block border rounded-lg p-4 my-2 min-h-[200px] bg-gray-50 relative">
      <div className="flex justify-center">
        {renderMindmap(treeData)}
      </div>
      {!readOnly && (
        <div className="flex justify-center mt-2">
          <button
            onClick={() => {
              const newNode = { id: generateId(), name: '新主题', children: [] }
              onUpdate({ ...data, data: { ...treeData, children: [...(treeData.children || []), newNode] } })
            }}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            + 添加分支
          </button>
        </div>
      )}
      {contextMenu && (
        <div
          className="fixed bg-white border rounded-lg shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button onClick={handleAddChild} className="w-full px-4 py-2 text-sm text-left hover:bg-gray-100">
            添加子节点
          </button>
          <button onClick={handleAddSibling} className="w-full px-4 py-2 text-sm text-left hover:bg-gray-100">
            添加兄弟节点
          </button>
          {selectedNode?.id !== treeData.id && (
            <button onClick={handleDeleteNode} className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-gray-100">
              删除节点
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ==================== 链表块组件 ====================

const LinkedListBlock = ({ data, onUpdate, readOnly }) => {
  const [nodes, setNodes] = useState(data.nodes || [{ id: 1, value: 1 }])
  const [editingNode, setEditingNode] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (data.nodes) setNodes(data.nodes)
  }, [data.nodes])

  const addNode = () => {
    const newNode = { id: Date.now(), value: Math.floor(Math.random() * 100) }
    const newNodes = [...nodes, newNode]
    setNodes(newNodes)
    onUpdate({ ...data, nodes: newNodes })
  }

  const deleteNode = (id) => {
    const newNodes = nodes.filter(n => n.id !== id)
    setNodes(newNodes)
    onUpdate({ ...data, nodes: newNodes })
  }

  const updateNodeValue = (id, value) => {
    const newNodes = nodes.map(n => n.id === id ? { ...n, value } : n)
    setNodes(newNodes)
    onUpdate({ ...data, nodes: newNodes })
  }

  const reverseList = async () => {
    setAnimating(true)
    const reversed = [...nodes].reverse()
    // 分步动画
    for (let i = 0; i < reversed.length; i++) {
      await new Promise(r => setTimeout(r, 300))
      setNodes([...reversed.slice(0, i + 1)])
    }
    setNodes(reversed)
    onUpdate({ ...data, nodes: reversed })
    setAnimating(false)
  }

  const handleEditStart = (node) => {
    if (readOnly) return
    setEditingNode(node.id)
    setEditValue(String(node.value))
  }

  const handleEditEnd = () => {
    if (editingNode) {
      updateNodeValue(editingNode, parseInt(editValue) || 0)
      setEditingNode(null)
    }
  }

  return (
    <div className="linkedlist-block border rounded-lg p-4 my-2 bg-gray-50">
      <div className="flex items-center justify-center gap-0 min-h-[80px] flex-wrap">
        {nodes.map((node, idx) => (
          <div key={node.id} className="flex items-center">
            <div
              className={`relative border-2 border-blue-400 rounded-lg p-3 bg-white min-w-[60px] text-center cursor-pointer hover:bg-blue-50 transition-colors ${
                animating ? 'animate-pulse' : ''
              }`}
              onDoubleClick={() => handleEditStart(node)}
            >
              {editingNode === node.id ? (
                <input
                  type="number"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={handleEditEnd}
                  onKeyDown={e => e.key === 'Enter' && handleEditEnd()}
                  className="w-12 text-center border rounded px-1 outline-none"
                  autoFocus
                />
              ) : (
                <span className="text-lg font-medium">{node.value}</span>
              )}
              {!readOnly && (
                <button
                  onClick={e => { e.stopPropagation(); deleteNode(node.id) }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                >
                  ×
                </button>
              )}
            </div>
            {idx < nodes.length - 1 && (
              <div className="flex items-center">
                <div className="w-8 h-0.5 bg-blue-400" />
                <span className="text-blue-400 text-sm">→</span>
              </div>
            )}
          </div>
        ))}
        {nodes.length === 0 && (
          <span className="text-gray-400 text-sm">空链表</span>
        )}
      </div>
      {!readOnly && (
        <div className="flex gap-2 mt-4 justify-center">
          <button
            onClick={addNode}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            + 添加节点
          </button>
          <button
            onClick={reverseList}
            disabled={animating || nodes.length <= 1}
            className="px-4 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            {animating ? '反转中...' : '🔄 反转链表'}
          </button>
        </div>
      )}
    </div>
  )
}

// ==================== 引用块组件 ====================

const CitationBlock = ({ data, onUpdate, readOnly }) => {
  const [doi, setDoi] = useState(data.doi || '')
  const [loading, setLoading] = useState(false)
  const [citationInfo, setCitationInfo] = useState(null)
  const [format, setFormat] = useState(data.format || 'apa')
  const [citationText, setCitationText] = useState(data.text || '')
  const [error, setError] = useState('')

  const fetchCitation = async () => {
    if (!doi) return
    setLoading(true)
    setError('')
    try {
      const info = await trackingAPI.addByDoi(doi)
      setCitationInfo(info)
      generateCitation(info, format)
    } catch (err) {
      setError('无法获取文献信息，请检查DOI')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const generateCitation = (info, fmt) => {
    if (!info) return
    let text = ''
    const authors = info.authors || []
    const year = info.year || info.published_date?.split('-')[0] || 'n.d.'
    const title = info.title || ''
    const journal = info.journal || info.container_title || ''
    const volume = info.volume || ''
    const pages = info.pages || ''
    const doi_str = info.doi || doi

    switch (fmt) {
      case 'apa':
        const authorStr = authors.length > 0
          ? (authors.length > 6
              ? `${authors.slice(0, 6).join(', ')}, ... ${authors[authors.length - 1]}`
              : authors.join(', & '))
          : 'Unknown'
        text = `${authorStr} (${year}). ${title}. ${journal}${volume ? `, ${volume}` : ''}${pages ? `, ${pages}` : ''}. https://doi.org/${doi_str}`
        break
      case 'acs':
        const acsAuthors = authors.slice(0, 3).join(', ')
        text = `${acsAuthors}${authors.length > 3 ? ', et al.' : ''}. ${year}. ${title}. ${journal}. https://doi.org/${doi_str}`
        break
      case 'mla':
        const mlaAuthor = authors.length > 0 ? authors[0] : 'Unknown'
        text = `${mlaAuthor}${authors.length > 1 ? ', et al.' : ''}. "${title}." ${journal}, ${year}${volume ? `, vol. ${volume}` : ''}${pages ? `, pp. ${pages}` : ''}. DOI: ${doi_str}.`
        break
      default:
        text = citationText
    }
    setCitationText(text)
    onUpdate({ ...data, doi, format: fmt, text })
  }

  const handleFetch = () => {
    if (doi !== data.doi) {
      fetchCitation()
    }
    onUpdate({ ...data, doi, format, text: citationText })
  }

  if (citationInfo || citationText) {
    return (
      <div className="citation-block border rounded-lg p-4 my-2 bg-gray-50">
        {citationInfo && (
          <div className="text-sm text-gray-600 mb-2">
            <span className="font-medium">{citationInfo.title}</span>
            {citationInfo.authors && (
              <span className="block text-gray-500">{citationInfo.authors.join(', ')}</span>
            )}
          </div>
        )}
        <div className="flex gap-2 mb-2">
          {['apa', 'acs', 'mla'].map(f => (
            <button
              key={f}
              onClick={() => { setFormat(f); generateCitation(citationInfo, f) }}
              className={`px-3 py-1 text-xs rounded ${format === f ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="bg-white border rounded p-3 text-sm leading-relaxed">
          {citationText}
        </div>
        {!readOnly && (
          <button
            onClick={() => { setCitationInfo(null); setCitationText(''); setDoi('') }}
            className="mt-2 text-sm text-gray-500 hover:text-gray-700"
          >
            重新输入DOI
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="citation-block border rounded-lg p-4 my-2 bg-gray-50">
      <p className="text-sm text-gray-600 mb-2">输入 DOI 获取文献引用</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={doi}
          onChange={e => setDoi(e.target.value)}
          placeholder="10.xxxx/xxxxx"
          disabled={readOnly}
          className="flex-1 px-3 py-2 border rounded text-sm"
        />
        <button
          onClick={handleFetch}
          disabled={readOnly || loading || !doi}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '获取中...' : '获取引用'}
        </button>
      </div>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  )
}

// ==================== 斜杠命令菜单 ====================

const SlashCommandMenu = ({ position, onSelect, onClose }) => {
  const menuRef = useRef(null)
  const [filter, setFilter] = useState('')

  const commands = [
    { type: 'text', label: '文本', icon: '📝', description: '普通文本段落' },
    { type: 'image', label: '图片', icon: '🖼️', description: '上传或嵌入图片' },
    { type: 'formula', label: '公式', icon: '∑', description: '数学公式（支持LaTeX）' },
    { type: 'table', label: '表格', icon: '⊞', description: '插入可编辑表格' },
    { type: 'mindmap', label: '思维导图', icon: '🧠', description: '创建思维导图' },
    { type: 'linkedlist', label: '链表', icon: '🔗', description: '算法链表可视化' },
    { type: 'citation', label: '引用', icon: '📚', description: '通过DOI添加文献引用' },
  ]

  const filteredCommands = filter
    ? commands.filter(c => c.label.includes(filter) || c.type.includes(filter))
    : commands

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border rounded-lg shadow-xl w-64 max-h-80 overflow-y-auto z-50"
      style={{ left: position.x, top: position.y }}
    >
      <div className="p-2 border-b">
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="搜索..."
          className="w-full px-2 py-1 text-sm border rounded outline-none"
          autoFocus
        />
      </div>
      <div className="py-1">
        {filteredCommands.map(cmd => (
          <button
            key={cmd.type}
            onClick={() => onSelect(cmd.type)}
            className="w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-gray-100"
          >
            <span className="text-xl">{cmd.icon}</span>
            <div>
              <div className="text-sm font-medium">{cmd.label}</div>
              <div className="text-xs text-gray-500">{cmd.description}</div>
            </div>
          </button>
        ))}
        {filteredCommands.length === 0 && (
          <div className="px-3 py-4 text-center text-gray-500 text-sm">无匹配结果</div>
        )}
      </div>
    </div>
  )
}

// ==================== 工具栏 ====================

const EditorToolbar = ({ editor, onInsertBlock, readOnly }) => {
  if (readOnly) return null
  if (!editor) return null

  const btnClass = 'px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded transition-colors'
  const activeClass = 'px-2 py-1 text-sm font-medium bg-blue-100 text-blue-600 rounded'

  return (
    <div className="flex items-center gap-1 p-2 bg-gray-50 border-b flex-wrap">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? activeClass : btnClass}
        title="加粗 (Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? activeClass : btnClass}
        title="斜体 (Ctrl+I)"
      >
        <em>I</em>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={editor.isActive('underline') ? activeClass : btnClass}
        title="下划线 (Ctrl+U)"
      >
        <u>U</u>
      </button>
      <span className="text-gray-300 mx-1">|</span>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={editor.isActive('heading', { level: 1 }) ? activeClass : btnClass}
        title="标题1"
      >
        H1
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={editor.isActive('heading', { level: 2 }) ? activeClass : btnClass}
        title="标题2"
      >
        H2
      </button>
      <span className="text-gray-300 mx-1">|</span>
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? activeClass : btnClass}
        title="无序列表"
      >
        •
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? activeClass : btnClass}
        title="有序列表"
      >
        1.
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={editor.isActive('blockquote') ? activeClass : btnClass}
        title="引用"
      >
        "
      </button>
      <span className="text-gray-300 mx-1">|</span>
      <button
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        className={btnClass}
        title="插入表格"
      >
        ⊞
      </button>
      <button
        onClick={onInsertBlock}
        className="px-3 py-1 text-sm font-medium text-white bg-blue-500 rounded hover:bg-blue-600"
        title="插入块 (输入 / 触发)"
      >
        + 块
      </button>
    </div>
  )
}

// ==================== 块渲染器 ====================

const BlockRenderer = ({ block, onUpdate, readOnly }) => {
  switch (block.type) {
    case 'text':
      // 文本块使用 TipTap 渲染
      return <div className="prose max-w-none">{block.content}</div>
    case 'image':
      return <ImageBlock data={block} onUpdate={onUpdate} readOnly={readOnly} />
    case 'formula':
      return <FormulaBlock data={block} onUpdate={onUpdate} readOnly={readOnly} />
    case 'table':
      return <TableBlock data={block} onUpdate={onUpdate} readOnly={readOnly} />
    case 'mindmap':
      return <MindmapBlock data={block} onUpdate={onUpdate} readOnly={readOnly} />
    case 'linkedlist':
      return <LinkedListBlock data={block} onUpdate={onUpdate} readOnly={readOnly} />
    case 'citation':
      return <CitationBlock data={block} onUpdate={onUpdate} readOnly={readOnly} />
    default:
      return <div className="text-gray-400 text-sm">未知块类型: {block.type}</div>
  }
}

// ==================== 主编辑器组件 ====================

export default function SmartEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = '开始输入... 或输入 / 插入块',
  className = '',
}) {
  const [blocks, setBlocks] = useState([])
  const [slashMenu, setSlashMenu] = useState(null)
  const editorContainerRef = useRef(null)

  // 解析初始值
  useEffect(() => {
    const parsed = parseValue(value)
    if (parsed.blocks && parsed.blocks.length > 0) {
      setBlocks(parsed.blocks)
    } else {
      // 初始化一个空文本块
      setBlocks([{ id: generateId(), type: 'text', content: '' }])
    }
  }, [value])

  // 同步数据到父组件
  const syncToParent = useCallback((newBlocks) => {
    setBlocks(newBlocks)
    if (onChange) {
      onChange(JSON.stringify({ type: 'doc', blocks: newBlocks }))
    }
  }, [onChange])

  // 更新块内容
  const updateBlock = useCallback((blockId, updates) => {
    const newBlocks = blocks.map(b =>
      b.id === blockId ? { ...b, ...updates } : b
    )
    syncToParent(newBlocks)
  }, [blocks, syncToParent])

  // 插入新块
  const insertBlock = useCallback((type) => {
    let newBlock
    switch (type) {
      case 'text':
        newBlock = { id: generateId(), type: 'text', content: '' }
        break
      case 'image':
        newBlock = { id: generateId(), type: 'image', src: '', caption: '' }
        break
      case 'formula':
        newBlock = { id: generateId(), type: 'formula', latex: '' }
        break
      case 'table':
        newBlock = { id: generateId(), type: 'table', data: [['', '', ''], ['', '', ''], ['', '', '']] }
        break
      case 'mindmap':
        newBlock = { id: generateId(), type: 'mindmap', data: { id: generateId(), name: '中心主题', children: [] } }
        break
      case 'linkedlist':
        newBlock = { id: generateId(), type: 'linkedlist', nodes: [{ id: 1, value: 1 }] }
        break
      case 'citation':
        newBlock = { id: generateId(), type: 'citation', doi: '', format: 'apa', text: '' }
        break
      default:
        newBlock = { id: generateId(), type: 'text', content: '' }
    }
    const newBlocks = [...blocks, newBlock]
    syncToParent(newBlocks)
    setSlashMenu(null)
  }, [blocks, syncToParent])

  // 删除块
  const deleteBlock = useCallback((blockId) => {
    const newBlocks = blocks.filter(b => b.id !== blockId)
    if (newBlocks.length === 0) {
      newBlocks.push({ id: generateId(), type: 'text', content: '' })
    }
    syncToParent(newBlocks)
  }, [blocks, syncToParent])

  // 处理 / 命令
  const handleSlashCommand = useCallback((e) => {
    if (readOnly) return
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSlashMenu({ x: rect.left, y: rect.bottom + 5 })
    }
  }, [readOnly])

  // 处理键盘事件
  const handleKeyDown = useCallback((e) => {
    if (e.key === '/' && !slashMenu) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const textBeforeCursor = range.startContainer.textContent?.slice(0, range.startOffset) || ''
        // 检查是否在行首
        if (textBeforeCursor.trim() === '' || textBeforeCursor.endsWith('\n')) {
          e.preventDefault()
          const rect = range.getBoundingClientRect()
          setSlashMenu({ x: rect.left, y: rect.bottom + 5 })
        }
      }
    }
    if (e.key === 'Escape' && slashMenu) {
      setSlashMenu(null)
    }
  }, [slashMenu])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // TipTap 编辑器配置
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
      Underline,
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: blocks.find(b => b.type === 'text')?.content || '',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const textBlock = blocks.find(b => b.type === 'text')
      if (textBlock) {
        updateBlock(textBlock.id, { content: html })
      } else {
        // 插入新的文本块
        const newBlocks = [{ id: generateId(), type: 'text', content: html }, ...blocks]
        syncToParent(newBlocks)
      }
    },
  })

  // 当 blocks 更新时同步到编辑器
  useEffect(() => {
    if (editor) {
      const textBlock = blocks.find(b => b.type === 'text')
      const currentHtml = editor.getHTML()
      const newHtml = textBlock?.content || ''
      if (currentHtml !== newHtml && newHtml !== editor.state.doc.firstChild?.textContent) {
        editor.commands.setContent(newHtml)
      }
    }
  }, [blocks, editor])

  const handleInsertBlock = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSlashMenu({ x: rect.left, y: rect.bottom + 5 })
    }
  }

  return (
    <div className={`smart-editor ${className}`}>
      <EditorToolbar editor={editor} onInsertBlock={handleInsertBlock} readOnly={readOnly} />
      
      <div ref={editorContainerRef} className="p-4 min-h-[300px]">
        {/* 渲染非文本块 */}
        {blocks.filter(b => b.type !== 'text').map(block => (
          <div key={block.id} className="mb-4 relative group">
            <BlockRenderer
              block={block}
              onUpdate={(updates) => updateBlock(block.id, updates)}
              readOnly={readOnly}
            />
            {!readOnly && (
              <button
                onClick={() => deleteBlock(block.id)}
                className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                title="删除块"
              >
                ×
              </button>
            )}
          </div>
        ))}
        
        {/* TipTap 文本编辑器 */}
        <div className={blocks.some(b => b.type !== 'text') ? 'mt-4' : ''}>
          <EditorContent editor={editor} className="prose max-w-none focus:outline-none" />
        </div>
      </div>

      {/* 斜杠命令菜单 */}
      {slashMenu && (
        <SlashCommandMenu
          position={slashMenu}
          onSelect={insertBlock}
          onClose={() => setSlashMenu(null)}
        />
      )}

      {/* 格式化工具栏（编辑模式固定显示） */}
      {!readOnly && editor && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-gray-50 flex-wrap">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-2 py-1 text-sm rounded ${editor.isActive('bold') ? 'bg-gray-300' : 'hover:bg-gray-200'}`}
            title="加粗"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-2 py-1 text-sm rounded ${editor.isActive('italic') ? 'bg-gray-300' : 'hover:bg-gray-200'}`}
            title="斜体"
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`px-2 py-1 text-sm rounded ${editor.isActive('underline') ? 'bg-gray-300' : 'hover:bg-gray-200'}`}
            title="下划线"
          >
            <u>U</u>
          </button>
          <span className="text-gray-300 mx-1">|</span>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2 py-1 text-sm rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-300' : 'hover:bg-gray-200'}`}
            title="标题"
          >H2</button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-2 py-1 text-sm rounded ${editor.isActive('bulletList') ? 'bg-gray-300' : 'hover:bg-gray-200'}`}
            title="列表"
          >• 列表</button>
          <span className="text-gray-300 mx-1">|</span>
          <button
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            className="px-2 py-1 text-sm rounded hover:bg-gray-200"
            title="插入表格"
          >⊞ 表格</button>
          <button
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'image/*'
              input.onchange = async (e) => {
                const file = e.target.files[0]
                if (!file) return
                try {
                  const result = await noteAPI.uploadImage(file)
                  editor.chain().focus().setImage({ src: result.url || result.path }).run()
                } catch (err) {
                  console.error('图片上传失败', err)
                }
              }
              input.click()
            }}
            className="px-2 py-1 text-sm rounded hover:bg-gray-200"
            title="插入图片"
          >🖼 图片</button>
        </div>
      )}
    </div>
  )
}
