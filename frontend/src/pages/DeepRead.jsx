/**
 * 绮捐椤甸潰 - 閲嶆瀯鐗? * 
 * 甯冨眬锛? * - 瀛﹁€呮ā寮? 宸︽爮(棰滆壊缁撴瀯+闀块毦鍙?鍗曡瘝) + 鍙虫爮(鏂囩尞+琛岄棿绗旇)
 * - 鍙屾爮妯″紡: 宸︽爮(棰滆壊缁撴瀯+闀块毦鍙?鍗曡瘝) + 涓爮(绾枃鐚? + 鍙虫爮(杈规爮绗旇)
 * 
 * 鐗规€э細
 * - 闃呰妯″紡锛氬師鏂囧彧璇伙紝鍙珮浜€佹壒娉ㄣ€佽皟鏁存牸寮? * - 缂栬緫妯″紡锛氱洿鎺ヤ慨鏀瑰師鏂? * - 鍗曡瘝/闀块毦鍙ヨ嚜鍔ㄦ牴鎹姸鎬佺潃鑹? */
import { useState, useEffect, useRef, useMemo } from 'react'
import useDeepReadStore, { 
  LAYOUT_MODES, 
  READ_MODES, 
  COLOR_STRUCTURE,
  WORD_STATUS_COLORS,
  SENTENCE_STYLES
} from '../stores/useDeepReadStore'
import useAppStore from '../stores/useAppStore'
import ObsidianEditor from '../components/ObsidianEditor'

// ==================== 瀛愮粍浠?====================

