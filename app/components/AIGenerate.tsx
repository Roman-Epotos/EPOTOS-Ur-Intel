'use client'

import { useState } from 'react'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'
import { DOCUMENT_TYPES, REGIONS } from '@/app/lib/documentTypes'

const COMPANIES = [
  { id: 'ТХ', name: 'ООО Техно' },
  { id: 'НПП', name: 'ООО НПП ЭПОТОС' },
  { id: 'СПТ', name: 'ООО СПТ' },
  { id: 'ОС', name: 'ООО ОС' },
  { id: 'Э-К', name: 'ООО Эпотос-К' },
]

interface Props {
  contractId?: string
  onGenerated?: () => void
}

export default function AIGenerate({ contractId, onGenerated }: Props) {
  const { user } = useBitrixAuth()
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    prompt: '',
    document_type: '',
    company_prefix: '',
    region: '',
    counterparty: '',
  })

  const baseUrl = 'https://epotos-ur-intel.vercel.app'

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.prompt || !form.document_type) {
      setError('Заполните описание задачи и тип документа')
      return
    }

    setGenerating(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`${baseUrl}/api/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          user_name: user?.name ?? 'Система',
          contract_id: contractId ?? null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error ?? 'Ошибка генерации')
        return
      }

      const templateUsed = response.headers.get('X-Template-Used') === 'true'

      // Скачиваем файл
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${form.document_type}_${Date.now()}.docx`
      a.click()
      URL.revokeObjectURL(url)

      setSuccess(`Документ успешно создан${templateUsed ? ' на основе шаблона' : ' без шаблона (шаблон не найден)'}`)
      onGenerated?.()
    } catch {
      setError('Ошибка соединения')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white text-lg">✨</div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">AI Генерация документа</h3>
          <p className="text-xs text-gray-500">Опишите задачу — AI создаст документ на основе шаблона</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 mb-4">{success}</div>}

      <form onSubmit={handleGenerate} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Тип документа <span className="text-red-500">*</span></label>
            <select value={form.document_type} onChange={e => setForm(p => ({...p, document_type: e.target.value}))}
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Компания ЭПОТОС</label>
            <select value={form.company_prefix} onChange={e => setForm(p => ({...p, company_prefix: e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
              <option value="">— Выберите компанию —</option>
              {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Контрагент</label>
            <input value={form.counterparty} onChange={e => setForm(p => ({...p, counterparty: e.target.value}))}
              placeholder="Название организации"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Регион</label>
            <select value={form.region} onChange={e => setForm(p => ({...p, region: e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
              {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Описание задачи <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.prompt}
            onChange={e => setForm(p => ({...p, prompt: e.target.value}))}
            placeholder="Опишите что нужно создать. Например: договор поставки противопожарного оборудования, срок 1 год, оплата в течение 30 дней, доставка за счёт поставщика..."
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />
        </div>

        <button type="submit" disabled={generating}
          className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {generating ? (
            <>
              <span className="animate-spin">⟳</span>
              AI создаёт документ... (30-60 сек)
            </>
          ) : (
            <>✨ Создать документ</>
          )}
        </button>
      </form>
    </div>
  )
}