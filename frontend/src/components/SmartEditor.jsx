/**
 * SmartEditor - 飞书/WPS风格智能文档编辑器
 * 
 * 核心设计：TipTap 就是整个文档
 * 所有块类型（公式、思维导图、链表、引用）都是 TipTap Custom Node Extension
 * 通过 ReactNodeViewRenderer 嵌入文档流，插入就在光标位置
 * 
 * 禁止：左右分屏预览、prompt()、块渲染在TipTap外面
 */
import { useState, useEffect, useRef, useCallback, forwardRef } from 'react'
import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react'
import { Node, mergeAttributes } from '@tiptap/core'
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

// 解析旧数据格式为 TipTap JSON
const parseValueToContent = (value) => {
  if (!value) return ''
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      // 旧的 blocks 格式
      if (parsed.type === 'doc' && parsed.blocks) {
        return blocksToTipTapJson(parsed.blocks)
      }
      // 已经是 TipTap JSON
      if (parsed.type === 'doc' && parsed.content) return parsed
      return parsed
    } catch {
      // 纯文本/Markdown → 段落
      return value.split('\n').map(line => ({
        type: 'paragraph',
        content: line ? [{ type: 'text', text: line }] : undefined
      }))
    }
  }
  return value
}

// 旧 blocks 数组转 TipTap JSON
const blocksToTipTapJson = (blocks) => {
  const content = []
  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        if (block.content) {
          content.push({ type: 'paragraph', content: [{ type: 'text', text: stripHtml(block.content) }] })
        }
        break
      case 'image':
        content.push({ type: 'image', attrs: { src: block.src, alt: block.caption || '' } })
        break
      case 'formula':
        content.push({ type: 'formula', attrs: { latex: block.latex || '' } })
        break
      case 'table':
        if (block.data && block.data.length > 0) {
          const rows = block.data.map((row, i) => ({
            type: i === 0 ? 'tableHeader' : 'tableRow',
            content: row.map(cell => ({
              type: i === 0 ? 'tableHeader' : 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: String(cell || '') }] }]
            }))
          }))
          content.push({ type: 'table', content: rows })
        }
        break
      case 'mindmap':
        content.push({ type: 'mindmap', attrs: { data: JSON.stringify(block.data || { name: '主题', children: [] }) } })
        break
      case 'linkedlist':
        content.push({ type: 'linkedlist', attrs: { nodes: JSON.stringify(block.nodes || []) } })
        break
      case 'citation':
        content.push({ type: 'citation', attrs: { doi: block.doi || '', format: block.format || 'apa', text: block.text || '' } })
        break
    }
  }
  return content.length > 0 ? { type: 'doc', content } : ''
}

