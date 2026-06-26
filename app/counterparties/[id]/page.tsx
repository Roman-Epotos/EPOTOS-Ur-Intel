'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { proxyUrl } from '@/app/utils/proxyUrl'
import { uploadFileDirect } from '@/app/utils/uploadFile'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

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
  is_individual?: boolean
  is_foreign?: boolean
  country?: string | null
  registration_number?: string | null
  person_birth_date?: string | null
  passport_series?: string | null
  passport_number?: string | null
  passport_issued_by?: string | null
  passport_issued_date?: string | null
  passport_dept_code?: string | null
  person_snils?: string | null
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
  const { user } = useBitrixAuth()
  const [counterparty, setCounterparty] = useState<Counterparty | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Counterparty>>({})
  const [saving, setSaving] = useState(false)

  // Проверка надёжности
  const [checkResult, setCheckResult] = useState<Record<string, unknown> | null>(null)
  const [checkLoading, setCheckLoading] = useState(false)
  const [checkError, setCheckError] = useState('')

  const runCheck = async () => {
    if (!counterparty || counterparty.inn?.startsWith('FOREIGN')) return
    setCheckLoading(true)
    setCheckError('')
    try {
      const res = await fetch(`${baseUrl}/api/counterparties/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inn: counterparty.inn,
          counterparty_id: counterparty.id,
          name: counterparty.short_name ?? counterparty.full_name,
        }),
      })
      const data = await res.json()
      if (data.error) setCheckError(data.error)
      else setCheckResult(data)
    } catch { setCheckError('Ошибка соединения') }
    finally { setCheckLoading(false) }
  }

  // Файлы контрагента
  const [cpDocs, setCpDocs] = useState<{id: string, category: string, file_name: string, file_url: string, uploaded_by_name: string, created_at: string}[]>([])
  const [cpDocsLoading, setCpDocsLoading] = useState(false)
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null)
  const [cpDocError, setCpDocError] = useState('')

  const CP_CATEGORIES = [
    { key: 'charter', label: '📜 Устав' },
    { key: 'poa', label: '📋 Доверенность' },
    { key: 'order', label: '📝 Решение/Приказ' },
    { key: 'other', label: '📎 Прочее' },
  ]

  const loadCpDocs = async () => {
    setCpDocsLoading(true)
    try {
      const res = await fetch(`${baseUrl}/api/counterparties/${id}/documents`)
      const data = await res.json()
      setCpDocs(data.documents ?? [])
    } finally {
      setCpDocsLoading(false)
    }
  }

  const uploadCpDoc = async (file: File, category: string) => {
    setUploadingCategory(category)
    setCpDocError('')
    try {
      const { public_url, file_name } = await uploadFileDirect(
        file,
        'counterparty-docs',
        `${id}/${category}`
      )
      const res = await fetch(`${baseUrl}/api/counterparties/${id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          file_name,
          file_url: public_url,
          file_type: file.type,
          uploaded_by_id: user?.id ?? '0',
          uploaded_by_name: user?.name ?? '',
        }),
      })
      const data = await res.json()
      if (data.success) {
        await loadCpDocs()
      } else {
        setCpDocError(data.error ?? 'Ошибка загрузки')
      }
    } catch (err) {
      setCpDocError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setUploadingCategory(null)
    }
  }

  const deleteCpDoc = async (docId: string) => {
    if (!confirm('Удалить файл?')) return
    const res = await fetch(`${baseUrl}/api/counterparties/${id}/documents?doc_id=${docId}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) setCpDocs(prev => prev.filter(d => d.id !== docId))
  }

  useEffect(() => { loadCounterparty(); loadCpDocs() }, [id])

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
                {(counterparty.is_individual ? [
                  { label: 'ФИО', key: 'full_name' },
                  { label: 'ИНН', key: 'inn' },
                  { label: 'Дата рождения', key: 'person_birth_date' },
                  { label: 'Серия паспорта', key: 'passport_series' },
                  { label: 'Номер паспорта', key: 'passport_number' },
                  { label: 'Кем выдан', key: 'passport_issued_by' },
                  { label: 'Дата выдачи', key: 'passport_issued_date' },
                  { label: 'Код подразделения', key: 'passport_dept_code' },
                  { label: 'СНИЛС', key: 'person_snils' },
                  { label: 'Телефон', key: 'phone' },
                  { label: 'Email', key: 'email' },
                ] : [
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
                ]).map(({ label, key }) => (
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

                {counterparty.is_individual && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 mb-0.5">Адрес регистрации</p>
                    {editing ? (
                      <input type="text" value={form.legal_address ?? ''}
                        onChange={e => setForm(p => ({ ...p, legal_address: e.target.value }))}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                    ) : (
                      <p className="text-sm text-gray-900">{counterparty.legal_address ?? '—'}</p>
                    )}
                  </div>
                )}
                {!counterparty.is_individual && <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-0.5">Юридический адрес</p>
                  {editing ? (
                    <input type="text" value={form.legal_address ?? ''}
                      onChange={e => setForm(p => ({ ...p, legal_address: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  ) : (
                    <p className="text-sm text-gray-900">{counterparty.legal_address ?? '—'}</p>
                  )}
                </div>}

                {!counterparty.is_individual && <div>
                  <p className="text-xs text-gray-400 mb-0.5">Дата доверенности</p>
                  {editing ? (
                    <input type="date" value={form.poa_date ?? ''}
                      onChange={e => setForm(p => ({ ...p, poa_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  ) : (
                    <p className="text-sm text-gray-900">{counterparty.poa_date ? new Date(counterparty.poa_date).toLocaleDateString('ru-RU') : '—'}</p>
                  )}
                </div>}
                {!counterparty.is_individual && <div>
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
                </div>}

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

            {/* Проверка надёжности */}
            {!counterparty.inn?.startsWith('FOREIGN') && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-900">🔍 Проверка надёжности</h2>
                  <button onClick={runCheck} disabled={checkLoading}
                    className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                    {checkLoading ? '⏳ Проверка...' : checkResult ? '🔄 Обновить' : 'Проверить'}
                  </button>
                </div>

                {checkError && <p className="text-xs text-red-600 mb-2">{checkError}</p>}

                {checkResult && (
                  <div className="space-y-3">
                    {/* Общий индикатор */}
                    <div className={`rounded-lg px-3 py-2 text-sm font-medium ${
                      checkResult.risk_level === 'low' ? 'bg-green-50 text-green-700 border border-green-200' :
                      checkResult.risk_level === 'medium' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                      'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {checkResult.risk_level === 'low' ? '🟢 Надёжный' :
                       checkResult.risk_level === 'medium' ? '🟡 Требует внимания' : '🔴 Высокий риск'}
                    </div>

                    {/* Резюме */}
                    <p className="text-xs text-gray-600">{checkResult.summary as string}</p>

                    {/* Детали по источникам */}
                    {(() => {
                      const d = checkResult.dadata as Record<string, unknown> | null
                      const f = checkResult.fssp as Record<string, unknown> | null
                      const b = checkResult.bankrupt as Record<string, unknown> | null
                      const r = checkResult.rnp as Record<string, unknown> | null
                      const statusLabel: Record<string, string> = { ACTIVE: 'Действующая', LIQUIDATING: 'Ликвидируется', LIQUIDATED: 'Ликвидирована', BANKRUPT: 'Банкрот', REORGANIZING: 'Реорганизация' }
                      return (
                        <div className="space-y-2">
                          {d && (
                            <div className="border border-gray-100 rounded-lg p-2">
                              <p className="text-xs font-medium text-gray-700 mb-1">📋 Реквизиты (ЕГРЮЛ)</p>
                              <p className="text-xs text-gray-500">Статус: <span className={`font-medium ${d.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>
                                {statusLabel[d.status as string] ?? (d.status as string) ?? 'Неизвестно'}
                              </span></p>
                              {d.director ? <p className="text-xs text-gray-500">Руководитель: {String(d.director)}</p> : null}
                              {d.registration_date ? <p className="text-xs text-gray-500">Регистрация: {(() => { try { return new Date(Number(d.registration_date)).toLocaleDateString('ru-RU') } catch { return '—' } })()}</p> : null}
                            </div>
                          )}
                          {f && (
                            <div className={`border rounded-lg p-2 ${f.found ? 'border-orange-200 bg-orange-50' : 'border-gray-100'}`}>
                              <p className="text-xs font-medium text-gray-700 mb-1">⚖️ Исполнительные производства</p>
                              <p className="text-xs text-gray-500">{f.found ? `⚠️ Найдено: ${f.count as number}` : '✅ Не найдено'}</p>
                            </div>
                          )}
                          {b && (
                            <div className={`border rounded-lg p-2 ${b.found ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                              <p className="text-xs font-medium text-gray-700 mb-1">🏦 Банкротство (ЕФРСБ)</p>
                              <p className="text-xs text-gray-500">{b.found ? `🔴 Найдено дел: ${b.count as number}` : '✅ Не найдено'}</p>
                            </div>
                          )}
                          {r && (
                            <div className={`border rounded-lg p-2 ${r.found ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                              <p className="text-xs font-medium text-gray-700 mb-1">🚫 Реестр недобросовестных (РНП)</p>
                              <p className="text-xs text-gray-500">{r.found ? `🔴 Включён: ${r.count as number} записей` : '✅ Не включён'}</p>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Дата проверки */}
                    <p className="text-xs text-gray-400">
                      {checkResult.from_cache ? '📦 Из кэша · ' : '🔄 Свежая проверка · '}
                      {checkResult.checked_at ? new Date(checkResult.checked_at as string).toLocaleString('ru-RU') : ''}
                    </p>
                  </div>
                )}

                {!checkResult && !checkLoading && (
                  <p className="text-xs text-gray-400">Нажмите «Проверить» для анализа надёжности контрагента по открытым реестрам</p>
                )}
              </div>
            )}

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
                  {/* На подписи в ЭДО */}
                  {(counterparty.contracts?.filter(c => c.status === 'на_подписи_в_эдо') ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-purple-700 mb-1.5">
                        📧 На подписи в ЭДО ({counterparty.contracts?.filter(c => c.status === 'на_подписи_в_эдо').length})
                      </p>
                      <div className="space-y-1">
                        {counterparty.contracts?.filter(c => c.status === 'на_подписи_в_эдо').map(c => (
                          <div key={c.id}
                            onClick={() => router.push(`/contracts/${c.id}`)}
                            className="cursor-pointer hover:bg-purple-50 rounded-lg p-2 transition-colors border border-purple-100">
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
                  {(counterparty.contracts?.filter(c => !['на_согласовании','на_подписи_в_эдо','подписан','на_исполнении'].includes(c.status)) ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">
                        📋 Прочие ({counterparty.contracts?.filter(c => !['на_согласовании','на_подписи_в_эдо','подписан','на_исполнении'].includes(c.status)).length})
                      </p>
                      <div className="space-y-1">
                        {counterparty.contracts?.filter(c => !['на_согласовании','на_подписи_в_эдо','подписан','на_исполнении'].includes(c.status)).map(c => (
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

            {/* Файлы контрагента */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">📁 Документы контрагента</h2>
              {cpDocError && <p className="text-xs text-red-600 mb-2">{cpDocError}</p>}
              {cpDocsLoading ? (
                <p className="text-xs text-gray-400">Загрузка...</p>
              ) : (
                <div className="space-y-3">
                  {CP_CATEGORIES.map(cat => {
                    const catDocs = cpDocs.filter(d => d.category === cat.key)
                    return (
                      <div key={cat.key}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-gray-600">{cat.label}</p>
                          <label className="cursor-pointer text-xs text-blue-600 hover:text-blue-800">
                            {uploadingCategory === cat.key ? '⏳' : '+ Загрузить'}
                            <input type="file" className="hidden" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadCpDoc(f, cat.key); e.target.value = '' }} />
                          </label>
                        </div>
                        {catDocs.length === 0 ? (
                          <p className="text-xs text-gray-300 italic">Не загружено</p>
                        ) : (
                          <div className="space-y-1">
                            {catDocs.map(doc => (
                              <div key={doc.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                                <a href={proxyUrl(doc.file_url)} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline truncate max-w-[140px]">
                                  📄 {doc.file_name}
                                </a>
                                <button onClick={() => deleteCpDoc(doc.id)}
                                  className="text-gray-300 hover:text-red-500 ml-1 flex-shrink-0">✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
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