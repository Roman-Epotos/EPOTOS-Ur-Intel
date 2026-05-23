'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

interface LegalDashData {
  status_stats: Record<string, number>
  company_stats: Record<string, number>
  overdue_approvals: {
    id: string
    deadline: string
    initiated_by_name: string
    contracts: { id: string; number: string; title: string; counterparty: string; status: string }
  }[]
  unsigned_contracts: {
    id: string; number: string; title: string; counterparty: string; created_at: string
  }[]
  overdue_checklist: {
    id: string; title: string; due_date: string; contract_id: string
    contracts: { id: string; number: string; title: string }
  }[]
  weekly_dynamics: Record<string, number>
  company_period_stats: Record<string, number>
  total_period: number
  period_days: number
}

const STATUS_LABELS: Record<string, string> = {
  черновик: 'Черновик',
  на_согласовании: 'На согласовании',
  согласован: 'Согласован',
  отклонён: 'Отклонён',
  загружен_частично: 'Загружен частично',
  подписан: 'Подписан',
  на_исполнении: 'На исполнении',
}

const STATUS_COLORS: Record<string, string> = {
  черновик: 'bg-gray-100 text-gray-700',
  на_согласовании: 'bg-yellow-100 text-yellow-700',
  согласован: 'bg-blue-100 text-blue-700',
  отклонён: 'bg-red-100 text-red-700',
  загружен_частично: 'bg-orange-100 text-orange-700',
  подписан: 'bg-green-100 text-green-700',
  на_исполнении: 'bg-emerald-100 text-emerald-700',
}

const PERIOD_OPTIONS = [
  { value: '30', label: '30 дней' },
  { value: '90', label: 'Квартал' },
  { value: '180', label: 'Полгода' },
  { value: '365', label: 'Год' },
]

const COMPANY_NAMES: Record<string, string> = {
  'ТХ': 'ООО Техно',
  'НПП': 'ООО НПП ЭПОТОС',
  'СПТ': 'ООО СПТ',
  'ОС': 'ООО ОС',
  'Э-К': 'ООО Эпотос-К',
}

const baseUrl = 'https://epotos-ur-intel.vercel.app'