const stripHtml = (html) => {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

// ==================== 公式块 Node ====================

const FormulaComponent = ({ node, updateAttributes }) => {
  const [editing, setEditing] = useState(!node.attrs.latex)
  const [latex, setLatex] = useState(node.attrs.latex || '')
  const [ocrLoading, setOcrLoading] = useState(false)

  useEffect(() => {
    setLatex(node.attrs.latex || '')
  }, [node.attrs.latex])

  const handleSave = () => {
    updateAttributes({ latex })
    setEditing(false)
  }

  const handleOcr = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      setOcrLoading(true)
      try {
        const result = await noteAPI.ocrFormula(file, 'turbo')
        const recognized = result.latex || result.text || result.content || ''
        if (recognized) {
          setLatex(recognized)
          updateAttributes({ latex: recognized })
          setEditing(false)
        }
      } catch (err) {
        console.error('公式识别失败', err)
      } finally {
        setOcrLoading(false)
      }
    }
    input.click()
  }

  const renderLatex = () => {
    try {
      return katex.renderToString(latex, { throwOnError: false, displayMode: true })
    } catch {
      return '<span class="text-red-500">公式错误</span>'
    }
  }

  return (
    <NodeViewWrapper className="formula-block">
      {editing ? (
        <div className="border rounded-lg p-3 bg-blue-50 my-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-blue-600">∑ 公式编辑</span>
            <button onClick={handleOcr} disabled={ocrLoading}
              className="ml-auto px-2 py-1 text-xs bg-purple-100 text-purple-600 rounded hover:bg-purple-200">
              {ocrLoading ? '识别中...' : '📷 OCR识别'}
            </button>
          </div>
          <textarea
            value={latex}
            onChange={e => setLatex(e.target.value)}
            placeholder="输入 LaTeX 公式，如 E=mc^2"
            className="w-full p-2 border rounded text-sm font-mono min-h-[60px] resize-y"
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSave() }}
          />
          <div className="flex gap-2 mt-2">
            <button onClick={handleSave} className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600">保存</button>
            <button onClick={() => { setEditing(false); setLatex(node.attrs.latex || '') }} className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700">取消</button>
          </div>
          {latex && (
            <div className="mt-2 p-2 bg-white rounded border" dangerouslySetInnerHTML={{ __html: renderLatex() }} />
          )}
        </div>
      ) : (
        <div className="my-2 cursor-pointer group" onClick={() => setEditing(true)}>
          {latex ? (
            <div className="p-2 bg-gray-50 rounded border hover:border-blue-300 transition-colors" 
              dangerouslySetInnerHTML={{ __html: renderLatex() }} />
          ) : (
            <div className="p-3 border-2 border-dashed border-gray-300 rounded text-center text-gray-400 hover:border-blue-400">
              点击编辑公式
            </div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  )
}

const FormulaNode = Node.create({
  name: 'formula',
  group: 'block',
  atom: true,
  addAttributes() {
    return { latex: { default: '' } }
  },
  parseHTML() { return [{ tag: 'div[data-formula]' }] },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-formula': '' })] },
  addNodeView() { return ReactNodeViewRenderer(FormulaComponent) },
  addCommands() {
    return {
      insertFormula: (latex = '') => ({ commands }) => commands.insertContent({ type: 'formula', attrs: { latex } })
    }
  }
})

// ==================== 思维导图 Node ====================

const MindmapComponent = ({ node, updateAttributes }) => {
  const data = (() => { try { return JSON.parse(node.attrs.data) } catch { return { name: '主题', children: [] } } })()
  const [editingPath, setEditingPath] = useState(null)
  const [editText, setEditText] = useState('')
  const [contextMenu, setContextMenu] = useState(null)

  const updateData = (newData) => {
    updateAttributes({ data: JSON.stringify(newData) })
  }

  // 路径操作
  const getNodeByPath = (root, path) => {
    let current = root
    for (const idx of path) {
      if (!current.children || !current.children[idx]) return null
      current = current.children[idx]
    }
    return current
  }

  const updateNodeByPath = (root, path, updater) => {
    if (path.length === 0) return updater(root)
    const newRoot = { ...root, children: [...(root.children || [])] }
    let current = newRoot
    for (let i = 0; i < path.length - 1; i++) {
      current.children[path[i]] = { ...current.children[path[i]], children: [...(current.children[path[i]].children || [])] }
      current = current.children[path[i]]
    }
    current.children[path[path.length - 1]] = updater(current.children[path[path.length - 1]])
    return newRoot
  }

  const addChild = (path) => {
    const newData = updateNodeByPath(data, path, node => ({
      ...node, children: [...(node.children || []), { name: '新节点', children: [] }]
    }))
    updateData(newData)
    setContextMenu(null)
  }

  const addSibling = (path) => {
    if (path.length === 0) return
    const parentPath = path.slice(0, -1)
    const newData = updateNodeByPath(data, parentPath, parent => ({
      ...parent, children: [...parent.children, { name: '新节点', children: [] }]
    }))
    updateData(newData)
    setContextMenu(null)
  }

  const deleteNode = (path) => {
    if (path.length === 0) return
    const parentPath = path.slice(0, -1)
    const newData = updateNodeByPath(data, parentPath, parent => ({
      ...parent, children: parent.children.filter((_, i) => i !== path[path.length - 1])
    }))
    updateData(newData)
    setContextMenu(null)
  }

  const startEdit = (path) => {
    const node = getNodeByPath(data, path)
    if (node) {
      setEditingPath(JSON.stringify(path))
      setEditText(node.name)
    }
  }

  const finishEdit = (path) => {
    const newData = updateNodeByPath(data, path, () => ({ ...getNodeByPath(data, path), name: editText }))
    updateData(newData)
    setEditingPath(null)
  }

  const handleContextMenu = (e, path) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, path })
  }

  // SVG 渲染
  const renderTree = (node, path = [], x = 300, y = 30, level = 0) => {
    const nodeWidth = 100
    const nodeHeight = 32
    const hSpacing = 140
    const vSpacing = 50
    const elements = []
    
    const isEditing = editingPath === JSON.stringify(path)

    // 节点矩形
    elements.push(
      <g key={`node-${path.join('-')}`} transform={`translate(${x - nodeWidth/2}, ${y})`}>
        <rect width={nodeWidth} height={nodeHeight} rx={6} 
          fill={level === 0 ? '#4DBBD5' : '#f0f9ff'} 
          stroke={level === 0 ? '#3a9ab5' : '#bfdbfe'} 
          strokeWidth={1.5}
          className="cursor-pointer"
          onDoubleClick={() => startEdit(path)}
          onContextMenu={e => handleContextMenu(e, path)}
        />
        {isEditing ? (
          <foreignObject x={4} y={4} width={nodeWidth - 8} height={nodeHeight - 8}>
            <input value={editText} onChange={e => setEditText(e.target.value)}
              onBlur={() => finishEdit(path)}
              onKeyDown={e => { if (e.key === 'Enter') finishEdit(path) }}
              autoFocus className="w-full h-full text-xs text-center border-none outline-none bg-transparent"
            />
          </foreignObject>
        ) : (
          <text x={nodeWidth/2} y={nodeHeight/2 + 4} textAnchor="middle" 
            fill={level === 0 ? 'white' : '#1e40af'} fontSize={12} className="pointer-events-none select-none">
            {node.name.length > 8 ? node.name.substring(0, 8) + '…' : node.name}
          </text>
        )}
      </g>
    )

    // 子节点
    if (node.children && node.children.length > 0) {
      const totalHeight = node.children.length * vSpacing
      const startY = y + nodeHeight + 20
      node.children.forEach((child, i) => {
        const childX = x + hSpacing
        const childY = startY + i * vSpacing + (totalHeight > vSpacing * 2 ? 0 : 0)
        // 连线
        elements.push(
          <line key={`line-${path.join('-')}-${i}`}
            x1={x + nodeWidth/2} y1={y + nodeHeight}
            x2={childX - nodeWidth/2} y2={childY + nodeHeight/2}
            stroke="#93c5fd" strokeWidth={1.5}
          />
        )
        elements.push(...renderTree(child, [...path, i], childX, childY, level + 1))
      })
    }

    return elements
  }

  const treeWidth = 600
  const treeHeight = Math.max(200, (data.children?.length || 0) * 50 + 100)

  return (
    <NodeViewWrapper className="mindmap-block">
      <div className="border rounded-lg p-2 my-2 bg-gray-50">
        <div className="flex items-center gap-2 mb-2 px-2">
          <span className="text-xs font-medium text-gray-500">🧠 思维导图</span>
          <span className="text-xs text-gray-400">双击编辑 | 右键添加/删除</span>
          <button onClick={() => addChild([])} className="ml-auto text-xs text-blue-500 hover:text-blue-700">+ 根子节点</button>
        </div>
        <svg width={treeWidth} height={treeHeight} className="w-full overflow-visible">
          {renderTree(data)}
        </svg>
      </div>
      {contextMenu && (
        <div className="fixed bg-white border rounded-lg shadow-xl py-1 z-50" 
          style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button onClick={() => addChild(contextMenu.path)} className="block w-full px-4 py-1.5 text-sm text-left hover:bg-gray-100">添加子节点</button>
          {contextMenu.path.length > 0 && (
            <>
              <button onClick={() => addSibling(contextMenu.path)} className="block w-full px-4 py-1.5 text-sm text-left hover:bg-gray-100">添加兄弟节点</button>
              <button onClick={() => deleteNode(contextMenu.path)} className="block w-full px-4 py-1.5 text-sm text-left hover:bg-gray-100 text-red-600">删除节点</button>
            </>
          )}
          <button onClick={() => setContextMenu(null)} className="block w-full px-4 py-1.5 text-sm text-left hover:bg-gray-100 text-gray-400">取消</button>
        </div>
      )}
    </NodeViewWrapper>
  )
}

