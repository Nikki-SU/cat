/**
 * 学习页面 - 全屏沉浸式单词学习
 * 支持：六种题型、艾宾浩斯复习、进度保存、断点续传
 */
import { useState, useEffect, useCallback } from 'react'
import useAppStore from '../stores/useAppStore'
import { learningAPI } from '../api/client'
import { WORD_QUEUE_LENGTHS } from '../utils/constants'

// 六种题型配置
const QUESTION_TYPES = {
  en_select_cn: {
    name: '英选中',
    getQuestion: (word) => word.word_en,
    getAnswer: (word) => word.word_cn,
  },
  cn_select_en: {
    name: '中选英',
    getQuestion: (word) => word.word_cn,
    getAnswer: (word) => word.word_en,
  },
  en_select_def: {
    name: '英选定义',
    getQuestion: (word) => word.word_en,
    getAnswer: (word, isReview) => isReview ? word.definition_en : word.definition_cn,
  },
  def_select_en: {
    name: '定义选英',
    getQuestion: (word) => word.definition_cn,
    getAnswer: (word) => word.word_en,
  },
  sent_select_cn: {
    name: '例句选中',
    getQuestion: (word) => word.sentence?.replace(word.word_en, '_____'),
    getAnswer: (word) => word.word_cn,
  },
  sent_select_def: {
    name: '例句选定义',
    getQuestion: (word) => word.sentence?.replace(word.word_en, '_____'),
    getAnswer: (word, isReview) => isReview ? word.definition_en : word.definition_cn,
  },
}

