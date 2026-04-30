'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'
import CancelApprovalButton from '@/app/components/CancelApprovalButton'
import { createClient } from '@supabase/supabase-js'

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

interface Participant {
  id: string
  user_name: string
  department: string | null
  role: string
  stage: string
  status: string
  comment: string | null
  decided_at: string | null
  bitrix_user_id: number | null
}

interface Message {
  id: string
  author_name: string
  message: string
  is_ai: boolean
  created_at: string
  bitrix_user_id: number | null
}

interface Session {
  id: string
  status: string
  deadline: string
  initiated_by_name: string
  initiated_by_bitrix_id: number | null
  created_at: string
  approval_participants: Participant[]
  approval_messages: Message[]
}

interface Contract {
  id: string
  number: string
  title: string
  counterparty: string
  status: string
  amount: number | null
  end_date: string | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'В работе',
  approved: 'Согласовал',
  acknowledged: 'Ознакомлен',
  disabled: 'Отключён',
  completed_by_initiator: 'Завершён инициатором',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  acknowledged: 'bg-purple-100 text-purple-800',
  disabled: 'bg-gray-100 text-gray-500',
  completed_by_initiator: 'bg-gray-200 text-gray-600',
}

const STAGE_LABELS: Record<string, string> = {
  legal: 'Юридический отдел',
  finance: 'Финансовый департамент',
  accounting: 'Бухгалтерия',
  director: 'Генеральный директор',
  custom: 'Дополнительно',
}

