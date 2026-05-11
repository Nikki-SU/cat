/**
 * Obsidian椋庢牸绗旇缂栬緫鍣? * 
 * 鏀寔锛? * - Markdown鍩虹璇硶
 * - 鍥剧墖鎷栨嫿/绮樿创/URL
 * - 浠ｇ爜鍧楋紙甯﹁娉曢珮浜級
 * - 閾炬帴锛堣嚜鍔ㄨ瘑鍒拰鎵嬪姩娣诲姞锛? * - 鎬濈淮瀵煎浘锛圡ermaid璇硶锛? * - 鍙岄摼寮曠敤 [[ ]]
 * - 鏍囩 #鏍囩
 * 
 * 涓ょ妯″紡锛? * - 闃呰妯″紡锛氭覆鏌撳悗鐨勫唴瀹? * - 缂栬緫妯″紡锛氭墍瑙佸嵆鎵€寰楁垨鍒嗗睆缂栬緫
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import mermaid from 'mermaid'

// ==================== 鎬濈淮瀵煎浘缁勪欢 ====================

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
        setSvg(`<div style="color:red">鎬濈淮瀵煎浘娓叉煋澶辫触</div>`)
      }
    }
    
    render()
  }, [chart])
  
  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: svg }} />
}

// ==================== 宸ュ叿鏍?====================

const EditorToolbar = ({ onInsert, readOnly }) => {
  if (readOnly) return null
  
  const tools = [
    { icon: 'B', label: '绮椾綋', action: () => onInsert('bold') },
    { icon: 'I', label: '鏂滀綋', action: () => onInsert('italic') },
    { icon: 'H', label: '鏍囬', action: () => onInsert('heading') },
    { icon: '"', label: '寮曠敤', action: () => onInsert('quote') },
    { icon: '鈥?, label: '鍒楄〃', action: () => onInsert('list') },
    { icon: '鈽?, label: '浠诲姟', action: () => onInsert('task') },
    { icon: '馃柤锔?, label: '鍥剧墖', action: () => onInsert('image') },
    { icon: '馃捇', label: '浠ｇ爜', action: () => onInsert('code') },
    { icon: '馃敆', label: '閾炬帴', action: () => onInsert('link') },
    { icon: '馃', label: '瀵煎浘', action: () => onInsert('mermaid') },
    { icon: '[[]]', label: '鍙岄摼', action: () => onInsert('wikilink') },
    { icon: '#', label: '鏍囩', action: () => onInsert('tag') },
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
      <span className="text-xs text-gray-400">鏀寔 Markdown 璇硶</span>
    </div>
  )
}

// ==================== 鍥剧墖涓婁紶 ====================

const ImageUploader = ({ onUpload, onClose }) => {
  const [url, setUrl] = useState('')
  const [dragActive, setDragActive] = useState(false)
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
  
  const uploadFile = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      onUpload(e.target.result)
    }
    reader.readAsDataURL(file)
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
        <h3 className="text-lg font-semibold mb-4">鎻掑叆鍥剧墖</h3>
        
        {/* URL杈撳叆 */}
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">鍥剧墖URL</label>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        
        {/* 鎷栨嫿鍖哄煙 */}
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
          <p className="text-gray-500">鎷栨嫿鍥剧墖鍒版澶勶紝鎴?/p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            閫夋嫨鏂囦欢
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])}
            className="hidden"
          />
          <p className="text-xs text-gray-400 mt-2">鏀寔绮樿创鎴浘</p>
        </div>
        
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
            鍙栨秷
          </button>
          <button 
            onClick={() => { if (url) onUpload(url); onClose() }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            鎻掑叆
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== 閾炬帴寮圭獥 ====================

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
        <h3 className="text-lg font-semibold mb-4">鎻掑叆閾炬帴</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">鏄剧ず鏂囨湰</label>
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-600 mb-1">閾炬帴鍦板潃</label>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://... 鎴栭〉闈㈠悕绉?
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
              鍙岄摼寮曠敤 [[椤甸潰鍚峕]
            </label>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
            鍙栨秷
          </button>
          <button 
            onClick={handleInsert}
            disabled={!url && !isWiki}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            鎻掑叆
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== 浠ｇ爜鍧楀璇濇 ====================

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
        <h3 className="text-lg font-semibold mb-4">鎻掑叆浠ｇ爜鍧?/h3>
        
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">璇█</label>
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
          placeholder="绮樿创浠ｇ爜..."
          className="w-full h-48 px-3 py-2 border rounded font-mono text-sm"
        />
        
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
            鍙栨秷
          </button>
          <button 
            onClick={handleInsert}
            disabled={!code.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            鎻掑叆
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== 鎬濈淮瀵煎浘瀵硅瘽妗?====================

const MermaidDialog = ({ onInsert, onClose }) => {
  const [type, setType] = useState('flowchart')
  const [content, setContent] = useState('')
  
  const templates = {
    flowchart: `flowchart TD
    A[寮€濮媇 --> B{鍒ゆ柇}
    B -->|鏄瘄 C[鎵ц1]
    B -->|鍚 D[鎵ц2]`,
    mindmap: `mindmap
  root((涓婚))
    鍒嗘敮1
      瀛愬垎鏀?
      瀛愬垎鏀?
    鍒嗘敮2
      瀛愬垎鏀?`,
    sequence: `sequenceDiagram
    鍙備笌鑰匒->>鍙備笌鑰匓: 娑堟伅
    鍙備笌鑰匓-->>鍙備笌鑰匒: 鍥炲`,
    gantt: `gantt
    title 椤圭洰璁″垝
    dateFormat  YYYY-MM-DD
    section 闃舵1
    浠诲姟1           :a1, 2024-01-01, 7d
    浠诲姟2           :after a1, 5d`
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
        <h3 className="text-lg font-semibold mb-4">鎻掑叆鎬濈淮瀵煎浘</h3>
        
        <div className="flex gap-2 mb-4">
          {Object.keys(templates).map(t => (
            <button
              key={t}
              onClick={() => applyTemplate(t)}
              className={`px-3 py-1 rounded text-sm ${
                type === t ? 'bg-blue-500 text-white' : 'bg-gray-100'
              }`}
            >
              {t === 'flowchart' && '娴佺▼鍥?}
              {t === 'mindmap' && '鎬濈淮瀵煎浘'}
              {t === 'sequence' && '鏃跺簭鍥?}
              {t === 'gantt' && '鐢樼壒鍥?}
            </button>
          ))}
        </div>
        
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="杈撳叆Mermaid璇硶..."
          className="w-full h-48 px-3 py-2 border rounded font-mono text-sm"
        />
        
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
            鍙栨秷
          </button>
          <button 
            onClick={handleInsert}
            disabled={!content.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            鎻掑叆
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== 涓荤紪杈戝櫒缁勪欢 ====================

const ObsidianEditor = ({ 
  value, 
  onChange, 
  readOnly = false,
  placeholder = '杈撳叆绗旇鍐呭...',
  className = ''
}) => {
  const [content, setContent] = useState(value || '')
  const [showPreview, setShowPreview] = useState(false)
  const [dialog, setDialog] = useState(null) // 'image' | 'link' | 'code' | 'mermaid' | null
  const textareaRef = useRef(null)
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  
  // 鍚屾澶栭儴value
  useEffect(() => {
    setContent(value || '')
  }, [value])
  
  // 澶勭悊鍐呭鍙樺寲
  const handleChange = (newContent) => {
    setContent(newContent)
    onChange?.(newContent)
  }
  
  // 璁板綍鍏夋爣浣嶇疆
  const handleSelect = () => {
    if (textareaRef.current) {
      setSelection({
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd
      })
    }
  }
  
  // 鎻掑叆鍐呭
  const insertAtCursor = (text) => {
    const before = content.substring(0, selection.start)
    const after = content.substring(selection.end)
    const newContent = before + text + after
    handleChange(newContent)
    
    // 鎭㈠鍏夋爣浣嶇疆
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = selection.start + text.length
        textareaRef.current.setSelectionRange(newPos, newPos)
        textareaRef.current.focus()
      }
    }, 0)
  }
  
  // 宸ュ叿鏍忔彃鍏?  const handleInsert = (type) => {
    handleSelect() // 纭繚鑾峰彇鏈€鏂伴€夋嫨
    const selectedText = content.substring(selection.start, selection.end)
    
    switch (type) {
      case 'bold':
        insertAtCursor(selectedText ? `**${selectedText}**` : '**绮椾綋**')
        break
      case 'italic':
        insertAtCursor(selectedText ? `*${selectedText}*` : '*鏂滀綋*')
        break
      case 'heading':
        insertAtCursor('\n## 鏍囬\n')
        break
      case 'quote':
        insertAtCursor(selectedText ? `\n> ${selectedText}` : '\n> 寮曠敤\n')
        break
      case 'list':
        insertAtCursor('\n- 鍒楄〃椤筡n- 鍒楄〃椤筡n')
        break
      case 'task':
        insertAtCursor('\n- [ ] 寰呭姙浠诲姟\n- [x] 宸插畬鎴怽n')
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
        insertAtCursor('[[鍙岄摼寮曠敤]]')
        break
      case 'tag':
        insertAtCursor('#鏍囩 ')
        break
      default:
        break
    }
  }
  
  // 澶勭悊鍥剧墖涓婁紶
  const handleImageUpload = (imageUrl) => {
    const imageMarkdown = `![鍥剧墖鎻忚堪](${imageUrl})`
    insertAtCursor(imageMarkdown)
    setDialog(null)
  }
  
  // 澶勭悊閾炬帴鎻掑叆
  const handleLinkInsert = (markdown) => {
    insertAtCursor(markdown)
    setDialog(null)
  }
  
  // 鑷畾涔夋覆鏌撶粍浠?  const MarkdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      const lang = match ? match[1] : ''
      
      // 鎬濈淮瀵煎浘
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
    
    // 鍙岄摼寮曠敤 [[xxx]]
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
    
    // 鏍囩 #xxx
    p({ node, children, ...props }) {
      // 澶勭悊鏍囩
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
  
  // 绾槄璇绘ā寮?  if (readOnly) {
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
  
  // 缂栬緫妯″紡
  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {/* 宸ュ叿鏍?*/}
      <EditorToolbar onInsert={handleInsert} readOnly={false} />
      
      {/* 缂栬緫/棰勮鍒囨崲 */}
      <div className="flex border-b bg-gray-50">
        <button
          onClick={() => setShowPreview(false)}
          className={`px-4 py-1 text-sm ${!showPreview ? 'bg-white border-b-2 border-blue-500' : ''}`}
        >
          缂栬緫
        </button>
        <button
          onClick={() => setShowPreview(true)}
          className={`px-4 py-1 text-sm ${showPreview ? 'bg-white border-b-2 border-blue-500' : ''}`}
        >
          棰勮
        </button>
      </div>
      
      {/* 缂栬緫鍣ㄦ垨棰勮 */}
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
            placeholder={placeholder}
            className="w-full min-h-[150px] p-4 resize-y font-mono text-sm focus:outline-none"
          />
        )}
      </div>
      
      {/* 寮圭獥 */}
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
