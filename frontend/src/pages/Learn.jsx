/**
 * 学习页面 - 全屏沉浸式单词学习
 * 支持：六种题型、艾宾浩斯复习、进度保存、断点续传
 */
import { useState, useEffect } from 'react'
import useAppStore from '../stores/useAppStore'
import { learningAPI } from '../api/client'
import { WORD_QUEUE_LENGTHS } from '../utils/constants'

const QUESTION_TYPES = {
  en_select_cn: { name: '英选中' },
  cn_select_en: { name: '中选英' },
  en_select_def: { name: '英选定义' },
  def_select_en: { name: '定义选英' },
  sent_select_cn: { name: '例句选中' },
  sent_select_def: { name: '例句选定义' },
}

function Learn() {
  const [queueLength, setQueueLength] = useState(10)
  const [mode, setMode] = useState(null)

  const startLearn = () => {
    console.log('开始学习，队列长度:', queueLength)
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">学习中心</h1>
      <p className="mt-2">队列长度设置:</p>
      <div className="flex gap-2 mt-2">
        {WORD_QUEUE_LENGTHS.map(n => (
          <button 
            key={n} 
            onClick={() => setQueueLength(n)}
            className={`px-4 py-2 rounded ${queueLength === n ? 'bg-red-800 text-white' : 'bg-gray-200'}`}
          >
            {n}个
          </button>
        ))}
      </div>
      <button 
        onClick={startLearn}
        className="mt-4 bg-red-800 text-white px-6 py-3 rounded-lg"
      >
        开始学习 ({queueLength}个/组)
      </button>
    </div>
  )
}

export default Learn
