'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

const STAGES = [
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

interface Participant {
  id: string
  stage: string
  company_prefix: string | null
  bitrix_user_id: number
  user_name: string
  department: string | null
  is_active: boolean
}

interface NewParticipant {
  stage: string
  company_prefix: string
  bitrix_user_id: string
  user_name: string
  department: string
}

export default function AdminPage() {
  const { user } = useBitrixAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [activeStage, setActiveStage] = useState('legal')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newP, setNewP] = useState<NewParticipant>({
    stage: 'legal',
    company_prefix: '',
    bitrix_user_id: '',
    user_name: '',
    department: '',
  })

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // Проверяем права администратора
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user?.id) return
      const res = await fetch(`${baseUrl}/api/approval-settings?stage=legal`)
      const data = await res.json()
      // Проверяем через список adminов
      const adminIds = [30, 1148] // Пирог Роман, Чащин Дмитрий
      if (adminIds.includes(parseInt(user.id))) {
        setIsAdmin(true)
      }
      setLoading(false)
    }
    checkAdmin()
  }, [user])

  // Загружаем участников по этапу
  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${baseUrl}/api/approval-settings?stage=${activeStage}`)
      const data = await res.json()
      setParticipants(data.participants ?? [])
    }
    load()
  }, [activeStage])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!newP.user_name || !newP.bitrix_user_id) {
      setError('Заполните ФИО и ID пользователя')
      return
    }

    const res = await fetch(`${baseUrl}/api/approval-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newP,
        bitrix_user_id: parseInt(newP.bitrix_user_id),
        company_prefix: newP.company_prefix || null,
        admin_bitrix_id: parseInt(user?.id ?? '0'),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setSuccess('Участник добавлен')
      setNewP({ stage: activeStage, company_prefix: '', bitrix_user_id: '', user_name: '', department: '' })
      const reload = await fetch(`${baseUrl}/api/approval-settings?stage=${activeStage}`)
      const reloadData = await reload.json()
      setParticipants(reloadData.participants ?? [])
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить участника из списка?')) return
    setError('')
    setSuccess('')

    const res = await fetch(`${baseUrl}/api/approval-settings`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, admin_bitrix_id: parseInt(user?.id ?? '0') }),
    })

    if (res.ok) {
      setSuccess('Участник удалён')
      setParticipants(prev => prev.filter(p => p.id !== id))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Загрузка...</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 font-medium">Доступ запрещён</p>
          <p className="text-gray-500 text-sm mt-1">Эта страница доступна только администраторам</p>
          <Link href="/" className="mt-4 inline-block text-sm text-gray-900 underline">
            На главную
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Назад</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">Настройки согласования</h1>
          <span className="text-xs bg-gray-900 text-white px-2 py-1 rounded-full">Администратор</span>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 mb-4">{success}</div>}

        {/* Вкладки этапов */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {STAGES.map(stage => (
            <button key={stage.id}
              onClick={() => { setActiveStage(stage.id); setNewP(p => ({ ...p, stage: stage.id })) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeStage === stage.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              {stage.label}
            </button>
          ))}
        </div>

        {/* Список текущих участников */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Текущий список — {STAGES.find(s => s.id === activeStage)?.label}
          </h2>
          {participants.length === 0 ? (
            <p className="text-sm text-gray-400">Список пуст</p>
          ) : (
            <div className="space-y-2">
              {participants.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.user_name}</p>
                    <p className="text-xs text-gray-500">
                      {p.department ?? '—'} · Битрикс ID: {p.bitrix_user_id}
                      {p.company_prefix && ` · ${p.company_prefix}`}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(p.id)}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded">
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Форма добавления */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Добавить участника</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">ФИО <span className="text-red-500">*</span></label>
                <input value={newP.user_name}
                  onChange={e => setNewP(p => ({ ...p, user_name: e.target.value }))}
                  placeholder="Иванов Иван Иванович"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Битрикс24 ID <span className="text-red-500">*</span></label>
                <input value={newP.bitrix_user_id}
                  onChange={e => setNewP(p => ({ ...p, bitrix_user_id: e.target.value }))}
                  placeholder="например: 246"
                  type="number"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Подразделение</label>
                <input value={newP.department}
                  onChange={e => setNewP(p => ({ ...p, department: e.target.value }))}
                  placeholder="Юридический отдел"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Компания (если специфично)</label>
                <select value={newP.company_prefix}
                  onChange={e => setNewP(p => ({ ...p, company_prefix: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                  <option value="">Все компании</option>
                  {COMPANIES.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit"
              className="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
              Добавить
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}