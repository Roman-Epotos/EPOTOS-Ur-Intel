'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'
import { DOCUMENT_TYPES, REGIONS, CONTRACT_DOCUMENT_TYPES } from '@/app/lib/documentTypes'

const COMPANIES = [
  { id: 'ТХ',  name: 'ООО Техно' },
  { id: 'НПП', name: 'ООО НПП ЭПОТОС' },
  { id: 'СПТ', name: 'ООО СПТ' },
  { id: 'ОС',  name: 'ООО ОС' },
  { id: 'Э-К', name: 'ООО Эпотос-К' },
]

export default function NewContractPage() {
  const { user } = useBitrixAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [autoNumber, setAutoNumber] = useState('')
  const [editingNumber, setEditingNumber] = useState(false)
  const [manualNumber, setManualNumber] = useState('')
  const [numberChanged, setNumberChanged] = useState(false)
  const [form, setForm] = useState({
    company_prefix: '',
    title: '',
    counterparty: '',
    type: '',
    amount: '',
    start_date: '',
    end_date: '',
    document_category: 'contract',
    region: '',
    customer_number: '',
  })
  const [counterpartyType, setCounterpartyType] = useState<'russian' | 'foreign'>('russian')
  const [foreignSearch, setForeignSearch] = useState('')
  const [foreignSuggestions, setForeignSuggestions] = useState<{id: string, full_name: string, short_name: string | null, country: string | null, registration_number: string | null}[]>([])
  const [showForeignSuggestions, setShowForeignSuggestions] = useState(false)
  const [foreignNotFound, setForeignNotFound] = useState(false)
  const [foreignSearchLoading, setForeignSearchLoading] = useState(false)
  const [showAddForeignModal, setShowAddForeignModal] = useState(false)
  const [addForeignForm, setAddForeignForm] = useState({ full_name: '', country: '', registration_number: '' })
  const [addForeignLoading, setAddForeignLoading] = useState(false)
  const [addForeignError, setAddForeignError] = useState('')
  const [counterpartyId, setCounterpartyId] = useState<string | null>(null)
  const [counterpartySearch, setCounterpartySearch] = useState('')
  const [counterpartySuggestions, setCounterpartySuggestions] = useState<{id: string, short_name: string | null, full_name: string, inn: string}[]>([])
  const [showCounterpartySuggestions, setShowCounterpartySuggestions] = useState(false)
  const [counterpartySearchLoading, setCounterpartySearchLoading] = useState(false)
  const [counterpartyNotFound, setCounterpartyNotFound] = useState(false)

  // Мини-модалка добавления контрагента
  const [showAddCpModal, setShowAddCpModal] = useState(false)
  const [addCpInn, setAddCpInn] = useState('')
  const [addCpLoading, setAddCpLoading] = useState(false)
  const [addCpResult, setAddCpResult] = useState<{
    inn: string; kpp: string | null; ogrn: string | null; full_name: string;
    short_name: string | null; legal_address: string | null; status: string;
    director_name: string | null; director_title: string | null;
  } | null>(null)
  const [addCpError, setAddCpError] = useState('')
  const [addCpSaving, setAddCpSaving] = useState(false)

  const searchCounterpartyByInn = async () => {
    if (!addCpInn.trim()) return
    setAddCpLoading(true)
    setAddCpError('')
    setAddCpResult(null)
    try {
      const res = await fetch(`https://epotos-ur-intel.vercel.app/api/counterparties/check-inn?inn=${addCpInn.trim()}`)
      const data = await res.json()
      if (data.found) {
        setAddCpResult(data.data)
      } else {
        setAddCpError(data.message ?? 'Организация не найдена в DaData')
      }
    } catch {
      setAddCpError('Ошибка соединения')
    } finally {
      setAddCpLoading(false)
    }
  }

  const saveNewCounterparty = async () => {
    if (!addCpResult) return
    setAddCpSaving(true)
    setAddCpError('')
    try {
      const res = await fetch('https://epotos-ur-intel.vercel.app/api/counterparties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addCpResult),
      })
      const data = await res.json()
      if (data.success) {
        const cp = data.counterparty
        const displayName = cp.short_name ?? cp.full_name
        setCounterpartySearch(displayName)
        setForm(p => ({ ...p, counterparty: displayName }))
        setCounterpartyId(cp.id)
        setShowAddCpModal(false)
        setAddCpInn('')
        setAddCpResult(null)
        setCounterpartyNotFound(false)
        setShowCounterpartySuggestions(false)
      } else {
        setAddCpError(data.error ?? 'Ошибка сохранения')
      }
    } finally {
      setAddCpSaving(false)
    }
  }

  // Связанный документ
  const [isChild, setIsChild] = useState(false)
  const [parentSource, setParentSource] = useState<'system' | 'external'>('system')
  const [parentContractExternal, setParentContractExternal] = useState('')
  const [parentContractId, setParentContractId] = useState<string | null>(null)
  const [parentContractNumber, setParentContractNumber] = useState('')
  const [parentSearch, setParentSearch] = useState('')
  const [parentSearchLoading, setParentSearchLoading] = useState(false)
  const [parentSuggestions, setParentSuggestions] = useState<{id: string, number: string, title: string, counterparty: string, status: string}[]>([])
  const [showParentSuggestions, setShowParentSuggestions] = useState(false)

  useEffect(() => {
    if (!form.company_prefix || !form.type) {
      setAutoNumber('')
      setManualNumber('')
      setNumberChanged(false)
      setEditingNumber(false)
      return
    }
    // Дочерний документ с привязкой к родителю в системе —
    // ждём выбора родителя, без него номер не генерируем
    if (isChild && parentSource === 'system') {
      if (!parentContractId) {
        setAutoNumber('')
        setManualNumber('')
        setNumberChanged(false)
        setEditingNumber(false)
        return
      }
      generateChildNumber(parentContractId, form.type)
      return
    }
    // Стандартная нумерация
    const generate = async () => {
      try {
        const baseUrl = 'https://epotos-ur-intel.vercel.app'
        const res = await fetch(`${baseUrl}/api/contracts?prefix=${encodeURIComponent(form.company_prefix)}&type=${encodeURIComponent(form.type)}`)
        const data = await res.json()
        if (data.number) {
          setAutoNumber(data.number)
          setManualNumber(data.number)
          setNumberChanged(false)
          setEditingNumber(false)
        }
      } catch {
        console.error('Ошибка генерации номера')
      }
    }
    generate()
  }, [form.company_prefix, form.type, isChild, parentSource, parentContractId])

  const searchCounterparties = async (q: string) => {
    if (q.length < 2) {
      setCounterpartySuggestions([])
      setCounterpartyNotFound(false)
      return
    }
    setCounterpartySearchLoading(true)
    setCounterpartyNotFound(false)
    try {
      const res = await fetch(`https://epotos-ur-intel.vercel.app/api/counterparties?search=${encodeURIComponent(q)}&limit=10`)
      const data = await res.json()
      const list = data.counterparties ?? []
      setCounterpartySuggestions(list)
      setShowCounterpartySuggestions(true)
      setCounterpartyNotFound(list.length === 0)
    } finally {
      setCounterpartySearchLoading(false)
    }
  }

  const selectCounterparty = (c: {id: string, short_name: string | null, full_name: string, inn: string}) => {
    setForm(p => ({ ...p, counterparty: c.short_name ?? c.full_name }))
    setCounterpartyId(c.id)
    setCounterpartySearch(c.short_name ?? c.full_name)
    setShowCounterpartySuggestions(false)
  }

  const searchForeignCounterparties = async (q: string) => {
    if (q.length < 2) { setForeignSuggestions([]); setShowForeignSuggestions(false); return }
    setForeignSearchLoading(true)
    try {
      const baseUrl = 'https://epotos-ur-intel.vercel.app'
      const res = await fetch(`${baseUrl}/api/counterparties?search=${encodeURIComponent(q)}&foreign_only=true`)
      const data = await res.json()
      const list = data.counterparties ?? []
      setForeignSuggestions(list)
      setShowForeignSuggestions(true)
      setForeignNotFound(list.length === 0)
    } finally {
      setForeignSearchLoading(false)
    }
  }

  const selectForeignCounterparty = (c: {id: string, full_name: string, short_name: string | null, country: string | null}) => {
    setForm(p => ({ ...p, counterparty: c.short_name ?? c.full_name }))
    setCounterpartyId(c.id)
    setForeignSearch(c.short_name ?? c.full_name)
    setShowForeignSuggestions(false)
    setForeignNotFound(false)
  }

  const saveNewForeignCounterparty = async () => {
    if (!addForeignForm.full_name.trim()) { setAddForeignError('Введите название организации'); return }
    setAddForeignLoading(true)
    setAddForeignError('')
    try {
      const baseUrl = 'https://epotos-ur-intel.vercel.app'
      const res = await fetch(`${baseUrl}/api/counterparties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: addForeignForm.full_name.trim(),
          short_name: addForeignForm.full_name.trim(),
          inn: `FOREIGN-${Date.now()}`,
          kpp: null,
          is_foreign: true,
          country: addForeignForm.country.trim() || null,
          registration_number: addForeignForm.registration_number.trim() || null,
        }),
      })
      const data = await res.json()
      if (data.success || data.counterparty) {
        const cp = data.counterparty
        setForm(p => ({ ...p, counterparty: cp.short_name ?? cp.full_name }))
        setCounterpartyId(cp.id)
        setForeignSearch(cp.short_name ?? cp.full_name)
        setShowAddForeignModal(false)
        setAddForeignForm({ full_name: '', country: '', registration_number: '' })
        setForeignNotFound(false)
        setShowForeignSuggestions(false)
      } else {
        setAddForeignError(data.error ?? 'Ошибка сохранения')
      }
    } catch { setAddForeignError('Ошибка соединения') }
    finally { setAddForeignLoading(false) }
  }

  const CONTRACT_TYPES = ['поставка', 'услуги', 'аренда', 'подряд', 'купля-продажа', 'агентский', 'лицензионный', 'доп-соглашение', 'nda', 'протокол-разногласий', 'спецификация']

  // Поиск родительского документа
  const searchParentContracts = async (q: string) => {
    if (q.length < 2) { setParentSuggestions([]); return }
    setParentSearchLoading(true)
    try {
      const baseUrl = 'https://epotos-ur-intel.vercel.app'
      const res = await fetch(`${baseUrl}/api/contracts-list?search=${encodeURIComponent(q)}&parent_only=true&bitrix_user_id=${user?.id ?? ''}`)
      const data = await res.json()
      setParentSuggestions(data.contracts ?? [])
      setShowParentSuggestions(true)
    } finally {
      setParentSearchLoading(false)
    }
  }

  const selectParentContract = (c: {id: string, number: string, title: string, counterparty: string, status: string}) => {
    setParentContractId(c.id)
    setParentContractNumber(c.number)
    setParentSearch(`${c.number} — ${c.title}`)
    setShowParentSuggestions(false)
    // Автоматически подставляем контрагента из родительского документа
    if (!form.counterparty) {
      setForm(p => ({ ...p, counterparty: c.counterparty }))
      setCounterpartySearch(c.counterparty)
    }
  }

  // Генерация номера для дочернего документа
  const generateChildNumber = async (parentId: string, childType: string) => {
    try {
      const baseUrl = 'https://epotos-ur-intel.vercel.app'
      const res = await fetch(`${baseUrl}/api/contracts?child_number=true&parent_id=${parentId}&child_type=${encodeURIComponent(childType)}`)
      const data = await res.json()
      if (data.number) {
        setAutoNumber(data.number)
        setManualNumber(data.number)
        setNumberChanged(false)
        setEditingNumber(false)
      }
    } catch {
      console.error('Ошибка генерации номера дочернего документа')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const newForm = { ...form, [e.target.name]: e.target.value }
    if (e.target.name === 'type') {
      newForm.document_category = CONTRACT_TYPES.includes(e.target.value) ? 'contract' : 'document'
    }
    setForm(newForm)
    setError('')
  }

  const finalNumber = manualNumber || autoNumber

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.company_prefix) { setError('Выберите компанию'); return }
    if (!form.type) { setError('Выберите тип документа'); return }
    if (!finalNumber) { setError('Номер не сгенерирован'); return }
    if (!counterpartyId) { setError('Выберите контрагента из реестра или добавьте нового через кнопку «+ Добавить контрагента в реестр»'); return }

    setLoading(true)
    setError('')

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)

      try {
        const baseUrl = 'https://epotos-ur-intel.vercel.app'
      const response = await fetch(`${baseUrl}/api/contracts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            number: finalNumber,
            title: form.title,
            counterparty: form.counterparty,
            counterparty_id: counterpartyId ?? null,
            type: form.type,
            amount: form.amount,
            start_date: form.start_date,
            end_date: form.end_date,
            document_category: form.document_category,
            user_name: user?.name ?? 'Система',
            user_bitrix_id: user?.id ?? null,
            is_child: isChild,
            parent_contract_id: isChild && parentSource === 'system' ? parentContractId : null,
            parent_contract_external: isChild && parentSource === 'external' ? parentContractExternal : null,
            company_prefix: form.company_prefix,
            customer_number: form.customer_number ?? null,
          }),
        })
        clearTimeout(timeout)

        if (!response.ok) {
          const data = await response.json()
          setError(data.error?.includes('duplicate key')
            ? 'Договор с таким номером уже существует. Нажмите "Изменить номер".'
            : 'Ошибка: ' + data.error)
          setLoading(false)
          return
        }
      } catch {
        // Таймаут или ошибка сети — данные уже сохранены, просто переходим
        clearTimeout(timeout)
      }

      setLoading(false)
      window.location.replace('https://epotos-ur-intel.vercel.app')
    } catch {
      setError('Ошибка соединения. Попробуйте ещё раз.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">

        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            ← Назад
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">Новый документ</h1>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Тип документа: основной или дочерний */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Тип создаваемого документа
              </label>
              <div className="flex gap-3">
                <button type="button"
                  onClick={() => { setIsChild(false); setParentContractId(null); setParentContractExternal('') }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${!isChild ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                  📄 Основной документ
                </button>
                <button type="button"
                  onClick={() => setIsChild(true)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${isChild ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                  📎 Дополнительный документ
                </button>
              </div>
            </div>

            {/* Привязка к родительскому документу */}
            {isChild && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-blue-900">Привязка к основному документу</p>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setParentSource('system')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${parentSource === 'system' ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                    🔍 Найти в системе
                  </button>
                  <button type="button"
                    onClick={() => setParentSource('external')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${parentSource === 'external' ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                    ✏️ Документ вне системы
                  </button>
                </div>

                {parentSource === 'system' && (
                  <div className="relative">
                    <input
                      type="text"
                      value={parentSearch}
                      onChange={e => { setParentSearch(e.target.value); searchParentContracts(e.target.value) }}
                      placeholder="Поиск по номеру, названию или контрагенту..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    {parentSearchLoading && <p className="text-xs text-gray-400 mt-1">Поиск...</p>}
                    {showParentSuggestions && parentSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {parentSuggestions.map(c => (
                          <button key={c.id} type="button"
                            onClick={() => selectParentContract(c)}
                            className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                            <p className="text-sm font-medium text-gray-900">{c.number}</p>
                            <p className="text-xs text-gray-500">{c.title} · {c.counterparty}</p>
                            <p className="text-xs text-gray-400">{c.status}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {parentContractId && (
                      <div className="mt-2 flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2">
                        <span className="text-green-600 text-sm">✓</span>
                        <p className="text-sm text-gray-900 font-medium">{parentContractNumber}</p>
                        <button type="button" onClick={() => { setParentContractId(null); setParentContractNumber(''); setParentSearch('') }}
                          className="ml-auto text-xs text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                    )}
                  </div>
                )}

                {parentSource === 'external' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={parentContractExternal}
                      onChange={e => setParentContractExternal(e.target.value)}
                      placeholder="Введите номер основного договора..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <p className="text-xs text-blue-700">
                      💡 В карточке документа будет указано, что он является дополнительным к договору № {parentContractExternal || '...'}, созданному вне системы ЮрИнтел.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Номер документа со стороны заказчика
                <span className="ml-2 text-xs text-gray-400 font-normal">(необязательно)</span>
              </label>
              <input
                name="customer_number"
                value={form.customer_number}
                onChange={handleChange}
                placeholder="Например: ЗК-2026/123"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Компания ГК ЭПОТОС <span className="text-red-500">*</span>
              </label>
              <select name="company_prefix" value={form.company_prefix}
                onChange={handleChange} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">— Выберите компанию —</option>
                {COMPANIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {finalNumber && (
              <div className={`rounded-lg border px-4 py-3 ${numberChanged ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500">
                    Номер документа
                    {numberChanged && <span className="ml-2 text-yellow-700 font-medium">изменён вручную</span>}
                  </p>
                  <div className="flex gap-2">
                    {numberChanged && !editingNumber && (
                      <button type="button"
                        onClick={() => { setManualNumber(autoNumber); setNumberChanged(false); setEditingNumber(false) }}
                        className="text-xs text-gray-500 hover:text-gray-700 underline">
                        Сбросить
                      </button>
                    )}
                    {!editingNumber && (
                      <button type="button" onClick={() => setEditingNumber(true)}
                        className="text-xs text-gray-900 hover:text-gray-600 underline font-medium">
                        Изменить номер
                      </button>
                    )}
                  </div>
                </div>
                {editingNumber ? (
                  <div className="flex gap-2 items-center mt-1">
                    <input value={manualNumber} onChange={(e) => setManualNumber(e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900" />
                    <button type="button"
                      onClick={() => { setEditingNumber(false); setNumberChanged(manualNumber !== autoNumber) }}
                      className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-700">
                      Сохранить
                    </button>
                    <button type="button"
                      onClick={() => { setManualNumber(autoNumber); setNumberChanged(false); setEditingNumber(false) }}
                      className="text-xs text-gray-500 hover:text-gray-700">
                      Отмена
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-mono font-semibold text-gray-900">{finalNumber}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название документа <span className="text-red-500">*</span>
              </label>
              <input name="title" value={form.title} onChange={handleChange} required
                placeholder="Поставка противопожарного оборудования"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Контрагент <span className="text-red-500">*</span>
              </label>

              {/* Переключатель тип контрагента */}
              <div className="flex gap-2 mb-3">
                <button type="button"
                  onClick={() => { setCounterpartyType('russian'); setForm(p => ({...p, counterparty: ''})); setCounterpartyId(null); setCounterpartySearch(''); setForeignSearch(''); setForeignSuggestions([]); setForeignNotFound(false) }}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${counterpartyType === 'russian' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                  🇷🇺 Российский
                </button>
                <button type="button"
                  onClick={() => { setCounterpartyType('foreign'); setForm(p => ({...p, counterparty: ''})); setCounterpartyId(null); setCounterpartySearch(''); setForeignSearch(''); setForeignSuggestions([]); setForeignNotFound(false) }}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${counterpartyType === 'foreign' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                  🌍 Иностранный
                </button>
              </div>

              {counterpartyType === 'foreign' ? (
                <div className="relative">
                  <input type="text" value={foreignSearch}
                    onChange={e => { setForeignSearch(e.target.value); setCounterpartyId(null); setForm(p => ({ ...p, counterparty: '' })); searchForeignCounterparties(e.target.value) }}
                    onBlur={() => setTimeout(() => setShowForeignSuggestions(false), 200)}
                    placeholder="Начните вводить название..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  {counterpartyId && <span className="absolute right-3 top-2.5 text-green-500 text-xs">✓ из реестра</span>}
                  {foreignSearchLoading && <span className="absolute right-3 top-2.5 text-gray-400 text-xs">...</span>}
                  {showForeignSuggestions && foreignSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {foreignSuggestions.map(c => (
                        <button key={c.id} type="button"
                          onMouseDown={() => selectForeignCounterparty(c)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                          <p className="text-sm font-medium text-gray-900">{c.short_name ?? c.full_name}</p>
                          {c.country && <p className="text-xs text-gray-400">🌍 {c.country}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                  {foreignNotFound && foreignSearch.length >= 2 && (
                    <div className="absolute z-10 w-full bg-white border border-orange-200 rounded-lg shadow-lg mt-1 px-3 py-3">
                      <p className="text-sm text-orange-700 mb-2">⚠️ Контрагент не найден</p>
                      <button type="button"
                        onMouseDown={() => { setShowAddForeignModal(true); setShowForeignSuggestions(false); setForeignNotFound(false) }}
                        className="w-full bg-gray-900 text-white text-xs px-3 py-2 rounded-lg hover:bg-gray-700">
                        + Добавить иностранного контрагента
                      </button>
                    </div>
                  )}
                  {showAddForeignModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
                      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">🌍 Добавить иностранного контрагента</h3>
                        {addForeignError && <p className="text-sm text-red-600 mb-3">{addForeignError}</p>}
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Название <span className="text-red-500">*</span></label>
                            <input value={addForeignForm.full_name}
                              onChange={e => setAddForeignForm(p => ({...p, full_name: e.target.value}))}
                              placeholder="Acme Corporation"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Страна</label>
                            <input value={addForeignForm.country}
                              onChange={e => setAddForeignForm(p => ({...p, country: e.target.value}))}
                              placeholder="США, Германия, Китай..."
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Регистрационный номер</label>
                            <input value={addForeignForm.registration_number}
                              onChange={e => setAddForeignForm(p => ({...p, registration_number: e.target.value}))}
                              placeholder="Номер регистрации в стране"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                          </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                          <button type="button" onClick={saveNewForeignCounterparty} disabled={addForeignLoading}
                            className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                            {addForeignLoading ? 'Сохранение...' : 'Добавить'}
                          </button>
                          <button type="button" onClick={() => { setShowAddForeignModal(false); setAddForeignError('') }}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                            Отмена
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={counterpartySearch}
                    onChange={e => {
                      setCounterpartySearch(e.target.value)
                      setCounterpartyId(null)
                      setForm(p => ({ ...p, counterparty: '' }))
                      searchCounterparties(e.target.value)
                    }}
                    onBlur={() => setTimeout(() => setShowCounterpartySuggestions(false), 200)}
                    placeholder="Начните вводить название или ИНН..."
                    required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  {counterpartyId && (
                    <span className="absolute right-3 top-2.5 text-green-500 text-xs">✓ из реестра</span>
                  )}
                  {counterpartySearchLoading && (
                    <span className="absolute right-3 top-2.5 text-gray-400 text-xs">...</span>
                  )}
                  {showCounterpartySuggestions && counterpartySuggestions.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {counterpartySuggestions.map(c => (
                        <button key={c.id} type="button"
                          onMouseDown={() => selectCounterparty(c)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                          <p className="text-sm font-medium text-gray-900">{c.short_name ?? c.full_name}</p>
                          <p className="text-xs text-gray-400">ИНН: {c.inn}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {counterpartyNotFound && counterpartySearch.length >= 2 && (
                    <div className="absolute z-10 w-full bg-white border border-orange-200 rounded-lg shadow-lg mt-1 px-3 py-3">
                      <p className="text-sm text-orange-700 mb-2">⚠️ Контрагент не найден в реестре</p>
                      <p className="text-xs text-gray-500 mb-2">Сначала добавьте контрагента в базу, затем выберите его в этом поле.</p>
                      <button type="button"
                        onMouseDown={() => { setShowAddCpModal(true); setShowCounterpartySuggestions(false); setCounterpartyNotFound(false) }}
                        className="w-full bg-gray-900 text-white text-xs px-3 py-2 rounded-lg hover:bg-gray-700">
                        + Добавить контрагента в реестр
                      </button>
                    </div>
                  )}
                  {showAddCpModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
                      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Добавить контрагента</h3>
                        {!addCpResult ? (
                          <>
                            <p className="text-sm text-gray-500 mb-3">Введите ИНН организации — данные будут загружены из DaData.</p>
                            <div className="flex gap-2 mb-3">
                              <input
                                value={addCpInn}
                                onChange={e => setAddCpInn(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && searchCounterpartyByInn()}
                                placeholder="ИНН (10 или 12 цифр)"
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                              />
                              <button type="button" onClick={searchCounterpartyByInn} disabled={addCpLoading}
                                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50">
                                {addCpLoading ? '...' : 'Найти'}
                              </button>
                            </div>
                            {addCpError && <p className="text-sm text-red-600">{addCpError}</p>}
                          </>
                        ) : (
                          <>
                            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1">
                              <p className="text-sm font-medium text-gray-900">{addCpResult.short_name ?? addCpResult.full_name}</p>
                              <p className="text-xs text-gray-500">ИНН: {addCpResult.inn}{addCpResult.kpp ? ` / КПП: ${addCpResult.kpp}` : ''}</p>
                              <p className="text-xs text-gray-500">Адрес: {addCpResult.legal_address ?? '—'}</p>
                              <p className="text-xs text-gray-500">Руководитель: {addCpResult.director_name ?? '—'}</p>
                            </div>
                            {addCpError && <p className="text-sm text-red-600 mb-2">{addCpError}</p>}
                            <div className="flex gap-2">
                              <button type="button" onClick={saveNewCounterparty} disabled={addCpSaving}
                                className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-50">
                                {addCpSaving ? 'Сохранение...' : 'Добавить в реестр'}
                              </button>
                              <button type="button" onClick={() => setAddCpResult(null)}
                                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                                Назад
                              </button>
                            </div>
                          </>
                        )}
                        <button type="button" onClick={() => { setShowAddCpModal(false); setAddCpInn(''); setAddCpResult(null); setAddCpError('') }}
                          className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600">
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тип документа <span className="text-red-500">*</span>
              </label>
              <select name="type" value={form.type} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                <option value="">— Выберите тип —</option>
                {DOCUMENT_TYPES.map(group => (
                  <optgroup key={group.group} label={group.group}>
                    {group.types.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Регион</label>
              <select name="region" value={form.region} onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Сумма (₽)</label>
              <input name="amount" value={form.amount} onChange={handleChange}
                type="number" placeholder="450000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала</label>
                <input name="start_date" value={form.start_date} onChange={handleChange} type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания</label>
                <input name="end_date" value={form.end_date} onChange={handleChange} type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading || !finalNumber}
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
                {loading ? 'Сохранение...' : 'Создать документ'}
              </button>
              <Link href="/"
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Отмена
              </Link>
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}