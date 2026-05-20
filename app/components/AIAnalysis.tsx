'use client'

import { useState, useEffect, useRef } from 'react'
import { CONTRACT_DOCUMENT_TYPES } from '@/app/lib/documentTypes'

interface RedFlag {
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  recommendation: string
}

interface LegalReview {
  red_flags: RedFlag[]
  warnings: { title: string; description: string }[]
  positives: { title: string; description: string }[]
  overall_risk: 'high' | 'medium' | 'low'
  summary: string
}

interface Passport {
  essence: string
  parties: {
    our_obligations: string[]
    counterparty_obligations: string[]
  }
  key_terms: {
    amount: string
    payment_terms: string
    start_date: string
    end_date: string
    auto_renewal: string
  }
  termination: string
  control_points: string[]
  attention_zones: string[]
}

interface Analysis {
  id: string
  type: string
  status: string
  result_json: LegalReview | Passport | { error: string } | null
  created_at: string
  model_used: string
  version_id: string | null
  attachment_id: string | null
}

interface DocumentReview {
  summary: string
  purpose: string
  attention_points: string[]
  recommendations: string[]
  document_type: string
  urgency: 'high' | 'medium' | 'low'
}

interface ChatMessage {
  id: string
  role: string
  message: string
  user_name: string
  created_at: string
}

interface Version {
  id: string
  file_url: string
  file_name: string
  version_number: number
}

interface Attachment {
  id: string
  attachment_type: string
  number: number
  title: string | null
  file_name: string
  file_url: string
}

interface Props {
  contractId: string
  versions: Version[]
  attachments?: Attachment[]
  userName?: string
  userId?: number
  documentType?: string | null
  documentCategory?: string | null
  contractStatus?: string
  sessionParticipantBitrixIds?: number[]
  onStatusChange?: (newStatus: string) => void
}

const RISK_COLORS = {
  high: 'bg-red-50 border-red-200 text-red-800',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  low: 'bg-blue-50 border-blue-200 text-blue-800',
}

const RISK_ICONS = {
  high: '🔴',
  medium: '🟡',
  low: '🔵',
}

const RISK_LABELS = {
  high: 'Высокий риск',
  medium: 'Средний риск',
  low: 'Низкий риск',
}