const MindmapNode = Node.create({
  name: 'mindmap',
  group: 'block',
  atom: true,
  addAttributes() {
    return { data: { default: '{"name":"主题","children":[]}' } }
  },
  parseHTML() { return [{ tag: 'div[data-mindmap]' }] },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-mindmap': '' })] },
  addNodeView() { return ReactNodeViewRenderer(MindmapComponent) },
  addCommands() {
    return {
      insertMindmap: () => ({ commands }) => commands.insertContent({ type: 'mindmap', attrs: { data: '{"name":"中心主题","children":[]}' } })
    }
  }
})

// ==================== 链表 Node ====================

const LinkedListComponent = ({ node, updateAttributes }) => {
  const nodes = (() => { try { return JSON.parse(node.attrs.nodes) } catch { return [] } })()
  const [animating, setAnimating] = useState(false)

  const updateNodes = (newNodes) => {
    updateAttributes({ nodes: JSON.stringify(newNodes) })
  }

  const addNode = () => {
    const newId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 1
    const newValue = nodes.length > 0 ? nodes[nodes.length - 1].value + 10 : 10
    updateNodes([...nodes, { id: newId, value: newValue }])
  }

  const removeNode = (id) => {
    updateNodes(nodes.filter(n => n.id !== id))
  }

  const updateValue = (id, val) => {
    updateNodes(nodes.map(n => n.id === id ? { ...n, value: Number(val) || 0 } : n))
  }

  const reverseList = async () => {
    setAnimating(true)
    await new Promise(r => setTimeout(r, 300))
    updateNodes([...nodes].reverse())
    setAnimating(false)
  }

  // Canvas 绘制
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(400, nodes.length * 130)
    canvas.width = width * dpr
    canvas.height = 80 * dpr
    canvas.style.width = width + 'px'
    canvas.style.height = '80px'
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, 80)

    const startX = 20
    const startY = 20
    const nodeW = 70
    const nodeH = 36
    const spacing = 60

    nodes.forEach((node, idx) => {
      const x = startX + idx * (nodeW + spacing)
      ctx.fillStyle = '#e0f2fe'
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(x, startY, nodeW, nodeH, 4)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#0c4a6e'
      ctx.font = '13px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(String(node.value), x + nodeW/2, startY + nodeH/2 + 5)
      if (idx < nodes.length - 1) {
        const ax = x + nodeW + 5
        const ay = startY + nodeH/2
        ctx.beginPath()
        ctx.strokeStyle = '#94a3b8'
        ctx.moveTo(ax, ay)
        ctx.lineTo(ax + spacing - 15, ay)
        ctx.stroke()
        ctx.beginPath()
        ctx.fillStyle = '#94a3b8'
        ctx.moveTo(ax + spacing - 10, ay)
        ctx.lineTo(ax + spacing - 18, ay - 4)
        ctx.lineTo(ax + spacing - 18, ay + 4)
        ctx.fill()
      }
    })
  }, [nodes])

  return (
    <NodeViewWrapper className="linkedlist-block">
      <div className="border rounded-lg p-3 my-2 bg-gray-50">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-gray-500">🔗 链表可视化</span>
          <button onClick={addNode} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200">+ 节点</button>
          <button onClick={reverseList} disabled={animating}
            className="px-2 py-0.5 text-xs bg-green-100 text-green-600 rounded hover:bg-green-200">
            {animating ? '反转中...' : '🔄 反转'}
          </button>
        </div>
        <canvas ref={canvasRef} className="max-w-full" />
        <div className="flex flex-wrap gap-2 mt-2">
          {nodes.map(n => (
            <div key={n.id} className="flex items-center gap-1 text-xs">
              <input value={n.value} onChange={e => updateValue(n.id, e.target.value)}
                className="w-12 px-1 py-0.5 border rounded text-center text-xs" />
              <button onClick={() => removeNode(n.id)} className="text-red-400 hover:text-red-600">×</button>
            </div>
          ))}
        </div>
      </div>
    </NodeViewWrapper>
  )
}

