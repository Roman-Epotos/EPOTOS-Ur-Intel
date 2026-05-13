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

interface ChecklistItem {
  id: string
  item_order: number
  category: string
  title: string
  description: string | null
  due_date: string | null
  responsible: string | null
  is_done: boolean
  done_at: string | null
  done_by_name: string | null
  done_by_bitrix_id: number | null
  created_at: string
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
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'legal_review' | 'passport' | 'chat' | 'document_review' | 'checklist'>('legal_review')
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatQuestion, setChatQuestion] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Чек-лист
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [generatingChecklist, setGeneratingChecklist] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('other')
  const [newItemDueDate, setNewItemDueDate] = useState('')
  const [newItemResponsible, setNewItemResponsible] = useState('')

  // Права на чек-лист
  const adminIds = [30, 1148]
  const gcManagerIds = [1, 246, 504]
  const canManageChecklist = userId
    ? adminIds.includes(userId) || gcManagerIds.includes(userId) || sessionParticipantBitrixIds.includes(userId)
    : false

  const baseUrl = 'https://epotos-ur-intel.vercel.app'

  useEffect(() => {
    if (versions.length > 0) {
      setSelectedVersion(versions[0].id)
    }
    loadAnalyses()
    loadChat()
    loadChecklist()
  }, [contractId])

  useEffect(() => {
    setActiveTab('legal_review')
    // Сбрасываем чат при смене документа
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

  const loadChecklist = async () => {
    const res = await fetch(`${baseUrl}/api/contract-checklist?contract_id=${contractId}`)
    const data = await res.json()
    setChecklistItems(data.items ?? [])
  }

  const generateChecklist = async () => {
    if (!selectedVersion || selectedVersion.startsWith('att_')) {
      alert('Выберите основной документ (версию договора) для генерации чек-листа')
      return
    }
    const version = versions.find(v => v.id === selectedVersion)
    if (!version) return

    if (!confirm('Сгенерировать AI чек-лист исполнения?\n\nВнимание: если чек-лист уже существует — он будет пересоздан.\nСтатус документа изменится на «на_исполнении».')) return

    setGeneratingChecklist(true)
    try {
      const res = await fetch(`${baseUrl}/api/contract-checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          file_url: version.file_url,
          file_name: version.file_name,
          user_name: userName ?? 'Система',
        }),
      })
      const data = await res.json()
      if (data.success) {
        await loadChecklist()
        setActiveTab('checklist')
        onStatusChange?.('на_исполнении')
      } else {
        alert('Ошибка: ' + data.error)
      }
    } catch {
      alert('Ошибка соединения')
    } finally {
      setGeneratingChecklist(false)
    }
  }

  const toggleChecklistItem = async (item: ChecklistItem) => {
    const newDone = !item.is_done
    setChecklistItems(prev => prev.map(i =>
      i.id === item.id
        ? { ...i, is_done: newDone, done_by_name: newDone ? (userName ?? null) : null }
        : i
    ))
    const res = await fetch(`${baseUrl}/api/contract-checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toggle',
        item_id: item.id,
        contract_id: contractId,
        is_done: newDone,
        title: item.title,
        user_name: userName ?? 'Система',
        bitrix_user_id: userId ?? null,
      }),
    })
    if (!res.ok) {
      setChecklistItems(prev => prev.map(i => i.id === item.id ? { ...i, is_done: item.is_done } : i))
      alert('Ошибка при обновлении')
    }
  }

  const deleteChecklistItem = async (item: ChecklistItem) => {
    if (!confirm(`Удалить пункт «${item.title}»?`)) return
    setChecklistItems(prev => prev.filter(i => i.id !== item.id))
    await fetch(`${baseUrl}/api/contract-checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_item',
        item_id: item.id,
        contract_id: contractId,
        title: item.title,
        user_name: userName ?? 'Система',
      }),
    })
  }

  const addChecklistItem = async () => {
    if (!newItemTitle.trim()) { alert('Введите название пункта'); return }
    setChecklistLoading(true)
    const res = await fetch(`${baseUrl}/api/contract-checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_item',
        contract_id: contractId,
        title: newItemTitle.trim(),
        description: newItemDescription.trim() || null,
        category: newItemCategory,
        due_date: newItemDueDate || null,
        responsible: newItemResponsible || null,
        user_name: userName ?? 'Система',
      }),
    })
    const data = await res.json()
    if (data.success) {
      await loadChecklist()
      setShowAddItem(false)
      setNewItemTitle('')
      setNewItemDescription('')
      setNewItemCategory('other')
      setNewItemDueDate('')
      setNewItemResponsible('')
    } else {
      alert('Ошибка: ' + data.error)
    }
    setChecklistLoading(false)
  }

  const runAnalysis = async (type: 'legal_review' | 'passport' | 'document_review') => {
    if (!selectedVersion) {
      alert('Выберите документ для анализа')
      return
    }

    let fileUrl = ''
    let fileName = ''
    let versionId = selectedVersion

    let attachmentId: string | null = null

    if (selectedVersion.startsWith('att_')) {
      const attId = selectedVersion.replace('att_', '')
      const att = attachments.find(a => a.id === attId)
      if (!att) return
      fileUrl = att.file_url
      fileName = att.file_name
      versionId = ''       // не используется для вложений
      attachmentId = attId // сохраняем отдельно
    } else {
      const version = versions.find(v => v.id === selectedVersion)
      if (!version) return
      fileUrl = version.file_url
      fileName = version.file_name
      versionId = version.id
    }

    setAnalyzing(type)

    try {
      const res = await fetch(`${baseUrl}/api/ai-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          version_id: attachmentId ? null : versionId,
          attachment_id: attachmentId ?? null,
          file_url: fileUrl,
          file_name: fileName,
          analysis_type: type,
          user_name: userName ?? 'Система',
        }),
      })

      const data = await res.json()
      if (data.success) {
        await loadAnalyses()
        setActiveTab(type)
      } else {
        alert('Ошибка анализа: ' + data.error)
      }
    } catch {
      alert('Ошибка соединения')
    } finally {
      setAnalyzing(null)
    }
  }

  const handleChatQuestion = async () => {
    if (!chatQuestion.trim() || chatLoading) return
    const question = chatQuestion
    setChatQuestion('')
    setChatLoading(true)

    const version = versions.find(v => v.id === selectedVersion)

    const tempUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      message: question,
      user_name: userName ?? 'Пользователь',
      created_at: new Date().toISOString(),
    }
    setChatMessages(prev => [...prev, tempUserMsg])

    const res = await fetch(`${baseUrl}/api/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract_id: contractId,
        version_id: selectedVersion,
        file_url: version?.file_url,
        file_name: version?.file_name,
        question,
        user_name: userName ?? 'Пользователь',
        bitrix_user_id: userId ?? null,
      }),
    })

    const data = await res.json()
    if (data.success) {
      const tempAiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        message: data.answer,
        user_name: 'EpotosGPT',
        created_at: new Date().toISOString(),
      }
      setChatMessages(prev => [...prev, tempAiMsg])
    }
    setChatLoading(false)
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
      <div className={`rounded-lg border px-4 py-3 ${result.urgency === 'high' ? 'bg-red-50 border-red-200' : result.urgency === 'medium' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
        <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Тип документа</p>
        <p className="text-sm font-medium text-gray-900">{result.document_type}</p>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">📋 Краткое содержание</h4>
        <p className="text-sm text-blue-900">{result.summary}</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">🎯 Цель документа</h4>
        <p className="text-sm text-gray-900">{result.purpose}</p>
      </div>
      {result.attention_points?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-yellow-800 mb-2 uppercase tracking-wide">⚡ Требуют внимания</h4>
          <ul className="space-y-1">
            {result.attention_points.map((p, i) => <li key={i} className="text-xs text-yellow-900">• {p}</li>)}
          </ul>
        </div>
      )}
      {result.recommendations?.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-green-800 mb-2 uppercase tracking-wide">✅ Рекомендации</h4>
          <ul className="space-y-1">
            {result.recommendations.map((r, i) => <li key={i} className="text-xs text-green-900">• {r}</li>)}
          </ul>
        </div>
      )}
    </div>
  )

  const renderPassport = (result: Passport) => (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">📄 Суть договора</h4>
        <p className="text-sm text-blue-900">{result.essence}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">💰 Ключевые условия</h4>
        <div className="space-y-1.5">
          {Object.entries(result.key_terms ?? {}).map(([key, value]) => {
            const labels: Record<string, string> = {
              amount: 'Сумма',
              payment_terms: 'Оплата',
              start_date: 'Начало',
              end_date: 'Окончание',
              auto_renewal: 'Автопролонгация',
            }
            return (
              <div key={key} className="flex gap-2">
                <span className="text-xs text-gray-500 w-28 flex-shrink-0">{labels[key] ?? key}:</span>
                <span className="text-xs text-gray-900">{value}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Наши обязательства</h4>
          <ul className="space-y-1">
            {result.parties?.our_obligations?.map((o, i) => (
              <li key={i} className="text-xs text-gray-600">• {o}</li>
            ))}
          </ul>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Обязательства контрагента</h4>
          <ul className="space-y-1">
            {result.parties?.counterparty_obligations?.map((o, i) => (
              <li key={i} className="text-xs text-gray-600">• {o}</li>
            ))}
          </ul>
        </div>
      </div>

      {result.control_points?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">🎯 Контрольные точки</h4>
          <ul className="space-y-1">
            {result.control_points.map((p, i) => (
              <li key={i} className="text-xs text-gray-600">• {p}</li>
            ))}
          </ul>
        </div>
      )}

      {result.attention_zones?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-yellow-800 mb-2">⚡ Зоны внимания</h4>
          <ul className="space-y-1">
            {result.attention_zones.map((z, i) => (
              <li key={i} className="text-xs text-yellow-800">• {z}</li>
            ))}
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
            {canManageChecklist && contractStatus === 'подписан' && !selectedVersion.startsWith('att_') && (
              <button onClick={generateChecklist} disabled={generatingChecklist}
                className="text-xs font-medium bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5">
                📋 {generatingChecklist ? 'AI генерирует чек-лист...' : checklistItems.length > 0 ? 'Перегенерировать чек-лист' : 'Создать чек-лист исполнения'}
              </button>
            )}
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

      {/* Результаты */}
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
            {checklistItems.length > 0 && (
              <button onClick={() => setActiveTab('checklist')}
                className={`text-sm px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'checklist' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                📋 Чек-лист ({checklistItems.filter(i => i.is_done).length}/{checklistItems.length})
              </button>
            )}
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
            {checklistItems.length > 0 && (
              <button onClick={() => setActiveTab('checklist')}
                className={`text-sm px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'checklist' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                📋 Чек-лист ({checklistItems.filter(i => i.is_done).length}/{checklistItems.length})
              </button>
            )}
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
          <p className="text-xs text-gray-300 mt-1">Legal Review найдёт риски · Паспорт создаст резюме</p>
        </div>
      )}

      {/* Чек-лист исполнения */}
      {activeTab === 'checklist' && (
        <div className="mt-2">
          {/* Прогресс-бар */}
          {checklistItems.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600">
                  Выполнено: {checklistItems.filter(i => i.is_done).length} из {checklistItems.length}
                </span>
                <span className="text-xs text-gray-400">
                  {Math.round(checklistItems.filter(i => i.is_done).length / checklistItems.length * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(checklistItems.filter(i => i.is_done).length / checklistItems.length * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Список пунктов */}
          <div className="space-y-2 mb-4">
            {checklistItems.map(item => {
              const catColors: Record<string, string> = {
                payment: 'bg-blue-50 border-blue-200 text-blue-700',
                delivery: 'bg-orange-50 border-orange-200 text-orange-700',
                deadline: 'bg-red-50 border-red-200 text-red-700',
                document: 'bg-purple-50 border-purple-200 text-purple-700',
                obligation: 'bg-yellow-50 border-yellow-200 text-yellow-700',
                other: 'bg-gray-50 border-gray-200 text-gray-600',
              }
              const catLabels: Record<string, string> = {
                payment: '💰 Оплата',
                delivery: '📦 Поставка',
                deadline: '⏰ Срок',
                document: '📄 Документы',
                obligation: '📌 Обязательство',
                other: '📋 Прочее',
              }
              return (
                <div key={item.id}
                  className={`rounded-lg border border-gray-200 bg-white p-3 transition-opacity ${item.is_done ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    {/* Чекбокс */}
                    <button
                      onClick={() => canManageChecklist && toggleChecklistItem(item)}
                      disabled={!canManageChecklist}
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        item.is_done
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : canManageChecklist
                            ? 'border-gray-300 hover:border-emerald-400'
                            : 'border-gray-200 cursor-not-allowed'
                      }`}>
                      {item.is_done && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </button>

                    {/* Контент */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${item.is_done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {item.title}
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${catColors[item.category] ?? catColors.other}`}>
                            {catLabels[item.category] ?? item.category}
                          </span>
                          {canManageChecklist && (
                            <button onClick={() => deleteChecklistItem(item)}
                              className="text-gray-300 hover:text-red-500 transition-colors p-0.5" title="Удалить пункт">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      {item.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-1">
                        {item.due_date && (
                          <span className="text-xs text-gray-400">
                            📅 {new Date(item.due_date).toLocaleDateString('ru-RU')}
                          </span>
                        )}
                        {item.responsible && (
                          <span className="text-xs text-gray-400">👤 {item.responsible}</span>
                        )}
                        {item.is_done && item.done_by_name && (
                          <span className="text-xs text-emerald-600">✓ {item.done_by_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Добавить пункт вручную */}
          {canManageChecklist && (
            <div>
              {!showAddItem ? (
                <button onClick={() => setShowAddItem(true)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                  + Добавить пункт вручную
                </button>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-emerald-800">Новый пункт чек-листа</p>
                  <input value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)}
                    placeholder="Название *" maxLength={200}
                    className="w-full text-sm border border-emerald-200 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                  <textarea value={newItemDescription} onChange={e => setNewItemDescription(e.target.value)}
                    placeholder="Описание (необязательно)" rows={2}
                    className="w-full text-sm border border-emerald-200 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none" />
                  <div className="grid grid-cols-3 gap-2">
                    <select value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)}
                      className="text-xs border border-emerald-200 rounded-lg px-2 py-2 bg-white text-gray-900">
                      <option value="payment">💰 Оплата</option>
                      <option value="delivery">📦 Поставка</option>
                      <option value="deadline">⏰ Срок</option>
                      <option value="document">📄 Документы</option>
                      <option value="obligation">📌 Обязательство</option>
                      <option value="other">📋 Прочее</option>
                    </select>
                    <input type="date" value={newItemDueDate} onChange={e => setNewItemDueDate(e.target.value)}
                      className="text-xs border border-emerald-200 rounded-lg px-2 py-2 bg-white text-gray-700" />
                    <select value={newItemResponsible} onChange={e => setNewItemResponsible(e.target.value)}
                      className="text-xs border border-emerald-200 rounded-lg px-2 py-2 bg-white text-gray-900">
                      <option value="">Ответственный...</option>
                      <option value="наша сторона">Наша сторона</option>
                      <option value="контрагент">Контрагент</option>
                      <option value="обе стороны">Обе стороны</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addChecklistItem} disabled={checklistLoading}
                      className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                      {checklistLoading ? 'Сохранение...' : 'Добавить'}
                    </button>
                    <button onClick={() => setShowAddItem(false)}
                      className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {checklistItems.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Чек-лист пуст</p>
            </div>
          )}
        </div>
      )}

      {/* EpotosGPT чат — вкладка */}
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
                <div className={`text-xs rounded-xl px-3 py-2 inline-block ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'}`}
                  style={msg.role === 'user' ? {backgroundColor: '#2563eb', color: '#ffffff', WebkitTextFillColor: '#ffffff'} : {}}>
                  {msg.message}
                </div>
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-medium">AI</div>
              <div className="bg-gray-100 rounded-xl px-3 py-2 text-xs text-gray-500">EpotosGPT думает...</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="flex gap-2 mt-3">
          <input value={chatQuestion} onChange={e => setChatQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatQuestion()}
            placeholder="Спросите что-нибудь о документе..."
            className="flex-1 border border-purple-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-900 bg-white" />
          <button onClick={handleChatQuestion} disabled={chatLoading || !chatQuestion.trim()}
            className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-purple-700 disabled:opacity-50">
            {chatLoading ? '...' : '➤'}
          </button>
        </div>
        </div>
      </div>
      )}
    </div>
  )
}