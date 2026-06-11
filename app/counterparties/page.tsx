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
  is_foreign?: boolean
  country?: string | null
  registration_number?: string | null
  check_risk?: 'low' | 'medium' | 'high' | null
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
  const [filterType, setFilterType] = useState<'all' | 'russian' | 'foreign'>('all')

  // Модалка иностранного контрагента
  const [showForeignModal, setShowForeignModal] = useState(false)
  const [foreignForm, setForeignForm] = useState({
    full_name: '', short_name: '', country: '',
    registration_number: '', director_name: '', phone: '', email: '',
  })
  const [foreignSaving, setForeignSaving] = useState(false)
  const [foreignError, setForeignError] = useState('')

  const saveForeignCounterparty = async () => {
    if (!foreignForm.full_name.trim() || !foreignForm.country.trim()) {
      setForeignError('Заполните название и страну')
      return
    }
    setForeignSaving(true)
    setForeignError('')
    try {
      const res = await fetch(`${baseUrl}/api/counterparties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: foreignForm.full_name.trim(),
          short_name: foreignForm.short_name.trim() || null,
          inn: `FOREIGN-${Date.now()}`,
          kpp: null,
          ogrn: null,
          legal_address: null,
          status: 'активный',
          director_name: foreignForm.director_name.trim() || null,
          phone: foreignForm.phone.trim() || null,
          email: foreignForm.email.trim() || null,
          is_foreign: true,
          country: foreignForm.country.trim(),
          registration_number: foreignForm.registration_number.trim() || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowForeignModal(false)
        setForeignForm({ full_name: '', short_name: '', country: '', registration_number: '', director_name: '', phone: '', email: '' })
        setFilterType('foreign')
        await loadCounterparties()
      } else {
        setForeignError(data.error ?? 'Ошибка сохранения')
      }
    } finally {
      setForeignSaving(false)
    }
  }

  useEffect(() => {
    loadCounterparties().then(list => loadRisks(list ?? []))
  }, [])

  const loadRisks = async (list: Counterparty[]) => {
    const inns = list.filter(c => c.inn && !c.inn.startsWith('FOREIGN')).map(c => c.inn)
    if (inns.length === 0) return
    try {
      const res = await fetch(`${baseUrl}/api/counterparties/check-cache?inns=${inns.join(',')}`)
      const data = await res.json()
      if (data.risks) {
        setCounterparties(prev => prev.map(c => ({
          ...c,
          check_risk: data.risks[c.inn] ?? null,
        })))
      }
    } catch { /* тихо игнорируем */ }
  }

  const loadCounterparties = async (q?: string): Promise<Counterparty[]> => {
    setLoading(true)
    try {
      const url = q
        ? `${baseUrl}/api/counterparties?search=${encodeURIComponent(q)}`
        : `${baseUrl}/api/counterparties`
      const res = await fetch(url)
      const data = await res.json()
      const list: Counterparty[] = data.counterparties ?? []
      setCounterparties(list)
      return list
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
          <div className="flex gap-2">
            <button onClick={() => setShowAddModal(true)}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
              🇷🇺 Российский
            </button>
            <button onClick={() => setShowForeignModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              🌍 Иностранный
            </button>
          </div>
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

        {/* Фильтр тип */}
        <div className="flex gap-2 mb-4 flex-shrink-0">
          {(['all','russian','foreign'] as const).map(f => (
            <button key={f} onClick={() => setFilterType(f)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filterType === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {f === 'all' ? 'Все контрагенты' : f === 'russian' ? '🇷🇺 Российские' : '🌍 Иностранные'}
            </button>
          ))}
        </div>

        {/* Список */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Загрузка...</div>
          ) : counterparties.filter(c =>
              filterType === 'all' ? true :
              filterType === 'russian' ? !c.is_foreign :
              !!c.is_foreign
            ).length === 0 ? (
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
                {counterparties.filter(c =>
                  filterType === 'all' ? true :
                  filterType === 'russian' ? !c.is_foreign :
                  !!c.is_foreign
                ).map(c => (
                  <tr key={c.id}
                    onClick={() => router.push(`/counterparties/${c.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {c.is_foreign && <span className="text-base">🌍</span>}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.short_name ?? c.full_name}</p>
                          {c.short_name && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{c.full_name}</p>}
                          {c.is_foreign && c.country && <p className="text-xs text-blue-500 mt-0.5">{c.country}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.is_foreign ? (c.registration_number ?? '—') : c.inn}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.director_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${riskColors[c.risk_level] ?? 'bg-gray-100 text-gray-500'}`}>
                          {c.risk_level}
                        </span>
                        {c.check_risk === 'low' && <span title="Надёжный">🟢</span>}
                        {c.check_risk === 'medium' && <span title="Требует внимания">🟡</span>}
                        {c.check_risk === 'high' && <span title="Высокий риск">🔴</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Модал добавления иностранного контрагента */}
      {showForeignModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-gray-900 mb-4">🌍 Добавить иностранного контрагента</h3>
            {foreignError && <p className="text-sm text-red-600 mb-3">{foreignError}</p>}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Полное название <span className="text-red-500">*</span></label>
                <input value={foreignForm.full_name} onChange={e => setForeignForm(p => ({...p, full_name: e.target.value}))}
                  placeholder="ACME Corporation Ltd."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Краткое название</label>
                <input value={foreignForm.short_name} onChange={e => setForeignForm(p => ({...p, short_name: e.target.value}))}
                  placeholder="ACME Corp"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Страна <span className="text-red-500">*</span></label>
                <input value={foreignForm.country} onChange={e => setForeignForm(p => ({...p, country: e.target.value}))}
                  placeholder="США, Германия, Китай..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Регистрационный номер</label>
                <input value={foreignForm.registration_number} onChange={e => setForeignForm(p => ({...p, registration_number: e.target.value}))}
                  placeholder="EIN, VAT, Company No..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Руководитель</label>
                <input value={foreignForm.director_name} onChange={e => setForeignForm(p => ({...p, director_name: e.target.value}))}
                  placeholder="John Smith"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Телефон</label>
                <input value={foreignForm.phone} onChange={e => setForeignForm(p => ({...p, phone: e.target.value}))}
                  placeholder="+1 234 567 8900"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
                <input value={foreignForm.email} onChange={e => setForeignForm(p => ({...p, email: e.target.value}))}
                  placeholder="contact@acme.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveForeignCounterparty} disabled={foreignSaving}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {foreignSaving ? 'Сохранение...' : 'Добавить'}
              </button>
              <button onClick={() => { setShowForeignModal(false); setForeignError('') }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

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