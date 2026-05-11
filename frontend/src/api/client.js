/**
 * API 客户端 - 封装 axios
 */
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 可以在这里添加 token 等认证信息
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// ==================== 文献 API ====================
export const literatureAPI = {
  // 文献条目
  listEntries: (params) => apiClient.get('/literature/entries', { params }),
  getEntry: (doi) => apiClient.get(`/literature/entries/${doi}`),
  createEntry: (data) => apiClient.post('/literature/entries', data),
  updateEntry: (doi, data) => apiClient.put(`/literature/entries/${doi}`, data),
  deleteEntry: (doi) => apiClient.delete(`/literature/entries/${doi}`),

  // 文献表
  listTable: (params) => apiClient.get('/literature/table', { params }),
  getTableEntry: (doi) => apiClient.get(`/literature/table/${doi}`),
  createTableEntry: (data) => apiClient.post('/literature/table', data),
  updateTableEntry: (doi, data) => apiClient.put(`/literature/table/${doi}`, data),
  deleteTableEntry: (doi, cascade) => apiClient.delete(`/literature/table/${doi}`, { params: { cascade } }),
}

// ==================== 追踪 API ====================
export const trackingAPI = {
  listRecords: (params) => apiClient.get('/tracking/records', { params }),
  getRecord: (id) => apiClient.get(`/tracking/records/${id}`),
  createRecord: (data) => apiClient.post('/tracking/records', data),
  updateRecord: (id, data) => apiClient.put(`/tracking/records/${id}`, data),
  deleteRecord: (id) => apiClient.delete(`/tracking/records/${id}`),
  getByJournal: (journal) => apiClient.get(`/tracking/records/by-journal/${journal}`),
}

// ==================== 文献卡片 API ====================
export const cardAPI = {
  // 文献卡片
  listCards: (params) => apiClient.get('/cards/literature', { params }),
  getCard: (doi) => apiClient.get(`/cards/literature/${doi}`),
  createCard: (data) => apiClient.post('/cards/literature', data),
  updateCard: (doi, data) => apiClient.put(`/cards/literature/${doi}`, data),
  deleteCard: (doi) => apiClient.delete(`/cards/literature/${doi}`),

  // 提示词模板
  listPromptTemplates: (params) => apiClient.get('/cards/prompt-templates', { params }),
  getPromptTemplate: (id) => apiClient.get(`/cards/prompt-templates/${id}`),
  createPromptTemplate: (data) => apiClient.post('/cards/prompt-templates', data),
  updatePromptTemplate: (id, data) => apiClient.put(`/cards/prompt-templates/${id}`, data),
  deletePromptTemplate: (id) => apiClient.delete(`/cards/prompt-templates/${id}`),

  // 卡片模板
  listTemplates: (params) => apiClient.get('/cards/templates', { params }),
  getTemplate: (id) => apiClient.get(`/cards/templates/${id}`),
  createTemplate: (data) => apiClient.post('/cards/templates', data),
  updateTemplate: (id, data) => apiClient.put(`/cards/templates/${id}`, data),
  deleteTemplate: (id) => apiClient.delete(`/cards/templates/${id}`),
}

