/**
 * 配对码弹窗组件
 * 支持Hub模式（显示配对码+二维码）和Leaf模式（输入配对码）
 */
import { useState, useEffect, useRef } from 'react'
import { pairingAPI } from '../api/client'

// 简单二维码生成器（纯JS实现，无需外部依赖）
function generateQRCode(data) {
  // 使用简单的QR码库或SVG生成
  // 这里使用一个简单的占位符，实际使用时可用qrcode.react库
  return `data:image/svg+xml;base64,${btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="white"/>
      <rect x="20" y="20" width="60" height="60" fill="black"/>
      <rect x="30" y="30" width="40" height="40" fill="white"/>
      <rect x="40" y="40" width="20" height="20" fill="black"/>
      <rect x="120" y="20" width="60" height="60" fill="black"/>
      <rect x="130" y="30" width="40" height="40" fill="white"/>
      <rect x="140" y="40" width="20" height="20" fill="black"/>
      <rect x="20" y="120" width="60" height="60" fill="black"/>
      <rect x="30" y="130" width="40" height="40" fill="white"/>
      <rect x="40" y="140" width="20" height="20" fill="black"/>
      <rect x="90" y="90" width="20" height="20" fill="black"/>
      <rect x="120" y="120" width="20" height="20" fill="black"/>
      <rect x="150" y="120" width="20" height="20" fill="black"/>
      <rect x="120" y="150" width="20" height="20" fill="black"/>
      <rect x="150" y="150" width="30" height="30" fill="black"/>
    </svg>
  `)}`
}

export default function PairingModal({ isOpen, onClose, mode: initialMode = 'leaf', relayUrl = null }) {
  // mode: 'hub' 显示配对码, 'leaf' 输入配对码
  const [mode, setMode] = useState(initialMode)
  const [pairingCode, setPairingCode] = useState(null)
  const [psk, setPsk] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const [timeLeft, setTimeLeft] = useState(120)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  
  // Leaf模式输入
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', ''])
  const inputRefs = useRef([])

  // Hub模式：生成配对码
  const generateCode = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await pairingAPI.generateCode()
      setPairingCode(result.code)
      setPsk(result.psk)
      setExpiresAt(result.expires_at)
      setTimeLeft(120)
    } catch (err) {
      setError(err.message || '生成配对码失败')
    } finally {
      setLoading(false)
    }
  }

  // Hub模式：刷新配对码
  const refreshCode = () => {
    setPairingCode(null)
    setPsk(null)
    generateCode()
  }

  // Leaf模式：连接
  const handleConnect = async () => {
    const code = codeDigits.join('')
    if (code.length !== 6) {
      setError('请输入完整的6位配对码')
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      const result = await pairingAPI.connectWithCode(code, {
        device_name: 'Leaf Device',
        device_type: 'desktop'
      })
      if (result.success) {
        setSuccess(true)
        // 保存连接信息到localStorage
        localStorage.setItem('relayConnection', JSON.stringify({
          hub_device_id: result.hub_device_id,
          psk: result.psk,
          hub_info: result.hub_info,
          via_relay: result.via_relay
        }))
        setTimeout(() => {
          onClose()
          window.location.reload()
        }, 1500)
      }
    } catch (err) {
      setError(err.message || '连接失败，配对码可能已过期')
    } finally {
      setLoading(false)
    }
  }

  // 处理数字输入
  const handleDigitChange = (index, value) => {
    // 只允许数字
    const digit = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...codeDigits]
    newDigits[index] = digit
    setCodeDigits(newDigits)
    
    // 自动跳到下一个输入框
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
    
    // 自动提交
    if (index === 5 && digit) {
      const fullCode = newDigits.slice(0, 5).join('') + digit
      if (fullCode.length === 6) {
        handleConnect()
      }
    }
  }

  // 处理键盘事件
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  // 粘贴处理
  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const newDigits = pasted.split('')
      setCodeDigits(newDigits)
      handleConnect()
    }
  }

  // 倒计时
  useEffect(() => {
    if (!expiresAt) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor(expiresAt - Date.now() / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) {
        setPairingCode(null)
        setPsk(null)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  // 初始化Hub模式
  useEffect(() => {
    if (isOpen && mode === 'hub' && !pairingCode && !loading) {
      generateCode()
    }
  }, [isOpen, mode])

  if (!isOpen) return null

  // 格式化配对码显示（每2位一组）
  const formatCode = (code) => {
    if (!code) return '------'
    return `${code.slice(0, 2)} ${code.slice(2, 4)} ${code.slice(4, 6)}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-500 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            {mode === 'hub' ? '📱 添加新设备' : '🔗 连接Hub'}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* 模式切换 */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('hub')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                mode === 'hub' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              我是Hub
            </button>
            <button
              onClick={() => setMode('leaf')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                mode === 'leaf' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              我是Leaf
            </button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* 成功提示 */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
              ✅ 连接成功！正在刷新页面...
            </div>
          )}

          {/* Hub模式：显示配对码 */}
          {mode === 'hub' && (
            <div className="text-center">
              {!pairingCode ? (
                <div className="py-8">
                  {loading ? (
                    <div className="text-gray-500">正在生成配对码...</div>
                  ) : (
                    <button
                      onClick={generateCode}
                      className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      生成配对码
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-gray-600 mb-4">请在新设备上输入配对码：</p>
                  
                  {/* 配对码显示 */}
                  <div className="text-4xl font-mono font-bold tracking-wider text-blue-600 mb-6">
                    {formatCode(pairingCode)}
                  </div>

                  {/* 二维码 */}
                  <div className="mb-6">
                    <p className="text-gray-500 text-sm mb-2">或扫描二维码：</p>
                    <div className="inline-block p-4 bg-white rounded-lg border border-gray-200">
                      <img 
                        src={generateQRCode(pairingCode)} 
                        alt="配对码二维码"
                        className="w-40 h-40"
                      />
                    </div>
                  </div>

                  {/* 倒计时 */}
                  <div className={`text-lg font-medium ${timeLeft <= 30 ? 'text-red-500' : 'text-gray-500'}`}>
                    ⏱ {timeLeft}秒后过期
                  </div>

                  {/* 刷新按钮 */}
                  <button
                    onClick={refreshCode}
                    className="mt-4 text-blue-500 hover:text-blue-600 text-sm"
                  >
                    🔄 刷新配对码
                  </button>
                </>
              )}
            </div>
          )}

          {/* Leaf模式：输入配对码 */}
          {mode === 'leaf' && (
            <div className="text-center">
              <p className="text-gray-600 mb-6">输入Hub上显示的6位配对码：</p>
              
              {/* 配对码输入框 */}
              <div 
                className="flex justify-center gap-2 mb-6"
                onPaste={handlePaste}
              >
                {codeDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => inputRefs.current[index] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                  />
                ))}
              </div>

              {/* 连接按钮 */}
              <button
                onClick={handleConnect}
                disabled={loading || codeDigits.join('').length !== 6}
                className={`w-full py-3 rounded-lg font-medium transition-colors ${
                  loading || codeDigits.join('').length !== 6
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {loading ? '连接中...' : '连接'}
              </button>

              {/* 提示 */}
              <p className="mt-4 text-gray-500 text-sm">
                💡 在Hub设备上点击"添加设备"获取配对码
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 text-center text-gray-500 text-xs">
          {relayUrl ? `通过 ${relayUrl} 中继` : '同一网络直连'}
        </div>
      </div>
    </div>
  )
}
