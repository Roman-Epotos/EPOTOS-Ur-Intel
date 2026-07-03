'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'
import { DOCUMENT_TYPES, REGIONS } from '@/app/lib/documentTypes'
import { proxyUrl } from '@/app/utils/proxyUrl'

const STAGES = [
  { id: 'legal', label: 'Юридический отдел' },
  { id: 'finance', label: 'Финансовый департамент' },
  { id: 'accounting', label: 'Бухгалтерия' },
  { id: 'director', label: 'Генеральный директор' },
  { id: 'edo', label: 'Специалисты ЭДО' },
  { id: 'custom', label: 'Дополнительные' },
]

const COMPANIES = [
  { id: 'ТХ', name: 'ООО Техно' },
  { id: 'НПП', name: 'ООО НПП ЭПОТОС' },
  { id: 'СПТ', name: 'ООО СПТ' },
  { id: 'ОС', name: 'ООО ОС' },
  { id: 'Э-К', name: 'ООО Эпотос-К' },
]

const ADMIN_TABS = [
  { id: 'approval', label: 'Согласующие' },
  { id: 'templates', label: 'Шаблоны документов' },
  { id: 'requisites', label: 'Реквизиты компаний' },
  { id: 'gc_roles', label: 'Роли ГК' },
  { id: 'knowledge', label: '📚 База знаний ИИ' },
  { id: 'deleted', label: '🗑 Удалённые документы' },
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

interface Template {
  id: string
  name: string
  type: string
  company_prefix: string | null
  file_url: string
  file_name: string
  description: string | null
  is_active: boolean
}

export default function AdminPage() {
  const { user } = useBitrixAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [adminTab, setAdminTab] = useState('approval')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [customCompanyFilter, setCustomCompanyFilter] = useState<string>('all')
  const [activeStage, setActiveStage] = useState('legal')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newP, setNewP] = useState<NewParticipant>({
    stage: 'legal',
    company_prefixes: [],
    bitrix_user_id: '',
    user_name: '',
    department: '',
  })

  // Роли ГК
  const [gcRoles, setGcRoles] = useState<{id: string, bitrix_user_id: number, user_name: string, role: string, created_at: string}[]>([])
  const [gcRolesLoading, setGcRolesLoading] = useState(false)
  const [gcRoleForm, setGcRoleForm] = useState({ bitrix_user_id: '', user_name: '', role: 'gc_manager' })
  const [gcRoleError, setGcRoleError] = useState('')
  const [gcRoleSuccess, setGcRoleSuccess] = useState('')

  const DEVELOPER_ID = 30
  const isDeveloper = parseInt(user?.id ?? '0') === DEVELOPER_ID
  const GC_ROLE_OPTIONS = [
    { value: 'admin', label: 'Администратор' },
    { value: 'gc_manager', label: 'Менеджер ГК' },
    { value: 'finance_gc', label: 'Финансист ГК' },
    { value: 'finance_company', label: 'Бухгалтер компании' },
    { value: 'legal_gc', label: 'Юрист ГК' },
  ]

  // Реквизиты
  const [selectedCompany, setSelectedCompany] = useState('ТХ')
  const [requisitesForm, setRequisitesForm] = useState({
    company_prefix: 'ТХ',
    company_name: '',
    inn: '',
    kpp: '',
    ogrn: '',
    legal_address: '',
    actual_address: '',
    bank_name: '',
    bank_account: '',
    bank_bik: '',
    bank_corr_account: '',
    director_name: '',
    director_title: 'Генеральный директор',
    phone: '',
    email: '',
    website: '',
    short_name: '',
    signatory_name: '',
    poa_number: '',
    poa_date: '',
    poa_expires: '',
    warehouse_address: '',
  })
  const [savingRequisites, setSavingRequisites] = useState(false)
  const [requisitesSuccess, setRequisitesSuccess] = useState('')
  const [requisitesError, setRequisitesError] = useState('')
  const [showRequisitesPreview, setShowRequisitesPreview] = useState(false)

  // Шаблоны
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateCompanyFilter, setTemplateCompanyFilter] = useState('all')
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [templateForm, setTemplateForm] = useState({ name: '', type: '', company_prefix: '', description: '', region: '' })
  const [uploadingTemplate, setUploadingTemplate] = useState(false)
  const [templateSuccess, setTemplateSuccess] = useState('')
  const [templateError, setTemplateError] = useState('')
  const [deletedContracts, setDeletedContracts] = useState<{id: string, number: string, title: string, company_prefix: string, deleted_at: string, deleted_by_name: string, delete_reason: string}[]>([])
  const [deletedLoading, setDeletedLoading] = useState(false)
  const [deletedError, setDeletedError] = useState('')
  const [deletedSuccess, setDeletedSuccess] = useState('')

  

  // Специалисты ЭДО
  const [edoSpecialists, setEdoSpecialists] = useState<{id: string, company_prefix: string, bitrix_user_id: number, user_name: string, position: string}[]>([])
  const [edoLoading, setEdoLoading] = useState(false)
  const [edoForm, setEdoForm] = useState({ company_prefix: 'ТХ', bitrix_user_id: '', user_name: '', position: '' })
  const [edoSaving, setEdoSaving] = useState(false)
  const [edoError, setEdoError] = useState('')
  const [edoSuccess, setEdoSuccess] = useState('')

  // База знаний ЭПОТОС-Ассистент
  const [knowledgeList, setKnowledgeList] = useState<{id: string, title: string, source_file: string, module: string, created_at: string, uploaded_by_name: string}[]>([])
  const [knowledgeLoading, setKnowledgeLoading] = useState(false)
  const [knowledgeUploading, setKnowledgeUploading] = useState(false)
  const [knowledgeError, setKnowledgeError] = useState('')
  const [knowledgeSuccess, setKnowledgeSuccess] = useState('')
  const [knowledgeTitle, setKnowledgeTitle] = useState('')
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null)
  const coreUrl = 'https://epotos-core.vercel.app'

  const baseUrl = 'https://epotos-ur-intel.vercel.app'

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user?.id) return
      const userId = parseInt(user.id)
      // Разработчик — жёстко в коде
      if (userId === 30) {
        setIsAdmin(true)
        setLoading(false)
        return
      }
      // Остальные — проверяем через system_roles
      const res = await fetch(`${baseUrl}/api/system-roles`)
      const data = await res.json()
      const myRole = (data.roles ?? []).find((r: {bitrix_user_id: number, role: string}) =>
        r.bitrix_user_id === userId
      )
      if (myRole && ['admin', 'gc_manager'].includes(myRole.role)) {
        setIsAdmin(true)
      }
      setLoading(false)
    }
    checkAdmin()
  }, [user])

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${baseUrl}/api/approval-settings?stage=${activeStage}`)
      const data = await res.json()
      setParticipants(data.participants ?? [])
    }
    load()
  }, [activeStage])

useEffect(() => {
    const loadGcRoles = async () => {
      setGcRolesLoading(true)
      const res = await fetch(`${baseUrl}/api/system-roles`)
      const data = await res.json()
      setGcRoles(data.roles ?? [])
      setGcRolesLoading(false)
    }
    if (adminTab === 'gc_roles') loadGcRoles()
    if (adminTab === 'approval') {
      setEdoLoading(true)
      fetch(`${baseUrl}/api/edo-specialists`)
        .then(r => r.json())
        .then(d => { setEdoSpecialists(d.specialists ?? []); setEdoLoading(false) })
    }
  }, [adminTab])

  useEffect(() => {
    const loadTemplates = async () => {
      const res = await fetch(`${baseUrl}/api/templates`)
      const data = await res.json()
      setTemplates(data.templates ?? [])
    }
    if (adminTab === 'templates') loadTemplates()
    if (adminTab === 'knowledge') {
      setKnowledgeLoading(true)
      fetch(`${coreUrl}/api/assistant/knowledge?module=юринтел`)
        .then(r => r.json())
        .then(d => { setKnowledgeList(d.documents ?? []); setKnowledgeLoading(false) })
    }
    if (adminTab === 'deleted') {
      setDeletedLoading(true)
      fetch(`${baseUrl}/api/deleted-contracts?bitrix_user_id=${user?.id}`)
        .then(r => r.json())
        .then(d => { setDeletedContracts(d.contracts ?? []); setDeletedLoading(false) })
    }
  }, [adminTab])

  

  // Загружаем реквизиты при смене компании
  useEffect(() => {
    const loadRequisites = async () => {
      const res = await fetch(`${baseUrl}/api/company-requisites?prefix=${selectedCompany}`)
      const data = await res.json()
      if (data.requisites?.length > 0) {
        setRequisitesForm(data.requisites[0])
      } else {
        setRequisitesForm({
          company_prefix: selectedCompany,
          company_name: '',
          short_name: '',
          warehouse_address: '',
          inn: '', kpp: '', ogrn: '',
          legal_address: '', actual_address: '',
          bank_name: '', bank_account: '', bank_bik: '', bank_corr_account: '',
          director_name: '', director_title: 'Генеральный директор',
          phone: '', email: '', website: '',
          signatory_name: '', poa_number: '', poa_date: '', poa_expires: '',
        })
      }
    }
    if (adminTab === 'requisites') loadRequisites()
  }, [adminTab, selectedCompany])

  const handleSaveRequisites = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingRequisites(true)
    setRequisitesError('')
    setRequisitesSuccess('')

    const res = await fetch(`${baseUrl}/api/company-requisites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...requisitesForm,
        company_prefix: selectedCompany,
        admin_bitrix_id: parseInt(user?.id ?? '0'),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setRequisitesError(data.error)
    } else {
      setRequisitesSuccess('Реквизиты сохранены')
    }
    setSavingRequisites(false)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!newP.user_name || !newP.bitrix_user_id) {
      setError('Заполните ФИО и ID пользователя')
      return
    }

    const prefixes = newP.company_prefixes.length > 0 ? newP.company_prefixes : [null]
    let hasError = false

    // Проверка на дубли
    const duplicates = prefixes.filter(prefix =>
      participants.some(p =>
        p.bitrix_user_id === parseInt(newP.bitrix_user_id) &&
        p.stage === newP.stage &&
        (p.company_prefix === prefix || (p.company_prefix === null && prefix === null))
      )
    )
    if (duplicates.length > 0) {
      setError(`Участник уже добавлен в этот раздел для компании: ${duplicates.join(', ')}`)
      return
    }

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
    formData.append('region', templateForm.region)
    formData.append('admin_bitrix_id', user?.id ?? '0')

    const res = await fetch(`${baseUrl}/api/templates`, { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setTemplateError(data.error)
    } else {
      setTemplateSuccess('Шаблон добавлен')
      setTemplateFile(null)
      setTemplateForm({ name: '', type: '', company_prefix: '', description: '', region: '' })
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
          <Link href="/" className="mt-4 inline-block text-sm text-gray-900 underline">На главную</Link>
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
          <h1 className="text-xl font-semibold text-gray-900">Настройки</h1>
          <span className="text-xs bg-gray-900 text-white px-2 py-1 rounded-full">Администратор</span>
        </div>

        {/* Главные вкладки */}
        <div className="flex gap-2 mb-6">
          {ADMIN_TABS.map(tab => (
            <button key={tab.id} onClick={() => setAdminTab(tab.id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${adminTab === tab.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Вкладка — Согласующие */}
        {adminTab === 'approval' && (
          <div>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 mb-4">{success}</div>}

            <div className="flex gap-2 mb-6 flex-wrap">
              {STAGES.map(stage => (
                <button key={stage.id}
                  onClick={() => { setActiveStage(stage.id); setNewP(p => ({ ...p, stage: stage.id })) }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeStage === stage.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                  {stage.label}
                </button>
              ))}
            </div>

            {activeStage !== 'edo' && <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">
                Текущий список — {STAGES.find(s => s.id === activeStage)?.label}
              </h2>
              {activeStage === 'custom' && (
                <div className="flex gap-1.5 mb-4 flex-wrap">
                  <button onClick={() => setCustomCompanyFilter('all')}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${customCompanyFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    Все компании
                  </button>
                  {COMPANIES.map(c => (
                    <button key={c.id} onClick={() => setCustomCompanyFilter(c.id)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${customCompanyFilter === c.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {c.id}
                    </button>
                  ))}
                </div>
              )}
              {participants.filter(p => activeStage !== 'custom' || customCompanyFilter === 'all' || p.company_prefix === customCompanyFilter).length === 0 ? (
                <p className="text-sm text-gray-400">Список пуст</p>
              ) : (
                <div className="space-y-2">
                  {participants.filter(p => activeStage !== 'custom' || customCompanyFilter === 'all' || p.company_prefix === customCompanyFilter).map(p => (
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
            </div>}

            {activeStage !== 'edo' && <div className="bg-white rounded-xl border border-gray-200 p-6">
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
                      Компании участия <span className="text-red-500">*</span>
                      <span className="text-gray-400 font-normal ml-1">(выберите хотя бы одну)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COMPANIES.map(c => (
                        <label key={c.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${newP.company_prefixes.includes(c.id) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                          <input type="checkbox" checked={newP.company_prefixes.includes(c.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setNewP(p => ({ ...p, company_prefixes: [...p.company_prefixes, c.id] }))
                              } else {
                                setNewP(p => ({ ...p, company_prefixes: p.company_prefixes.filter(x => x !== c.id) }))
                              }
                            }}
                            className="hidden" />
                          {c.id} — {c.name.replace('ООО ', '')}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <button type="submit"
                  disabled={!newP.user_name || !newP.bitrix_user_id || newP.company_prefixes.length === 0}
                  className="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Добавить
                </button>
              </form>
            </div>}
          {activeStage === 'edo' && (
            <div className="space-y-6">
              {edoError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{edoError}</div>}
              {edoSuccess && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{edoSuccess}</div>}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-medium text-gray-700 mb-4">Текущий список — Специалисты ЭДО</h2>
                {edoLoading ? <p className="text-sm text-gray-400">Загрузка...</p> : (
                  <div className="space-y-4">
                    {COMPANIES.map(company => {
                      const specs = edoSpecialists.filter(s => s.company_prefix === company.id)
                      if (specs.length === 0) return null
                      return (
                        <div key={company.id}>
                          <p className="text-xs font-semibold text-gray-500 mb-2">{company.name}</p>
                          {specs.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-1">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{s.user_name}</p>
                                <p className="text-xs text-gray-500">{s.position} · Битрикс ID: {s.bitrix_user_id}</p>
                              </div>
                              <button onClick={async () => {
                                setEdoError(''); setEdoSuccess('')
                                const res = await fetch(`${baseUrl}/api/edo-specialists?id=${s.id}`, { method: 'DELETE' })
                                const data = await res.json()
                                if (data.success) {
                                  setEdoSpecialists(prev => prev.filter(x => x.id !== s.id))
                                  setEdoSuccess('Удалено')
                                } else { setEdoError(data.error ?? 'Ошибка') }
                              }} className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded">Удалить</button>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-medium text-gray-700 mb-4">Добавить специалиста ЭДО</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Компания <span className="text-red-500">*</span></label>
                    <select value={edoForm.company_prefix} onChange={e => setEdoForm(p => ({...p, company_prefix: e.target.value}))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Битрикс24 ID <span className="text-red-500">*</span></label>
                    <input type="number" value={edoForm.bitrix_user_id} onChange={e => setEdoForm(p => ({...p, bitrix_user_id: e.target.value}))}
                      placeholder="например: 158"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">ФИО <span className="text-red-500">*</span></label>
                    <input value={edoForm.user_name} onChange={e => setEdoForm(p => ({...p, user_name: e.target.value}))}
                      placeholder="Наумова Елена"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Должность</label>
                    <input value={edoForm.position} onChange={e => setEdoForm(p => ({...p, position: e.target.value}))}
                      placeholder="Главный бухгалтер"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <button onClick={async () => {
                  if (!edoForm.bitrix_user_id || !edoForm.user_name) { setEdoError('Заполните ID и ФИО'); return }
                  setEdoSaving(true); setEdoError(''); setEdoSuccess('')
                  const res = await fetch(`${baseUrl}/api/edo-specialists`, {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({...edoForm, bitrix_user_id: parseInt(edoForm.bitrix_user_id)})
                  })
                  const data = await res.json()
                  if (data.success) {
                    setEdoSuccess('Специалист добавлен')
                    setEdoForm({ company_prefix: 'ТХ', bitrix_user_id: '', user_name: '', position: '' })
                    const r = await fetch(`${baseUrl}/api/edo-specialists`)
                    const d = await r.json()
                    setEdoSpecialists(d.specialists ?? [])
                  } else { setEdoError(data.error ?? 'Ошибка') }
                  setEdoSaving(false)
                }} disabled={edoSaving}
                  className="mt-4 bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                  {edoSaving ? 'Сохранение...' : 'Добавить'}
                </button>
              </div>
            </div>
          )}
          </div>
        )}

        {/* Модальное окно предпросмотра реквизитов */}
        {showRequisitesPreview && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">
                  Реквизиты — {requisitesForm.short_name || requisitesForm.company_name}
                </h3>
                <button onClick={() => setShowRequisitesPreview(false)}
                  className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {/* Блок предпросмотра */}
              <div id="requisites-preview" className="text-sm text-gray-800 space-y-1 border border-gray-100 rounded-lg p-4 bg-gray-50">
                {requisitesForm.company_name && (
                  <p className="font-semibold">{requisitesForm.company_name}</p>
                )}
                {requisitesForm.short_name && (
                  <p className="text-gray-500">{requisitesForm.short_name}</p>
                )}
                <div className="border-t border-gray-200 my-2" />
                {requisitesForm.inn && (
                  <p>ИНН: <span className="font-medium">{requisitesForm.inn}</span>
                    {requisitesForm.kpp && <> / КПП: <span className="font-medium">{requisitesForm.kpp}</span></>}
                    {requisitesForm.ogrn && <> / ОГРН: <span className="font-medium">{requisitesForm.ogrn}</span></>}
                  </p>
                )}
                {requisitesForm.legal_address && (
                  <p>Юр. адрес: <span className="font-medium">{requisitesForm.legal_address}</span></p>
                )}
                {requisitesForm.actual_address && (
                  <p>Факт. адрес: <span className="font-medium">{requisitesForm.actual_address}</span></p>
                )}
                {requisitesForm.bank_name && (
                  <>
                    <div className="border-t border-gray-200 my-2" />
                    <p>Банк: <span className="font-medium">{requisitesForm.bank_name}</span></p>
                    {requisitesForm.bank_account && (
                      <p>р/с: <span className="font-medium">{requisitesForm.bank_account}</span></p>
                    )}
                    {requisitesForm.bank_corr_account && (
                      <p>к/с: <span className="font-medium">{requisitesForm.bank_corr_account}</span></p>
                    )}
                    {requisitesForm.bank_bik && (
                      <p>БИК: <span className="font-medium">{requisitesForm.bank_bik}</span></p>
                    )}
                  </>
                )}
                {(requisitesForm.director_name || requisitesForm.director_title) && (
                  <>
                    <div className="border-t border-gray-200 my-2" />
                    <p>{requisitesForm.director_title}: <span className="font-medium">{requisitesForm.director_name}</span></p>
                  </>
                )}
                {(requisitesForm.phone || requisitesForm.email || requisitesForm.website) && (
                  <>
                    <div className="border-t border-gray-200 my-2" />
                    {requisitesForm.phone && <p>Тел: <span className="font-medium">{requisitesForm.phone}</span></p>}
                    {requisitesForm.email && <p>Email: <span className="font-medium">{requisitesForm.email}</span></p>}
                    {requisitesForm.website && <p>Сайт: <span className="font-medium">{requisitesForm.website}</span></p>}
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={() => {
                  const content = document.getElementById('requisites-preview')?.innerHTML ?? ''
                  const win = window.open('', '_blank')
                  if (win) {
                    win.document.write(`
                      <html><head><title>Реквизиты</title>
                      <style>body{font-family:Arial,sans-serif;font-size:14px;padding:20px;max-width:600px;margin:0 auto}
                      p{margin:4px 0}.divider{border-top:1px solid #eee;margin:8px 0}
                      @media print{button{display:none}}</style></head>
                      <body>${content}<br/><button onclick="window.print()">Печать</button></body></html>
                    `)
                    win.document.close()
                    win.print()
                  }
                }}
                  className="flex-1 bg-gray-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-gray-700">
                  🖨️ Печать
                </button>
                <button onClick={() => setShowRequisitesPreview(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                  Закрыть
                </button>
              </div>
            </div>
          {activeStage === 'edo' && (
            <div className="space-y-6">
              {edoError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{edoError}</div>}
              {edoSuccess && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{edoSuccess}</div>}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-medium text-gray-700 mb-4">Текущий список — Специалисты ЭДО</h2>
                {edoLoading ? <p className="text-sm text-gray-400">Загрузка...</p> : (
                  <div className="space-y-4">
                    {COMPANIES.map(company => {
                      const specs = edoSpecialists.filter(s => s.company_prefix === company.id)
                      if (specs.length === 0) return null
                      return (
                        <div key={company.id}>
                          <p className="text-xs font-semibold text-gray-500 mb-2">{company.name}</p>
                          {specs.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-1">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{s.user_name}</p>
                                <p className="text-xs text-gray-500">{s.position} · Битрикс ID: {s.bitrix_user_id}</p>
                              </div>
                              <button onClick={async () => {
                                setEdoError(''); setEdoSuccess('')
                                const res = await fetch(`${baseUrl}/api/edo-specialists?id=${s.id}`, { method: 'DELETE' })
                                const data = await res.json()
                                if (data.success) {
                                  setEdoSpecialists(prev => prev.filter(x => x.id !== s.id))
                                  setEdoSuccess('Удалено')
                                } else { setEdoError(data.error ?? 'Ошибка') }
                              }} className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded">Удалить</button>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-sm font-medium text-gray-700 mb-4">Добавить специалиста ЭДО</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Компания <span className="text-red-500">*</span></label>
                    <select value={edoForm.company_prefix} onChange={e => setEdoForm(p => ({...p, company_prefix: e.target.value}))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Битрикс24 ID <span className="text-red-500">*</span></label>
                    <input type="number" value={edoForm.bitrix_user_id} onChange={e => setEdoForm(p => ({...p, bitrix_user_id: e.target.value}))}
                      placeholder="например: 158"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">ФИО <span className="text-red-500">*</span></label>
                    <input value={edoForm.user_name} onChange={e => setEdoForm(p => ({...p, user_name: e.target.value}))}
                      placeholder="Наумова Елена"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Должность</label>
                    <input value={edoForm.position} onChange={e => setEdoForm(p => ({...p, position: e.target.value}))}
                      placeholder="Главный бухгалтер"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <button onClick={async () => {
                  if (!edoForm.bitrix_user_id || !edoForm.user_name) { setEdoError('Заполните ID и ФИО'); return }
                  setEdoSaving(true); setEdoError(''); setEdoSuccess('')
                  const res = await fetch(`${baseUrl}/api/edo-specialists`, {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({...edoForm, bitrix_user_id: parseInt(edoForm.bitrix_user_id)})
                  })
                  const data = await res.json()
                  if (data.success) {
                    setEdoSuccess('Специалист добавлен')
                    setEdoForm({ company_prefix: 'ТХ', bitrix_user_id: '', user_name: '', position: '' })
                    const r = await fetch(`${baseUrl}/api/edo-specialists`)
                    const d = await r.json()
                    setEdoSpecialists(d.specialists ?? [])
                  } else { setEdoError(data.error ?? 'Ошибка') }
                  setEdoSaving(false)
                }} disabled={edoSaving}
                  className="mt-4 bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                  {edoSaving ? 'Сохранение...' : 'Добавить'}
                </button>
              </div>
            </div>
          )}
          </div>
        )}

        {/* Модальное окно предпросмотра реквизитов */}
        {showRequisitesPreview && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">
                  Реквизиты — {requisitesForm.short_name || requisitesForm.company_name}
                </h3>
                <button onClick={() => setShowRequisitesPreview(false)}
                  className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div id="requisites-preview" className="text-sm text-gray-800 space-y-1 border border-gray-100 rounded-lg p-4 bg-gray-50">
                {requisitesForm.company_name && (
                  <p className="font-semibold">{requisitesForm.company_name}</p>
                )}
                {requisitesForm.short_name && (
                  <p className="text-gray-500">{requisitesForm.short_name}</p>
                )}
                <div className="border-t border-gray-200 my-2" />
                {requisitesForm.inn && (
                  <p>ИНН: <span className="font-medium">{requisitesForm.inn}</span>
                    {requisitesForm.kpp && <> / КПП: <span className="font-medium">{requisitesForm.kpp}</span></>}
                    {requisitesForm.ogrn && <> / ОГРН: <span className="font-medium">{requisitesForm.ogrn}</span></>}
                  </p>
                )}
                {requisitesForm.legal_address && (
                  <p>Юр. адрес: <span className="font-medium">{requisitesForm.legal_address}</span></p>
                )}
                {requisitesForm.actual_address && (
                  <p>Факт. адрес: <span className="font-medium">{requisitesForm.actual_address}</span></p>
                )}
                {requisitesForm.bank_name && (
                  <>
                    <div className="border-t border-gray-200 my-2" />
                    <p>Банк: <span className="font-medium">{requisitesForm.bank_name}</span></p>
                    {requisitesForm.bank_account && (
                      <p>р/с: <span className="font-medium">{requisitesForm.bank_account}</span></p>
                    )}
                    {requisitesForm.bank_corr_account && (
                      <p>к/с: <span className="font-medium">{requisitesForm.bank_corr_account}</span></p>
                    )}
                    {requisitesForm.bank_bik && (
                      <p>БИК: <span className="font-medium">{requisitesForm.bank_bik}</span></p>
                    )}
                  </>
                )}
                {(requisitesForm.director_name || requisitesForm.director_title) && (
                  <>
                    <div className="border-t border-gray-200 my-2" />
                    <p>{requisitesForm.director_title}: <span className="font-medium">{requisitesForm.director_name}</span></p>
                  </>
                )}
                {(requisitesForm.phone || requisitesForm.email || requisitesForm.website) && (
                  <>
                    <div className="border-t border-gray-200 my-2" />
                    {requisitesForm.phone && <p>Тел: <span className="font-medium">{requisitesForm.phone}</span></p>}
                    {requisitesForm.email && <p>Email: <span className="font-medium">{requisitesForm.email}</span></p>}
                    {requisitesForm.website && <p>Сайт: <span className="font-medium">{requisitesForm.website}</span></p>}
                  </>
                )}
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => {
                  const content = document.getElementById('requisites-preview')?.innerHTML ?? ''
                  const win = window.open('', '_blank')
                  if (win) {
                    win.document.write(`<html><head><title>Реквизиты</title>
                      <style>body{font-family:Arial,sans-serif;font-size:14px;padding:20px;max-width:600px;margin:0 auto}
                      p{margin:4px 0}@media print{button{display:none}}</style></head>
                      <body>${content}<br/><button onclick="window.print()">Печать</button></body></html>`)
                    win.document.close()
                    win.print()
                  }
                }}
                  className="flex-1 bg-gray-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-gray-700">
                  🖨️ Печать
                </button>
                <button onClick={() => setShowRequisitesPreview(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Вкладка — Реквизиты */}
        {adminTab === 'requisites' && (
          <div className="space-y-6">
            {requisitesError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{requisitesError}</div>}
            {requisitesSuccess && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{requisitesSuccess}</div>}

            {/* Выбор компании */}
            <div className="flex gap-2">
              {COMPANIES.map(c => (
                <button key={c.id} onClick={() => setSelectedCompany(c.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCompany === c.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                  {c.id}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">
                Реквизиты — {COMPANIES.find(c => c.id === selectedCompany)?.name}
              </h2>
              {/* Кнопка предпросмотра */}
              <div className="flex justify-end mb-2">
                <button type="button" onClick={() => setShowRequisitesPreview(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  🖨️ Предпросмотр и печать
                </button>
              </div>

              <form onSubmit={handleSaveRequisites} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Полное наименование</label>
                    <input value={requisitesForm.company_name} onChange={e => setRequisitesForm(p => ({...p, company_name: e.target.value}))}
                      placeholder='Общество с ограниченной ответственностью "Техно"'
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Сокращённое наименование</label>
                    <input value={requisitesForm.short_name ?? ''} onChange={e => setRequisitesForm(p => ({...p, short_name: e.target.value}))}
                      placeholder='ООО "Техно"'
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">ИНН</label>
                    <input value={requisitesForm.inn} onChange={e => setRequisitesForm(p => ({...p, inn: e.target.value}))}
                      placeholder="1234567890"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">КПП</label>
                    <input value={requisitesForm.kpp} onChange={e => setRequisitesForm(p => ({...p, kpp: e.target.value}))}
                      placeholder="123456789"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">ОГРН</label>
                    <input value={requisitesForm.ogrn} onChange={e => setRequisitesForm(p => ({...p, ogrn: e.target.value}))}
                      placeholder="1234567890123"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Руководитель</label>
                    <input value={requisitesForm.director_name} onChange={e => setRequisitesForm(p => ({...p, director_name: e.target.value}))}
                      placeholder="Иванов Иван Иванович"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Должность руководителя</label>
                    <input value={requisitesForm.director_title} onChange={e => setRequisitesForm(p => ({...p, director_title: e.target.value}))}
                      placeholder="Генеральный директор"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>

                  <div className="col-span-2 border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Подписант по доверенности (если есть)</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">ФИО подписанта</label>
                    <input value={requisitesForm.signatory_name ?? ''} onChange={e => setRequisitesForm(p => ({...p, signatory_name: e.target.value}))}
                      placeholder="Иванов Иван Иванович"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div className="col-span-2">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Номер доверенности</label>
                        <input value={requisitesForm.poa_number ?? ''} onChange={e => setRequisitesForm(p => ({...p, poa_number: e.target.value}))}
                          placeholder="№ 123"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Дата доверенности</label>
                        <input type="date" value={requisitesForm.poa_date ?? ''} onChange={e => setRequisitesForm(p => ({...p, poa_date: e.target.value}))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Срок действия</label>
                        <input type="date" value={requisitesForm.poa_expires ?? ''} onChange={e => setRequisitesForm(p => ({...p, poa_expires: e.target.value}))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Юридический адрес</label>
                    <input value={requisitesForm.legal_address} onChange={e => setRequisitesForm(p => ({...p, legal_address: e.target.value}))}
                      placeholder="г. Москва, ул. Примерная, д. 1"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Фактический адрес</label>
                    <input value={requisitesForm.actual_address} onChange={e => setRequisitesForm(p => ({...p, actual_address: e.target.value}))}
                      placeholder="г. Москва, ул. Примерная, д. 1"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Адрес склада</label>
                    <input value={requisitesForm.warehouse_address ?? ''} onChange={e => setRequisitesForm(p => ({...p, warehouse_address: e.target.value}))}
                      placeholder="196641, г. Санкт-Петербург, пос. Металлострой, д. 9Б"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>

                  <div className="col-span-2 border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Банковские реквизиты</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Наименование банка</label>
                    <input value={requisitesForm.bank_name} onChange={e => setRequisitesForm(p => ({...p, bank_name: e.target.value}))}
                      placeholder="Банк ВТБ (ПАО)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Расчётный счёт</label>
                    <input value={requisitesForm.bank_account} onChange={e => setRequisitesForm(p => ({...p, bank_account: e.target.value}))}
                      placeholder="40702810000000000000"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">БИК</label>
                    <input value={requisitesForm.bank_bik} onChange={e => setRequisitesForm(p => ({...p, bank_bik: e.target.value}))}
                      placeholder="044525187"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Корреспондентский счёт</label>
                    <input value={requisitesForm.bank_corr_account} onChange={e => setRequisitesForm(p => ({...p, bank_corr_account: e.target.value}))}
                      placeholder="30101810145250000411"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>

                  <div className="col-span-2 border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Контактная информация</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Телефон</label>
                    <input value={requisitesForm.phone} onChange={e => setRequisitesForm(p => ({...p, phone: e.target.value}))}
                      placeholder="+7 (495) 000-00-00"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                    <input value={requisitesForm.email} onChange={e => setRequisitesForm(p => ({...p, email: e.target.value}))}
                      placeholder="info@epotos.ru"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Сайт</label>
                    <input value={requisitesForm.website} onChange={e => setRequisitesForm(p => ({...p, website: e.target.value}))}
                      placeholder="https://epotos.ru"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <button type="submit" disabled={savingRequisites}
                  className="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                  {savingRequisites ? 'Сохранение...' : 'Сохранить реквизиты'}
                </button>
              </form>
            </div>
          </div>
        )}

{/* Вкладка — Роли ГК */}
        {adminTab === 'gc_roles' && (
          <div className="space-y-6">
            {gcRoleError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{gcRoleError}</div>}
            {gcRoleSuccess && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{gcRoleSuccess}</div>}

            {/* Список текущих ролей */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Назначенные роли ГК</h2>
              {gcRolesLoading ? (
                <p className="text-sm text-gray-400">Загрузка...</p>
              ) : gcRoles.length === 0 ? (
                <p className="text-sm text-gray-400">Роли не назначены</p>
              ) : (
                <div className="space-y-2">
                  {gcRoles.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.user_name}</p>
                        <p className="text-xs text-gray-500">ID: {r.bitrix_user_id} · {GC_ROLE_OPTIONS.find(o => o.value === r.role)?.label ?? r.role}</p>
                      </div>
                      {isDeveloper && (
                        <button onClick={async () => {
                          if (!confirm('Удалить роль?')) return
                          const res = await fetch(`${baseUrl}/api/system-roles`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: r.id, admin_bitrix_id: parseInt(user?.id ?? '0') }),
                          })
                          if (res.ok) {
                            setGcRoles(prev => prev.filter(x => x.id !== r.id))
                            setGcRoleSuccess('Роль удалена')
                          }
                        }}
                          className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50">
                          Удалить
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Форма добавления */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Назначить роль ГК</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">ФИО <span className="text-red-500">*</span></label>
                  <input value={gcRoleForm.user_name} onChange={e => setGcRoleForm(p => ({...p, user_name: e.target.value}))}
                    placeholder="Иванов Иван Иванович"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Битрикс24 ID <span className="text-red-500">*</span></label>
                  <input value={gcRoleForm.bitrix_user_id} onChange={e => setGcRoleForm(p => ({...p, bitrix_user_id: e.target.value}))}
                    placeholder="123"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Роль <span className="text-red-500">*</span></label>
                  <select value={gcRoleForm.role} onChange={e => setGcRoleForm(p => ({...p, role: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                    {GC_ROLE_OPTIONS
                      .filter(o => isDeveloper || o.value !== 'admin')
                      .map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    disabled={!gcRoleForm.user_name || !gcRoleForm.bitrix_user_id}
                    onClick={async () => {
                      setGcRoleError('')
                      setGcRoleSuccess('')
                      const res = await fetch(`${baseUrl}/api/system-roles`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          ...gcRoleForm,
                          bitrix_user_id: parseInt(gcRoleForm.bitrix_user_id),
                          admin_bitrix_id: parseInt(user?.id ?? '0'),
                        }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        setGcRoleSuccess('Роль назначена')
                        setGcRoleForm({ bitrix_user_id: '', user_name: '', role: 'gc_manager' })
                        const reload = await fetch(`${baseUrl}/api/system-roles`)
                        const reloadData = await reload.json()
                        setGcRoles(reloadData.roles ?? [])
                      } else {
                        setGcRoleError(data.error ?? 'Ошибка')
                      }
                    }}
                    className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    Назначить роль
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Вкладка — Шаблоны */}
        {/* Вкладка — База знаний ИИ */}
        {adminTab === 'knowledge' && (
          <div className="space-y-4">
            {knowledgeError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{knowledgeError}</div>}
            {knowledgeSuccess && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{knowledgeSuccess}</div>}

            {/* Список документов */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Документы в базе знаний ЭПОТОС-Ассистента</h2>
              {knowledgeLoading ? <p className="text-sm text-gray-400">Загрузка...</p> : knowledgeList.length === 0 ? (
                <p className="text-sm text-gray-400">База знаний пуста. Загрузите первый документ.</p>
              ) : (
                <div className="space-y-2">
                  {knowledgeList.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                        <p className="text-xs text-gray-400">{doc.source_file} · {doc.uploaded_by_name} · {new Date(doc.created_at).toLocaleDateString('ru-RU')}</p>
                      </div>
                      <button onClick={async () => {
                        if (!confirm(`Удалить документ "${doc.title}" из базы знаний?`)) return
                        setKnowledgeError(''); setKnowledgeSuccess('')
                        const res = await fetch(`${coreUrl}/api/assistant/knowledge?id=${doc.id}`, { method: 'DELETE' })
                        const data = await res.json()
                        if (data.success) {
                          setKnowledgeList(prev => prev.filter(d => d.id !== doc.id))
                          setKnowledgeSuccess('Документ удалён')
                        } else { setKnowledgeError(data.error ?? 'Ошибка') }
                      }} className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-2 py-1 rounded">
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Форма загрузки */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Загрузить документ в базу знаний</h2>
              <p className="text-xs text-gray-500 mb-4">Поддерживаются форматы DOCX и TXT. Документ будет разбит на фрагменты и проиндексирован для поиска.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Название документа <span className="text-red-500">*</span></label>
                  <input value={knowledgeTitle} onChange={e => setKnowledgeTitle(e.target.value)}
                    placeholder="Например: Инструкция пользователя ЮрИнтел"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Файл (DOCX или TXT) <span className="text-red-500">*</span></label>
                  <div className={`w-full border-2 border-dashed rounded-lg px-4 py-6 text-center cursor-pointer transition-colors ${knowledgeFile ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-gray-400 bg-gray-50'}`}
                    onClick={() => document.getElementById('knowledge-file-input')?.click()}>
                    <input id="knowledge-file-input" type="file" accept=".docx,.txt" className="hidden"
                      onChange={e => setKnowledgeFile(e.target.files?.[0] ?? null)} />
                    {knowledgeFile ? (
                      <div>
                        <p className="text-sm font-medium text-green-700">✅ {knowledgeFile.name}</p>
                        <p className="text-xs text-green-500 mt-1">{(knowledgeFile.size / 1024).toFixed(1)} КБ</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-2xl mb-2">📄</p>
                        <p className="text-sm text-gray-600 font-medium">Нажмите для выбора файла</p>
                        <p className="text-xs text-gray-400 mt-1">DOCX или TXT</p>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={async () => {
                  if (!knowledgeTitle.trim() || !knowledgeFile) { setKnowledgeError('Заполните название и выберите файл'); return }
                  setKnowledgeUploading(true); setKnowledgeError(''); setKnowledgeSuccess('')
                  const formData = new FormData()
                  formData.append('file', knowledgeFile)
                  formData.append('title', knowledgeTitle)
                  formData.append('module', 'юринтел')
                  formData.append('user_id', user?.id ?? '0')
                  formData.append('user_name', user?.name ?? '')
                  const res = await fetch(`${coreUrl}/api/assistant/upload`, { method: 'POST', body: formData })
                  const data = await res.json()
                  if (data.success) {
                    setKnowledgeSuccess(`Документ загружен! Создано ${data.chunks_created} фрагментов.`)
                    setKnowledgeTitle('')
                    setKnowledgeFile(null)
                    const r = await fetch(`${coreUrl}/api/assistant/knowledge?module=юринтел`)
                    const d = await r.json()
                    setKnowledgeList(d.documents ?? [])
                  } else { setKnowledgeError(data.error ?? 'Ошибка загрузки') }
                  setKnowledgeUploading(false)
                }} disabled={knowledgeUploading}
                  className="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                  {knowledgeUploading ? '⏳ Обработка...' : '+ Загрузить документ'}
                </button>
              </div>
            </div>
          </div>
        )}

        {adminTab === 'deleted' && (
          <div className="space-y-4">
            {deletedError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{deletedError}</div>}
            {deletedSuccess && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{deletedSuccess}</div>}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Удалённые документы</h2>
              {deletedLoading ? (
                <p className="text-sm text-gray-400">Загрузка...</p>
              ) : deletedContracts.length === 0 ? (
                <p className="text-sm text-gray-400">Удалённых документов нет</p>
              ) : (
                <div className="space-y-3">
                  {deletedContracts.map(c => (
                    <div key={c.id} className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{c.number} — {c.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Компания: {c.company_prefix}</p>
                        <p className="text-xs text-gray-500">Удалил: {c.deleted_by_name} · {new Date(c.deleted_at).toLocaleString('ru-RU')}</p>
                        <p className="text-xs text-red-600 mt-0.5">Причина: {c.delete_reason}</p>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={async () => {
                            setDeletedError('')
                            setDeletedSuccess('')
                            const res = await fetch(`${baseUrl}/api/deleted-contracts`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ contract_id: c.id, bitrix_user_id: parseInt(user?.id ?? '0'), user_name: user?.name }),
                            })
                            const data = await res.json()
                            if (data.success) {
                              setDeletedContracts(prev => prev.filter(x => x.id !== c.id))
                              setDeletedSuccess(`Документ ${c.number} восстановлен`)
                            } else {
                              setDeletedError(data.error ?? 'Ошибка восстановления')
                            }
                          }}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
                          ↩ Восстановить
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Удалить безвозвратно документ ${c.number}?\n\nЭто действие НЕЛЬЗЯ отменить — все файлы и данные будут уничтожены.`)) return
                            setDeletedError('')
                            setDeletedSuccess('')
                            const res = await fetch(`${baseUrl}/api/deleted-contracts`, {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ contract_id: c.id, bitrix_user_id: parseInt(user?.id ?? '0') }),
                            })
                            const data = await res.json()
                            if (data.success) {
                              setDeletedContracts(prev => prev.filter(x => x.id !== c.id))
                              setDeletedSuccess(`Документ ${c.number} удалён безвозвратно`)
                            } else {
                              setDeletedError(data.error ?? 'Ошибка удаления')
                            }
                          }}
                          className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50">
                          🗑 Удалить безвозвратно
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {adminTab === 'templates' && (
          <div className="space-y-6">
            {templateError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{templateError}</div>}
            {templateSuccess && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{templateSuccess}</div>}

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-700">Загруженные шаблоны</h2>
                <select value={templateCompanyFilter} onChange={e => setTemplateCompanyFilter(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="all">Все шаблоны</option>
                  {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {templates.filter(t => templateCompanyFilter === 'all' || t.company_prefix === templateCompanyFilter).length === 0 ? (
                <p className="text-sm text-gray-400">Шаблонов пока нет</p>
              ) : (
                <div className="space-y-2">
                  {templates.filter(t => templateCompanyFilter === 'all' || t.company_prefix === templateCompanyFilter).map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-500">
                          {t.type} · {t.company_prefix ?? 'Все компании'} · {t.file_name}
                        </p>
                        {t.description && <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>}
                      </div>
                      <div className="flex gap-2">
                        <a href={proxyUrl(t.file_url)} target="_blank" rel="noopener noreferrer"
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

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Добавить шаблон</h2>
              <form onSubmit={handleAddTemplate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Название <span className="text-red-500">*</span></label>
                    <input value={templateForm.name} onChange={e => setTemplateForm(p => ({...p, name: e.target.value}))}
                      placeholder="Договор услуг (типовой)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Тип документа <span className="text-red-500">*</span></label>
                    <select value={templateForm.type} onChange={e => setTemplateForm(p => ({...p, type: e.target.value}))}
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
                    <label className="block text-xs font-medium text-gray-500 mb-1">Компания</label>
                    <select value={templateForm.company_prefix} onChange={e => setTemplateForm(p => ({...p, company_prefix: e.target.value}))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                      <option value="">Все компании</option>
                      {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Регион</label>
                    <select value={templateForm.region} onChange={e => setTemplateForm(p => ({...p, region: e.target.value}))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
                      {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
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
                  <div className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${templateFile ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}>
                    {templateFile ? (
                      <div>
                        <p className="text-sm font-medium text-gray-900">{templateFile.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{(templateFile.size / 1024 / 1024).toFixed(2)} МБ</p>
                        <button type="button" onClick={() => setTemplateFile(null)}
                          className="mt-2 text-xs text-red-500 hover:text-red-700 underline">
                          Удалить
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Нажмите для выбора файла</p>
                        <p className="text-xs text-gray-400">PDF, DOCX, XLSX — до 50 МБ</p>
                      </div>
                    )}
                    {!templateFile && (
                      <input type="file" accept=".pdf,.docx,.xlsx"
                        onChange={e => setTemplateFile(e.target.files?.[0] ?? null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    )}
                  </div>
                </div>
                <button type="submit" disabled={uploadingTemplate}
                  className="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                  {uploadingTemplate ? 'Загрузка...' : 'Добавить шаблон'}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}