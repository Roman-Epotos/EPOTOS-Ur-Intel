'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

interface FinanceDashData {
  stats_sums: Record<string, number>
  stats_count: Record<string, number>
  debt_contracts: {
    id: string; number: string; title: string
    counterparty: string; amount: number; end_date: string | null
  }[]
  total_debt: number
  no_amount_contracts: {
    id: string; number: string; title: string
    counterparty: string; status: string; created_at: string
  }[]
  top_counterparties: { name: string; total: number }[]
  company_amounts: Record<string, number>
  total_period_amount: number
  period_days: number
}

const PERIOD_OPTIONS = [
  { value: '30', label: '30 дней' },
  { value: '90', label: 'Квартал' },
  { value: '180', label: 'Полгода' },
  { value: '365', label: 'Год' },
]

const COMPANY_NAMES: Record<string, string> = {
  'ТХ': 'ООО Техно', 'НПП': 'ООО НПП ЭПОТОС',
  'СПТ': 'ООО СПТ', 'ОС': 'ООО ОС', 'Э-К': 'ООО Эпотос-К',
}

const STATUS_LABELS: Record<string, string> = {
  на_согласовании: 'На согласовании',
  согласован: 'Согласован',
  загружен_частично: 'Загружен частично',
  подписан: 'Подписан',
  на_исполнении: 'На исполнении',
}

const baseUrl = 'https://epotos-ur-intel.vercel.app'

const formatSum = (n: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)

export default function FinanceDashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useBitrixAuth()
  const [data, setData] = useState<FinanceDashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const [hasAccess, setHasAccess] = useState(false)
  const [companyPrefix, setCompanyPrefix] = useState<string | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<string>('all')
  const [companies, setCompanies] = useState<{ prefix: string; name: string }[]>([])

  const GC_ROLES = ['developer', 'admin', 'gc_manager', 'finance_gc', 'legal_gc']
  const ALLOWED_ROLES = [...GC_ROLES, 'director', 'finance']

  useEffect(() => {
    if (authLoading || !user?.id) return
    fetch(`${baseUrl}/api/user-role?bitrix_user_id=${user.id}`)
      .then(r => r.json())
      .then(d => {
        const allRoles: string[] = d.all_roles ?? [d.role]
        const hasAllowed = allRoles.some(r => ALLOWED_ROLES.includes(r))
        if (hasAllowed) {
          setHasAccess(true)
          const isGC = allRoles.some(r => GC_ROLES.includes(r))
          setCompanyPrefix(isGC ? null : d.companies.join(','))
        }
      })
  }, [authLoading, user?.id])

  useEffect(() => {
    fetch(`${baseUrl}/api/company-requisites`)
      .then(r => r.json())
      .then(d => {
        const list = (d.requisites ?? []).map((r: { company_prefix: string; short_name: string }) => ({
          prefix: r.company_prefix,
          name: r.short_name ?? r.company_prefix,
        }))
        setCompanies(list)
      })
  }, [])

  useEffect(() => {
    if (hasAccess) loadData()
  }, [hasAccess, period, selectedCompany])

  const loadData = async () => {
    setLoading(true)
    try {
      const effectivePrefix = selectedCompany !== 'all'
        ? selectedCompany
        : companyPrefix
      const url = effectivePrefix
        ? `${baseUrl}/api/dashboard-finance?period=${period}&company_prefix=${effectivePrefix}`
        : `${baseUrl}/api/dashboard-finance?period=${period}`
      const res = await fetch(url)
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
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
        <p className="text-gray-500 text-sm mt-1">Финансовый дашборд недоступен для вашей роли</p>
        <Link href="/" className="mt-4 inline-block text-sm text-gray-900 underline">На главную</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Шапка */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 flex-shrink-0">← Рабочий стол</Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">💰 Финансовый дашборд</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {companies.length > 1 && (
              <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer">
                <option value="all">ГК ЭПОТОС</option>
                {companies
                  .filter(c => !companyPrefix || companyPrefix.split(',').includes(c.prefix))
                  .map(c => (
                    <option key={c.prefix} value={c.prefix}>{c.name}</option>
                  ))}
              </select>
            )}
            <div className="flex gap-2">
              {PERIOD_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setPeriod(opt.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${period === opt.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Загрузка данных...</div>
        ) : !data ? null : (
          <div className="space-y-6">

            {/* Суммы по статусам */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">💰 Суммы договоров по статусам</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <div key={status} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className="text-sm font-bold text-gray-900">
                      {formatSum(data.stats_sums[status] ?? 0)}
                    </p>
                    <p className="text-xs text-gray-400">{data.stats_count[status] ?? 0} дог.</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Дебиторская задолженность */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  📊 Дебиторская задолженность
                </h2>
                <p className="text-2xl font-bold text-red-600 mb-3">{formatSum(data.total_debt)}</p>
                {data.debt_contracts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Нет договоров на исполнении</p>
                ) : (
                  <div className="space-y-2">
                    {data.debt_contracts.map(c => (
                      <div key={c.id} onClick={() => router.push(`/contracts/${c.id}`)}
                        className="cursor-pointer hover:bg-gray-50 rounded-lg p-3 border border-gray-100 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{c.number}</p>
                            <p className="text-xs text-gray-500 truncate">{c.counterparty}</p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                            {formatSum(c.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Топ контрагентов */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">🏢 Топ контрагентов по сумме</h2>
                {data.top_counterparties.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Нет данных</p>
                ) : (
                  <div className="space-y-2">
                    {data.top_counterparties.map((c, i) => {
                      const max = data.top_counterparties[0]?.total ?? 1
                      const pct = Math.round((c.total / max) * 100)
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-600 truncate max-w-xs">{c.name}</span>
                            <span className="text-xs font-medium text-gray-900 ml-2 whitespace-nowrap">{formatSum(c.total)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="bg-gray-900 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Договоры без суммы */}
              <div className="bg-white rounded-xl border border-orange-200 p-5">
                <h2 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                  ⚠️ Договоры без суммы
                  {data.no_amount_contracts.length > 0 && (
                    <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                      {data.no_amount_contracts.length}
                    </span>
                  )}
                </h2>
                {data.no_amount_contracts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">✅ Все суммы указаны</p>
                ) : (
                  <div className="space-y-2">
                    {data.no_amount_contracts.map(c => (
                      <div key={c.id} onClick={() => router.push(`/contracts/${c.id}`)}
                        className="cursor-pointer hover:bg-orange-50 rounded-lg p-3 border border-orange-100 transition-colors">
                        <p className="text-sm font-medium text-gray-900">{c.number}</p>
                        <p className="text-xs text-gray-500 truncate">{c.counterparty}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Динамика по компаниям */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">
                  📈 Суммы за {PERIOD_OPTIONS.find(o => o.value === period)?.label}
                </h2>
                <p className="text-2xl font-bold text-gray-900 mb-3">{formatSum(data.total_period_amount)}</p>
                {Object.keys(data.company_amounts).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Нет данных за период</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(data.company_amounts)
                      .sort(([, a], [, b]) => b - a)
                      .map(([company, amount]) => {
                        const max = Math.max(...Object.values(data.company_amounts))
                        const pct = Math.round((amount / max) * 100)
                        return (
                          <div key={company}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-600">{COMPANY_NAMES[company] ?? company}</span>
                              <span className="text-xs font-medium text-gray-900">{formatSum(amount)}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="bg-gray-900 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
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