// 棰滆壊-缁撴瀯闈㈡澘
const ColorStructurePanel = ({ paragraphs, onColorClick }) => {
  const getContentByColor = (colorId) => {
    return paragraphs.filter(p => p.suggestedColor?.id === colorId)
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-gray-700">馃帹 棰滆壊-缁撴瀯</h3>
      {COLOR_STRUCTURE.map(cs => {
        const content = getContentByColor(cs.id)
        return (
          <div key={cs.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => onColorClick(cs)}
              className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium"
              style={{ backgroundColor: cs.color }}
            >
              <span className="w-3 h-3 rounded-full border border-gray-400" 
                style={{ backgroundColor: cs.color }} />
              <span style={{ color: cs.textColor }}>{cs.name}</span>
              <span className="text-xs opacity-60 ml-auto">{content.length}</span>
            </button>
            <div className="max-h-32 overflow-auto text-xs p-2 bg-gray-50">
              {content.map(p => (
                <div key={p.id} className="truncate py-1 text-gray-600 border-b last:border-0">
                  {p.plainText.substring(0, 60)}...
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 闀块毦鍙ュ垪琛?const SentenceList = ({ sentences, paragraphs, onSentenceClick }) => {
  const sentencesWithContext = useMemo(() => {
    return sentences.map(s => {
      const paragraph = paragraphs.find(p => 
        p.plainText.includes(s.sentence_en.substring(0, 30))
      )
      return { ...s, paragraphId: paragraph?.id }
    })
  }, [sentences, paragraphs])

  return (
    <div className="mt-4">
      <h3 className="font-semibold text-sm text-gray-700 mb-2">
        馃摑 闀块毦鍙?({sentences.length})
      </h3>
      <div className="space-y-2 max-h-60 overflow-auto">
        {sentencesWithContext.map(s => (
          <div 
            key={s.id}
            onClick={() => onSentenceClick(s)}
            className="p-2 rounded bg-red-50 border border-red-200 cursor-pointer hover:bg-red-100"
          >
            <p className="text-xs text-red-700 line-clamp-2">{s.sentence_en}</p>
            {s.sentence_cn && (
              <p className="text-xs text-gray-500 mt-1">{s.sentence_cn}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// 鍗曡瘝鍒楄〃
const WordList = ({ words, paragraphs, onWordClick }) => {
  const wordsWithContext = useMemo(() => {
    return words.map(w => {
      const paragraph = paragraphs.find(p => 
        p.plainText.toLowerCase().includes(w.word_en.toLowerCase())
      )
      return { ...w, paragraphId: paragraph?.id }
    })
  }, [words, paragraphs])

  const getStatusStyle = (status) => {
    switch (status) {
      case 'new': return 'text-red-600 font-bold border-b-2 border-red-500'
      case 'learning': return 'text-amber-600 font-bold border-b-2 border-amber-500'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="mt-4">
      <h3 className="font-semibold text-sm text-gray-700 mb-2">
        馃摎 鍗曡瘝 ({words.length})
      </h3>
      <div className="flex flex-wrap gap-1">
        {wordsWithContext.map(w => (
          <span
            key={w.id}
            onClick={() => onWordClick(w)}
            className={`px-2 py-1 text-xs rounded cursor-pointer hover:bg-gray-100 ${getStatusStyle(w.status)}`}
          >
            {w.word_en}
          </span>
        ))}
      </div>
    </div>
  )
}

// 甯﹀崟璇?闀块毦鍙ラ珮浜殑鏂囨湰娓叉煋
const HighlightedText = ({ text, words, sentences }) => {
  // 鏋勫缓姝ｅ垯鍖归厤
  const wordList = words.map(w => w.word_en)
  const sentenceList = sentences.map(s => s.sentence_en.substring(0, 50))
  
  // 绠€鍗曠殑鏇挎崲绛栫暐
  let highlighted = text
  
  // 鏍囪闀块毦鍙ワ紙鍏堝鐞嗛暱鐨勶級
  sentences.forEach(s => {
    const pattern = s.sentence_en.substring(0, Math.min(s.sentence_en.length, 100))
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${pattern})`, 'gi')
    highlighted = highlighted.replace(regex, 
      '<span class="sentence-highlight">$1</span>'
    )
  })
  
  // 鏍囪鍗曡瘝
  words.forEach(w => {
    const regex = new RegExp(`\\b(${w.word_en})\\b`, 'gi')
    const style = w.status === 'new' 
      ? 'word-new' 
      : w.status === 'learning' 
        ? 'word-learning' 
        : 'word-mastered'
    highlighted = highlighted.replace(regex, `<span class="${style}">$1</span>`)
  })
  
  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />
}

// 鏂囩尞娈佃惤娓叉煋
const ParagraphRenderer = ({ 
  paragraph, 
  words, 
  sentences, 
  notes, 
  isInlineMode,
  onAddNote,
  onTextSelect,
  readMode
}) => {
  const paragraphWords = words.filter(w => 
    paragraph.plainText.toLowerCase().includes(w.word_en.toLowerCase())
  )
  
  const paragraphSentences = sentences.filter(s => 
    paragraph.plainText.includes(s.sentence_en.substring(0, 30))
  )
  
  const paragraphNotes = notes.filter(n => n.anchor_id === paragraph.id)

  const renderContent = () => {
    const { type, raw } = paragraph
    
    // 鏍规嵁绫诲瀷娓叉煋涓嶅悓鍏冪礌
    switch (type) {
      case 'heading':
        const level = raw.match(/^(#+)/)?.[0].length || 1
        const text = raw.replace(/^#+\s*/, '')
        return <Heading level={level} text={text} words={paragraphWords} sentences={paragraphSentences} />
      
      case 'bullet':
        return <li className="ml-4"><HighlightedText text={raw.replace(/^[-*]\s*/, '')} words={paragraphWords} sentences={paragraphSentences} /></li>
      
      case 'numbered':
        return <li className="ml-4"><HighlightedText text={raw.replace(/^\d+\.\s*/, '')} words={paragraphWords} sentences={paragraphSentences} /></li>
      
      default:
        return <p><HighlightedText text={raw} words={paragraphWords} sentences={paragraphSentences} /></p>
    }
  }

  return (
    <div 
      id={paragraph.id}
      data-anchor={paragraph.id}
      className="paragraph-block group relative hover:bg-gray-50"
      onMouseUp={readMode === 'read' ? (e) => onTextSelect(e, paragraph.id) : undefined}
    >
      {/* 娈佃惤鍐呭 */}
      <div className={`${paragraph.suggestedColor ? `border-l-4 pl-3` : ''}`}
        style={{ borderColor: paragraph.suggestedColor?.color }}>
        {renderContent()}
      </div>
      
      {/* 琛岄棿绗旇锛堝鑰呮ā寮忥級 */}
      {isInlineMode && paragraphNotes.length > 0 && (
        <div className="mt-2 ml-4 space-y-1">
          {paragraphNotes.map(note => (
            <InlineNote key={note.id} note={note} />
          ))}
        </div>
      )}
      
      {/* 娣诲姞绗旇鎸夐挳锛堟偓娴級 */}
      {readMode === 'read' && isInlineMode && (
        <button
          onClick={() => onAddNote(paragraph.id)}
          className="absolute -left-6 top-0 opacity-0 group-hover:opacity-100 text-blue-500 text-xs"
        >
          +绗旇
        </button>
      )}
    </div>
  )
}

// 鏍囬缁勪欢
const Heading = ({ level, text, words, sentences }) => {
  const Tag = `h${Math.min(level + 1, 6)}`
  return (
    <Tag className="font-bold my-4">
      <HighlightedText text={text} words={words} sentences={sentences} />
    </Tag>
  )
}

// 琛岄棿绗旇
const InlineNote = ({ note }) => (
  <div className="p-2 bg-blue-50 border-l-4 border-blue-400 rounded my-2 ml-4">
    <ObsidianEditor value={note.content} readOnly />
  </div>
)

// 杈规爮绗旇
const SidebarNote = ({ note, paragraph, onEdit, onDelete }) => (
  <div className="p-3 bg-white rounded shadow-sm border-l-4 border-blue-400">
    <div className="text-xs text-gray-500 mb-1">
      娈佃惤 {paragraph?.index + 1 || '?'}
    </div>
    <div className="prose prose-sm max-w-none">
      <ObsidianEditor value={note.content} readOnly />
    </div>
    <div className="flex gap-2 mt-2">
      <button onClick={() => onEdit(note)} className="text-xs text-blue-500">缂栬緫</button>
      <button onClick={() => onDelete(note.id)} className="text-xs text-red-500">鍒犻櫎</button>
    </div>
  </div>
)

// 绗旇缂栬緫鍣?- 浣跨敤 ObsidianEditor
const NoteEditor = ({ onSave, onCancel, initialContent = '' }) => {
  const [content, setContent] = useState(initialContent)
  
  return (
    <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
      <ObsidianEditor
        value={content}
        onChange={setContent}
        placeholder="杈撳叆绗旇锛堟敮鎸佸浘鐗囥€佷唬鐮併€佹€濈淮瀵煎浘銆佸弻閾惧紩鐢ㄧ瓑锛?.."
        className="min-h-[150px]"
      />
      <div className="flex gap-2 mt-2">
        <button 
          onClick={() => onSave(content)}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
        >
          淇濆瓨
        </button>
        <button 
          onClick={onCancel}
          className="px-3 py-1 bg-gray-200 rounded text-sm"
        >
          鍙栨秷
        </button>
      </div>
    </div>
  )
}

// ==================== 涓荤粍浠?====================

function DeepRead() {
  const {
    selectedLiterature,
    paragraphs,
    words,
    sentences,
    notes,
    layoutMode,
    readMode,
    isProtected,
    selectedColor,
    loadLiterature,
    setLayoutMode,
    setReadMode,
    toggleEditMode,
    addNote,
    addHighlight,
    getWordsForParagraph,
    getSentencesForParagraph,
    getNotesForParagraph,
    getContentByColor,
    saveContent
  } = useDeepReadStore()
  
  const { literatureTable } = useAppStore()
  
  // 鏈湴鐘舵€?  const [editingNote, setEditingNote] = useState(null)
  const [selectedParagraph, setSelectedParagraph] = useState(null)
  const [editContent, setEditContent] = useState('')
  const contentRef = useRef(null)
  
  // 鍔犺浇鏂囩尞
  const handleSelectLiterature = async (item) => {
    await loadLiterature(item)
    setEditContent(item.content || '')
  }
  
  // 鏂囨湰閫夋嫨
  const handleTextSelect = (e, paragraphId) => {
    const selection = window.getSelection()
    const text = selection.toString().trim()
    if (text) {
      // 娣诲姞楂樹寒鎴栨樉绀鸿彍鍗?      console.log('閫変腑:', text, '鍦ㄦ钀?', paragraphId)
    }
  }
  
  // 娣诲姞绗旇
  const handleAddNote = async (paragraphId, content) => {
    await addNote({
      anchor_id: paragraphId,
      note_type: 'markdown',
      content,
      position: ''
    })
    setEditingNote(null)
  }
  
  // 淇濆瓨缂栬緫
  const handleSaveEdit = async () => {
    await saveContent(editContent)
  }
  
  // 褰撳墠甯冨眬閰嶇疆
  const currentLayout = LAYOUT_MODES[layoutMode]
  const isInlineMode = currentLayout.notePosition === 'inline'
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 椤堕儴宸ュ叿鏍?*/}
      <header className="bg-white border-b px-4 py-2 flex items-center gap-4">
        {/* 鏂囩尞閫夋嫨 */}
        <select 
          className="border rounded px-3 py-1 min-w-[200px]"
          onChange={e => handleSelectLiterature(literatureTable.find(l => l.doi === e.target.value))}
          value={selectedLiterature?.doi || ''}
        >
          <option value="">閫夋嫨鏂囩尞...</option>
          {literatureTable.map(l => (
            <option key={l.doi} value={l.doi}>{l.title_cn || l.title_en || l.doi}</option>
          ))}
        </select>
        
        {/* 甯冨眬鍒囨崲 */}
        <div className="flex border rounded">
          {Object.values(LAYOUT_MODES).map(mode => (
            <button
              key={mode.id}
              onClick={() => setLayoutMode(mode.id)}
              className={`px-3 py-1 text-sm ${layoutMode === mode.id ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        
        {/* 缂栬緫妯″紡寮€鍏?*/}
        <button
          onClick={toggleEditMode}
          className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
            readMode === 'edit' ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'
          }`}
        >
          {readMode === 'edit' ? '鉁忥笍 缂栬緫涓? : '馃摉 闃呰'}
        </button>
        
        {readMode === 'edit' && (
          <button
            onClick={handleSaveEdit}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            馃捑 淇濆瓨
          </button>
        )}
      </header>
      
      {/* 涓诲唴瀹瑰尯 */}
      {selectedLiterature ? (
        <div className={`flex-1 overflow-hidden grid ${currentLayout.grid}`}>
          
          {/* ========== 宸︽爮锛氶鑹茬粨鏋?+ 闀块毦鍙?+ 鍗曡瘝 ========== */}
          <aside className="bg-white border-r overflow-y-auto p-4">
            <ColorStructurePanel 
              paragraphs={paragraphs}
              onColorClick={(cs) => console.log('閫変腑棰滆壊:', cs)}
            />
            <SentenceList 
              sentences={sentences}
              paragraphs={paragraphs}
              onSentenceClick={(s) => {
                // 婊氬姩鍒板搴旀钀?                document.getElementById(s.paragraphId)?.scrollIntoView({ behavior: 'smooth' })
              }}
            />
            <WordList 
              words={words}
              paragraphs={paragraphs}
              onWordClick={(w) => {
                document.getElementById(w.paragraphId)?.scrollIntoView({ behavior: 'smooth' })
              }}
            />
          </aside>
          
          {/* ========== 瀛﹁€呮ā寮忥細鍙虫爮(鏂囩尞+琛岄棿绗旇) ========== */}
          {isInlineMode && (
            <main className="overflow-y-auto p-6" ref={contentRef}>
              <div className="max-w-3xl mx-auto">
                <h1 className="text-2xl font-bold mb-6">
                  {selectedLiterature.title_cn || selectedLiterature.title_en}
                </h1>
                
                {readMode === 'edit' ? (
                  // 缂栬緫妯″紡
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="w-full min-h-[600px] p-4 border rounded font-mono text-sm"
                  />
                ) : (
                  // 闃呰妯″紡
                  <div className="prose prose-lg max-w-none space-y-4">
                    {paragraphs.map(p => (
                      <ParagraphRenderer
                        key={p.id}
                        paragraph={p}
                        words={getWordsForParagraph(p.id)}
                        sentences={getSentencesForParagraph(p.id)}
                        notes={getNotesForParagraph(p.id)}
                        isInlineMode={true}
                        onAddNote={(id) => setEditingNote({ paragraphId: id, content: '' })}
                        onTextSelect={handleTextSelect}
                        readMode={readMode}
                      />
                    ))}
                    
                    {/* 鏂板缓绗旇缂栬緫鍣?*/}
                    {editingNote && (
                      <div className="mt-4">
                        <NoteEditor
                          onSave={(content) => handleAddNote(editingNote.paragraphId, content)}
                          onCancel={() => setEditingNote(null)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </main>
          )}
          
          {/* ========== 鍙屾爮妯″紡锛氫腑鏍?绾枃鐚? + 鍙虫爮(杈规爮绗旇) ========== */}
          {!isInlineMode && (
            <>
              {/* 涓爮锛氱函鏂囩尞 */}
              <main className="overflow-y-auto p-6" ref={contentRef}>
                <div className="max-w-3xl mx-auto">
                  <h1 className="text-2xl font-bold mb-6">
                    {selectedLiterature.title_cn || selectedLiterature.title_en}
                  </h1>
                  
                  {readMode === 'edit' ? (
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="w-full min-h-[600px] p-4 border rounded font-mono text-sm"
                    />
                  ) : (
                    <div className="prose prose-lg max-w-none space-y-4">
                      {paragraphs.map(p => (
                        <ParagraphRenderer
                          key={p.id}
                          paragraph={p}
                          words={getWordsForParagraph(p.id)}
                          sentences={getSentencesForParagraph(p.id)}
                          notes={[]} // 鍙屾爮妯″紡涓嶆樉绀鸿闂寸瑪璁?                          isInlineMode={false}
                          onTextSelect={handleTextSelect}
                          readMode={readMode}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </main>
              
              {/* 鍙虫爮锛氳竟鏍忕瑪璁?*/}
              <aside className="bg-gray-50 border-l overflow-y-auto p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">馃摑 绗旇</h3>
                  <button 
                    onClick={() => setEditingNote({ paragraphId: paragraphs[0]?.id, content: '' })}
                    className="text-sm px-2 py-1 bg-blue-500 text-white rounded"
                  >
                    + 娣诲姞
                  </button>
                </div>
                
                <div className="space-y-3">
                  {notes.map(note => {
                    const paragraph = paragraphs.find(p => p.id === note.anchor_id)
                    return (
                      <SidebarNote
                        key={note.id}
                        note={note}
                        paragraph={paragraph}
                        onEdit={(n) => setEditingNote({ ...n, editing: true })}
                        onDelete={async (id) => {
                          // 瀹炵幇鍒犻櫎閫昏緫
                        }}
                      />
                    )
                  })}
                </div>
                
                {/* 缂栬緫鍣?*/}
                {editingNote && (
                  <div className="mt-4">
                    <NoteEditor
                      initialContent={editingNote.content}
                      onSave={(content) => handleAddNote(editingNote.paragraphId, content)}
                      onCancel={() => setEditingNote(null)}
                    />
                  </div>
                )}
              </aside>
            </>
          )}
          
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <p>璇烽€夋嫨涓€绡囨枃鐚紑濮嬮槄璇?/p>
        </div>
      )}
      
      {/* 鍏ㄥ眬鏍峰紡 */}
      <style>{`
        .word-new {
          color: #DC2626;
          font-weight: bold;
          border-bottom: 2px solid #DC2626;
        }
        .word-learning {
          color: #D97706;
          font-weight: bold;
          border-bottom: 2px solid #F59E0B;
        }
        .word-mastered {
          color: inherit;
        }
        .sentence-highlight {
          color: #DC2626;
          background: rgba(254, 226, 226, 0.3);
          border-radius: 2px;
          padding: 1px 2px;
        }
        .paragraph-block {
          position: relative;
          padding: 8px 0;
        }
      `}</style>
    </div>
  )
}

export default DeepRead
