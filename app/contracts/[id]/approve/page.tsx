'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

const REQUIRED_STAGES = [
  { id: 'legal', label: 'Юридический отдел' },
  { id: 'finance', label: 'Финансовый департамент' },
  { id: 'accounting', label: 'Бухгалтерия' },
  { id: 'director', label: 'Генеральный директор' },
]

const COMPANIES = [
  { id: 'ТХ', name: 'ООО Техно' },
  { id: 'НПП', name: 'ООО НПП ЭПОТОС' },
  { id: 'СПТ', name: 'ООО СПТ' },
  { id: 'ОС', name: 'ООО ОС' },
  { id: 'Э-К', name: 'ООО Эпотос-К' },
]

interface SettingsParticipant {
  id: string
  bitrix_user_id: number
  user_name: string
  department: string | null
  company_prefix: string | null
}

interface Participant {
  user_name: string
  bitrix_user_id?: number
  department?: string
  role: 'required' | 'optional'
  stage: string
}

export default function ApprovePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useBitrixAuth()
  const contractId = params.id as string

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stageOptions, setStageOptions] = useState<Record<string, SettingsParticipant[]>>({})
  const [selectedParticipants, setSelectedParticipants] = useState<Record<string, string>>({
    legal: '',
    finance: '',
    accounting: '',
    director: '',
  })
  const [companyPrefix, setCompanyPrefix] = useState('')
  const [customParticipants, setCustomParticipants] = useState<Participant[]>([])
  const [customOptions, setCustomOptions] = useState<SettingsParticipant[]>([])
  const [customRows, setCustomRows] = useState<{ user_name: string; role: 'required' | 'optional' }[]>([
    { user_name: '', role: 'optional' }
  ])

  const defaultDeadline = new Date()
  defaultDeadline.setDate(defaultDeadline.getDate() + 10)
  const [deadline, setDeadline] = useState(defaultDeadline.toISOString().split('T')[0])

  const baseUrl = typeof window !== 'undefined' ? 'https://epotos-ur-intel.vercel.app' : ''

  // Загружаем списки согласующих при выборе компании
  useEffect(() => {
    if (!companyPrefix) return

    const loadStages = async () => {
      const results: Record<string, SettingsParticipant[]> = {}
      for (const stage of REQUIRED_STAGES) {
        const res = await fetch(`${baseUrl}/api/approval-settings?stage=${stage.id}&company=${companyPrefix}`)
        const data = await res.json()
        results[stage.id] = data.participants ?? []
      }
      // Загружаем дополнительных отдельно
      const customRes = await fetch(`${baseUrl}/api/approval-settings?stage=custom&company=${companyPrefix}`)
      const customData = await customRes.json()
      setCustomOptions(customData.participants ?? [])

      setStageOptions(results)
      setSelectedParticipants({ legal: '', finance: '', accounting: '', director: '' })
    }
    loadStages()
  }, [companyPrefix])

  const addCustomRow = () => {
    setCustomRows(prev => [...prev, { user_name: '', role: 'optional' }])
  }

  const updateCustomRow = (index: number, field: string, value: string) => {
    setCustomRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  const removeCustomRow = (index: number) => {
    setCustomRows(prev => prev.filter((_, i) => i !== index))
  }

  const removeCustom = (index: number) => {
    setCustomParticipants(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!companyPrefix) {
      setError('Выберите компанию')
      return
    }

    // Собираем обязательных согласующих
    const requiredParticipants: Participant[] = []
    for (const stage of REQUIRED_STAGES) {
      const selectedId = selectedParticipants[stage.id]
      if (selectedId) {
        const found = stageOptions[stage.id]?.find(p => p.id === selectedId)
        if (found) {
          requiredParticipants.push({
            user_name: found.user_name,
            bitrix_user_id: found.bitrix_user_id,
            department: found.department ?? undefined,
            role: 'required',
            stage: stage.id,
          })
        }
      }
    }

    if (requiredParticipants.length === 0) {
      setError('Выберите хотя бы одного обязательного согласующего')
      return
    }

    // Собираем дополнительных из строк
    const customParticipants: Participant[] = customRows
      .filter(r => r.user_name.trim())
      .map(r => {
        const found = customOptions.find(p => p.user_name === r.user_name)
        return {
          user_name: r.user_name,
          bitrix_user_id: found?.bitrix_user_id,
          department: found?.department ?? undefined,
          role: r.role,
          stage: 'custom',
        }
      })

    const allParticipants = [...requiredParticipants, ...customParticipants]

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${baseUrl}/api/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          participants: allParticipants,
          deadline,
          initiated_by_name: user?.name ?? 'Система',
          initiated_by_bitrix_id: user?.id ? parseInt(user.id) : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Ошибка запуска согласования')
        setLoading(false)
        return
      }

      router.push(`/contracts/${contractId}`)
    } catch {
      setError('Ошибка соединения')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">

        <div className="flex items-center gap-3 mb-8">
          <Link href={`/contracts/${contractId}`}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            ← Назад
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">Запуск согласования</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Компания */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-700 mb-4">
              Компания ГК ЭПОТОС <span className="text-red-500">*</span>
            </h2>
            <select
              value={companyPrefix}
              onChange={e => setCompanyPrefix(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              <option value="">— Выберите компанию —</option>
              {COMPANIES.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Срок */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Срок согласования</h2>
            <div className="flex items-center gap-4">
              <input type="date" value={deadline}
                onChange={e => setDeadline(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              <span className="text-sm text-gray-500">По умолчанию — 10 дней</span>
            </div>
          </div>

          {/* Обязательные согласующие */}
          {companyPrefix && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Обязательные согласующие</h2>
              <div className="space-y-4">
                {REQUIRED_STAGES.map(stage => (
                  <div key={stage.id}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {stage.label}
                    </label>
                    {stageOptions[stage.id]?.length > 0 ? (
                      <select
                        value={selectedParticipants[stage.id]}
                        onChange={e => setSelectedParticipants(prev => ({ ...prev, [stage.id]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                      >
                        <option value="">— Не выбран —</option>
                        {stageOptions[stage.id].map(p => (
                          <option key={p.id} value={p.id}>
                            {p.user_name}{p.department ? ` — ${p.department}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Нет доступных согласующих для этого этапа</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Дополнительные согласующие */}
          {companyPrefix && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Дополнительные согласующие</h2>

            <div className="space-y-2">
              {customRows.map((row, index) => (
                <div key={index} className="flex gap-2 items-center">
                  {customOptions.length > 0 ? (
                    <select value={row.user_name}
                      onChange={e => updateCustomRow(index, 'user_name', e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                      <option value="">— Выберите сотрудника —</option>
                      {customOptions.map(p => (
                        <option key={p.id} value={p.user_name}>
                          {p.user_name}{p.department ? ` — ${p.department}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={row.user_name}
                      onChange={e => updateCustomRow(index, 'user_name', e.target.value)}
                      placeholder="ФИО согласующего"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  )}
                  <select value={row.role}
                    onChange={e => updateCustomRow(index, 'role', e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none bg-white">
                    <option value="required">Обязательный</option>
                    <option value="optional">Для информирования</option>
                  </select>
                  {customRows.length > 1 && (
                    <button type="button" onClick={() => removeCustomRow(index)}
                      className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addCustomRow}
              className="mt-3 text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
              + Добавить ещё одного
            </button>
          </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-3">
            <button type="submit" disabled={loading || !companyPrefix}
              className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
              {loading ? 'Запуск...' : 'Запустить согласование'}
            </button>
            <Link href={`/contracts/${contractId}`}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Отмена
            </Link>
          </div>

        </form>
      </div>
    </div>
  )
}