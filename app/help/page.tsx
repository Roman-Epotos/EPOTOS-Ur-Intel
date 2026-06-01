'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'
import { createClient } from '@supabase/supabase-js'

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

const baseUrl = 'https://epotos-ur-intel.vercel.app'
const ADMIN_IDS = [30, 1148]

const SUBJECTS = [
  'Восстановление удалённого документа',
  'Проблема с доступом',
  'Технический вопрос',
  'Вопрос по работе системы',
  'Другое',
]

const ADMINS = [
  { id: 30, name: 'Пирог Роман', title: 'Директор Департамента цифрового развития' },
  { id: 1148, name: 'Чащин Дмитрий', title: 'Заместитель директора Департамента цифрового развития' },
]

const FAQ_ITEMS = [
  { q: 'Как войти в систему?', a: 'Откройте Битрикс24 и найдите пункт «Эпотос-ЮрИнтел» в левом меню. Отдельная авторизация не требуется — система использует ваш аккаунт Битрикс24.' },
  { q: 'Я не вижу нужный документ — что делать?', a: 'Проверьте фильтры на главной странице — возможно, выбрана другая компания или статус. Снимите все фильтры и попробуйте поиск по номеру или названию документа.' },
  { q: 'Документ открылся только на чтение, не могу редактировать', a: 'Редактирование доступно только для статусов «Черновик» и «На согласовании». Если документ уже подписан — загрузите новую версию через вкладку «Документы».' },
  { q: 'Не получаю уведомления от системы', a: 'Уведомления приходят через внутренний мессенджер Битрикс24 (колокольчик). Убедитесь, что уведомления Битрикс24 у вас включены.' },
  { q: 'Как сгенерировать договор из шаблона?', a: 'Откройте карточку документа → вкладка «Генерация» → выберите шаблон → заполните несколько полей → нажмите «Сгенерировать». Реквизиты компании и контрагента подставляются автоматически.' },
  { q: 'Как запустить согласование?', a: 'Откройте документ → вкладка «Согласование» → нажмите «Начать согласование» → добавьте участников. Они получат уведомление в Битрикс24.' },
  { q: 'Как работает AI-анализ документа?', a: 'Откройте документ → вкладка «EpotosGPT». Доступны: Legal Review (проверка рисков), Паспорт документа (краткая выжимка) и анализ дополнительных материалов.' },
  { q: 'Как создать задачу в Битрикс24 из чек-листа?', a: 'Документ должен быть в статусе «Подписан» или «На исполнении». Откройте вкладку «Чек-лист» → выберите пункт → нажмите «Создать задачу» → назначьте ответственного и срок.' },
  { q: 'Случайно удалил документ — можно восстановить?', a: 'Да! Обратитесь к администратору через форму ниже, выбрав тему «Восстановление удалённого документа». Администратор восстановит документ из раздела «Удалённые документы».' },
  { q: 'Система недоступна или работает медленно', a: 'В период разработки платформы Эпотос-Core возможны кратковременные технические работы. Все данные защищены — ежедневный бэкап в 17:00 это гарантирует.' },
  { q: 'Безопасны ли мои документы в системе?', a: 'Да. Данные хранятся в облачной базе с шифрованием. Ежедневно в 17:00 создаётся резервная копия на Яндекс.Диск. Права доступа разграничены по ролям.' },
]

interface SupportRequest {
  id: string
  user_name: string
  admin_name: string
  admin_bitrix_id: number
  user_bitrix_id: number
  subject: string
  message: string
  status: string
  created_at: string
}

interface SupportMessage {
  id: string
  request_id: string
  author_bitrix_id: number
  author_name: string
  is_admin: boolean
  message: string
  created_at: string
}

const statusLabel: Record<string, string> = { new: '🔴 Новое', in_progress: '🟡 В работе', resolved: '🟢 Решено' }
const statusColor: Record<string, string> = { new: 'bg-red-100 text-red-700', in_progress: 'bg-yellow-100 text-yellow-800', resolved: 'bg-green-100 text-green-800' }

