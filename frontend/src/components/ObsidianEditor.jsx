/**
 * Obsidian风格笔记编辑器
 * 
 * 支持：
 * - Markdown基础语法
 * - 图片拖拽/粘贴/URL
 * - 代码块（带语法高亮）
 * - 链接（自动识别和手动添加）
 * - 思维导图（Mermaid语法）
 * - 双链引用 [[ ]]
 * - 标签 #标签
 * 
 * 两种模式：
 * - 阅读模式：渲染后的内容
 * - 编辑模式：所见即所得或分屏编辑
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import mermaid from 'mermaid'
import { noteAPI } from '../api/client'

// ==================== 思维导图组件 ====================

const MermaidDiagram = ({ chart }) => {
  const [svg, setSvg] = useState('')
  const containerRef = useRef(null)
  
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose'
    })
    
    const render = async () => {
      try {
        const { svg } = await mermaid.render(`mermaid-${Date.now()}`, chart)
        setSvg(svg)
      } catch (error) {
        setSvg(`<div style="color:red">思维导图渲染失败</div>`)
      }
    }
    
    render()
  }, [chart])
  
  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: svg }} />
}

// ==================== 工具栏 ====================

const EditorToolbar = ({ onInsert, readOnly }) => {
  if (readOnly) return null
  
  const tools = [
    { icon: 'B', label: '粗体', action: () => onInsert('bold') },
    { icon: 'I', label: '斜体', action: () => onInsert('italic') },
    { icon: 'H', label: '标题', action: () => onInsert('heading') },
    { icon: '"', label: '引用', action: () => onInsert('quote') },
    { icon: '•', label: '列表', action: () => onInsert('list') },
    { icon: '☐', label: '任务', action: () => onInsert('task') },
    { icon: '🖼️', label: '图片', action: () => onInsert('image') },
    { icon: '💻', label: '代码', action: () => onInsert('code') },
    { icon: '🔗', label: '链接', action: () => onInsert('link') },
    { icon: '🧠', label: '导图', action: () => onInsert('mermaid') },
    { icon: '[[]]', label: '双链', action: () => onInsert('wikilink') },
    { icon: '#', label: '标签', action: () => onInsert('tag') },
  ]
  
  return (
    <div className="flex items-center gap-1 p-2 bg-gray-50 border-b">
      {tools.map((tool, idx) => (
        <button
          key={idx}
          onClick={tool.action}
          className="px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded"
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
      <div className="flex-1" />
      <span className="text-xs text-gray-400">支持 Markdown 语法</span>
    </div>
  )
}

// ==================== 图片上传 ====================

const ImageUploader = ({ onUpload, onClose }) => {
  const [url, setUrl] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)
  
  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }
  
  const uploadFile = async (file) => {
    setUploading(true)
    setUploadError('')
    try {
      const result = await noteAPI.uploadImage(file)
      if (result.success) {
        onUpload(result.url)
        onClose()
      } else {
        setUploadError('上传失败，请重试')
      }
    } catch (error) {
      console.error('图片上传失败:', error)
      setUploadError(error?.response?.data?.detail || error?.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }
  
  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith('image/')) {
        uploadFile(file)
      }
    }
  }
  
  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (items) {
      for (let item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) uploadFile(file)
        }
      }
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">插入图片</h3>
        
        {/* URL输入 */}
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">图片URL</label>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        
        {/* 拖拽区域 */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onPaste={handlePaste}
          className={`border-2 border-dashed rounded-lg p-8 text-center ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center">
              <span className="animate-spin text-2xl mb-2">⏳</span>
              <p className="text-blue-600">上传中...</p>
            </div>
          ) : (
            <>
              <p className="text-gray-500">拖拽图片到此处，或</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                选择文件
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])}
                className="hidden"
              />
              <p className="text-xs text-gray-400 mt-2">支持粘贴截图</p>
            </>
          )}
        </div>
        
        {/* 上传错误提示 */}
        {uploadError && (
          <p className="mt-2 text-sm text-red-500">{uploadError}</p>
        )}
        
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
            取消
          </button>
          <button 
            onClick={() => { if (url) { onUpload(url); onClose() } }}
            disabled={!url}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            插入
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== 链接弹窗 ====================

const LinkDialog = ({ onInsert, onClose, selectedText = '' }) => {
  const [text, setText] = useState(selectedText)
  const [url, setUrl] = useState('')
  const [isWiki, setIsWiki] = useState(false)
  
  const handleInsert = () => {
    if (isWiki) {
      onInsert(`[[${text}]]`)
    } else {
      onInsert(text ? `[${text}](${url})` : url)
    }
    onClose()
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">插入链接</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">显示文本</label>
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">链接地址</label>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://... 或页面名称"
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="wiki-link"
              checked={isWiki}
              onChange={e => setIsWiki(e.target.checked)}
            />
            <label htmlFor="wiki-link" className="text-sm text-gray-600">
              双链引用 [[页面名]]
            </label>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
            取消
          </button>
          <button 
            onClick={handleInsert}
            disabled={!url && !isWiki}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            插入
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== 代码块对话框 ====================

const CodeDialog = ({ onInsert, onClose }) => {
  const [language, setLanguage] = useState('javascript')
  const [code, setCode] = useState('')
  
  const languages = [
    'javascript', 'python', 'java', 'cpp', 'c', 'csharp', 'go', 'rust',
    'sql', 'html', 'css', 'json', 'yaml', 'bash', 'markdown'
  ]
  
  const handleInsert = () => {
    if (code.trim()) {
      onInsert(`\`\`\`${language}\n${code}\n\`\`\``)
      onClose()
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
        <h3 className="text-lg font-semibold mb-4">插入代码块</h3>
        
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">语言</label>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          >
            {languages.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
        
        <textarea
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="粘贴代码..."
          className="w-full h-48 px-3 py-2 border rounded font-mono text-sm"
        />
        
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
            取消
          </button>
          <button 
            onClick={handleInsert}
            disabled={!code.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            插入
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== 思维导图对话框 ====================

const MermaidDialog = ({ onInsert, onClose }) => {
  const [type, setType] = useState('flowchart')
  const [content, setContent] = useState('')
  
  const templates = {
    flowchart: `flowchart TD
    A[开始] --> B{判断}
    B -->|是| C[执行1]
    B -->|否| D[执行2]`,
    mindmap: `mindmap
  root((主题))
    分支1
      子分支1
      子分支2
    分支2
      子分支3`,
    sequence: `sequenceDiagram
    参与者A->>参与者B: 消息
    参与者B-->>参与者A: 回复`,
    gantt: `gantt
    title 项目计划
    dateFormat  YYYY-MM-DD
    section 阶段1
    任务1           :a1, 2024-01-01, 7d
    任务2           :after a1, 5d`
  }
  
  const handleInsert = () => {
    if (content.trim()) {
      onInsert(`\`\`\`mermaid\n${content}\n\`\`\``)
      onClose()
    }
  }
  
  const applyTemplate = (t) => {
    setType(t)
    setContent(templates[t])
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
        <h3 className="text-lg font-semibold mb-4">插入思维导图</h3>
        
        <div className="flex gap-2 mb-4">
          {Object.keys(templates).map(t => (
            <button
              key={t}
              onClick={() => applyTemplate(t)}
              className={`px-3 py-1 rounded text-sm ${
                type === t ? 'bg-blue-500 text-white' : 'bg-gray-100'
              }`}
            >
              {t === 'flowchart' && '流程图'}
              {t === 'mindmap' && '思维导图'}
              {t === 'sequence' && '时序图'}
              {t === 'gantt' && '甘特图'}
            </button>
          ))}
        </div>
        
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="输入Mermaid语法..."
          className="w-full h-48 px-3 py-2 border rounded font-mono text-sm"
        />
        
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
            取消
          </button>
          <button 
            onClick={handleInsert}
            disabled={!content.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            插入
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== 主编辑器组件 ====================

const ObsidianEditor = ({ 
  value, 
  onChange, 
  readOnly = false,
  placeholder = '输入笔记内容...',
  className = ''
}) => {
  const [content, setContent] = useState(value || '')
  const [showPreview, setShowPreview] = useState(false)
  const [dialog, setDialog] = useState(null) // 'image' | 'link' | 'code' | 'mermaid' | null
  const textareaRef = useRef(null)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  
  // 同步外部value
  useEffect(() => {
    setContent(value || '')
  }, [value])
  
  // 处理内容变化
  const handleChange = (newContent) => {
    setContent(newContent)
    onChange?.(newContent)
  }
  
  // 记录光标位置
  const handleSelect = () => {
    if (textareaRef.current) {
      setSelection({
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd
      })
    }
  }
  
  // 插入内容
  const insertAtCursor = (text) => {
    const before = content.substring(0, selection.start)
    const after = content.substring(selection.end)
    const newContent = before + text + after
    handleChange(newContent)
    
    // 恢复光标位置
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = selection.start + text.length
        textareaRef.current.setSelectionRange(newPos, newPos)
        textareaRef.current.focus()
      }
    }, 0)
  }
  
  // 工具栏插入
  const handleInsert = (type) => {
    handleSelect() // 确保获取最新选择
    const selectedText = content.substring(selection.start, selection.end)
    
    switch (type) {
      case 'bold':
        insertAtCursor(selectedText ? `**${selectedText}**` : '**粗体**')
        break
      case 'italic':
        insertAtCursor(selectedText ? `*${selectedText}*` : '*斜体*')
        break
      case 'heading':
        insertAtCursor('\n## 标题\n')
        break
      case 'quote':
        insertAtCursor(selectedText ? `\n> ${selectedText}` : '\n> 引用\n')
        break
      case 'list':
        insertAtCursor('\n- 列表项\n- 列表项\n')
        break
      case 'task':
        insertAtCursor('\n- [ ] 待办任务\n- [x] 已完成\n')
        break
      case 'image':
        setDialog('image')
        break
      case 'link':
        setDialog('link')
        break
      case 'code':
        setDialog('code')
        break
      case 'mermaid':
        setDialog('mermaid')
        break
      case 'wikilink':
        insertAtCursor('[[双链引用]]')
        break
      case 'tag':
        insertAtCursor('#标签 ')
        break
      default:
        break
    }
  }
  
  // 处理编辑器内直接粘贴图片
  const handleEditorPaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    
    for (let item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        
        // 在光标位置插入上传占位符
        const placeholder = `![上传中...]()`
        const before = content.substring(0, selection.start)
        const after = content.substring(selection.end)
        const newContent = before + placeholder + after
        handleChange(newContent)
        
        // 上传图片
        try {
          const result = await noteAPI.uploadImage(file)
          if (result.success) {
            // 替换占位符为真实图片
            const imageMarkdown = `![图片](${result.url})`
            handleChange(newContent.replace(placeholder, imageMarkdown))
          } else {
            // 上传失败，移除占位符
            handleChange(newContent.replace(placeholder, ''))
            console.error('粘贴图片上传失败')
          }
        } catch (error) {
          handleChange(newContent.replace(placeholder, ''))
          console.error('粘贴图片上传失败:', error)
        }
        return // 只处理第一张图片
      }
    }
  }
  
  // 处理图片上传
  const handleImageUpload = (imageUrl) => {
    const imageMarkdown = `![图片描述](${imageUrl})`
    insertAtCursor(imageMarkdown)
    setDialog(null)
  }
  
  // 处理链接插入
  const handleLinkInsert = (markdown) => {
    insertAtCursor(markdown)
    setDialog(null)
  }
  
  // 自定义渲染组件
  const MarkdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      const lang = match ? match[1] : ''
      
      // 思维导图
      if (lang === 'mermaid') {
        return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />
      }
      
      return !inline && lang ? (
        <SyntaxHighlighter
          style={oneLight}
          language={lang}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },
    
    // 双链引用 [[xxx]]
    span({ node, children, ...props }) {
      const text = String(children)
      if (text.startsWith('[[') && text.endsWith(']]')) {
        const pageName = text.slice(2, -2)
        return (
          <span 
            className="text-blue-600 bg-blue-50 px-1 rounded cursor-pointer hover:bg-blue-100"
            {...props}
          >
            {pageName}
          </span>
        )
      }
      return <span {...props}>{children}</span>
    },
    
    // 标签 #xxx
    p({ node, children, ...props }) {
      // 处理标签
      const processed = children?.map((child, i) => {
        if (typeof child === 'string') {
          const parts = child.split(/(#[\w\u4e00-\u9fa5]+)/g)
          return parts.map((part, j) => {
            if (part.startsWith('#') && part.length > 1) {
              return (
                <span 
                  key={`${i}-${j}`}
                  className="text-purple-600 bg-purple-50 px-1 rounded cursor-pointer hover:bg-purple-100"
                >
                  {part}
                </span>
              )
            }
            return part
          })
        }
        return child
      })
      return <p {...props}>{processed}</p>
    }
  }
  
  // 纯阅读模式
  if (readOnly) {
    return (
      <div className={`prose prose-sm max-w-none ${className}`}>
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={MarkdownComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  }
  
  // 编辑模式
  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {/* 工具栏 */}
      <EditorToolbar onInsert={handleInsert} readOnly={false} />
      
      {/* 编辑/预览切换 */}
      <div className="flex border-b bg-gray-50">
        <button
          onClick={() => setShowPreview(false)}
          className={`px-4 py-1 text-sm ${!showPreview ? 'bg-white border-b-2 border-blue-500' : ''}`}
        >
          编辑
        </button>
        <button
          onClick={() => setShowPreview(true)}
          className={`px-4 py-1 text-sm ${showPreview ? 'bg-white border-b-2 border-blue-500' : ''}`}
        >
          预览
        </button>
      </div>
      
      {/* 编辑器或预览 */}
      <div className="bg-white">
        {showPreview ? (
          <div className="p-4 prose prose-sm max-w-none min-h-[150px]">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={MarkdownComponents}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => handleChange(e.target.value)}
            onSelect={handleSelect}
            onClick={handleSelect}
            onKeyUp={handleSelect}
            onPaste={handleEditorPaste}
            placeholder={placeholder}
            className="w-full min-h-[150px] p-4 resize-y font-mono text-sm focus:outline-none"
          />
        )}
      </div>
      
      {/* 弹窗 */}
      {dialog === 'image' && (
        <ImageUploader 
          onUpload={handleImageUpload}
          onClose={() => setDialog(null)}
        />
      )}
      
      {dialog === 'link' && (
        <LinkDialog
          onInsert={handleLinkInsert}
          onClose={() => setDialog(null)}
          selectedText={content.substring(selection.start, selection.end)}
        />
      )}
      
      {dialog === 'code' && (
        <CodeDialog
          onInsert={handleLinkInsert}
          onClose={() => setDialog(null)}
        />
      )}
      
      {dialog === 'mermaid' && (
        <MermaidDialog
          onInsert={handleLinkInsert}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

export default ObsidianEditor
