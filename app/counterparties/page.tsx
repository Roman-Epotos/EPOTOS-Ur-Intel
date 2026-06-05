'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Counterparty {
  id: string
  inn: string
  short_name: string | null
  full_name: string
  status: string
  risk_level: string
  director_name: string | null
  phone: string | null
  email: string | null
  created_at: string
}

const statusColors: Record<string, string> = {
  'активный': 'bg-green-100 text-green-700',
  'ликвидирован': 'bg-red-100 text-red-700',
  'в_реорганизации': 'bg-yellow-100 text-yellow-700',
  'приостановлен': 'bg-gray-100 text-gray-700',
}

const riskColors: Record<string, string> = {
  'низкий': 'bg-green-100 text-green-700',
  'средний': 'bg-yellow-100 text-yellow-700',
  'высокий': 'bg-red-100 text-red-700',
  'не_определён': 'bg-gray-100 text-gray-500',
}

const baseUrl = 'https://epotos-ur-intel.vercel.app'

export default function CounterpartiesPage() {
  const router = useRouter()
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [innInput, setInnInput] = useState('')
  const [checkLoading, setCheckLoading] = useState(false)
  const [checkResult, setCheckResult] = useState<Record<string, string> | null>(null)
  const [checkError, setCheckError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCounterparties()
  }, [])

  const loadCounterparties = async (q?: string) => {
    setLoading(true)
    try {
      const url = q
        ? `${baseUrl}/api/counterparties?search=${encodeURIComponent(q)}`
        : `${baseUrl}/api/counterparties`
      const res = await fetch(url)
      const data = await res.json()
      setCounterparties(data.counterparties ?? [])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    if (value.length >= 2 || value.length === 0) {
      loadCounterparties(value || undefined)
    }
  }

  const checkInn = async () => {
    if (!innInput.trim()) return
    setCheckLoading(true)
    setCheckResult(null)
    setCheckError('')
    try {
      const res = await fetch(`${baseUrl}/api/counterparties/check-inn?inn=${innInput.trim()}`)
      const data = await res.json()
      if (data.found) {
        setCheckResult(data.data)
      } else {
        setCheckError(data.message ?? 'Организация не найдена')
      }
    } catch {
      setCheckError('Ошибка соединения')
    } finally {
      setCheckLoading(false)
    }
  }

  const saveCounterparty = async () => {
    if (!checkResult) return
    setSaving(true)
    try {
      const res = await fetch(`${baseUrl}/api/counterparties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkResult),
      })
      const data = await res.json()
      if (data.success) {
        setShowAddModal(false)
        setInnInput('')
        setCheckResult(null)
        await loadCounterparties()
        router.push(`/counterparties/${data.counterparty.id}`)
      } else {
        alert('Ошибка: ' + data.error)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <div className="max-w-6xl mx-auto w-full flex flex-col flex-1 overflow-hidden px-6 py-6">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Главная</Link>
              <span className="text-gray-300">/</span>
              <h1 className="text-xl font-bold text-gray-900">🏢 Реестр контрагентов</h1>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Управление и проверка контрагентов</p>
          </div>
          <button onClick={() => setShowAddModal(true)}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
            + Добавить контрагента
          </button>
        </div>

        {/* Поиск */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex-shrink-0">
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Поиск по названию или ИНН..."
            className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {/* Список */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Загрузка...</div>
          ) : counterparties.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">Контрагентов не найдено</p>
              <p className="text-gray-300 text-xs mt-1">Добавьте первого контрагента по ИНН</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Организация</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">ИНН</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Руководитель</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Статус</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Риск</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {counterparties.map(c => (
                  <tr key={c.id}
                    onClick={() => router.push(`/counterparties/${c.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{c.short_name ?? c.full_name}</p>
                      {c.short_name && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{c.full_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.inn}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.director_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${riskColors[c.risk_level] ?? 'bg-gray-100 text-gray-500'}`}>
                        {c.risk_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Модал добавления по ИНН */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              🔍 Добавить контрагента по ИНН
            </h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={innInput}
                onChange={e => setInnInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && checkInn()}
                placeholder="Введите ИНН (10 или 12 цифр)"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button onClick={checkInn} disabled={checkLoading || !innInput.trim()}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                {checkLoading ? '...' : 'Проверить'}
              </button>
            </div>

            {checkError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">{checkError}</p>
              </div>
            )}

            {checkResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 space-y-1">
                <p className="text-sm font-medium text-green-900">{checkResult.full_name}</p>
                {checkResult.short_name && <p className="text-xs text-green-700">{checkResult.short_name}</p>}
                <p className="text-xs text-green-700">ИНН: {checkResult.inn}{checkResult.kpp ? ` / КПП: ${checkResult.kpp}` : ''}</p>
                {checkResult.ogrn && <p className="text-xs text-green-700">ОГРН: {checkResult.ogrn}</p>}
                {checkResult.director_name && <p className="text-xs text-green-700">Руководитель: {checkResult.director_name}</p>}
                {checkResult.legal_address && <p className="text-xs text-green-700">Адрес: {checkResult.legal_address}</p>}
                <p className="text-xs text-green-700">Статус: {checkResult.status}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAddModal(false); setInnInput(''); setCheckResult(null); setCheckError('') }}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
              {checkResult && (
                <button onClick={saveCounterparty} disabled={saving}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
                  {saving ? 'Сохранение...' : 'Добавить в реестр'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}