const LinkedListNode = Node.create({
  name: 'linkedlist',
  group: 'block',
  atom: true,
  addAttributes() {
    return { nodes: { default: '[]' } }
  },
  parseHTML() { return [{ tag: 'div[data-linkedlist]' }] },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-linkedlist': '' })] },
  addNodeView() { return ReactNodeViewRenderer(LinkedListComponent) },
  addCommands() {
    return {
      insertLinkedList: () => ({ commands }) => commands.insertContent({ type: 'linkedlist', attrs: { nodes: '[{"id":1,"value":10},{"id":2,"value":20}]' } })
    }
  }
})

// ==================== 引用块 Node ====================

const CitationComponent = ({ node, updateAttributes }) => {
  const [doi, setDoi] = useState(node.attrs.doi || '')
  const [format, setFormat] = useState(node.attrs.format || 'apa')
  const [text, setText] = useState(node.attrs.text || '')
  const [loading, setLoading] = useState(false)

  const handleFetch = async () => {
    if (!doi.trim()) return
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const info = await trackingAPI.addByDoi(doi, true, false, today)
      // 格式化引用
      let citationText = ''
      const authors = info.first_author || ''
      const title = info.title_en || info.title_cn || ''
      const journal = info.journal || ''
      const year = info.pubdate ? info.pubdate.substring(0, 4) : ''

      switch (format) {
        case 'apa':
          citationText = `${authors} (${year}). ${title}. ${journal}. https://doi.org/${doi}`
          break
        case 'acs':
          citationText = `${authors}. ${year}. ${title}. ${journal}. DOI: ${doi}`
          break
        case 'mla':
          citationText = `${authors}. "${title}." ${journal}, ${year}. DOI: ${doi}.`
          break
        default:
          citationText = `${authors} (${year}). ${title}. ${journal}.`
      }
      setText(citationText)
      updateAttributes({ doi, format, text: citationText })
    } catch (err) {
      setText('获取失败: ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  const changeFormat = (fmt) => {
    setFormat(fmt)
    if (text) handleFetch() // 重新获取格式
  }

  return (
    <NodeViewWrapper className="citation-block">
      <div className="border-l-4 border-green-400 bg-green-50 rounded-r-lg p-3 my-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-green-600">📖 引用</span>
          <div className="flex gap-1 ml-auto">
            {['apa', 'acs', 'mla'].map(f => (
              <button key={f} onClick={() => changeFormat(f)}
                className={`px-2 py-0.5 text-xs rounded ${format === f ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <input value={doi} onChange={e => setDoi(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleFetch() }}
            placeholder="输入 DOI，如 10.1038/nature12373"
            className="flex-1 px-2 py-1 border rounded text-sm" />
          <button onClick={handleFetch} disabled={loading}
            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50">
            {loading ? '获取中...' : '获取'}
          </button>
        </div>
        {text && (
          <div className="mt-2 text-sm text-gray-700 leading-relaxed">{text}</div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

const CitationNode = Node.create({
  name: 'citation',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      doi: { default: '' },
      format: { default: 'apa' },
      text: { default: '' },
    }
  },
  parseHTML() { return [{ tag: 'div[data-citation]' }] },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-citation': '' })] },
  addNodeView() { return ReactNodeViewRenderer(CitationComponent) },
  addCommands() {
    return {
      insertCitation: () => ({ commands }) => commands.insertContent({ type: 'citation', attrs: { doi: '', format: 'apa', text: '' } })
    }
  }
})

// ==================== 工具栏 ====================

const EditorToolbar = ({ editor }) => {
  if (!editor) return null
  const btn = 'px-2 py-1 text-sm rounded transition-colors'
  const active = 'bg-gray-800 text-white'
  const inactive = 'hover:bg-gray-200 text-gray-600'

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-white sticky top-0 z-10 flex-wrap">
      <button onClick={() => editor.chain().focus().toggleBold().run()}
        className={`${btn} ${editor.isActive('bold') ? active : inactive}`} title="加粗 Ctrl+B">
        <strong>B</strong>
      </button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`${btn} ${editor.isActive('italic') ? active : inactive}`} title="斜体 Ctrl+I">
        <em>I</em>
      </button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`${btn} ${editor.isActive('underline') ? active : inactive}`} title="下划线 Ctrl+U">
        <u>U</u>
      </button>
      <span className="text-gray-200 mx-1">|</span>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`${btn} ${editor.isActive('heading', { level: 2 }) ? active : inactive}`} title="标题">H2</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`${btn} ${editor.isActive('heading', { level: 3 }) ? active : inactive}`} title="标题">H3</button>
      <span className="text-gray-200 mx-1">|</span>
      <button onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`${btn} ${editor.isActive('bulletList') ? active : inactive}`} title="列表">•</button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`${btn} ${editor.isActive('blockquote') ? active : inactive}`} title="引用">"</button>
      <span className="text-gray-200 mx-1">|</span>
      <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        className={`${btn} ${inactive}`} title="插入表格">⊞ 表格</button>
      <button onClick={() => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = async (e) => {
          const file = e.target.files[0]
          if (!file) return
          try {
            const result = await noteAPI.uploadImage(file)
            editor.chain().focus().setImage({ src: result.url || result.path }).run()
          } catch (err) { console.error('图片上传失败', err) }
        }
        input.click()
      }} className={`${btn} ${inactive}`} title="插入图片">🖼</button>
      <button onClick={() => editor.chain().focus().insertFormula().run()}
        className={`${btn} ${inactive}`} title="插入公式">∑ 公式</button>
      <button onClick={() => editor.chain().focus().insertMindmap().run()}
        className={`${btn} ${inactive}`} title="插入思维导图">🧠 导图</button>
      <button onClick={() => editor.chain().focus().insertLinkedList().run()}
        className={`${btn} ${inactive}`} title="插入链表">🔗 链表</button>
      <button onClick={() => editor.chain().focus().insertCitation().run()}
        className={`${btn} ${inactive}`} title="插入引用">📖 引用</button>
    </div>
  )
}

// ==================== 斜杠命令菜单 ====================

const SlashCommandMenu = ({ editor, position, onClose }) => {
  const [filter, setFilter] = useState('')
  const items = [
    { type: 'paragraph', label: '文本', icon: '📝', desc: '普通段落' },
    { type: 'heading', label: '标题', icon: '🔤', desc: '二级标题' },
    { type: 'table', label: '表格', icon: '⊞', desc: '3×3 表格' },
    { type: 'image', label: '图片', icon: '🖼', desc: '上传图片' },
    { type: 'formula', label: '公式', icon: '∑', desc: 'LaTeX 公式' },
    { type: 'mindmap', label: '思维导图', icon: '🧠', desc: '可编辑导图' },
    { type: 'linkedlist', label: '链表', icon: '🔗', desc: '算法可视化' },
    { type: 'citation', label: '引用', icon: '📖', desc: '文献引用' },
  ]

  const filtered = items.filter(it => it.label.includes(filter) || it.desc.includes(filter))

  const handleSelect = (item) => {
    switch (item.type) {
      case 'paragraph':
        editor.chain().focus().setParagraph().run()
        break
      case 'heading':
        editor.chain().focus().toggleHeading({ level: 2 }).run()
        break
      case 'table':
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        break
      case 'image':
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = async (e) => {
          const file = e.target.files[0]
          if (!file) return
          try {
            const result = await noteAPI.uploadImage(file)
            editor.chain().focus().setImage({ src: result.url || result.path }).run()
          } catch (err) { console.error('图片上传失败', err) }
        }
        input.click()
        break
      case 'formula':
        editor.chain().focus().insertFormula().run()
        break
      case 'mindmap':
        editor.chain().focus().insertMindmap().run()
        break
      case 'linkedlist':
        editor.chain().focus().insertLinkedList().run()
        break
      case 'citation':
        editor.chain().focus().insertCitation().run()
        break
    }
    onClose()
  }

  return (
    <div className="fixed z-50 bg-white border rounded-xl shadow-2xl w-64 overflow-hidden"
      style={{ left: position.x, top: position.y }}>
      <div className="p-2 border-b">
        <input value={filter} onChange={e => setFilter(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose() }}
          placeholder="搜索块类型..."
          className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          autoFocus />
      </div>
      <div className="max-h-60 overflow-y-auto">
        {filtered.map(item => (
          <button key={item.type} onClick={() => handleSelect(item)}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-blue-50 text-left transition-colors">
            <span className="text-lg">{item.icon}</span>
            <div>
              <div className="font-medium text-gray-800">{item.label}</div>
              <div className="text-xs text-gray-400">{item.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ==================== 主编辑器 ====================

export default function SmartEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = '开始输入... 或输入 / 插入块',
  className = '',
}) {
  const [slashMenu, setSlashMenu] = useState(null)
  const slashFilterRef = useRef('')

  const content = parseValueToContent(value)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: false }),
      Underline,
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      FormulaNode,
      MindmapNode,
      LinkedListNode,
      CitationNode,
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(JSON.stringify(editor.getJSON()))
      }
    },
  })

  // 处理 / 斜杠命令
  useEffect(() => {
    if (!editor || readOnly) return

    const handleKeyDown = (e) => {
      // 关闭菜单
      if (e.key === 'Escape' && slashMenu) {
        setSlashMenu(null)
        return
      }

      // 检测 / 输入
      if (e.key === '/' && !slashMenu) {
        const { from } = editor.state.selection
        const textBefore = editor.state.doc.textBetween(
          Math.max(0, from - 2), from, '\n'
        )
        // 行首或空格后输入 / 
        if (textBefore === '' || textBefore === '\n' || textBefore.endsWith(' ')) {
          setTimeout(() => {
            const coords = editor.view.coordsAtPos(editor.state.selection.from)
            setSlashMenu({ x: coords.left, y: coords.bottom + 5 })
          }, 10)
        }
      }

      // 输入文字时关闭菜单
      if (slashMenu && e.key !== 'Escape' && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        // 让菜单继续显示但可以过滤（菜单自己处理）
      }
    }

    editor.view.dom.addEventListener('keydown', handleKeyDown)
    return () => editor.view.dom.removeEventListener('keydown', handleKeyDown)
  }, [editor, readOnly, slashMenu])

  // 点击外部关闭斜杠菜单
  useEffect(() => {
    if (!slashMenu) return
    const handleClick = () => setSlashMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [slashMenu])

  if (!editor) return null

  return (
    <div className={`smart-editor border rounded-lg overflow-hidden bg-white ${className}`}
      onClick={e => e.stopPropagation()}>
      {!readOnly && <EditorToolbar editor={editor} />}
      
      <EditorContent 
        editor={editor} 
        className="prose prose-sm max-w-none p-4 min-h-[300px] focus:outline-none" 
      />

      {slashMenu && (
        <SlashCommandMenu
          editor={editor}
          position={slashMenu}
          onClose={() => { setSlashMenu(null); editor.commands.focus() }}
        />
      )}
    </div>
  )
}