// ==================== 附件 API ====================
export const attachmentAPI = {
  list: (params) => apiClient.get('/attachments', { params }),
  get: (id) => apiClient.get(`/attachments/${id}`),
  upload: async (doi, file) => {
    const formData = new FormData()
    formData.append('doi', doi)
    formData.append('file', file)
    return apiClient.post('/attachments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  update: (id, data) => apiClient.put(`/attachments/${id}`, data),
  delete: (id) => apiClient.delete(`/attachments/${id}`),
  download: (id) => `${API_BASE_URL}/attachments/${id}/download`,
}

// ==================== 结构性文献 API ====================
export const structuredAPI = {
  listLiterature: (params) => apiClient.get('/structured/literature', { params }),
  getLiterature: (doi) => apiClient.get(`/structured/literature/${doi}`),
  createLiterature: (data) => apiClient.post('/structured/literature', data),
  updateLiterature: (doi, data) => apiClient.put(`/structured/literature/${doi}`, data),
  deleteLiterature: (doi) => apiClient.delete(`/structured/literature/${doi}`),
  
  // 获取结构化内容（兼容方法）
  getContent: (doi) => apiClient.get(`/structured/literature/${doi}`),
  
  // 保存结构化内容
  saveContent: (doi, data) => apiClient.put(`/structured/literature/${doi}`, data),

  listNotes: (params) => apiClient.get('/structured/notes', { params }),
  getNote: (id) => apiClient.get(`/structured/notes/${id}`),
  createNote: (data) => apiClient.post('/structured/notes', data),
  updateNote: (id, data) => apiClient.put(`/structured/notes/${id}`, data),
  deleteNote: (id) => apiClient.delete(`/structured/notes/${id}`),
}

// ==================== 学习 API ====================
export const learningAPI = {
  // 单词
  listWords: (params) => apiClient.get('/learning/words', { params }),
  getWord: (id) => apiClient.get(`/learning/words/${id}`),
  createWord: (data) => apiClient.post('/learning/words', data),
  updateWord: (id, data) => apiClient.put(`/learning/words/${id}`, data),
  deleteWord: (id) => apiClient.delete(`/learning/words/${id}`),

  // 长难句
  listSentences: (params) => apiClient.get('/learning/sentences', { params }),
  getSentence: (id) => apiClient.get(`/learning/sentences/${id}`),
  createSentence: (data) => apiClient.post('/learning/sentences', data),
  updateSentence: (id, data) => apiClient.put(`/learning/sentences/${id}`, data),
  deleteSentence: (id) => apiClient.delete(`/learning/sentences/${id}`),

  // 单词表
  listWordLists: (params) => apiClient.get('/learning/word-lists', { params }),
  getWordList: (id) => apiClient.get(`/learning/word-lists/${id}`),
  createWordList: (data) => apiClient.post('/learning/word-lists', data),
  updateWordList: (id, data) => apiClient.put(`/learning/word-lists/${id}`, data),
  deleteWordList: (id) => apiClient.delete(`/learning/word-lists/${id}`),

  // 长难句表
  listSentenceLists: (params) => apiClient.get('/learning/sentence-lists', { params }),
  getSentenceList: (id) => apiClient.get(`/learning/sentence-lists/${id}`),
  createSentenceList: (data) => apiClient.post('/learning/sentence-lists', data),
  updateSentenceList: (id, data) => apiClient.put(`/learning/sentence-lists/${id}`, data),
  deleteSentenceList: (id) => apiClient.delete(`/learning/sentence-lists/${id}`),
}

// ==================== 笔记 API ====================
export const noteAPI = {
  listGeneralNotes: (params) => apiClient.get('/notes/general', { params }),
  getGeneralNote: (id) => apiClient.get(`/notes/general/${id}`),
  createGeneralNote: (data) => apiClient.post('/notes/general', data),
  updateGeneralNote: (id, data) => apiClient.put(`/notes/general/${id}`, data),
  deleteGeneralNote: (id) => apiClient.delete(`/notes/general/${id}`),

  listTemplates: (params) => apiClient.get('/notes/templates', { params }),
  getTemplate: (id) => apiClient.get(`/notes/templates/${id}`),
  createTemplate: (data) => apiClient.post('/notes/templates', data),
  updateTemplate: (id, data) => apiClient.put(`/notes/templates/${id}`, data),
  deleteTemplate: (id) => apiClient.delete(`/notes/templates/${id}`),
}

// ==================== 组织 API ====================
export const organizationAPI = {
  listTags: (params) => apiClient.get('/organization/tags', { params }),
  getTag: (id) => apiClient.get(`/organization/tags/${id}`),
  createTag: (data) => apiClient.post('/organization/tags', data),
  updateTag: (id, data) => apiClient.put(`/organization/tags/${id}`, data),
  deleteTag: (id) => apiClient.delete(`/organization/tags/${id}`),

  listCollections: (params) => apiClient.get('/organization/collections', { params }),
  getCollection: (id) => apiClient.get(`/organization/collections/${id}`),
  createCollection: (data) => apiClient.post('/organization/collections', data),
  updateCollection: (id, data) => apiClient.put(`/organization/collections/${id}`, data),
  deleteCollection: (id) => apiClient.delete(`/organization/collections/${id}`),

  listCollectionItems: (params) => apiClient.get('/organization/collection-items', { params }),
  getCollectionItem: (id) => apiClient.get(`/organization/collection-items/${id}`),
  createCollectionItem: (data) => apiClient.post('/organization/collection-items', data),
  updateCollectionItem: (id, data) => apiClient.put(`/organization/collection-items/${id}`, data),
  deleteCollectionItem: (id) => apiClient.delete(`/organization/collection-items/${id}`),

  listJournalGroups: (params) => apiClient.get('/organization/journal-groups', { params }),
  getJournalGroup: (id) => apiClient.get(`/organization/journal-groups/${id}`),
  createJournalGroup: (data) => apiClient.post('/organization/journal-groups', data),
  updateJournalGroup: (id, data) => apiClient.put(`/organization/journal-groups/${id}`, data),
  deleteJournalGroup: (id) => apiClient.delete(`/organization/journal-groups/${id}`),

  listKeywordGroups: (params) => apiClient.get('/organization/keyword-groups', { params }),
  getKeywordGroup: (id) => apiClient.get(`/organization/keyword-groups/${id}`),
  createKeywordGroup: (data) => apiClient.post('/organization/keyword-groups', data),
  updateKeywordGroup: (id, data) => apiClient.put(`/organization/keyword-groups/${id}`, data),
  deleteKeywordGroup: (id) => apiClient.delete(`/organization/keyword-groups/${id}`),
}

// ==================== 翻译 API ====================
export const translationAPI = {
  listCards: (params) => apiClient.get('/translation/cards', { params }),
  getCard: (id) => apiClient.get(`/translation/cards/${id}`),
  createCard: (data) => apiClient.post('/translation/cards', data),
  updateCard: (id, data) => apiClient.put(`/translation/cards/${id}`, data),
  deleteCard: (id) => apiClient.delete(`/translation/cards/${id}`),
}

export default apiClient
