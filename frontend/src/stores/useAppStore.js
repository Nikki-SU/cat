/**
 * Zustand 状态管理
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

  // ==================== 学习状态 ====================
  words: [],
  longSentences: [],
  wordLists: [],
  sentenceLists: [],

  fetchWords: async (params = {}) => {
    try {
      const data = await learningAPI.listWords(params)
      set({ words: data })
    } catch (error) {
      set({ error: error.message })
    }
  },

  fetchLongSentences: async (params = {}) => {
    try {
      const data = await learningAPI.listSentences(params)
      set({ longSentences: data })
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

  // ==================== 翻译卡片状态 ====================
  translationCards: [],

  fetchTranslationCards: async (params = {}) => {
    try {
      const data = await translationAPI.listCards(params)
      set({ translationCards: data })
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
