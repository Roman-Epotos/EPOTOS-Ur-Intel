'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Counterparty {
  id: string
  inn: string
  kpp: string | null
  ogrn: string | null
  full_name: string
  short_name: string | null
  legal_address: string | null
  actual_address: string | null
  director_name: string | null
  director_title: string | null
  phone: string | null
  email: string | null
  website: string | null
  status: string
  risk_level: string
  notes: string | null
  signatory_name: string | null
  poa_number: string | null
  poa_date: string | null
  poa_expires: string | null
  created_at: string
  updated_at: string
  contracts?: {
    id: string
    number: string
    title: string
    status: string
    created_at: string
  }[]
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

export default function CounterpartyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [counterparty, setCounterparty] = useState<Counterparty | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Counterparty>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadCounterparty() }, [id])

  const loadCounterparty = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${baseUrl}/api/counterparties?id=${id}`)
      const data = await res.json()
      setCounterparty(data.counterparty)
      setForm(data.counterparty)
    } finally {
      setLoading(false)
    }
  }

  const saveChanges = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${baseUrl}/api/counterparties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...form }),
      })
      const data = await res.json()
      if (data.success) {
        setCounterparty(data.counterparty)
        setEditing(false)
      } else {
        alert('Ошибка: ' + data.error)
      }
    } finally {
      setSaving(false)
    }
  }

  const deleteCounterparty = async () => {
    if (!confirm('Удалить контрагента? Связи с документами будут разорваны.')) return
    await fetch(`${baseUrl}/api/counterparties?id=${id}`, { method: 'DELETE' })
    router.push('/counterparties')
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Загрузка...</div>
  if (!counterparty) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Контрагент не найден</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Шапка */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/counterparties')}
            className="text-sm text-gray-500 hover:text-gray-900">← Реестр</button>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-bold text-gray-900">
            {counterparty.short_name ?? counterparty.full_name}
          </h1>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[counterparty.status]}`}>
            {counterparty.status}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${riskColors[counterparty.risk_level]}`}>
            Риск: {counterparty.risk_level}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Основная информация */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Реквизиты</h2>
                {!editing ? (
                  <button onClick={() => setEditing(true)}
                    className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 px-3 py-1 rounded-lg">
                    ✏️ Редактировать
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => { setEditing(false); setForm(counterparty) }}
                      className="text-xs border border-gray-200 px-3 py-1 rounded-lg text-gray-600">
                      Отмена
                    </button>
                    <button onClick={saveChanges} disabled={saving}
                      className="text-xs bg-gray-900 text-white px-3 py-1 rounded-lg disabled:opacity-50">
                      {saving ? 'Сохранение...' : 'Сохранить'}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Полное название', key: 'full_name' },
                  { label: 'Краткое название', key: 'short_name' },
                  { label: 'ИНН', key: 'inn' },
                  { label: 'КПП', key: 'kpp' },
                  { label: 'ОГРН', key: 'ogrn' },
                  { label: 'Руководитель', key: 'director_name' },
                  { label: 'Должность', key: 'director_title' },
                  { label: 'Телефон', key: 'phone' },
                  { label: 'Email', key: 'email' },
                  { label: 'Сайт', key: 'website' },
                  { label: 'Подписант по доверенности', key: 'signatory_name' },
                  { label: 'Номер доверенности', key: 'poa_number' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    {editing ? (
                      <input
                        type="text"
                        value={(form[key as keyof Counterparty] as string) ?? ''}
                        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                      />
                    ) : (
                      <p className="text-sm text-gray-900">
                        {(counterparty[key as keyof Counterparty] as string) ?? '—'}
                      </p>
                    )}
                  </div>
                ))}

                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-0.5">Юридический адрес</p>
                  {editing ? (
                    <input type="text" value={form.legal_address ?? ''}
                      onChange={e => setForm(p => ({ ...p, legal_address: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  ) : (
                    <p className="text-sm text-gray-900">{counterparty.legal_address ?? '—'}</p>
                  )}
                </div>

<div>
                  <p className="text-xs text-gray-400 mb-0.5">Дата доверенности</p>
                  {editing ? (
                    <input type="date" value={form.poa_date ?? ''}
                      onChange={e => setForm(p => ({ ...p, poa_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  ) : (
                    <p className="text-sm text-gray-900">{counterparty.poa_date ? new Date(counterparty.poa_date).toLocaleDateString('ru-RU') : '—'}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Срок действия доверенности</p>
                  {editing ? (
                    <input type="date" value={form.poa_expires ?? ''}
                      onChange={e => setForm(p => ({ ...p, poa_expires: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  ) : (
                    <p className={`text-sm ${counterparty.poa_expires && new Date(counterparty.poa_expires) < new Date() ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                      {counterparty.poa_expires ? new Date(counterparty.poa_expires).toLocaleDateString('ru-RU') : '—'}
                      {counterparty.poa_expires && new Date(counterparty.poa_expires) < new Date() ? ' ⚠️ истекла' : ''}
                    </p>
                  )}
                </div>

                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-0.5">Уровень риска</p>
                  {editing ? (
                    <select value={form.risk_level ?? 'не_определён'}
                      onChange={e => setForm(p => ({ ...p, risk_level: e.target.value }))}
                      className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none">
                      <option value="не_определён">Не определён</option>
                      <option value="низкий">Низкий</option>
                      <option value="средний">Средний</option>
                      <option value="высокий">Высокий</option>
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${riskColors[counterparty.risk_level]}`}>
                      {counterparty.risk_level}
                    </span>
                  )}
                </div>

                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-0.5">Заметки</p>
                  {editing ? (
                    <textarea value={form.notes ?? ''}
                      onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                      rows={3}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none resize-none" />
                  ) : (
                    <p className="text-sm text-gray-900">{counterparty.notes ?? '—'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Боковая панель */}
          <div className="space-y-4">
            {/* Договоры */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">
                📄 Документов ({counterparty.contracts?.length ?? 0})
              </h2>
              {counterparty.contracts?.length === 0 ? (
                <p className="text-xs text-gray-400">Документов нет</p>
              ) : (
                <div className="space-y-3">
                  {/* На согласовании */}
                  {(counterparty.contracts?.filter(c => c.status === 'на_согласовании') ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-yellow-700 mb-1.5">
                        🕐 На согласовании ({counterparty.contracts?.filter(c => c.status === 'на_согласовании').length})
                      </p>
                      <div className="space-y-1">
                        {counterparty.contracts?.filter(c => c.status === 'на_согласовании').map(c => (
                          <div key={c.id}
                            onClick={() => router.push(`/contracts/${c.id}`)}
                            className="cursor-pointer hover:bg-yellow-50 rounded-lg p-2 transition-colors border border-yellow-100">
                            <p className="text-xs font-medium text-gray-900">{c.number}</p>
                            <p className="text-xs text-gray-500 truncate">{c.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Действующие */}
                  {(counterparty.contracts?.filter(c => ['подписан','на_исполнении'].includes(c.status)) ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-700 mb-1.5">
                        ✅ Действующие ({counterparty.contracts?.filter(c => ['подписан','на_исполнении'].includes(c.status)).length})
                      </p>
                      <div className="space-y-1">
                        {counterparty.contracts?.filter(c => ['подписан','на_исполнении'].includes(c.status)).map(c => (
                          <div key={c.id}
                            onClick={() => router.push(`/contracts/${c.id}`)}
                            className="cursor-pointer hover:bg-green-50 rounded-lg p-2 transition-colors border border-green-100">
                            <p className="text-xs font-medium text-gray-900">{c.number}</p>
                            <p className="text-xs text-gray-500 truncate">{c.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Остальные (черновики, согласованы и др.) */}
                  {(counterparty.contracts?.filter(c => !['на_согласовании','подписан','на_исполнении'].includes(c.status)) ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">
                        📋 Прочие ({counterparty.contracts?.filter(c => !['на_согласовании','подписан','на_исполнении'].includes(c.status)).length})
                      </p>
                      <div className="space-y-1">
                        {counterparty.contracts?.filter(c => !['на_согласовании','подписан','на_исполнении'].includes(c.status)).map(c => (
                          <div key={c.id}
                            onClick={() => router.push(`/contracts/${c.id}`)}
                            className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors border border-gray-100">
                            <p className="text-xs font-medium text-gray-900">{c.number}</p>
                            <p className="text-xs text-gray-500 truncate">{c.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{c.status}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Действия */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Действия</h2>
              <div className="space-y-2">
                <button
                  onClick={deleteCounterparty}
                  className="w-full text-xs text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
                  🗑️ Удалить контрагента
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Добавлен: {new Date(counterparty.created_at).toLocaleDateString('ru-RU')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}