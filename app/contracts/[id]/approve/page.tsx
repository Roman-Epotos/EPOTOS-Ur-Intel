'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

const REQUIRED_STAGES = [
  { id: 'legal', label: 'Юридический отдел' },
  { id: 'finance', label: 'Финансовый департамент' },
  { id: 'accounting', label: 'Бухгалтерия' },
]

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

  const defaultDeadline = new Date()
  defaultDeadline.setDate(defaultDeadline.getDate() + 10)
  const deadlineStr = defaultDeadline.toISOString().split('T')[0]

  const [deadline, setDeadline] = useState(deadlineStr)

  const [stageParticipants, setStageParticipants] = useState<Record<string, Participant>>({
    legal: { user_name: '', role: 'required', stage: 'legal' },
    finance: { user_name: '', role: 'required', stage: 'finance' },
    accounting: { user_name: '', role: 'required', stage: 'accounting' },
  })

  const [customParticipants, setCustomParticipants] = useState<Participant[]>([])

  const updateStage = (stageId: string, field: string, value: string) => {
    setStageParticipants(prev => ({
      ...prev,
      [stageId]: { ...prev[stageId], [field]: value }
    }))
  }

  const addCustomParticipant = () => {
    setCustomParticipants(prev => [
      ...prev,
      { user_name: '', role: 'optional', stage: 'custom' }
    ])
  }

  const updateCustom = (index: number, field: string, value: string) => {
    setCustomParticipants(prev => prev.map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    ))
  }

  const removeCustom = (index: number) => {
    setCustomParticipants(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const allParticipants = [
      ...Object.values(stageParticipants).filter(p => p.user_name.trim()),
      ...customParticipants.filter(p => p.user_name.trim()),
    ]

    if (allParticipants.length === 0) {
      setError('Добавьте хотя бы одного согласующего')
      return
    }

    setLoading(true)
    setError('')

    try {
      const baseUrl = window.location.origin
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

          {/* Срок согласования */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Срок согласования</h2>
            <div className="flex items-center gap-4">
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <span className="text-sm text-gray-500">По умолчанию — 10 дней</span>
            </div>
          </div>

          {/* Обязательные согласующие */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Обязательные согласующие</h2>
            <div className="space-y-4">
              {REQUIRED_STAGES.map(stage => (
                <div key={stage.id}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {stage.label}
                  </label>
                  <input
                    type="text"
                    value={stageParticipants[stage.id]?.user_name ?? ''}
                    onChange={e => updateStage(stage.id, 'user_name', e.target.value)}
                    placeholder="ФИО согласующего"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Дополнительные согласующие */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-700">Дополнительные согласующие</h2>
              <button
                type="button"
                onClick={addCustomParticipant}
                className="text-xs text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
              >
                + Добавить
              </button>
            </div>

            {customParticipants.length === 0 ? (
              <p className="text-sm text-gray-400">Нет дополнительных согласующих</p>
            ) : (
              <div className="space-y-3">
                {customParticipants.map((p, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={p.user_name}
                      onChange={e => updateCustom(index, 'user_name', e.target.value)}
                      placeholder="ФИО согласующего"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <select
                      value={p.role}
                      onChange={e => updateCustom(index, 'role', e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                    >
                      <option value="required">Обязательный</option>
                      <option value="optional">Для информирования</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeCustom(index)}
                      className="text-red-400 hover:text-red-600 text-sm px-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Кнопки */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Запуск...' : 'Запустить согласование'}
            </button>
            <Link
              href={`/contracts/${contractId}`}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Отмена
            </Link>
          </div>

        </form>
      </div>
    </div>
  )
}