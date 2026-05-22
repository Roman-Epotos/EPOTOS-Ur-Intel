'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

interface DashboardData {
  my_approvals: {
    id: string
    role: string
    status: string
    approval_sessions: {
      id: string
      deadline: string
      initiated_by_name: string
      contracts: {
        id: string
        number: string
        title: string
        counterparty: string
        status: string
        amount: number | null
      }
    }
  }[]
  deadline_items: {
    id: string
    title: string
    due_date: string
    contract_id: string
    contracts: { id: string; number: string; title: string }
  }[]
  my_drafts: {
    id: string
    number: string
    title: string
    counterparty: string
    created_at: string
    type: string
  }[]
  my_initiated: {
    id: string
    deadline: string
    created_at: string
    contracts: { id: string; number: string; title: string; counterparty: string; status: string }
  }[]
  high_risk_counterparties: {
    id: string
    full_name: string
    short_name: string | null
    inn: string
    risk_level: string
    status: string
  }[]
  stats: {
    total_docs: number
    on_approval: number
    on_execution: number
    total_counterparties: number
  }
}

const baseUrl = 'https://epotos-ur-intel.vercel.app'

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useBitrixAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && user?.id) loadDashboard()
  }, [authLoading, user?.id])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${baseUrl}/api/dashboard?bitrix_user_id=${user!.id}`)
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }

  const getDaysLeft = (date: string) => {
    const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
    return diff
  }

  if (authLoading || loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Загрузка рабочего стола...</p>
    </div>
  )

  if (!data) return null

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Заголовок */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                👋 Добрый день, {user?.name?.split(' ')[1] ?? user?.name?.split(' ')[0]}!
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg">
                📄 Все документы
              </Link>
              {user && [30, 1148].includes(parseInt(user.id)) && (
                <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg">
                  ⚙️ Настройки
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Всего документов', value: data.stats.total_docs, icon: '📄', color: 'text-blue-700' },
            { label: 'На согласовании', value: data.stats.on_approval, icon: '🔄', color: 'text-yellow-700' },
            { label: 'На исполнении', value: data.stats.on_execution, icon: '✅', color: 'text-green-700' },
            { label: 'Контрагентов', value: data.stats.total_counterparties, icon: '🏢', color: 'text-purple-700' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{s.icon}</span>
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Требуют согласования */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>📋</span> Требуют моего согласования
              {data.my_approvals.length > 0 && (
                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  {data.my_approvals.length}
                </span>
              )}
            </h2>
            {data.my_approvals.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Нет документов для согласования</p>
            ) : (
              <div className="space-y-2">
                {data.my_approvals.map(a => {
                  const contract = a.approval_sessions.contracts
                  const daysLeft = getDaysLeft(a.approval_sessions.deadline)
                  return (
                    <div key={a.id}
                      onClick={() => router.push(`/contracts/${contract.id}`)}
                      className="cursor-pointer hover:bg-gray-50 rounded-lg p-3 border border-gray-100 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{contract.number}</p>
                          <p className="text-xs text-gray-500 truncate">{contract.counterparty}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${daysLeft <= 1 ? 'bg-red-100 text-red-700' : daysLeft <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                          {daysLeft > 0 ? `${daysLeft} дн.` : 'просрочен'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Инициатор: {a.approval_sessions.initiated_by_name}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Дедлайны чек-листа */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>⏰</span> Дедлайны чек-листа (3 дня)
              {data.deadline_items.length > 0 && (
                <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  {data.deadline_items.length}
                </span>
              )}
            </h2>
            {data.deadline_items.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Нет срочных пунктов</p>
            ) : (
              <div className="space-y-2">
                {data.deadline_items.map(item => {
                  const daysLeft = getDaysLeft(item.due_date)
                  return (
                    <div key={item.id}
                      onClick={() => router.push(`/contracts/${item.contract_id}`)}
                      className="cursor-pointer hover:bg-gray-50 rounded-lg p-3 border border-gray-100 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                          <p className="text-xs text-gray-500">{item.contracts.number}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${daysLeft === 0 ? 'bg-red-100 text-red-700' : daysLeft === 1 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {daysLeft === 0 ? 'сегодня' : daysLeft === 1 ? 'завтра' : `${daysLeft} дн.`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Мои черновики */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>📄</span> Мои черновики
            </h2>
            {data.my_drafts.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Нет черновиков</p>
            ) : (
              <div className="space-y-2">
                {data.my_drafts.map(d => (
                  <div key={d.id}
                    onClick={() => router.push(`/contracts/${d.id}`)}
                    className="cursor-pointer hover:bg-gray-50 rounded-lg p-3 border border-gray-100 transition-colors">
                    <p className="text-sm font-medium text-gray-900">{d.number}</p>
                    <p className="text-xs text-gray-500 truncate">{d.counterparty}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(d.created_at).toLocaleDateString('ru-RU')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Мои активные согласования */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>🔄</span> Мои активные согласования
            </h2>
            {data.my_initiated.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Нет активных согласований</p>
            ) : (
              <div className="space-y-2">
                {data.my_initiated.map(s => {
                  const contract = s.contracts
                  const daysLeft = getDaysLeft(s.deadline)
                  return (
                    <div key={s.id}
                      onClick={() => router.push(`/contracts/${contract.id}`)}
                      className="cursor-pointer hover:bg-gray-50 rounded-lg p-3 border border-gray-100 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{contract.number}</p>
                          <p className="text-xs text-gray-500 truncate">{contract.counterparty}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${daysLeft <= 2 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {daysLeft > 0 ? `${daysLeft} дн.` : 'просрочен'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Контрагенты с высоким риском */}
          {data.high_risk_counterparties.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                <span>⚠️</span> Контрагенты с высоким риском
                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  {data.high_risk_counterparties.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {data.high_risk_counterparties.map(c => (
                  <div key={c.id}
                    onClick={() => router.push(`/counterparties/${c.id}`)}
                    className="cursor-pointer hover:bg-red-50 rounded-lg p-3 border border-red-100 transition-colors">
                    <p className="text-sm font-medium text-gray-900">{c.short_name ?? c.full_name}</p>
                    <p className="text-xs text-gray-500">ИНН: {c.inn}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
