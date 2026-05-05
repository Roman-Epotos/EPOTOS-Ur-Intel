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
  })

  useEffect(() => {
    if (!form.company_prefix) {
      setAutoNumber('')
      setManualNumber('')
      setNumberChanged(false)
      setEditingNumber(false)
      return
    }
    const generate = async () => {
      try {
        const baseUrl = 'https://epotos-ur-intel.vercel.app'
      const res = await fetch(`${baseUrl}/api/contracts?prefix=${encodeURIComponent(form.company_prefix)}`)
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
  }, [form.company_prefix])

  const CONTRACT_TYPES = ['поставка', 'услуги', 'аренда', 'подряд', 'купля-продажа', 'агентский', 'лицензионный', 'доп-соглашение', 'nda', 'протокол-разногласий']

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
            type: form.type,
            amount: form.amount,
            start_date: form.start_date,
            end_date: form.end_date,
            document_category: form.document_category,
            user_name: user?.name ?? 'Система',
            user_bitrix_id: user?.id ?? null,
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
              <input name="counterparty" value={form.counterparty} onChange={handleChange} required
                placeholder="ООО Название компании"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
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