export default function LegalDashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useBitrixAuth()
  const [data, setData] = useState<LegalDashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  const ADMIN_IDS = [30, 1148]
  const GC_MANAGER_IDS = [1, 246, 504]
  const DIRECTOR_MAP: Record<number, string[]> = {
    592: ['НПП'],
    6: ['СПТ', 'ОС'],
    954: ['Э-К'],
  }
  const userId = parseInt(user?.id ?? '0')
  const isAdminOrManager = ADMIN_IDS.includes(userId) || GC_MANAGER_IDS.includes(userId)
  const directorCompanies = DIRECTOR_MAP[userId] ?? []
  const hasAccess = isAdminOrManager || directorCompanies.length > 0
  const companyPrefix = isAdminOrManager ? null : directorCompanies.join(',')

  useEffect(() => {
    if (!authLoading && user?.id) loadData()
  }, [authLoading, user?.id, period])

  const loadData = async () => {
    setLoading(true)
    try {
      const url = companyPrefix
        ? `${baseUrl}/api/dashboard-legal?period=${period}&company_prefix=${companyPrefix}`
        : `${baseUrl}/api/dashboard-legal?period=${period}`
      const res = await fetch(url)
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }

  const getDaysOverdue = (date: string) => {
    return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  }

  if (authLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Загрузка...</p>
    </div>
  )

  if (!hasAccess) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-900 font-medium">Доступ запрещён</p>
        <p className="text-gray-500 text-sm mt-1">Дашборд доступен только для администраторов и руководителей</p>
        <Link href="/" className="mt-4 inline-block text-sm text-gray-900 underline">На главную</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Шапка */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Главная</Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-bold text-gray-900">⚖️ Юридический дашборд</h1>
          </div>
          {/* Выбор периода */}
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setPeriod(opt.value)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${period === opt.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Загрузка данных...</div>
        ) : !data ? null : (
          <div className="space-y-6">

            {/* Статистика по статусам */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">📊 Документы по статусам</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <div key={status} className="text-center">
                    <div className={`text-2xl font-bold mb-1 ${STATUS_COLORS[status]?.split(' ')[1] ?? 'text-gray-700'}`}>
                      {data.status_stats[status] ?? 0}
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Просроченные согласования */}
              <div className="bg-white rounded-xl border border-red-200 p-5">
                <h2 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                  ⏰ Просроченные согласования
                  {data.overdue_approvals.length > 0 && (
                    <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                      {data.overdue_approvals.length}
                    </span>
                  )}
                </h2>
                {data.overdue_approvals.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">✅ Просроченных нет</p>
                ) : (
                  <div className="space-y-2">
                    {data.overdue_approvals.map(a => (
                      <div key={a.id} onClick={() => router.push(`/contracts/${a.contracts.id}`)}
                        className="cursor-pointer hover:bg-red-50 rounded-lg p-3 border border-red-100 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{a.contracts.number}</p>
                            <p className="text-xs text-gray-500 truncate">{a.contracts.counterparty}</p>
                            <p className="text-xs text-gray-400">Инициатор: {a.initiated_by_name}</p>
                          </div>
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                            +{getDaysOverdue(a.deadline)} дн.
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Согласованы без подписанных */}
              <div className="bg-white rounded-xl border border-orange-200 p-5">
                <h2 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                  📋 Согласованы — ожидают подписания
                  {data.unsigned_contracts.length > 0 && (
                    <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                      {data.unsigned_contracts.length}
                    </span>
                  )}
                </h2>
                {data.unsigned_contracts.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">✅ Все подписаны</p>
                ) : (
                  <div className="space-y-2">
                    {data.unsigned_contracts.map(c => (
                      <div key={c.id} onClick={() => router.push(`/contracts/${c.id}`)}
                        className="cursor-pointer hover:bg-orange-50 rounded-lg p-3 border border-orange-100 transition-colors">
                        <p className="text-sm font-medium text-gray-900">{c.number}</p>
                        <p className="text-xs text-gray-500 truncate">{c.counterparty}</p>
                        <p className="text-xs text-gray-400">
                          Согласован {new Date(c.created_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Просроченные пункты чек-листа */}
              <div className="bg-white rounded-xl border border-yellow-200 p-5">
                <h2 className="text-sm font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                  🔴 Просроченные пункты чек-листа
                  {data.overdue_checklist.length > 0 && (
                    <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full">
                      {data.overdue_checklist.length}
                    </span>
                  )}
                </h2>
                {data.overdue_checklist.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">✅ Просроченных нет</p>
                ) : (
                  <div className="space-y-2">
                    {data.overdue_checklist.map(item => (
                      <div key={item.id} onClick={() => router.push(`/contracts/${item.contract_id}`)}
                        className="cursor-pointer hover:bg-yellow-50 rounded-lg p-3 border border-yellow-100 transition-colors">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        <p className="text-xs text-gray-500">{item.contracts.number}</p>
                        <p className="text-xs text-red-500">
                          Просрочен с {new Date(item.due_date).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Динамика по компаниям за период */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">
                  📈 Создано документов за {PERIOD_OPTIONS.find(o => o.value === period)?.label}
                  <span className="ml-2 text-gray-400 font-normal">({data.total_period} всего)</span>
                </h2>
                {Object.keys(data.company_period_stats).length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">Нет документов за период</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(data.company_period_stats)
                      .sort(([, a], [, b]) => b - a)
                      .map(([company, count]) => {
                        const max = Math.max(...Object.values(data.company_period_stats))
                        const pct = Math.round((count / max) * 100)
                        return (
                          <div key={company}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">{COMPANY_NAMES[company] ?? company}</span>
                              <span className="text-xs font-medium text-gray-900">{count}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div className="bg-gray-900 h-2 rounded-full transition-all"
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}