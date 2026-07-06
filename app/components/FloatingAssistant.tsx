'use client'

import { useState, useRef, useEffect } from 'react'
import { useDocumentContext } from '@/app/context/DocumentContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: { title: string; similarity: number }[]
}

const coreUrl = 'https://epotos-core.vercel.app'

export default function FloatingAssistant() {
  const { currentDocument } = useDocumentContext()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    // Прикладываем контекст текущего документа, если он открыт
    const contextPrefix = currentDocument
      ? `[Контекст: сейчас пользователь просматривает документ ${currentDocument.number} — ${currentDocument.title}, статус: ${currentDocument.status}]\n\n`
      : ''

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch(`${coreUrl}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: contextPrefix + userMessage, module: 'юринтел', history }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer ?? 'Не удалось получить ответ',
        sources: data.sources,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Ошибка соединения с ассистентом. Попробуйте позже.',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Плавающая кнопка */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-800 transition-colors flex items-center justify-center text-2xl"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Панель чата */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-96 max-w-[calc(100vw-2rem)] h-[500px] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-semibold">🤖 ЭПОТОС-Ассистент</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
          </div>

          {currentDocument && (
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex-shrink-0">
              <p className="text-xs text-blue-700">
                📄 Контекст: {currentDocument.number} — {currentDocument.title}
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center mt-8 px-2">
                <p className="text-sm text-gray-400">
                  Задайте вопрос об ЮрИнтел{currentDocument ? ' или об этом документе' : ''} — я постараюсь помочь
                </p>
                {currentDocument && (
                  <p className="text-xs text-gray-300 mt-3">
                    💡 Чтобы спросить про содержание самого договора (пункты, условия, суммы) — используйте вкладку <b>EpotosGPT → Чат с AI</b> в карточке документа
                  </p>
                )}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-3 py-2 text-sm text-gray-400">Думаю...</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="p-3 border-t border-gray-200 flex-shrink-0 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Написать вопрос..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      )}
    </>
  )
}