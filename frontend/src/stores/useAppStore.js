/**
 * Zustand 状态管理 - 包含学习模块状态
 */
import { create } from 'zustand'
import { literatureAPI, trackingAPI, cardAPI, learningAPI, noteAPI, organizationAPI, translationAPI } from '../api/client'

const useAppStore = create((set, get) => ({
  // ==================== UI状态 ====================
  isLoading: false,
  error: null,

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // ==================== 文献表状态 ====================
  literatureTable: [],
  literatureEntries: [],

  fetchLiteratureTable: async (params = {}) => {
    try {
      set({ isLoading: true })
      const data = await literatureAPI.listTable(params)
      set({ literatureTable: data, isLoading: false })
    } catch (error) {
      set({ error: error.message, isLoading: false })
    }
  },

  addToLiteratureTable: async (entry) => {
    try {
      await literatureAPI.createTableEntry(entry)
      get().fetchLiteratureTable()
    } catch (error) {
      set({ error: error.message })
    }
  },

  updateLiteratureTableEntry: async (doi, data) => {
    try {
      await literatureAPI.updateTableEntry(doi, data)
      get().fetchLiteratureTable()
    } catch (error) {
      set({ error: error.message })
    }
  },

  deleteLiteratureTableEntry: async (doi, cascade = false) => {
    try {
      await literatureAPI.deleteTableEntry(doi, cascade)
      get().fetchLiteratureTable()
    } catch (error) {
      set({ error: error.message })
    }
  },

  // ==================== 追踪记录状态 ====================
  trackingRecords: [],

  fetchTrackingRecords: async (params = {}) => {
    try {
      set({ isLoading: true })
      const data = await trackingAPI.listRecords(params)
      set({ trackingRecords: data, isLoading: false })
    } catch (error) {
      set({ error: error.message, isLoading: false })
    }
  },

  addTrackingRecord: async (record) => {
    try {
      await trackingAPI.createRecord(record)
      get().fetchTrackingRecords()
    } catch (error) {
      set({ error: error.message })
    }
  },

  updateTrackingRecord: async (id, data) => {
    try {
      await trackingAPI.updateRecord(id, data)
      get().fetchTrackingRecords()
    } catch (error) {
      set({ error: error.message })
    }
  },

  deleteTrackingRecord: async (id) => {
    try {
      await trackingAPI.deleteRecord(id)
      get().fetchTrackingRecords()
    } catch (error) {
      set({ error: error.message })
    }
  },

  // ==================== 文献卡片状态 ====================
  literatureCards: [],

  fetchLiteratureCards: async (params = {}) => {
    try {
      set({ isLoading: true })
      const data = await cardAPI.listCards(params)
      set({ literatureCards: data, isLoading: false })
    } catch (error) {
      set({ error: error.message, isLoading: false })
    }
  },

  // ==================== 学习状态（重写版） ====================
  
  // 单词状态
  words: [],
  wordStats: { total: 0, new: 0, learning: 0, learned: 0, mastered: 0, error_book: 0, today_to_review: 0 },
  
  // 学习会话状态
  currentSession: null,
  currentQuestion: null,
  isLearning: false,
  isReviewing: false,

  // 学习设置
  studySettings: {
    word_queue_length: 5,
    allow_zhan: true,
    master_count: 12,
    question_types: ['en_select_cn'],
    voice_enabled: true
  },

  // 长难句状态
  longSentences: [],
  sentenceStats: { total: 0, new: 0, learning: 0, mastered: 0, today_to_review: 0 },
  currentSentence: null,
  isSentenceLearning: false,

  // 翻译练习状态
  translationCards: [],
  translationStats: { total: 0, pending: 0, completed: 0, today_to_review: 0 },
  currentTranslation: null,
  isTranslating: false,

  // 单词列表
  wordLists: [],
  sentenceLists: [],

  // 加载学习数据
  fetchLearningData: async () => {
    try {
      set({ isLoading: true })
      
      // 加载设置
      const settingsData = await learningAPI.getSettings()
      set({ studySettings: settingsData })
      
      // 加载单词统计
      const wordStatsData = await learningAPI.getWordStats()
      set({ wordStats: wordStatsData })
      
      // 加载长难句统计
      const sentenceStatsData = await learningAPI.getSentenceStats()
      set({ sentenceStats: sentenceStatsData })
      
      // 加载翻译练习统计
      const translationStatsData = await learningAPI.getTranslationStats()
      set({ translationStats: translationStatsData })
      
      set({ isLoading: false })
    } catch (error) {
      set({ error: error.message, isLoading: false })
    }
  },

  // 单词CRUD
  fetchWords: async (params = {}) => {
    try {
      const data = await learningAPI.listWords(params)
      set({ words: data })
    } catch (error) {
      set({ error: error.message })
    }
  },

  createWord: async (data) => {
    try {
      await learningAPI.createWord(data)
      get().fetchWords()
      get().fetchLearningData()
    } catch (error) {
      set({ error: error.message })
    }
  },

  updateWord: async (id, data) => {
    try {
      await learningAPI.updateWord(id, data)
      get().fetchWords()
      get().fetchLearningData()
    } catch (error) {
      set({ error: error.message })
    }
  },

  deleteWord: async (id) => {
    try {
      await learningAPI.deleteWord(id)
      get().fetchWords()
      get().fetchLearningData()
    } catch (error) {
      set({ error: error.message })
    }
  },

  // 学习会话
  startWordStudy: async (mode = 'learn', queueLength = 5) => {
    try {
      const result = await learningAPI.startStudy(mode, queueLength)
      set({
        currentSession: result,
        currentQuestion: result.question,
        isLearning: mode === 'learn',
        isReviewing: mode === 'review'
      })
      return result
    } catch (error) {
      set({ error: error.message })
      throw error
    }
  },

  submitWordAnswer: async (sessionId, wordId, selected) => {
    try {
      const result = await learningAPI.submitAnswer(sessionId, wordId, selected)
      return result
    } catch (error) {
      set({ error: error.message })
      throw error
    }
  },

  nextWordQuestion: async (sessionId) => {
    try {
      const result = await learningAPI.nextQuestion(sessionId)
      if (result.session_finished) {
        set({
          currentSession: null,
          currentQuestion: null,
          isLearning: false,
          isReviewing: false
        })
        get().fetchLearningData()
        return null
      }
      set({ currentQuestion: result })
      return result
    } catch (error) {
      set({ error: error.message })
      throw error
    }
  },

  zhanWord: async (wordId) => {
    try {
      await learningAPI.zhanWord(wordId)
      get().fetchLearningData()
    } catch (error) {
      set({ error: error.message })
    }
  },

  endWordStudy: async (sessionId) => {
    try {
      if (sessionId) {
        await learningAPI.endSession(sessionId)
      }
      set({
        currentSession: null,
        currentQuestion: null,
        isLearning: false,
        isReviewing: false
      })
      get().fetchLearningData()
    } catch (error) {
      set({ error: error.message })
    }
  },

  // 学习设置更新
  updateStudySettings: async (newSettings) => {
    try {
      await learningAPI.updateSettings(newSettings)
      set({ studySettings: { ...get().studySettings, ...newSettings } })
    } catch (error) {
      set({ error: error.message })
    }
  },

  // 长难句CRUD
  fetchLongSentences: async (params = {}) => {
    try {
      const data = await learningAPI.listSentences(params)
      set({ longSentences: data })
    } catch (error) {
      set({ error: error.message })
    }
  },

  createLongSentence: async (data) => {
    try {
      await learningAPI.createSentence(data)
      get().fetchLongSentences()
      get().fetchLearningData()
    } catch (error) {
      set({ error: error.message })
    }
  },

  submitSentenceTranslation: async (sentenceId, translation) => {
    try {
      const result = await learningAPI.submitSentenceTranslation(sentenceId, translation)
      get().fetchLearningData()
      return result
    } catch (error) {
      set({ error: error.message })
      throw error
    }
  },

  // 翻译练习CRUD
  fetchTranslationCards: async (params = {}) => {
    try {
      const data = await learningAPI.listTranslations(params)
      set({ translationCards: data })
    } catch (error) {
      set({ error: error.message })
    }
  },

  createTranslationCard: async (data) => {
    try {
      await learningAPI.createTranslation(data)
      get().fetchTranslationCards()
      get().fetchLearningData()
    } catch (error) {
      set({ error: error.message })
    }
  },

  submitTranslation: async (cardId, translation) => {
    try {
      const result = await learningAPI.submitTranslation(cardId, translation)
      get().fetchLearningData()
      return result
    } catch (error) {
      set({ error: error.message })
      throw error
    }
  },

  // 单词表/长难句表
  fetchWordLists: async () => {
    try {
      const data = await learningAPI.listWordLists()
      set({ wordLists: data })
    } catch (error) {
      set({ error: error.message })
    }
  },

  fetchSentenceLists: async () => {
    try {
      const data = await learningAPI.listSentenceLists()
      set({ sentenceLists: data })
    } catch (error) {
      set({ error: error.message })
    }
  },

  // ==================== 笔记状态 ====================
  generalNotes: [],

  fetchGeneralNotes: async (params = {}) => {
    try {
      const data = await noteAPI.listGeneralNotes(params)
      set({ generalNotes: data })
    } catch (error) {
      set({ error: error.message })
    }
  },

  // ==================== 组织状态 ====================
  tags: [],
  collections: [],
  journalGroups: [],
  keywordGroups: [],

  fetchTags: async () => {
    try {
      const data = await organizationAPI.listTags()
      set({ tags: data })
    } catch (error) {
      set({ error: error.message })
    }
  },

  fetchJournalGroups: async () => {
    try {
      const data = await organizationAPI.listJournalGroups()
      set({ journalGroups: data })
    } catch (error) {
      set({ error: error.message })
    }
  },

  fetchKeywordGroups: async () => {
    try {
      const data = await organizationAPI.listKeywordGroups()
      set({ keywordGroups: data })
    } catch (error) {
      set({ error: error.message })
    }
  },

  // ==================== 设置状态 ====================
  settings: {
    displayLanguage: 'cn', // cn | en
    displayDetail: 'detailed', // detailed | brief
    trackingInterval: 24,
    defaultJumpMode: 'doi', // xml | doi | gff
    wordQueueLength: 20,
    reviewMode: 'interval', // interval | strict
    translationMode: 'normal', // normal | strict
  },

  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),
}))

export default useAppStore
