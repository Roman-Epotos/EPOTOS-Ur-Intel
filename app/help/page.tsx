'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

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
  {
    q: 'Как войти в систему?',
    a: 'Откройте Битрикс24 и найдите пункт «Эпотос-ЮрИнтел» в левом меню. Отдельная авторизация не требуется — система использует ваш аккаунт Битрикс24.',
  },
  {
    q: 'Я не вижу нужный документ — что делать?',
    a: 'Проверьте фильтры на главной странице — возможно, выбрана другая компания или статус. Снимите все фильтры и попробуйте поиск по номеру или названию документа.',
  },
  {
    q: 'Документ открылся только на чтение, не могу редактировать',
    a: 'Редактирование доступно только для статусов «Черновик» и «На согласовании». Если документ уже подписан — загрузите новую версию через вкладку «Документы».',
  },
  {
    q: 'Не получаю уведомления от системы',
    a: 'Уведомления приходят через внутренний мессенджер Битрикс24 (колокольчик). Убедитесь, что уведомления Битрикс24 у вас включены.',
  },
  {
    q: 'Как сгенерировать договор из шаблона?',
    a: 'Откройте карточку документа → вкладка «Генерация» → выберите шаблон → заполните несколько полей → нажмите «Сгенерировать». Реквизиты компании и контрагента подставляются автоматически.',
  },
  {
    q: 'Как запустить согласование?',
    a: 'Откройте документ → вкладка «Согласование» → нажмите «Начать согласование» → добавьте участников. Они получат уведомление в Битрикс24.',
  },
  {
    q: 'Как работает AI-анализ документа?',
    a: 'Откройте документ → вкладка «EpotosGPT». Доступны три функции: Legal Review (проверка рисков), Паспорт документа (краткая выжимка ключевых условий) и анализ дополнительных материалов.',
  },
  {
    q: 'Как создать задачу в Битрикс24 из чек-листа?',
    a: 'Документ должен быть в статусе «Подписан» или «На исполнении». Откройте вкладку «Чек-лист» → выберите пункт → нажмите «Создать задачу» → назначьте ответственного и укажите срок.',
  },
  {
    q: 'Случайно удалил документ — можно восстановить?',
    a: 'Да! Обратитесь к администратору системы через форму ниже, выбрав тему «Восстановление удалённого документа». Администратор восстановит документ из раздела «Удалённые документы».',
  },
  {
    q: 'Система недоступна или работает медленно',
    a: 'В период разработки платформы Эпотос-Core возможны кратковременные технические работы. Все ваши данные защищены — ежедневный бэкап в 17:00 это гарантирует. Если проблема сохраняется — сообщите администратору.',
  },
  {
    q: 'Безопасны ли мои документы в системе?',
    a: 'Да. Данные хранятся в облачной базе с шифрованием. Ежедневно в 17:00 автоматически создаётся резервная копия на Яндекс.Диск. Права доступа разграничены по ролям.',
  },
]

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

  // Мои обращения
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [myRequestsLoading, setMyRequestsLoading] = useState(false)

  // Обращения к администратору
  const [adminRequests, setAdminRequests] = useState<any[]>([])
  const [adminRequestsLoading, setAdminRequestsLoading] = useState(false)
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [replyStatus, setReplyStatus] = useState<Record<string, string>>({})

  const isAdmin = user ? ADMIN_IDS.includes(parseInt(user.id)) : false

  useEffect(() => {
    if (activeTab === 'my_requests' && user) {
      setMyRequestsLoading(true)
      fetch(`${baseUrl}/api/support-requests?bitrix_user_id=${user.id}&my_requests=true`)
        .then(r => r.json())
        .then(d => { setMyRequests(d.requests ?? []); setMyRequestsLoading(false) })
    }
    if (activeTab === 'admin' && isAdmin && user) {
      setAdminRequestsLoading(true)
      fetch(`${baseUrl}/api/support-requests?bitrix_user_id=${user.id}`)
        .then(r => r.json())
        .then(d => { setAdminRequests(d.requests ?? []); setAdminRequestsLoading(false) })
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
      setSendSuccess('Обращение отправлено! Администратор ответит вам в Битрикс24.')
      setMessage('')
    } else {
      setSendError(data.error ?? 'Ошибка отправки')
    }
    setSending(false)
  }

  const handleReply = async (requestId: string, userBitrixId: number) => {
    const reply = replyText[requestId]
    if (!reply?.trim()) return
    const status = replyStatus[requestId] !== undefined ? replyStatus[requestId] : 'in_progress'
    console.log('handleReply status:', status, 'replyStatus map:', replyStatus)
    if (status === 'resolved') {
      if (!confirm('Отметить обращение как «Решено»?\n\nЧат по данному вопросу будет закрыт — дальнейшая переписка невозможна.')) return
    }
    const res = await fetch(`${baseUrl}/api/support-requests`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: requestId,
        admin_bitrix_id: parseInt(user?.id ?? '0'),
        admin_reply: reply.trim(),
        status,
      }),
    })
    const data = await res.json()
    if (data.success) {
      setAdminRequests(prev => prev.map(r => r.id === requestId
        ? { ...r, admin_reply: reply.trim(), status, replied_by: user?.name, replied_at: new Date().toISOString() }
        : r
      ))
      setReplyText(prev => ({ ...prev, [requestId]: '' }))
      setReplyStatus(prev => ({ ...prev, [requestId]: status }))
    }
  }

  const statusLabel: Record<string, string> = {
    new: '🔴 Новое',
    in_progress: '🟡 В работе',
    resolved: '🟢 Решено',
  }

  const statusColor: Record<string, string> = {
    new: 'bg-red-100 text-red-700',
    in_progress: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Загрузка...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Шапка */}
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
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'my_requests' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            📋 Мои обращения
          </button>
          {isAdmin && (
            <button onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'admin' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              🔧 Обращения ко мне
            </button>
          )}
        </div>

        {/* FAQ */}
        {activeTab === 'faq' && (
          <div className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-900">{item.q}</span>
                  <span className="text-gray-400 flex-shrink-0">{openFaq === i ? '▲' : '▼'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-gray-600 border-t border-gray-100 pt-3">
                    {item.a}
                  </div>
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
                {ADMINS.map(a => (
                  <option key={a.id} value={a.id}>{a.name} — {a.title}</option>
                ))}
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
                rows={5}
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
          <div className="space-y-3">
            {myRequestsLoading ? (
              <p className="text-sm text-gray-400">Загрузка...</p>
            ) : myRequests.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-400 text-sm">У вас пока нет обращений</p>
              </div>
            ) : myRequests.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.subject}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Кому: {r.admin_name} · {new Date(r.created_at).toLocaleString('ru-RU')}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${statusColor[r.status]}`}>
                    {statusLabel[r.status]}
                  </span>
                </div>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{r.message}</p>
                {r.admin_reply && (
                  <div className="border-l-4 border-green-400 pl-3">
                    <p className="text-xs text-gray-500 mb-1">Ответ от {r.replied_by} · {new Date(r.replied_at).toLocaleString('ru-RU')}</p>
                    <p className="text-sm text-gray-700">{r.admin_reply}</p>
                  </div>
                )}
              </div>
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
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.subject}</p>
                    <p className="text-xs text-gray-500 mt-0.5">От: {r.user_name} · {new Date(r.created_at).toLocaleString('ru-RU')}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${statusColor[r.status]}`}>
                    {statusLabel[r.status]}
                  </span>
                </div>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{r.message}</p>
                {r.admin_reply && (
                  <div className="border-l-4 border-green-400 pl-3">
                    <p className="text-xs text-gray-500 mb-1">Ответ · {new Date(r.replied_at).toLocaleString('ru-RU')}</p>
                    <p className="text-sm text-gray-700">{r.admin_reply}</p>
                  </div>
                )}
                {r.status !== 'resolved' && isAdmin && (
                  <div className="space-y-2">
                    <textarea
                      value={replyText[r.id] ?? ''}
                      onChange={e => setReplyText(prev => ({ ...prev, [r.id]: e.target.value }))}
                      placeholder="Напишите ответ или уточняющий вопрос..."
                      rows={3}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
                    <div className="flex gap-2">
                      <select
                        value={replyStatus[r.id] !== undefined ? replyStatus[r.id] : 'in_progress'}
                        onChange={e => setReplyStatus(prev => ({ ...prev, [r.id]: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none">
                        <option value="in_progress">🟡 В работе</option>
                        <option value="resolved">🟢 Решено</option>
                      </select>
                      <button onClick={() => handleReply(r.id, r.user_bitrix_id)}
                        disabled={!replyText[r.id]?.trim()}
                        className="flex-1 bg-gray-900 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-gray-700 disabled:opacity-50">
                        Отправить
                      </button>
                      <button onClick={async () => {
                        if (!confirm(`Удалить обращение безвозвратно?`)) return
                        const res = await fetch(`${baseUrl}/api/support-requests`, {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ request_id: r.id, admin_bitrix_id: parseInt(user?.id ?? '0') }),
                        })
                        const data = await res.json()
                        if (data.success) setAdminRequests(prev => prev.filter(x => x.id !== r.id))
                      }}
                        className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50">
                        🗑
                      </button>
                    </div>
                  </div>
                )}
                {r.status === 'resolved' && (
                  <div className="flex justify-end">
                    <button onClick={async () => {
                      if (!confirm(`Удалить обращение безвозвратно?`)) return
                      const res = await fetch(`${baseUrl}/api/support-requests`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ request_id: r.id, admin_bitrix_id: parseInt(user?.id ?? '0') }),
                      })
                      const data = await res.json()
                      if (data.success) setAdminRequests(prev => prev.filter(x => x.id !== r.id))
                    }}
                      className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50">
                      🗑 Удалить
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}