export default function AIAnalysis({ contractId, versions, attachments = [], userName, userId, documentType, documentCategory, contractStatus, sessionParticipantBitrixIds = [], onStatusChange }: Props) {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'legal_review' | 'passport' | 'chat' | 'document_review'>('legal_review')
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatQuestion, setChatQuestion] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const baseUrl = 'https://epotos-ur-intel.vercel.app'

  useEffect(() => {
    if (versions.length > 0) {
      setSelectedVersion(versions[0].id)
    }
    loadAnalyses()
    loadChat()
  }, [contractId])

  useEffect(() => {
    setActiveTab('legal_review')
    setChatMessages([])
    setChatQuestion('')
  }, [selectedVersion])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const loadAnalyses = async () => {
    const res = await fetch(`${baseUrl}/api/ai-analysis?contract_id=${contractId}`)
    const data = await res.json()
    setAnalyses(data.analyses ?? [])
  }

  const loadChat = async () => {
    const res = await fetch(`${baseUrl}/api/ai-chat?contract_id=${contractId}`)
    const data = await res.json()
    setChatMessages(data.messages ?? [])
  }

  const runAnalysis = async (type: string) => {
    if (!selectedVersion) return
    setAnalyzing(type)
    try {
      const isAttachment = selectedVersion.startsWith('att_')
      let fileUrl = ''
      let fileName = ''
      let versionId = null
      let attachmentId = null

      if (isAttachment) {
        const att = attachments.find(a => `att_${a.id}` === selectedVersion)
        if (!att) return
        fileUrl = att.file_url
        fileName = att.file_name
        attachmentId = att.id
      } else {
        const version = versions.find(v => v.id === selectedVersion)
        if (!version) return
        fileUrl = version.file_url
        fileName = version.file_name
        versionId = version.id
      }

      const res = await fetch(`${baseUrl}/api/ai-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          version_id: versionId,
          attachment_id: attachmentId,
          file_url: fileUrl,
          file_name: fileName,
          analysis_type: type,
          user_name: userName ?? 'Система',
        }),
      })
      const data = await res.json()
      if (data.success) {
        await loadAnalyses()
        setActiveTab(type as 'legal_review' | 'passport' | 'document_review')
      } else {
        alert('Ошибка анализа: ' + (data.error ?? 'Неизвестная ошибка'))
      }
    } catch {
      alert('Ошибка соединения')
    } finally {
      setAnalyzing(null)
    }
  }

  const sendChatMessage = async () => {
    if (!chatQuestion.trim() || chatLoading) return
    const question = chatQuestion.trim()
    setChatQuestion('')
    setChatLoading(true)

    const isAttachment = selectedVersion.startsWith('att_')
    let fileUrl = ''
    let fileName = ''
    let versionId = null

    if (isAttachment) {
      const att = attachments.find(a => `att_${a.id}` === selectedVersion)
      if (att) { fileUrl = att.file_url; fileName = att.file_name }
    } else {
      const version = versions.find(v => v.id === selectedVersion)
      if (version) { fileUrl = version.file_url; fileName = version.file_name; versionId = version.id }
    }

    try {
      const res = await fetch(`${baseUrl}/api/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          version_id: versionId,
          question,
          file_url: fileUrl || null,
          file_name: fileName || null,
          user_name: userName ?? 'Пользователь',
          bitrix_user_id: userId ?? null,
        }),
      })
      const data = await res.json()
      if (data.success) await loadChat()
    } catch {
      alert('Ошибка соединения')
    } finally {
      setChatLoading(false)
    }
  }

  const isAttachment = selectedVersion.startsWith('att_')
  const currentAttId = isAttachment ? selectedVersion.replace('att_', '') : null

  const latestReview = analyses.find(a =>
    (a.type === 'legal_review' || a.type === 'document_review') &&
    a.status === 'completed' &&
    (isAttachment ? a.attachment_id === currentAttId : a.version_id === selectedVersion)
  )
  const latestPassport = analyses.find(a =>
    a.type === 'passport' &&
    a.status === 'completed' &&
    (isAttachment ? a.attachment_id === currentAttId : a.version_id === selectedVersion)
  )

  const renderLegalReview = (result: LegalReview) => (
    <div className="space-y-4">
      <div className={`rounded-lg border px-4 py-3 ${RISK_COLORS[result.overall_risk]}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{RISK_ICONS[result.overall_risk]}</span>
          <div>
            <p className="text-sm font-semibold">Общий уровень риска: {RISK_LABELS[result.overall_risk]}</p>
            <p className="text-xs mt-0.5">{result.summary}</p>
          </div>
        </div>
      </div>
      {result.red_flags?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">⚠️ Риски</h4>
          <div className="space-y-2">
            {result.red_flags.map((flag, i) => (
              <div key={i} className={`rounded-lg border p-3 ${RISK_COLORS[flag.severity]}`}>
                <div className="flex items-start gap-2">
                  <span>{RISK_ICONS[flag.severity]}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{flag.title}</p>
                    <p className="text-xs mt-0.5">{flag.description}</p>
                    {flag.recommendation && <p className="text-xs mt-1 italic">💡 {flag.recommendation}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {result.warnings?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">📋 Замечания</h4>
          <div className="space-y-2">
            {result.warnings.map((w, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-800">{w.title}</p>
                <p className="text-xs text-gray-600 mt-0.5">{w.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {result.positives?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">✅ Защита интересов</h4>
          <div className="space-y-2">
            {result.positives.map((p, i) => (
              <div key={i} className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-sm font-medium text-green-800">{p.title}</p>
                <p className="text-xs text-green-700 mt-0.5">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderDocumentReview = (result: DocumentReview) => (
    <div className="space-y-4">
      <div className={`rounded-lg border px-4 py-3 ${result.urgency === 'high' ? RISK_COLORS.high : result.urgency === 'medium' ? RISK_COLORS.medium : RISK_COLORS.low}`}>
        <p className="text-sm font-semibold">Тип: {result.document_type}</p>
        <p className="text-xs mt-0.5">{result.summary}</p>
      </div>
      {result.attention_points?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-yellow-800 mb-2">⚡ Зоны внимания</h4>
          <ul className="space-y-1">
            {result.attention_points.map((p, i) => (
              <li key={i} className="text-xs text-yellow-800">• {p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )

  const renderPassport = (result: Passport) => (
    <div className="space-y-4">
      {result.essence && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-1">📋 Суть договора</h4>
          <p className="text-xs text-gray-600">{result.essence}</p>
        </div>
      )}
      {result.key_terms && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">💰 Ключевые условия</h4>
          <div className="space-y-1">
            {result.key_terms.amount && <p className="text-xs text-gray-600">Сумма: {result.key_terms.amount}</p>}
            {result.key_terms.payment_terms && <p className="text-xs text-gray-600">Оплата: {result.key_terms.payment_terms}</p>}
            {result.key_terms.start_date && <p className="text-xs text-gray-600">Начало: {result.key_terms.start_date}</p>}
            {result.key_terms.end_date && <p className="text-xs text-gray-600">Окончание: {result.key_terms.end_date}</p>}
          </div>
        </div>
      )}
      {result.parties && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">🤝 Обязательства сторон</h4>
          {result.parties.our_obligations?.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-gray-600 mb-1">Наши обязательства:</p>
              <ul className="space-y-0.5">
                {result.parties.our_obligations.map((o, i) => <li key={i} className="text-xs text-gray-600">• {o}</li>)}
              </ul>
            </div>
          )}
          {result.parties.counterparty_obligations?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Обязательства контрагента:</p>
              <ul className="space-y-0.5">
                {result.parties.counterparty_obligations.map((o, i) => <li key={i} className="text-xs text-gray-600">• {o}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      {result.control_points?.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-blue-800 mb-2">📌 Точки контроля</h4>
          <ul className="space-y-1">
            {result.control_points.map((p, i) => <li key={i} className="text-xs text-blue-800">• {p}</li>)}
          </ul>
        </div>
      )}
      {result.attention_zones?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-yellow-800 mb-2">⚡ Зоны внимания</h4>
          <ul className="space-y-1">
            {result.attention_zones.map((z, i) => <li key={i} className="text-xs text-yellow-800">• {z}</li>)}
          </ul>
        </div>
      )}
      {result.termination && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-1">🚪 Расторжение</h4>
          <p className="text-xs text-gray-600">{result.termination}</p>
        </div>
      )}
    </div>
  )

  if (versions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">🤖 EpotosGPT — AI анализ</h2>
        <p className="text-sm text-gray-400">Загрузите документ чтобы запустить AI анализ</p>
      </div>
    )
  }

  return (
    <div>
      {/* Заголовок */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">EpotosGPT — AI анализ документа</h2>
        <p className="text-xs text-gray-500">Выберите документ и запустите нужный анализ</p>
      </div>

      {/* Выбор версии и запуск */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-gray-500 mb-1">Документ для анализа</label>
            <select value={selectedVersion}
              onChange={e => setSelectedVersion(e.target.value)}
              onBlur={e => setSelectedVersion(e.target.value)}
              size={1}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-900">
              {versions.length > 0 && (
                <optgroup label="Версии документа">
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>v{v.version_number} — {v.file_name}</option>
                  ))}
                </optgroup>
              )}
              {attachments.length > 0 && (
                <optgroup label="Дополнительные материалы">
                  {attachments.map(a => (
                    <option key={`att_${a.id}`} value={`att_${a.id}`}>
                      {a.attachment_type} №{a.number}{a.title ? ` — ${a.title}` : ''} ({a.file_name})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="flex flex-col gap-2 pt-4">
            {(documentCategory === 'contract' || CONTRACT_DOCUMENT_TYPES.includes(documentType ?? '')) ? (
              <>
                <button onClick={() => runAnalysis('legal_review')} disabled={!!analyzing}
                  className="text-xs font-medium bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5">
                  🔍 {analyzing === 'legal_review' ? 'Анализируется...' : 'Запустить Legal Review'}
                </button>
                <button onClick={() => runAnalysis('passport')} disabled={!!analyzing}
                  className="text-xs font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5">
                  📄 {analyzing === 'passport' ? 'Создаётся...' : 'Создать паспорт документа'}
                </button>
              </>
            ) : (
              <button onClick={() => runAnalysis('document_review')} disabled={!!analyzing}
                className="text-xs font-medium bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5">
                📝 {analyzing === 'document_review' ? 'Анализируется...' : 'Анализировать документ'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Вкладки результатов */}
      {(latestReview || latestPassport) && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Результаты анализа</p>
          <div className="flex gap-2 border-b border-gray-200">
            {latestReview && (
              <button onClick={() => setActiveTab('legal_review')}
                className={`text-sm px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'legal_review' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                🔍 Legal Review
              </button>
            )}
            {latestPassport && (
              <button onClick={() => setActiveTab('passport')}
                className={`text-sm px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'passport' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                📄 Паспорт документа
              </button>
            )}
            <button onClick={() => setActiveTab('chat')}
              className={`text-sm px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'chat' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              💬 Чат с AI
            </button>
          </div>
        </div>
      )}

      {!(latestReview || latestPassport) && (
        <div className="mb-4">
          <div className="flex gap-2 border-b border-gray-200">
            <button onClick={() => setActiveTab('chat')}
              className={`text-sm px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'chat' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              💬 Чат с AI
            </button>
          </div>
        </div>
      )}

      {analyzing && activeTab !== 'chat' && (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">🤖</div>
          <p className="text-sm text-gray-600">AI анализирует документ...</p>
          <p className="text-xs text-gray-400 mt-1">Это может занять 20-40 секунд</p>
        </div>
      )}

      {!analyzing && activeTab !== 'chat' && latestReview && latestReview.type === 'document_review' && (
        <div>
          <p className="text-xs text-gray-400 mb-3">
            Анализ от {new Date(latestReview.created_at).toLocaleString('ru-RU')} · {latestReview.model_used}
          </p>
          {renderDocumentReview(latestReview.result_json as unknown as DocumentReview)}
        </div>
      )}

      {!analyzing && activeTab === 'legal_review' && latestReview && latestReview.type !== 'document_review' && (
        <div>
          <p className="text-xs text-gray-400 mb-3">
            Анализ от {new Date(latestReview.created_at).toLocaleString('ru-RU')} · {latestReview.model_used}
          </p>
          {renderLegalReview(latestReview.result_json as LegalReview)}
        </div>
      )}

      {!analyzing && activeTab === 'passport' && latestPassport && (
        <div>
          <p className="text-xs text-gray-400 mb-3">
            Создан {new Date(latestPassport.created_at).toLocaleString('ru-RU')} · {latestPassport.model_used}
          </p>
          {renderPassport(latestPassport.result_json as Passport)}
        </div>
      )}

      {!analyzing && !latestReview && !latestPassport && activeTab !== 'chat' && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400">Нажмите кнопку для запуска анализа</p>
          <p className="text-xs text-gray-300 mt-1">Legal Review найдёт риски · Паспорт создаст краткое резюме</p>
        </div>
      )}

      {/* EpotosGPT чат */}
      {activeTab === 'chat' && (
        <div className="mt-2">
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
            <div className="bg-white rounded-lg border border-purple-100 p-3 space-y-3 max-h-64 overflow-y-auto mb-3">
              {chatMessages.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  Задайте вопрос по документу — EpotosGPT ответит на основе содержимого файла
                </p>
              ) : chatMessages.map(msg => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${msg.role === 'assistant' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {msg.role === 'assistant' ? 'AI' : (userName ?? 'П').charAt(0).toUpperCase()}
                  </div>
                  <div className={`flex-1 max-w-xs ${msg.role === 'user' ? 'items-end' : ''}`}>
                    <div className={`text-xs rounded-xl px-3 py-2 inline-block ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
                      {msg.message}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 px-1">
                      {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatQuestion}
                onChange={e => setChatQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                placeholder="Задайте вопрос по документу..."
                className="flex-1 text-xs border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white"
              />
              <button onClick={sendChatMessage} disabled={chatLoading || !chatQuestion.trim()}
                className="text-xs bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap">
                {chatLoading ? '...' : 'Спросить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}