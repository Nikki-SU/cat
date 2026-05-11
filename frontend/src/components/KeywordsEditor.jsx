/**
 * 关键词编辑器组件
 * 支持 AND/OR/NOT 逻辑
 */
import { useState } from 'react'

const LOGIC_OPTIONS = [
  { id: 'and', label: 'AND', color: 'bg-blue-500', description: '必须包含' },
  { id: 'or', label: 'OR', color: 'bg-gray-400', description: '可选包含（默认）' },
  { id: 'not', label: 'NOT', color: 'bg-red-500', description: '必须排除' }
]

function KeywordsEditor({ keywords, onChange, placeholder = "输入关键词..." }) {
  const [inputValue, setInputValue] = useState('')
  const [selectedLogic, setSelectedLogic] = useState('or')

  const handleAdd = () => {
    if (!inputValue.trim()) return
    
    const newKeyword = {
      word: inputValue.trim(),
      logic: selectedLogic
    }
    
    onChange([...keywords, newKeyword])
    setInputValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  const handleRemove = (index) => {
    onChange(keywords.filter((_, i) => i !== index))
  }

  const handleUpdateLogic = (index, newLogic) => {
    const updated = [...keywords]
    updated[index] = { ...updated[index], logic: newLogic }
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      {/* 输入区域 */}
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-3 py-2 border rounded text-sm"
          />
        </div>
        
        {/* 逻辑选择 */}
        <select
          value={selectedLogic}
          onChange={(e) => setSelectedLogic(e.target.value)}
          className="px-2 py-2 border rounded text-sm"
          title="选择逻辑关系"
        >
          {LOGIC_OPTIONS.map(opt => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        
        <button
          onClick={handleAdd}
          disabled={!inputValue.trim()}
          className="px-3 py-2 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
        >
          添加
        </button>
      </div>
      
      {/* 说明文字 */}
      <p className="text-xs text-gray-500">
        AND=必须包含, OR=可选包含, NOT=必须排除 | 按 Enter 快速添加
      </p>
      
      {/* 关键词列表 */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {keywords.map((kw, index) => (
            <div
              key={index}
              className="flex items-center gap-1 px-2 py-1 rounded text-sm"
              style={{
                backgroundColor: kw.logic === 'and' ? '#DBEAFE' : 
                                kw.logic === 'not' ? '#FEE2E2' : '#F3F4F6',
                border: `1px solid ${kw.logic === 'and' ? '#3B82F6' : 
                                     kw.logic === 'not' ? '#EF4444' : '#D1D5DB'}`
              }}
            >
              <span className={`text-xs font-bold ${
                kw.logic === 'and' ? 'text-blue-600' :
                kw.logic === 'not' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {kw.logic.toUpperCase()}
              </span>
              <span className="mx-1">{kw.word}</span>
              
              {/* 逻辑切换按钮 */}
              <div className="flex gap-0.5 ml-1">
                {['and', 'or', 'not'].map(logic => (
                  <button
                    key={logic}
                    onClick={() => handleUpdateLogic(index, logic)}
                    className={`w-5 h-5 rounded text-xs ${
                      kw.logic === logic
                        ? logic === 'and' ? 'bg-blue-500 text-white' :
                          logic === 'not' ? 'bg-red-500 text-white' :
                          'bg-gray-500 text-white'
                        : 'bg-white hover:bg-gray-100'
                    }`}
                    title={LOGIC_OPTIONS.find(o => o.id === logic)?.description}
                  >
                    {logic[0].toUpperCase()}
                  </button>
                ))}
              </div>
              
              {/* 删除按钮 */}
              <button
                onClick={() => handleRemove(index)}
                className="ml-1 text-gray-400 hover:text-red-500"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default KeywordsEditor