export default function ApprovalPortalPage() {
  const params = useParams()
  const { user } = useBitrixAuth()
  const contractId = params.id as string

  const [contract, setContract] = useState<Contract | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false)
  const [approveComment, setApproveComment] = useState('')
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [acknowledging, setAcknowledging] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const baseUrl = typeof window !== 'undefined' ? 'https://epotos-ur-intel.vercel.app' : ''

  const loadData = async () => {
    try {
      const [contractRes, sessionRes] = await Promise.all([
        fetch(`${baseUrl}/api/contracts/${contractId}`),
        fetch(`${baseUrl}/api/approvals?contract_id=${contractId}`),
      ])
      const contractData = await contractRes.json()
      const sessionData = await sessionRes.json()
      setContract(contractData.contract)
      if (sessionData.session) {
        sessionData.session.approval_messages = (sessionData.session.approval_messages ?? [])
          .sort((a: { created_at: string }, b: { created_at: string }) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
      }
      setSession(sessionData.session)
    } catch {
      console.error('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [contractId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.approval_messages])

  // Realtime подписка
  useEffect(() => {
    if (!session?.id) return

    const channel = supabaseClient
      .channel(`portal-${session.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'approval_messages',
      }, (payload) => {
        const newMsg = payload.new as Message
        if (newMsg.session_id !== session.id) return
        setSession(prev => {
          if (!prev) return prev
          const exists = prev.approval_messages.find(m => m.id === newMsg.id)
          if (exists) return prev
          return {
            ...prev,
            approval_messages: [...prev.approval_messages, newMsg]
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          }
        })
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'approval_participants',
      }, () => loadData())
      .subscribe()

    return () => { supabaseClient.removeChannel(channel) }
  }, [session?.id])

  const myParticipant = session?.approval_participants.find(
    p => p.bitrix_user_id === parseInt(user?.id ?? '0')
  )

  const canApprove = myParticipant?.status === 'pending'

  const handleSendMessage = async () => {
    if (!message.trim() || !session) return
    setSendingMessage(true)

    await fetch(`${baseUrl}/api/approvals/${session.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message.trim(),
        author_name: user?.name ?? 'Гость',
        bitrix_user_id: user?.id ? parseInt(user.id) : null,
      }),
    })

    setMessage('')
    setSendingMessage(false)
    await loadData()
  }

  const handleAcknowledge = async () => {
    if (!session || !approvingId) return
    setAcknowledging(true)

    await fetch(`https://epotos-ur-intel.vercel.app/api/approvals/${session.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: approvingId,
        comment: 'Ознакомлен',
        user_name: user?.name ?? 'Система',
        contract_id: contractId,
        is_acknowledge: true,
      }),
    })

    

    setShowAcknowledgeModal(false)
    setApprovingId(null)
    setAcknowledging(false)
    await loadData()
  }

  const handleApprove = async () => {
    if (!session || !approvingId) return
    setApproving(true)

    await fetch(`${baseUrl}/api/approvals/${session.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: approvingId,
        comment: approveComment,
        user_name: user?.name ?? 'Система',
        contract_id: contractId,
      }),
    })

    setShowApproveModal(false)
    setApproveComment('')
    setApprovingId(null)
    setApproving(false)
    await loadData()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Загрузка портала согласования...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 font-medium">Согласование не запущено</p>
          <Link href={`/contracts/${contractId}`}
            className="mt-3 inline-block text-sm text-gray-900 underline">
            Вернуться к договору
          </Link>
        </div>
      </div>
    )
  }

  const allRequired = session.approval_participants.filter(p => p.role === 'required')
  const allApproved = allRequired.every(p => p.status === 'approved' || p.status === 'disabled' || p.status === 'completed_by_initiator')
  const daysLeft = Math.ceil((new Date(session.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Шапка */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Link href={`/contracts/${contractId}`}
            className="text-sm text-gray-500 hover:text-gray-700">← Назад</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">Портал согласования</h1>
          {allApproved && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
              Все согласовали ✓
            </span>
          )}
          <div className="ml-auto">
            <CancelApprovalButton
              sessionId={session.id}
              contractId={contractId}
              contractNumber={contract?.number ?? ''}
              initiatedByBitrixId={session.initiated_by_bitrix_id ?? null}
              onCancelled={() => window.location.href = `/contracts/${contractId}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">

          {/* Левая колонка */}
          <div className="col-span-2 space-y-6">

            {/* Карточка документа */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-medium text-gray-700 mb-1">Документ на согласовании</h2>
                  <p className="text-lg font-semibold text-gray-900">{contract?.number}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{contract?.title}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Дедлайн</p>
                  <p className={`text-sm font-medium ${daysLeft < 2 ? 'text-red-600' : 'text-gray-900'}`}>
                    {new Date(session.deadline).toLocaleDateString('ru-RU')}
                  </p>
                  <p className={`text-xs ${daysLeft < 2 ? 'text-red-500' : 'text-gray-500'}`}>
                    {daysLeft > 0 ? `осталось ${daysLeft} дн.` : 'просрочено'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Контрагент: </span>
                  <span className="text-gray-900">{contract?.counterparty}</span>
                </div>
                {contract?.amount && (
                  <div>
                    <span className="text-gray-500">Сумма: </span>
                    <span className="text-gray-900">{Number(contract.amount).toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}
                <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className="text-xs text-blue-600 font-medium">Инициатор:</span>
                  <span className="text-sm font-semibold text-blue-900">{session.initiated_by_name}</span>
                </div>
                <div>
                  <span className="text-gray-500">Запущено: </span>
                  <span className="text-gray-900">{new Date(session.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={`/contracts/${contractId}`}
                  className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700">
                  Открыть договор
                </Link>
                <Link href={`/contracts/${contractId}/upload`}
                  className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700">
                  Загрузить новую версию
                </Link>
              </div>
            </div>

            {/* Чат */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Чат согласования</h2>

              <div className="space-y-3 max-h-80 overflow-y-auto mb-4 pr-1">
                {session.approval_messages.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Сообщений пока нет</p>
                ) : (
                  session.approval_messages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.is_ai ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${msg.is_ai ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-700'}`}>
                        {msg.is_ai ? 'AI' : msg.author_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className={`flex-1 ${msg.is_ai ? 'items-end' : ''}`}>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-900">{msg.author_name}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(msg.created_at).toLocaleString('ru-RU')}
                          </span>
                        </div>
                        <div className={`text-sm rounded-lg px-3 py-2 inline-block ${msg.is_ai ? 'bg-purple-50 text-purple-900' : 'bg-gray-50 text-gray-900'}`}>
                          {msg.message}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="flex gap-2">
                <input
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder="Написать сообщение..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
                />
                <button onClick={handleSendMessage} disabled={sendingMessage || !message.trim()}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50">
                  {sendingMessage ? '...' : 'Отправить'}
                </button>
              </div>
            </div>

          </div>

          {/* Правая колонка — участники */}
          <div className="col-span-1 space-y-4">

            {/* Моё действие */}
            {myParticipant?.status === 'pending' && myParticipant?.role === 'required' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-medium text-blue-900 mb-3">Требуется ваше решение</p>
                <button
                  onClick={() => { setApprovingId(myParticipant?.id ?? null); setShowApproveModal(true) }}
                  className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                  ✓ Согласовать документ
                </button>
              </div>
            )}

            {myParticipant?.status === 'pending' && myParticipant?.role === 'optional' && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Вы добавлены для ознакомления</p>
                <button
                  onClick={() => { setApprovingId(myParticipant?.id ?? null); setShowAcknowledgeModal(true) }}
                  className="w-full bg-gray-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-900">
                  👁 Ознакомлен
                </button>
              </div>
            )}

            {/* Чек-лист */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Участники согласования</h2>
              <div className="space-y-3">
                {session.approval_participants.map(p => (
                  <div key={p.id} className="border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.user_name}</p>
                        <p className="text-xs text-gray-500">{STAGE_LABELS[p.stage] ?? p.stage}</p>
                        {p.role === 'optional' && (
                          <p className="text-xs text-gray-400">для информирования</p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </div>
                    {p.comment && (
                      <p className="text-xs text-gray-600 mt-1 italic">«{p.comment}»</p>
                    )}
                    {p.decided_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(p.decided_at).toLocaleDateString('ru-RU')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Прогресс */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-2">Прогресс</h2>
              {(() => {
                const required = session.approval_participants.filter(p => p.role === 'required')
                const done = required.filter(p => p.status === 'approved' || p.status === 'disabled' || p.status === 'completed_by_initiator')
                const pct = required.length > 0 ? Math.round(done.length / required.length * 100) : 0
                const optional = session.approval_participants.filter(p => p.role === 'optional')
                const ackDone = optional.filter(p => p.status === 'acknowledged' || p.status === 'approved')
                const ackPct = optional.length > 0 ? Math.round(ackDone.length / optional.length * 100) : 0
                return (
                  <>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{done.length} из {required.length} согласовали</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                      <div className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }} />
                    </div>
                    {optional.length > 0 && (
                      <>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{ackDone.length} из {optional.length} ознакомились</span>
                          <span>{ackPct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${ackPct}%` }} />
                        </div>
                      </>
                    )}
                  </>
                )
              })()}
            </div>

          </div>
        </div>
      </div>

      {/* Modal ознакомления */}
      {showAcknowledgeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Подтверждение ознакомления</h3>
            <p className="text-sm text-gray-600 mb-6">
              Вы подтверждаете что ознакомились с документом <strong>{contract?.number}</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={handleAcknowledge} disabled={acknowledging}
                className="flex-1 bg-gray-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50">
                {acknowledging ? 'Сохранение...' : '👁 Подтвердить ознакомление'}
              </button>
              <button onClick={() => { setShowAcknowledgeModal(false) }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal подтверждения */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Подтверждение согласования</h3>
            <p className="text-sm text-gray-600 mb-4">
              Вы подтверждаете согласование документа <strong>{contract?.number}</strong>?
            </p>
            <textarea
              value={approveComment}
              onChange={e => setApproveComment(e.target.value)}
              placeholder="Комментарий (необязательно)..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 mb-4 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={handleApprove} disabled={approving}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {approving ? 'Сохранение...' : 'Подтвердить согласование'}
              </button>
              <button onClick={() => { setShowApproveModal(false); setApproveComment('') }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}