function Learn() {
  const { fetchWords } = useAppStore()
  const [mode, setMode] = useState(null)
  const [session, setSession] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [showCard, setShowCard] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [isCorrect, setIsCorrect] = useState(null)
  const [stats, setStats] = useState({
    new: 0, studying: 0, learned: 0, mastered: 0,
    error_book: 0, today_to_review: 0
  })
  const [studySettings, setStudySettings] = useState({
    queueLength: 10,
    selectedTypes: ['en_select_cn', 'cn_select_en', 'en_select_def',
                   'def_select_en', 'sent_select_cn', 'sent_select_def'],
    allowSkip: true
  })
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    fetchWords()
    loadStats()
    loadStudySettings()
    checkActiveSession()
  }, [])

  const checkActiveSession = async () => {
    try {
      const data = await learningAPI.getActiveSession()
      if (data.has_active_session) {
        if (window.confirm('检测到有未完成的学习会话，是否继续？')) {
          setMode(data.session.mode)
          const question = await learningAPI.getCurrentQuestion(data.session.id)
          setSession({ session_id: data.session.id, ...data.session })
          setCurrentQuestion(question)
        }
      }
    } catch (e) {}
  }

  const loadStats = async () => {
    try {
      const data = await learningAPI.getStudyStats()
      setStats(data)
    } catch (e) {}
  }

  const loadStudySettings = async () => {
    try {
      const data = await learningAPI.getStudySettings()
      setStudySettings({
        queueLength: data.queue_length || 10,
        selectedTypes: data.selected_types || studySettings.selectedTypes,
        allowSkip: data.allow_skip ?? true
      })
    } catch (e) {}
  }

  const saveStudySettings = async () => {
    try {
      await learningAPI.updateStudySettings({
        queue_length: studySettings.queueLength,
        selected_types: studySettings.selectedTypes,
        allow_skip: studySettings.allowSkip
      })
      setShowSettings(false)
    } catch (e) {}
  }

  const startSession = async (sessionMode) => {
    try {
      const data = await learningAPI.startStudy({
        mode: sessionMode,
        queue_length: studySettings.queueLength,
        selected_types: studySettings.selectedTypes
      })
      setMode(sessionMode)
      setSession(data)
      setCurrentQuestion(data)
      resetUI()
    } catch (e) {
      alert(e.message || '开始失败')
    }
  }

  const resetUI = () => {
    setShowCard(false)
    setSelectedAnswer(null)
    setIsCorrect(null)
  }

  const submitAnswer = async (answer) => {
    if (!currentQuestion?.question || selectedAnswer !== null) return
    setSelectedAnswer(answer)
    const correct = answer === currentQuestion.question.correct_answer
    setIsCorrect(correct)

    try {
      const result = await learningAPI.submitAnswer(
        session.session_id, {
          word_id: currentQuestion.question.word_id,
          answer
        }
      )
      if (!correct) {
        setTimeout(() => setShowCard(true), 600)
      } else {
        setTimeout(() => handleNext(result), 800)
      }
    } catch (e) {}
  }

  const handleNext = async (result) => {
    if (result?.session_finished) {
      finishSession()
      return
    }
    try {
      const data = await learningAPI.nextQuestion(session.session_id)
      if (data) {
        setCurrentQuestion(data)
        resetUI()
      } else {
        finishSession()
      }
    } catch (e) {}
  }

  const continueAfterCard = async () => {
    setShowCard(false)
    setSelectedAnswer(null)
    setIsCorrect(null)
    try {
      const data = await learningAPI.getCurrentQuestion(session.session_id)
      if (data) setCurrentQuestion(data)
    } catch (e) {}
  }

  const skipWord = async () => {
    if (!currentQuestion?.question) return
    if (!studySettings.allowSkip) {
      alert('当前设置不允许斩词')
      return
    }
    try {
      await learningAPI.skipWord(currentQuestion.question.word_id)
      handleNext()
    } catch (e) {}
  }

  const exitSession = () => {
    if (window.confirm('确定要退出吗？进度会自动保存')) {
      setMode(null)
      setSession(null)
      setCurrentQuestion(null)
      loadStats()
    }
  }

  const finishSession = () => {
    const modeText = mode === 'learn' ? '学习' : mode === 'review' ? '复习' : '错词本'
    alert(`${modeText}完成！`)
    setMode(null)
    setSession(null)
    setCurrentQuestion(null)
    loadStats()
  }

  if (mode && currentQuestion) {
    const { question, current_idx, total_words, type_name, is_retry } = currentQuestion

    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        <div className="h-14 bg-red-800 text-white flex items-center justify-between px-4 shrink-0">
          <button onClick={exitSession} className="hover:opacity-80">退出</button>
          <div className="flex items-center gap-3 text-sm">
            <span>{current_idx} / {total_words}</span>
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs">
              {type_name}{is_retry && ' (重)'}
            </span>
          </div>
          <button onClick={skipWord} disabled={!studySettings.allowSkip} className="hover:opacity-80">
            斩词
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-10 text-center">
            {question?.question || '加载中...'}
          </div>

          {question?.options && (
            <div className="w-full max-w-md space-y-3">
              {question.options.map((option, idx) => {
                const isSelected = selectedAnswer === option
                const showResult = selectedAnswer !== null
                const isCorrectOption = option === question.correct_answer
                let btnClass = 'w-full p-4 md:p-5 rounded-xl text-lg font-medium transition-all border-2 '
                
                if (!showResult) {
                  btnClass += 'bg-gray-50 hover:bg-red-800 hover:text-white border-transparent'
                } else if (isCorrectOption) {
                  btnClass += 'bg-green-500 text-white border-green-500'
                } else if (isSelected) {
                  btnClass += 'bg-red-500 text-white border-red-500'
                } else {
                  btnClass += 'bg-gray-100 text-gray-500 border-transparent'
                }

                return (
                  <button key={idx} onClick={() => submitAnswer(option)} disabled={showResult} className={btnClass}>
                    {option}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {showCard && question?.word_data && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-3xl font-bold text-gray-900 mb-4 text-center">{question.word_data.word_en}</h3>
              <div className="space-y-3 text-center">
                <p className="text-2xl text-red-800 font-medium">{question.word_data.word_cn}</p>
                {question.word_data.definition_cn && (
                  <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">{question.word_data.definition_cn}</p>
                )}
                {question.word_data.sentence && (
                  <p className="text-sm text-gray-500 italic border-t pt-3">"{question.word_data.sentence}"</p>
                )}
              </div>
              <button onClick={continueAfterCard} className="w-full mt-6 bg-red-800 text-white py-3 rounded-xl">
                记住了，继续重做
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <div className="text-center py-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">学习中心</h1>
          <p className="text-gray-600">艾宾浩斯记忆法背单词</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow">
          <h3 className="font-semibold text-gray-900 mb-4 text-lg">学习统计</h3>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div><div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold mx-auto mb-1 text-sm">{stats.new}</div><span className="text-xs text-gray-600">新学</span></div>
            <div><div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold mx-auto mb-1 text-sm">{stats.studying}</div><span className="text-xs text-gray-600">正在学</span></div>
            <div><div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold mx-auto mb-1 text-sm">{stats.learned}</div><span className="text-xs text-gray-600">待复习</span></div>
            <div><div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold mx-auto mb-1 text-sm">{stats.mastered}</div><span className="text-xs text-gray-600">已掌握</span></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 text-lg">学习设置</h3>
            <button onClick={() => setShowSettings(!showSettings)} className="text-sm text-red-800">
              {showSettings ? '收起' : '设置'}
            </button>
          </div>

          {showSettings && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <label className="text-sm text-gray-600 block mb-2">每组单词数（队列长度）</label>
                <div className="flex gap-2 flex-wrap">
                  {WORD_QUEUE_LENGTHS.map(n => (
                    <button key={n} onClick={() => setStudySettings({...studySettings, queueLength: n})} className={`px-4 py-2 rounded-lg text-sm ${studySettings.queueLength === n ? 'bg-red-800 text-white' : 'bg-gray-100 text-gray-900'}`}>
                      {n}个
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600 block mb-2">题型选择</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(QUESTION_TYPES).map(([key, type]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={studySettings.selectedTypes.includes(key)} onChange={(e) => {
                        const newTypes = e.target.checked ? [...studySettings.selectedTypes, key] : studySettings.selectedTypes.filter(t => t !== key)
                        setStudySettings({...studySettings, selectedTypes: newTypes})
                      }} className="w-4 h-4" />
                      <span>{type.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button onClick={saveStudySettings} className="w-full py-2 bg-red-800 text-white rounded-lg">保存设置</button>
            </div>
          )}
        </div>

        <div className="space-y-3 pt-2">
          <button onClick={() => startSession('learn')} className="w-full bg-red-800 text-white py-4 rounded-xl text-lg flex items-center justify-center gap-3 hover:bg-red-900">
            <span>开始学习</span>
            <span className="text-sm opacity-80">{stats.new + stats.studying} 个单词待学习</span>
          </button>

          <button onClick={() => startSession('review')} disabled={stats.today_to_review === 0} className="w-full bg-green-600 text-white py-4 rounded-xl text-lg flex items-center justify-center gap-3 hover:bg-green-700 disabled:opacity-50">
            <span>开始复习</span>
            <span className="text-sm opacity-80">{stats.today_to_review} 个单词待复习</span>
          </button>

          {stats.error_book > 0 && (
            <button onClick={() => startSession('error_book')} className="w-full bg-red-500 text-white py-4 rounded-xl text-lg flex items-center justify-center gap-3 hover:bg-red-600">
              <span>错词本</span>
              <span className="text-sm opacity-80">{stats.error_book} 个单词</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Learn