function ChatWindow({ request, currentUserId, currentUserName, isAdmin, onStatusChange, onDelete }: {
  request: SupportRequest
  currentUserId: number
  currentUserName: string
  isAdmin: boolean
  onStatusChange: (id: string, status: string) => void
  onDelete?: (id: string) => void
}) {
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [hasNew, setHasNew] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const loadMessages = async () => {
    const res = await fetch(`${baseUrl}/api/support-requests?bitrix_user_id=${currentUserId}&request_id=${request.id}`)
    const data = await res.json()
    const msgs = data.messages ?? []
    setMessages(msgs)
    setLoading(false)
    // Отмечаем как просмотренный
    localStorage.setItem(`support_seen_${request.id}`, new Date().toISOString())
    setHasNew(false)
    onStatusChange(request.id, request.status)
  }

  useEffect(() => {
    loadMessages()

    // Realtime подписка
    const channel = supabaseClient
      .channel(`support_chat_${request.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `request_id=eq.${request.id}`,
      }, (payload) => {
        const newMsg = payload.new as SupportMessage
        if (newMsg.author_bitrix_id !== currentUserId) {
          setHasNew(true)
        }
        setMessages(prev => {
          const exists = prev.some(m => m.id === newMsg.id)
          if (exists) return prev
          return [...prev, newMsg]
        })
      })
      .subscribe()

    return () => { supabaseClient.removeChannel(channel) }
  }, [request.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!text.trim()) return
    setSending(true)
    await fetch(`${baseUrl}/api/support-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: request.id,
        author_bitrix_id: currentUserId,
        author_name: currentUserName,
        message: text.trim(),
        is_admin: isAdmin,
        status: 'in_progress',
      }),
    })
    setText('')
    setSending(false)
  }

  const handleResolve = async () => {
    if (!confirm('Отметить обращение как «Решено»?\n\nЧат будет закрыт — дальнейшая переписка невозможна.')) return
    await fetch(`${baseUrl}/api/support-requests`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: request.id, admin_bitrix_id: currentUserId, status: 'resolved' }),
    })
    onStatusChange(request.id, 'resolved')
  }

  const isClosed = request.status === 'resolved'

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Шапка чата */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{request.subject}</p>
            {hasNew && (
              <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-medium animate-pulse">
                новое сообщение
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {isAdmin ? `От: ${request.user_name}` : `Администратор: ${request.admin_name}`}
            {' · '}{new Date(request.created_at).toLocaleString('ru-RU')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[request.status]}`}>
            {statusLabel[request.status]}
          </span>
          {isAdmin && !isClosed && (
            <button onClick={handleResolve}
              className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
              ✅ Решено
            </button>
          )}
          {isAdmin && onDelete && (
            <button onClick={async () => {
              if (!confirm('Удалить обращение безвозвратно?')) return
              const res = await fetch(`${baseUrl}/api/support-requests`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_id: request.id, admin_bitrix_id: currentUserId }),
              })
              const data = await res.json()
              if (data.success) onDelete(request.id)
            }}
              className="text-xs text-red-500 border border-red-200 px-2 py-1.5 rounded-lg hover:bg-red-50">
              🗑
            </button>
          )}
        </div>
      </div>

      {/* Сообщения */}
      <div className="px-5 py-4 space-y-3 max-h-72 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-gray-400">Загрузка...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center">Нет сообщений</p>
        ) : messages.map(m => {
          const isMine = m.author_bitrix_id === currentUserId
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded-xl px-4 py-2.5 ${isMine ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
                {!isMine && <p className="text-xs font-medium mb-1 opacity-70">{m.author_name}</p>}
                <p className="text-sm">{m.message}</p>
                <p className={`text-xs mt-1 opacity-60`}>{new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          )
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Поле ввода */}
      {!isClosed ? (
        <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
          <input
            value={text}
            onChange={e => { setText(e.target.value); setHasNew(false) }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Напишите сообщение..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button onClick={handleSend} disabled={sending || !text.trim()}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
            {sending ? '...' : '→'}
          </button>
        </div>
      ) : (
        <div className="px-5 py-3 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">Обращение закрыто</p>
        </div>
      )}
    </div>
  )
}

export default function HelpPage() {
  const { user, loading } = useBitrixAuth()
  const [activeTab, setActiveTab] = useState<'faq' | 'request' | 'my_requests' | 'admin'>('faq')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  // Форма обращения
  const [selectedAdmin, setSelectedAdmin] = useState(ADMINS[0].id)
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState('')
  const [sendError, setSendError] = useState('')

  // Обращения
  const [myRequests, setMyRequests] = useState<SupportRequest[]>([])
  const [myRequestsLoading, setMyRequestsLoading] = useState(false)
  const [adminRequests, setAdminRequests] = useState<SupportRequest[]>([])
  const [adminRequestsLoading, setAdminRequestsLoading] = useState(false)

  // Счётчики новых
  const [myUnread, setMyUnread] = useState(0)
  const [adminUnread, setAdminUnread] = useState(0)

  const isAdmin = user ? ADMIN_IDS.includes(parseInt(user.id)) : false

  useEffect(() => {
    if (!user) return
    // Считаем непрочитанные
    fetch(`${baseUrl}/api/support-requests?bitrix_user_id=${user.id}&my_requests=true`)
      .then(r => r.json())
      .then(d => {
        const reqs = d.requests ?? []
        setMyUnread(reqs.filter((r: SupportRequest) => {
          if (r.status === 'resolved') return false
          const lastSeen = localStorage.getItem(`support_seen_${r.id}`)
          return !lastSeen
        }).length)
      })
    if (isAdmin) {
      fetch(`${baseUrl}/api/support-requests?bitrix_user_id=${user.id}`)
        .then(r => r.json())
        .then(d => {
          const reqs = d.requests ?? []
          setAdminUnread(reqs.filter((r: SupportRequest) => {
            if (r.status === 'resolved') return false
            const lastSeen = localStorage.getItem(`support_seen_${r.id}`)
            return !lastSeen
          }).length)
        })
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    if (activeTab === 'my_requests') {
      setMyRequestsLoading(true)
      fetch(`${baseUrl}/api/support-requests?bitrix_user_id=${user.id}&my_requests=true`)
        .then(r => r.json())
        .then(d => { setMyRequests(d.requests ?? []); setMyRequestsLoading(false); setMyUnread(0) })
    }
    if (activeTab === 'admin' && isAdmin) {
      setAdminRequestsLoading(true)
      fetch(`${baseUrl}/api/support-requests?bitrix_user_id=${user.id}`)
        .then(r => r.json())
        .then(d => { setAdminRequests(d.requests ?? []); setAdminRequestsLoading(false); setAdminUnread(0) })
    }
  }, [activeTab, user])

  const handleSend = async () => {
    if (!message.trim()) { setSendError('Напишите текст обращения'); return }
    setSending(true)
    setSendError('')
    setSendSuccess('')
    const res = await fetch(`${baseUrl}/api/support-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_bitrix_id: parseInt(user?.id ?? '0'),
        user_name: user?.name ?? 'Пользователь',
        admin_bitrix_id: selectedAdmin,
        subject,
        message: message.trim(),
      }),
    })
    const data = await res.json()
    if (data.success) {
      setSendSuccess('Обращение отправлено! Перейдите в «Мои обращения» чтобы следить за ответом.')
      setMessage('')
    } else {
      setSendError(data.error ?? 'Ошибка отправки')
    }
    setSending(false)
  }

  const handleStatusChange = (id: string, status: string) => {
    setAdminRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    setMyRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const handleDelete = (id: string) => {
    setAdminRequests(prev => prev.filter(r => r.id !== id))
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Загрузка...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">

        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Назад</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">Помощь и поддержка</h1>
        </div>

        {/* Вкладки */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setActiveTab('faq')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'faq' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            ❓ Частые вопросы
          </button>
          <button onClick={() => setActiveTab('request')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'request' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            📩 Написать администратору
          </button>
          <button onClick={() => setActiveTab('my_requests')}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'my_requests' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            💬 Мои обращения
            {myUnread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                {myUnread}
              </span>
            )}
          </button>
          {isAdmin && (
            <button onClick={() => setActiveTab('admin')}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'admin' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              🔧 Обращения ко мне
              {adminUnread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                  {adminUnread}
                </span>
              )}
            </button>
          )}
        </div>

        {/* FAQ */}
        {activeTab === 'faq' && (
          <div className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-900">{item.q}</span>
                  <span className="text-gray-400 flex-shrink-0">{openFaq === i ? '▲' : '▼'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-gray-600 border-t border-gray-100 pt-3">{item.a}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Форма обращения */}
        {activeTab === 'request' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Новое обращение</h2>
            {sendSuccess && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{sendSuccess}</div>}
            {sendError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{sendError}</div>}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Кому</label>
              <select value={selectedAdmin} onChange={e => setSelectedAdmin(parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                {ADMINS.map(a => <option key={a.id} value={a.id}>{a.name} — {a.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Тема обращения</label>
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Текст обращения</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Опишите вашу проблему или вопрос..."
                rows={4}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
            </div>
            <button onClick={handleSend} disabled={sending}
              className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
              {sending ? 'Отправка...' : 'Отправить обращение'}
            </button>
          </div>
        )}

        {/* Мои обращения */}
        {activeTab === 'my_requests' && (
          <div className="space-y-4">
            {myRequestsLoading ? (
              <p className="text-sm text-gray-400">Загрузка...</p>
            ) : myRequests.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-400 text-sm">У вас пока нет обращений</p>
              </div>
            ) : myRequests.map(r => (
              <ChatWindow
                key={r.id}
                request={r}
                currentUserId={parseInt(user?.id ?? '0')}
                currentUserName={user?.name ?? ''}
                isAdmin={false}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}

        {/* Обращения к администратору */}
        {activeTab === 'admin' && isAdmin && (
          <div className="space-y-4">
            {adminRequestsLoading ? (
              <p className="text-sm text-gray-400">Загрузка...</p>
            ) : adminRequests.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-400 text-sm">Новых обращений нет</p>
              </div>
            ) : adminRequests.map(r => (
              <ChatWindow
                key={r.id}
                request={r}
                currentUserId={parseInt(user?.id ?? '0')}
                currentUserName={user?.name ?? ''}
                isAdmin={true}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}