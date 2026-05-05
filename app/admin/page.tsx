'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

const STAGES = [
  { id: 'legal', label: 'Юридический отдел' },
  { id: 'finance', label: 'Финансовый департамент' },
  { id: 'accounting', label: 'Бухгалтерия' },
  { id: 'director', label: 'Генеральный директор' },
  { id: 'custom', label: 'Дополнительные' },
]

const ADMIN_TABS = [
  { id: 'approval', label: 'Согласующие' },
  { id: 'templates', label: 'Шаблоны документов' },
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
  company_prefixes: string[]
  bitrix_user_id: string
  user_name: string
  department: string
}

export default function AdminPage() {
  const { user } = useBitrixAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [adminTab, setAdminTab] = useState('approval')
  const [activeStage, setActiveStage] = useState('legal')
  const [templates, setTemplates] = useState<{id: string, name: string, type: string, company_prefix: string | null, file_url: string, file_name: string, description: string | null, is_active: boolean}[]>([])
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [templateForm, setTemplateForm] = useState({ name: '', type: '', company_prefix: '', description: '' })
  const [uploadingTemplate, setUploadingTemplate] = useState(false)
  const [templateSuccess, setTemplateSuccess] = useState('')
  const [templateError, setTemplateError] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newP, setNewP] = useState<NewParticipant>({
    stage: 'legal',
    company_prefixes: [],
    bitrix_user_id: '',
    user_name: '',
    department: '',
  })

  const baseUrl = typeof window !== 'undefined' ? 'https://epotos-ur-intel.vercel.app' : ''

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

  // Загружаем шаблоны
  useEffect(() => {
    const loadTemplates = async () => {
      const res = await fetch(`${baseUrl}/api/templates`)
      const data = await res.json()
      setTemplates(data.templates ?? [])
    }
    if (adminTab === 'templates') loadTemplates()
  }, [adminTab])

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateFile || !templateForm.name || !templateForm.type) {
      setTemplateError('Заполните название, тип и выберите файл')
      return
    }
    setUploadingTemplate(true)
    setTemplateError('')
    setTemplateSuccess('')

    const formData = new FormData()
    formData.append('file', templateFile)
    formData.append('name', templateForm.name)
    formData.append('type', templateForm.type)
    formData.append('company_prefix', templateForm.company_prefix)
    formData.append('description', templateForm.description)
    formData.append('admin_bitrix_id', user?.id ?? '0')

    const res = await fetch(`${baseUrl}/api/templates`, { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setTemplateError(data.error)
    } else {
      setTemplateSuccess('Шаблон добавлен')
      setTemplateFile(null)
      setTemplateForm({ name: '', type: '', company_prefix: '', description: '' })
      const reload = await fetch(`${baseUrl}/api/templates`)
      const reloadData = await reload.json()
      setTemplates(reloadData.templates ?? [])
    }
    setUploadingTemplate(false)
  }

  const handleDeleteTemplate = async (id: string, file_url: string) => {
    if (!confirm('Удалить шаблон?')) return
    const res = await fetch(`${baseUrl}/api/templates`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, file_url, admin_bitrix_id: parseInt(user?.id ?? '0') }),
    })
    if (res.ok) {
      setTemplates(prev => prev.filter(t => t.id !== id))
      setTemplateSuccess('Шаблон удалён')
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!newP.user_name || !newP.bitrix_user_id) {
      setError('Заполните ФИО и ID пользователя')
      return
    }

    // Создаём запись для каждой выбранной компании
    const prefixes = newP.company_prefixes.length > 0 ? newP.company_prefixes : [null]
    let hasError = false

    for (const prefix of prefixes) {
      const res = await fetch(`${baseUrl}/api/approval-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: newP.stage,
          company_prefix: prefix,
          bitrix_user_id: parseInt(newP.bitrix_user_id),
          user_name: newP.user_name,
          department: newP.department,
          admin_bitrix_id: parseInt(user?.id ?? '0'),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error)
        hasError = true
        break
      }
    }

    if (!hasError) {
      setSuccess(`Участник добавлен в ${prefixes.length} компани${prefixes.length === 1 ? 'ю' : 'и'}`)
      setNewP({ stage: activeStage, company_prefixes: [], bitrix_user_id: '', user_name: '', department: '' })
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

        {/* Главные вкладки */}
        <div className="flex gap-2 mb-6">
          {ADMIN_TABS.map(tab => (
            <button key={tab.id} onClick={() => setAdminTab(tab.id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${adminTab === tab.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {adminTab === 'templates' && (
          <div className="space-y-6">
            {templateError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{templateError}</div>}
            {templateSuccess && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{templateSuccess}</div>}

            {/* Список шаблонов */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Загруженные шаблоны</h2>
              {templates.length === 0 ? (
                <p className="text-sm text-gray-400">Шаблонов пока нет</p>
              ) : (
                <div className="space-y-2">
                  {templates.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-500">
                          {t.type} · {t.company_prefix ?? 'Все компании'} · {t.file_name}
                        </p>
                        {t.description && <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>}
                      </div>
                      <div className="flex gap-2">
                        <a href={t.file_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-gray-600 border border-gray-200 px-2 py-1 rounded hover:bg-gray-100">
                          Скачать
                        </a>
                        <button onClick={() => handleDeleteTemplate(t.id, t.file_url)}
                          className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50">
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Форма добавления шаблона */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Добавить шаблон</h2>
              <form onSubmit={handleAddTemplate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Название шаблона <span className="text-red-500">*</span></label>
                    <input value={templateForm.name} onChange={e => setTemplateForm(p => ({...p, name: e.target.value}))}
                      placeholder="Договор услуг (типовой)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Тип документа <span className="text-red-500">*</span></label>
                    <select value={templateForm.type} onChange={e => setTemplateForm(p => ({...p, type: e.target.value}))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                      <option value="">— Выберите тип —</option>
                      <optgroup label="Договоры">
                        <option value="поставка">Договор поставки</option>
                        <option value="услуги">Договор услуг</option>
                        <option value="аренда">Договор аренды</option>
                        <option value="подряд">Договор подряда</option>
                        <option value="купля-продажа">Договор купли-продажи</option>
                        <option value="агентский">Агентский договор</option>
                        <option value="лицензионный">Лицензионный договор</option>
                      </optgroup>
                      <optgroup label="Соглашения">
                        <option value="доп-соглашение">Дополнительное соглашение</option>
                        <option value="nda">NDA</option>
                        <option value="протокол-разногласий">Протокол разногласий</option>
                      </optgroup>
                      <optgroup label="Документы">
                        <option value="претензия">Претензия</option>
                        <option value="письмо">Письмо</option>
                        <option value="акт">Акт</option>
                        <option value="счет">Счёт</option>
                        <option value="доверенность">Доверенность</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Компания</label>
                    <select value={templateForm.company_prefix} onChange={e => setTemplateForm(p => ({...p, company_prefix: e.target.value}))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                      <option value="">Все компании</option>
                      {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
                    <input value={templateForm.description} onChange={e => setTemplateForm(p => ({...p, description: e.target.value}))}
                      placeholder="Краткое описание шаблона"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Файл шаблона <span className="text-red-500">*</span></label>
                  <input type="file" accept=".pdf,.docx,.xlsx"
                    onChange={e => setTemplateFile(e.target.files?.[0] ?? null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  {templateFile && <p className="text-xs text-gray-500 mt-1">Выбран: {templateFile.name}</p>}
                </div>
                <button type="submit" disabled={uploadingTemplate}
                  className="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                  {uploadingTemplate ? 'Загрузка...' : 'Добавить шаблон'}
                </button>
              </form>
            </div>
          </div>
        )}

        {adminTab === 'approval' && (
        <>
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
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Компании участия
                  <span className="text-gray-400 font-normal ml-1">(не выбрано = все компании)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMPANIES.map(c => (
                    <label key={c.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${newP.company_prefixes.includes(c.id) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                      <input
                        type="checkbox"
                        checked={newP.company_prefixes.includes(c.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setNewP(p => ({ ...p, company_prefixes: [...p.company_prefixes, c.id] }))
                          } else {
                            setNewP(p => ({ ...p, company_prefixes: p.company_prefixes.filter(x => x !== c.id) }))
                          }
                        }}
                        className="hidden"
                      />
                      {c.id} — {c.name.replace('ООО ', '')}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button type="submit"
              className="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
              Добавить
            </button>
          </form>
        </div>
      </>
      )}
    </div>
  )
}