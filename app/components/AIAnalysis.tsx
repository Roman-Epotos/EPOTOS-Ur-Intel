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
  high: 'рџ”ґ',
  medium: 'рџџЎ',
  low: 'рџ”µ',
}

const RISK_LABELS = {
  high: 'Р’С‹СЃРѕРєРёР№ СЂРёСЃРє',
  medium: 'РЎСЂРµРґРЅРёР№ СЂРёСЃРє',
  low: 'РќРёР·РєРёР№ СЂРёСЃРє',
}

export default function AIAnalysis({ contractId, versions, attachments = [], userName, userId, documentType, documentCategory, contractStatus, sessionParticipantBitrixIds = [], onStatusChange }: Props) {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)

  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatQuestion, setChatQuestion] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Р§РµРє-Р»РёСЃС‚



  const [showAddItem, setShowAddItem] = useState(false)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('other')
  const [newItemDueDate, setNewItemDueDate] = useState('')
  const [newItemResponsible, setNewItemResponsible] = useState('')

  // РџСЂР°РІР° РЅР° С‡РµРє-Р»РёСЃС‚
  const adminIds = [30, 1148]
  const gcManagerIds = [1, 246, 504]




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
    // РЎР±СЂР°СЃС‹РІР°РµРј С‡Р°С‚ РїСЂРё СЃРјРµРЅРµ РґРѕРєСѓРјРµРЅС‚Р°
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




















































































































  }

  const runAnalysis = async (type: 'legal_review' | 'passport' | 'document_review') => {
    if (!selectedVersion) {
      alert('Р’С‹Р±РµСЂРёС‚Рµ РґРѕРєСѓРјРµРЅС‚ РґР»СЏ Р°РЅР°Р»РёР·Р°')
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
      versionId = ''       // РЅРµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РґР»СЏ РІР»РѕР¶РµРЅРёР№
      attachmentId = attId // СЃРѕС…СЂР°РЅСЏРµРј РѕС‚РґРµР»СЊРЅРѕ
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
          user_name: userName ?? 'РЎРёСЃС‚РµРјР°',
        }),
      })

      const data = await res.json()
      if (data.success) {
        await loadAnalyses()
        setActiveTab(type)
      } else {
        alert('РћС€РёР±РєР° Р°РЅР°Р»РёР·Р°: ' + data.error)
      }
    } catch {
      alert('РћС€РёР±РєР° СЃРѕРµРґРёРЅРµРЅРёСЏ')
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
      user_name: userName ?? 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ',
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
        user_name: userName ?? 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ',
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
            <p className="text-sm font-semibold">РћР±С‰РёР№ СѓСЂРѕРІРµРЅСЊ СЂРёСЃРєР°: {RISK_LABELS[result.overall_risk]}</p>
            <p className="text-xs mt-0.5">{result.summary}</p>
          </div>
        </div>
      </div>

      {result.red_flags?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">вљ пёЏ Р РёСЃРєРё</h4>
          <div className="space-y-2">
            {result.red_flags.map((flag, i) => (
              <div key={i} className={`rounded-lg border p-3 ${RISK_COLORS[flag.severity]}`}>
                <div className="flex items-start gap-2">
                  <span>{RISK_ICONS[flag.severity]}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{flag.title}</p>
                    <p className="text-xs mt-0.5">{flag.description}</p>
                    {flag.recommendation && <p className="text-xs mt-1 italic">рџ’Ў {flag.recommendation}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.warnings?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">рџ“‹ Р—Р°РјРµС‡Р°РЅРёСЏ</h4>
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
          <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">вњ… Р—Р°С‰РёС‚Р° РёРЅС‚РµСЂРµСЃРѕРІ</h4>
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
        <p className="text-xs font-semibold text-gray-600 uppercase mb-1">РўРёРї РґРѕРєСѓРјРµРЅС‚Р°</p>
        <p className="text-sm font-medium text-gray-900">{result.document_type}</p>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">рџ“‹ РљСЂР°С‚РєРѕРµ СЃРѕРґРµСЂР¶Р°РЅРёРµ</h4>
        <p className="text-sm text-blue-900">{result.summary}</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wide">рџЋЇ Р¦РµР»СЊ РґРѕРєСѓРјРµРЅС‚Р°</h4>
        <p className="text-sm text-gray-900">{result.purpose}</p>
      </div>
      {result.attention_points?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-yellow-800 mb-2 uppercase tracking-wide">вљЎ РўСЂРµР±СѓСЋС‚ РІРЅРёРјР°РЅРёСЏ</h4>
          <ul className="space-y-1">
            {result.attention_points.map((p, i) => <li key={i} className="text-xs text-yellow-900">вЂў {p}</li>)}
          </ul>
        </div>
      )}
      {result.recommendations?.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-green-800 mb-2 uppercase tracking-wide">вњ… Р РµРєРѕРјРµРЅРґР°С†РёРё</h4>
          <ul className="space-y-1">
            {result.recommendations.map((r, i) => <li key={i} className="text-xs text-green-900">вЂў {r}</li>)}
          </ul>
        </div>
      )}
    </div>
  )

  const renderPassport = (result: Passport) => (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">рџ“„ РЎСѓС‚СЊ РґРѕРіРѕРІРѕСЂР°</h4>
        <p className="text-sm text-blue-900">{result.essence}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">рџ’° РљР»СЋС‡РµРІС‹Рµ СѓСЃР»РѕРІРёСЏ</h4>
        <div className="space-y-1.5">
          {Object.entries(result.key_terms ?? {}).map(([key, value]) => {
            const labels: Record<string, string> = {
              amount: 'РЎСѓРјРјР°',
              payment_terms: 'РћРїР»Р°С‚Р°',
              start_date: 'РќР°С‡Р°Р»Рѕ',
              end_date: 'РћРєРѕРЅС‡Р°РЅРёРµ',
              auto_renewal: 'РђРІС‚РѕРїСЂРѕР»РѕРЅРіР°С†РёСЏ',
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
          <h4 className="text-xs font-semibold text-gray-700 mb-2">РќР°С€Рё РѕР±СЏР·Р°С‚РµР»СЊСЃС‚РІР°</h4>
          <ul className="space-y-1">
            {result.parties?.our_obligations?.map((o, i) => (
              <li key={i} className="text-xs text-gray-600">вЂў {o}</li>
            ))}
          </ul>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">РћР±СЏР·Р°С‚РµР»СЊСЃС‚РІР° РєРѕРЅС‚СЂР°РіРµРЅС‚Р°</h4>
          <ul className="space-y-1">
            {result.parties?.counterparty_obligations?.map((o, i) => (
              <li key={i} className="text-xs text-gray-600">вЂў {o}</li>
            ))}
          </ul>
        </div>
      </div>

      {result.control_points?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">рџЋЇ РљРѕРЅС‚СЂРѕР»СЊРЅС‹Рµ С‚РѕС‡РєРё</h4>
          <ul className="space-y-1">
            {result.control_points.map((p, i) => (
              <li key={i} className="text-xs text-gray-600">вЂў {p}</li>
            ))}
          </ul>
        </div>
      )}

      {result.attention_zones?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-yellow-800 mb-2">вљЎ Р—РѕРЅС‹ РІРЅРёРјР°РЅРёСЏ</h4>
          <ul className="space-y-1">
            {result.attention_zones.map((z, i) => (
              <li key={i} className="text-xs text-yellow-800">вЂў {z}</li>
            ))}
          </ul>
        </div>
      )}

      {result.termination && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-700 mb-1">рџљЄ Р Р°СЃС‚РѕСЂР¶РµРЅРёРµ</h4>
          <p className="text-xs text-gray-600">{result.termination}</p>
        </div>
      )}
    </div>
  )

  if (versions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">рџ¤– EpotosGPT вЂ” AI Р°РЅР°Р»РёР·</h2>
        <p className="text-sm text-gray-400">Р—Р°РіСЂСѓР·РёС‚Рµ РґРѕРєСѓРјРµРЅС‚ С‡С‚РѕР±С‹ Р·Р°РїСѓСЃС‚РёС‚СЊ AI Р°РЅР°Р»РёР·</p>
      </div>
    )
  }

  return (
    <div>
      {/* Р—Р°РіРѕР»РѕРІРѕРє */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">EpotosGPT вЂ” AI Р°РЅР°Р»РёР· РґРѕРєСѓРјРµРЅС‚Р°</h2>
        <p className="text-xs text-gray-500">Р’С‹Р±РµСЂРёС‚Рµ РґРѕРєСѓРјРµРЅС‚ Рё Р·Р°РїСѓСЃС‚РёС‚Рµ РЅСѓР¶РЅС‹Р№ Р°РЅР°Р»РёР·</p>
      </div>

      {/* Р’С‹Р±РѕСЂ РІРµСЂСЃРёРё Рё Р·Р°РїСѓСЃРє */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-gray-500 mb-1">Р”РѕРєСѓРјРµРЅС‚ РґР»СЏ Р°РЅР°Р»РёР·Р°</label>
            <select value={selectedVersion} 
              onChange={e => setSelectedVersion(e.target.value)}
              onBlur={e => setSelectedVersion(e.target.value)}
              size={1}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-900">
              {versions.length > 0 && (
                <optgroup label="Р’РµСЂСЃРёРё РґРѕРєСѓРјРµРЅС‚Р°">
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>v{v.version_number} вЂ” {v.file_name}</option>
                  ))}
                </optgroup>
              )}
              {attachments.length > 0 && (
                <optgroup label="Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ РјР°С‚РµСЂРёР°Р»С‹">
                  {attachments.map(a => (
                    <option key={`att_${a.id}`} value={`att_${a.id}`}>
                      {a.attachment_type} в„–{a.number}{a.title ? ` вЂ” ${a.title}` : ''} ({a.file_name})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="flex flex-col gap-2 pt-4">







              <>
                <button onClick={() => runAnalysis('legal_review')} disabled={!!analyzing}
                  className="text-xs font-medium bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5">
                  рџ”Ќ {analyzing === 'legal_review' ? 'РђРЅР°Р»РёР·РёСЂСѓРµС‚СЃСЏ...' : 'Р—Р°РїСѓСЃС‚РёС‚СЊ Legal Review'}
                </button>
                <button onClick={() => runAnalysis('passport')} disabled={!!analyzing}
                  className="text-xs font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5">
                  рџ“„ {analyzing === 'passport' ? 'РЎРѕР·РґР°С‘С‚СЃСЏ...' : 'РЎРѕР·РґР°С‚СЊ РїР°СЃРїРѕСЂС‚ РґРѕРєСѓРјРµРЅС‚Р°'}
                </button>
              </>
            ) : (
              <button onClick={() => runAnalysis('document_review')} disabled={!!analyzing}
                className="text-xs font-medium bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1.5">
                рџ“ќ {analyzing === 'document_review' ? 'РђРЅР°Р»РёР·РёСЂСѓРµС‚СЃСЏ...' : 'РђРЅР°Р»РёР·РёСЂРѕРІР°С‚СЊ РґРѕРєСѓРјРµРЅС‚'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Р РµР·СѓР»СЊС‚Р°С‚С‹ */}
      {(latestReview || latestPassport) && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Р РµР·СѓР»СЊС‚Р°С‚С‹ Р°РЅР°Р»РёР·Р°</p>
          <div className="flex gap-2 border-b border-gray-200">
            {latestReview && (
              <button onClick={() => setActiveTab('legal_review')}
                className={`text-sm px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'legal_review' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                рџ”Ќ Legal Review
              </button>
            )}
            {latestPassport && (
              <button onClick={() => setActiveTab('passport')}
                className={`text-sm px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'passport' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                рџ“„ РџР°СЃРїРѕСЂС‚ РґРѕРєСѓРјРµРЅС‚Р°
              </button>
            )}
            <button onClick={() => setActiveTab('chat')}
              className={`text-sm px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'chat' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              рџ’¬ Р§Р°С‚ СЃ AI
            </button>
            
          </div>
        </div>
      )}

      {!(latestReview || latestPassport) && (
        <div className="mb-4">
          <div className="flex gap-2 border-b border-gray-200">
            <button onClick={() => setActiveTab('chat')}
              className={`text-sm px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'chat' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              рџ’¬ Р§Р°С‚ СЃ AI
            </button>
            
          </div>
        </div>
      )}

      {analyzing && activeTab !== 'chat' && (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">рџ¤–</div>
          <p className="text-sm text-gray-600">AI Р°РЅР°Р»РёР·РёСЂСѓРµС‚ РґРѕРєСѓРјРµРЅС‚...</p>
          <p className="text-xs text-gray-400 mt-1">Р­С‚Рѕ РјРѕР¶РµС‚ Р·Р°РЅСЏС‚СЊ 20-40 СЃРµРєСѓРЅРґ</p>
        </div>
      )}

      {!analyzing && activeTab !== 'chat' && latestReview && latestReview.type === 'document_review' && (
        <div>
          <p className="text-xs text-gray-400 mb-3">
            РђРЅР°Р»РёР· РѕС‚ {new Date(latestReview.created_at).toLocaleString('ru-RU')} В· {latestReview.model_used}
          </p>
          {renderDocumentReview(latestReview.result_json as unknown as DocumentReview)}
        </div>
      )}

      {!analyzing && activeTab === 'legal_review' && latestReview && latestReview.type !== 'document_review' && (
        <div>
          <p className="text-xs text-gray-400 mb-3">
            РђРЅР°Р»РёР· РѕС‚ {new Date(latestReview.created_at).toLocaleString('ru-RU')} В· {latestReview.model_used}
          </p>
          {renderLegalReview(latestReview.result_json as LegalReview)}
        </div>
      )}

      {!analyzing && activeTab === 'passport' && latestPassport && (
        <div>
          <p className="text-xs text-gray-400 mb-3">
            РЎРѕР·РґР°РЅ {new Date(latestPassport.created_at).toLocaleString('ru-RU')} В· {latestPassport.model_used}
          </p>
          {renderPassport(latestPassport.result_json as Passport)}
        </div>
      )}

      {!analyzing && !latestReview && !latestPassport && activeTab !== 'chat' && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400">РќР°Р¶РјРёС‚Рµ РєРЅРѕРїРєСѓ РґР»СЏ Р·Р°РїСѓСЃРєР° Р°РЅР°Р»РёР·Р°</p>
          <p className="text-xs text-gray-300 mt-1">Legal Review РЅР°Р№РґС‘С‚ СЂРёСЃРєРё В· РџР°СЃРїРѕСЂС‚ СЃРѕР·РґР°СЃС‚ СЂРµР·СЋРјРµ</p>
        </div>
      )}

      {/* Р§РµРє-Р»РёСЃС‚ РёСЃРїРѕР»РЅРµРЅРёСЏ */}































































































































































            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Р§РµРє-Р»РёСЃС‚ РїСѓСЃС‚</p>
            </div>
          )}
        </div>
      )}

      {/* EpotosGPT С‡Р°С‚ вЂ” РІРєР»Р°РґРєР° */}
      {activeTab === 'chat' && (
      <div className="mt-2">
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
          <div className="bg-white rounded-lg border border-purple-100 p-3 space-y-3 max-h-64 overflow-y-auto mb-3">
          {chatMessages.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              Р—Р°РґР°Р№С‚Рµ РІРѕРїСЂРѕСЃ РїРѕ РґРѕРєСѓРјРµРЅС‚Сѓ вЂ” EpotosGPT РѕС‚РІРµС‚РёС‚ РЅР° РѕСЃРЅРѕРІРµ СЃРѕРґРµСЂР¶РёРјРѕРіРѕ С„Р°Р№Р»Р°
            </p>
          ) : chatMessages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${msg.role === 'assistant' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {msg.role === 'assistant' ? 'AI' : (userName ?? 'Рџ').charAt(0).toUpperCase()}
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
              <div className="bg-gray-100 rounded-xl px-3 py-2 text-xs text-gray-500">EpotosGPT РґСѓРјР°РµС‚...</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="flex gap-2 mt-3">
          <input value={chatQuestion} onChange={e => setChatQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatQuestion()}
            placeholder="РЎРїСЂРѕСЃРёС‚Рµ С‡С‚Рѕ-РЅРёР±СѓРґСЊ Рѕ РґРѕРєСѓРјРµРЅС‚Рµ..."
            className="flex-1 border border-purple-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-900 bg-white" />
          <button onClick={handleChatQuestion} disabled={chatLoading || !chatQuestion.trim()}
            className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-purple-700 disabled:opacity-50">
            {chatLoading ? '...' : 'вћ¤'}
          </button>
        </div>
        </div>
      </div>
      )}
    </div>
  )
}
