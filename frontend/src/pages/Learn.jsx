/**
 * 学习页面 - 单词、长难句、翻译练习
 */
import { useState, useEffect, useMemo } from 'react'
import useAppStore from '../stores/useAppStore'
import { learningAPI, translationAPI } from '../api/client'
import { formatDate, shuffleArray, calculateNextReview } from '../utils/helpers'
import { LEARNING_MODES, WORD_STATUS, REVIEW_MODES, TRANSLATION_MODES, QUESTION_TYPES } from '../utils/constants'

function Learn() {
  const { 
    settings, 
    words, 
    longSentences, 
    translationCards,
    fetchWords, 
    fetchLongSentences, 
    fetchTranslationCards,
    updateSettings 
  } = useAppStore()

  const [learningMode, setLearningMode] = useState(LEARNING_MODES.word)
  const [reviewMode, setReviewMode] = useState(settings.reviewMode || REVIEW_MODES.interval.id)
  const [translationMode, setTranslationMode] = useState(settings.translationMode || TRANSLATION_MODES.normal.id)
  
  // 学习卡片状态
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  
  // 单词统计数据
  const wordStats = useMemo(() => {
    return {
      new: words.filter(w => w.status === 'new').length,
      learning: words.filter(w => w.status === 'learning').length,
      mastered: words.filter(w => w.status === 'mastered').length,
      total: words.length,
    }
  }, [words])

  // 长难句统计数据
  const sentenceStats = useMemo(() => {
    return {
      new: longSentences.filter(s => s.status === 'new').length,
      learning: longSentences.filter(s => s.status === 'learning').length,
      mastered: longSentences.filter(s => s.status === 'mastered').length,
      total: longSentences.length,
    }
  }, [longSentences])

  // 待学习的单词（按优先级排序）
  const learningQueue = useMemo(() => {
    const now = new Date()
    return words
      .filter(w => {
        if (w.status === 'mastered') return false
        if (!w.next_review) return true
        return new Date(w.next_review) <= now
      })
      .sort((a, b) => {
        // 优先级：新学 > 学习中快到期 > 学习中慢到期
        if (a.status === 'new' && b.status !== 'new') return -1
        if (b.status === 'new' && a.status !== 'new') return 1
        if (!a.next_review) return -1
        if (!b.next_review) return 1
        return new Date(a.next_review) - new Date(b.next_review)
      })
      .slice(0, settings.wordQueueLength || 20)
  }, [words, settings.wordQueueLength])

  // 当前卡片
  const currentCard = learningQueue[currentCardIndex]

  // 加载数据
  useEffect(() => {
    fetchWords()
    fetchLongSentences()
    fetchTranslationCards()
  }, [])

  // 处理答案判断
  const handleAnswer = async (correct) => {
    if (!currentCard) return
    
    setIsCorrect(correct)
    
    // 更新单词状态
    try {
      const newStreak = correct ? (currentCard.correct_streak || 0) + 1 : 0
      const newStatus = correct && newStreak >= 3 ? 'mastered' : 
                        correct ? 'learning' : 
                        currentCard.status === 'new' ? 'learning' : currentCard.status
      
      await learningAPI.updateWord(currentCard.id, {
        status: newStatus,
        correct_streak: newStreak,
        last_review: new Date().toISOString(),
        next_review: correct ? calculateNextReview(newStreak).toISOString() : null,
        review_count: (currentCard.review_count || 0) + 1,
      })
      
      // 重新获取单词列表
      await fetchWords()
    } catch (error) {
      console.error('Failed to update word:', error)
    }
    
    // 延迟后进入下一张
    setTimeout(() => {
      setShowAnswer(false)
      setIsCorrect(null)
      if (currentCardIndex < learningQueue.length - 1) {
        setCurrentCardIndex(prev => prev + 1)
      } else {
        // 重新开始或结束
        setCurrentCardIndex(0)
      }
    }, 1000)
  }

  // 处理长难句答案
  const handleSentenceAnswer = async (correct) => {
    if (!currentSentence) return
    
    setIsCorrect(correct)
    
    try {
      const newStreak = correct ? (currentSentence.correct_streak || 0) + 1 : 0
      const newStatus = correct && newStreak >= 3 ? 'mastered' : 
                        correct ? 'learning' : 
                        currentSentence.status === 'new' ? 'learning' : currentSentence.status
      
      await learningAPI.updateSentence(currentSentence.id, {
        status: newStatus,
        correct_streak: newStreak,
        last_review: new Date().toISOString(),
        next_review: correct ? calculateNextReview(newStreak).toISOString() : null,
        review_count: (currentSentence.review_count || 0) + 1,
      })
      
      await fetchLongSentences()
    } catch (error) {
      console.error('Failed to update sentence:', error)
    }
    
    setTimeout(() => {
      setShowAnswer(false)
      setIsCorrect(null)
      if (sentenceIndex < sentenceQueue.length - 1) {
        setSentenceIndex(prev => prev + 1)
      } else {
        setSentenceIndex(0)
      }
    }, 1000)
  }

  // 长难句学习队列
  const [sentenceIndex, setSentenceIndex] = useState(0)
  const sentenceQueue = useMemo(() => {
    const now = new Date()
    return longSentences
      .filter(s => {
        if (s.status === 'mastered') return false
        if (!s.next_review) return true
        return new Date(s.next_review) <= now
      })
      .slice(0, 10)
  }, [longSentences])
  
  const currentSentence = sentenceQueue[sentenceIndex]

  // 翻译练习
  const [currentTranslation, setCurrentTranslation] = useState(null)
  const [translationIndex, setTranslationIndex] = useState(0)
  const [showTranslationHint, setShowTranslationHint] = useState(false)
  
  const translationQueue = useMemo(() => {
    return shuffleArray(translationCards.filter(t => t)).slice(0, 10)
  }, [translationCards])
  
  useEffect(() => {
    if (translationQueue.length > 0) {
      setCurrentTranslation(translationQueue[0])
    }
  }, [learningMode])
  
  const handleNextTranslation = () => {
    if (translationIndex < translationQueue.length - 1) {
      setTranslationIndex(prev => prev + 1)
      setCurrentTranslation(translationQueue[translationIndex + 1])
      setShowTranslationHint(false)
    } else {
      setTranslationIndex(0)
      setCurrentTranslation(translationQueue[0])
      setShowTranslationHint(false)
    }
  }

  // 统计卡片组件
  const StatsCard = ({ stats, title }) => (
    <div className="bg-white rounded-xl p-4 card-shadow">
      <h3 className="font-semibold text-text-main mb-3">{title}</h3>
      <div className="flex justify-around">
        <div className="text-center">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mb-1"
            style={{ backgroundColor: WORD_STATUS.new.color }}
          >
            {stats.new}
          </div>
          <span className="text-xs text-text-secondary">新学</span>
        </div>
        <div className="text-center">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mb-1"
            style={{ backgroundColor: WORD_STATUS.learning.color }}
          >
            {stats.learning}
          </div>
          <span className="text-xs text-text-secondary">学习中</span>
        </div>
        <div className="text-center">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mb-1"
            style={{ backgroundColor: WORD_STATUS.mastered.color }}
          >
            {stats.mastered}
          </div>
          <span className="text-xs text-text-secondary">已掌握</span>
        </div>
      </div>
      <p className="text-center text-sm text-text-secondary mt-2">
        共 {stats.total} 条
      </p>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-primary-blue mb-2">📚 学习中心</h1>
        <p className="text-text-secondary">单词、长难句、翻译练习</p>
      </div>

      {/* 学习模式切换 */}
      <div className="bg-white rounded-xl p-4 card-shadow">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {[
            { id: LEARNING_MODES.word, icon: '📝', label: '背单词' },
            { id: LEARNING_MODES.sentence, icon: '📖', label: '长难句' },
            { id: LEARNING_MODES.translation, icon: '🔄', label: '翻译练习' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setLearningMode(mode.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                learningMode === mode.id
                  ? 'bg-white shadow text-primary-blue'
                  : 'text-text-secondary hover:text-text-main'
              }`}
            >
              <span className="mr-1">{mode.icon}</span>
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* 单词学习 */}
      {learningMode === LEARNING_MODES.word && (
        <>
          <StatsCard stats={wordStats} title="📝 单词统计" />
          
          {/* 复习模式选择 */}
          <div className="bg-white rounded-xl p-4 card-shadow">
            <h3 className="font-semibold text-text-main mb-3">复习模式</h3>
            <div className="flex gap-3">
              {Object.values(REVIEW_MODES).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => {
                    setReviewMode(mode.id)
                    updateSettings({ reviewMode: mode.id })
                  }}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    reviewMode === mode.id
                      ? 'border-primary-blue bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium">{mode.label}</p>
                  <p className="text-xs text-text-secondary mt-1">{mode.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 学习卡片 */}
          {learningQueue.length > 0 && currentCard ? (
            <div className="bg-white rounded-xl p-6 card-shadow">
              <div className="text-center mb-6">
                <p className="text-sm text-text-secondary mb-2">
                  {currentCardIndex + 1} / {learningQueue.length}
                </p>
                <p 
                  className="text-3xl font-bold mb-4"
                  style={{ color: WORD_STATUS[currentCard.status]?.color || '#3C5488' }}
                >
                  {currentCard.word_en}
                </p>
                
                {showAnswer && (
                  <div className="mt-4 space-y-2 animate-fade-in">
                    <p className="text-lg text-text-main">{currentCard.word_cn}</p>
                    {currentCard.definition_en && (
                      <p className="text-sm text-text-secondary">{currentCard.definition_en}</p>
                    )}
                    {currentCard.sentence && (
                      <p className="text-sm text-text-secondary italic mt-2">
                        "{currentCard.sentence}"
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              {/* 操作按钮 */}
              <div className="flex justify-center gap-4">
                {!showAnswer ? (
                  <button
                    onClick={() => setShowAnswer(true)}
                    className="btn btn-primary px-8"
                  >
                    显示答案
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleAnswer(false)}
                      className={`px-6 py-3 rounded-lg font-medium transition-all ${
                        isCorrect === false
                          ? 'bg-status-error text-white'
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      }`}
                    >
                      不认识 😵
                    </button>
                    <button
                      onClick={() => handleAnswer(true)}
                      className={`px-6 py-3 rounded-lg font-medium transition-all ${
                        isCorrect === true
                          ? 'bg-status-success text-white'
                          : 'bg-green-100 text-green-600 hover:bg-green-200'
                      }`}
                    >
                      记住了 ✨
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 card-shadow text-center">
              <p className="text-4xl mb-4">🎉</p>
              <p className="text-text-main font-medium">太棒了！</p>
              <p className="text-text-secondary mt-2">今天的单词已经复习完成</p>
            </div>
          )}
        </>
      )}

      {/* 长难句学习 */}
      {learningMode === LEARNING_MODES.sentence && (
        <>
          <StatsCard stats={sentenceStats} title="📖 长难句统计" />
          
          {sentenceQueue.length > 0 && currentSentence ? (
            <div className="bg-white rounded-xl p-6 card-shadow">
              <div className="text-center mb-6">
                <p className="text-sm text-text-secondary mb-4">
                  {sentenceIndex + 1} / {sentenceQueue.length}
                </p>
                <p className="text-lg font-medium text-text-main leading-relaxed mb-4">
                  {currentSentence.sentence_en}
                </p>
                
                {showAnswer && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg animate-fade-in">
                    <p className="text-lg text-primary-blue">{currentSentence.sentence_cn}</p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-center gap-4">
                {!showAnswer ? (
                  <button
                    onClick={() => setShowAnswer(true)}
                    className="btn btn-primary px-8"
                  >
                    显示翻译
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleSentenceAnswer(false)}
                      className="px-6 py-3 rounded-lg font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-all"
                    >
                      不认识
                    </button>
                    <button
                      onClick={() => handleSentenceAnswer(true)}
                      className="px-6 py-3 rounded-lg font-medium bg-green-100 text-green-600 hover:bg-green-200 transition-all"
                    >
                      掌握了
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 card-shadow text-center">
              <p className="text-4xl mb-4">🎉</p>
              <p className="text-text-main font-medium">长难句已复习完成</p>
            </div>
          )}
        </>
      )}

      {/* 翻译练习 */}
      {learningMode === LEARNING_MODES.translation && (
        <>
          {/* 翻译模式选择 */}
          <div className="bg-white rounded-xl p-4 card-shadow">
            <h3 className="font-semibold text-text-main mb-3">练习模式</h3>
            <div className="flex gap-3">
              {Object.values(TRANSLATION_MODES).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => {
                    setTranslationMode(mode.id)
                    updateSettings({ translationMode: mode.id })
                  }}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    translationMode === mode.id
                      ? 'border-primary-blue bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium">{mode.label}</p>
                  <p className="text-xs text-text-secondary mt-1">{mode.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 翻译卡片列表 */}
          {translationQueue.length > 0 && currentTranslation ? (
            <div className="bg-white rounded-xl p-6 card-shadow">
              <div className="mb-4">
                <p className="text-sm text-text-secondary">
                  {translationIndex + 1} / {translationQueue.length}
                </p>
              </div>
              
              {/* 原文 */}
              <div className="p-4 bg-gray-50 rounded-lg mb-4">
                <p className="text-sm text-text-secondary mb-2">原文摘要</p>
                <p className="text-text-main leading-relaxed">
                  {currentTranslation.original_text}
                </p>
              </div>
              
              {/* 提示区域（突击模式直接显示，严格模式需点击） */}
              {translationMode === TRANSLATION_MODES.strict.id && !showTranslationHint && (
                <button
                  onClick={() => setShowTranslationHint(true)}
                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-text-secondary hover:border-primary-blue hover:text-primary-blue transition-all"
                >
                  点击回忆 / 查看翻译
                </button>
              )}
              
              {(translationMode === TRANSLATION_MODES.normal.id || showTranslationHint) && (
                <div className="p-4 bg-blue-50 rounded-lg mb-4">
                  <p className="text-sm text-text-secondary mb-2">你的翻译</p>
                  <p className="text-text-main leading-relaxed mb-4">
                    {currentTranslation.user_translation || '（待填写）'}
                  </p>
                  
                  <p className="text-sm text-text-secondary mb-2">参考翻译</p>
                  <p className="text-primary-blue leading-relaxed">
                    {currentTranslation.ai_feedback || '（暂无参考）'}
                  </p>
                </div>
              )}
              
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleNextTranslation}
                  className="btn btn-primary px-6"
                >
                  下一题 →
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 card-shadow text-center">
              <p className="text-4xl mb-4">📚</p>
              <p className="text-text-main font-medium">暂无翻译练习</p>
              <p className="text-text-secondary mt-2">阅读文献时创建翻译练习</p>
            </div>
          )}
        </>
      )}

      {/* 底部占位 */}
      <div className="h-8" />
    </div>
  )
}

export default Learn
