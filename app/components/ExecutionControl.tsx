'use client'

import { useState, useEffect } from 'react'

interface ChecklistItem {
  id: string
  item_order: number
  category: string
  title: string
  description: string | null
  due_date: string | null
  responsible: string | null
  is_done: boolean
  done_at: string | null
  done_by_name: string | null
  done_by_bitrix_id: number | null
  source_document: string | null
  created_at: string
}

interface Version {
  id: string
  file_url: string
  file_name: string
  version_number: number
}

interface Attachment {
  id: string
  file_url: string
  file_name: string
  title: string
  attachment_type: string
}

interface Props {
  contractId: string
  contractStatus: string
  versions: Version[]
  attachments: Attachment[]
  userName?: string
  userId?: number
  sessionParticipantBitrixIds?: number[]
  onStatusChange?: (newStatus: string) => void
}

const baseUrl = 'https://epotos-ur-intel.vercel.app'

const CAT_COLORS: Record<string, string> = {
  payment:    'bg-blue-50 border-blue-200 text-blue-700',
  delivery:   'bg-orange-50 border-orange-200 text-orange-700',
  deadline:   'bg-red-50 border-red-200 text-red-700',
  document:   'bg-purple-50 border-purple-200 text-purple-700',
  obligation: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  other:      'bg-gray-50 border-gray-200 text-gray-600',
}

const CAT_LABELS: Record<string, string> = {
  payment:    '💰 Оплата',
  delivery:   '📦 Поставка',
  deadline:   '⏰ Срок',
  document:   '📄 Документы',
  obligation: '📌 Обязательство',
  other:      '📋 Прочее',
}

export default function ExecutionControl({
  contractId, contractStatus, versions, attachments,
  userName, userId, sessionParticipantBitrixIds = [], onStatusChange,
}: Props) {

  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [activeSection, setActiveSection] = useState<'checklist' | 'history'>('checklist')

  // Форма нового пункта
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState('other')
  const [newDueDate, setNewDueDate] = useState('')
  const [newResponsible, setNewResponsible] = useState('')

  // Модальное окно редактирования пункта
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('other')
  const [editDueDate, setEditDueDate] = useState('')
  const [editResponsible, setEditResponsible] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Модальное окно дат для относительных сроков
  const [showDatesModal, setShowDatesModal] = useState(false)
  const [signedDate, setSignedDate] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [customDate1Label, setCustomDate1Label] = useState('')
  const [customDate1Value, setCustomDate1Value] = useState('')

  // Права
  const adminIds = [30, 1148]
  const gcManagerIds = [1, 246, 504]
  const canManage = userId
    ? adminIds.includes(userId) || gcManagerIds.includes(userId) || sessionParticipantBitrixIds.includes(userId)
    : false

  const canGenerate = canManage && ['подписан', 'на_исполнении'].includes(contractStatus)

  useEffect(() => {
    loadItems()
  }, [contractId])

  const loadItems = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${baseUrl}/api/contract-checklist?contract_id=${contractId}`)
      const data = await res.json()
      setItems(data.items ?? [])
    } finally {
      setLoading(false)
    }
  }

  // Запускаем генерацию — показываем модал дат
  const handleGenerateClick = () => {
    if (items.length > 0) {
      if (!confirm('Перегенерировать чек-лист?\n\nТекущая версия будет сохранена как предыдущая.')) return
    }
    setShowDatesModal(true)
  }

  // Генерируем чек-лист после ввода дат
  const handleGenerate = async () => {
    setShowDatesModal(false)
    setGenerating(true)

    // Собираем все файлы: последняя версия + все вложения
    const latestVersion = versions[0] ?? null
    const allFiles = []

    if (latestVersion) {
      allFiles.push({
        file_url: latestVersion.file_url,
        file_name: latestVersion.file_name,
        source: 'Основной документ',
      })
    }

    attachments.forEach(att => {
      allFiles.push({
        file_url: att.file_url,
        file_name: att.file_name,
        source: att.title || att.attachment_type,
      })
    })

    if (allFiles.length === 0) {
      alert('Нет загруженных файлов для анализа')
      setGenerating(false)
      return
    }

    try {
      const res = await fetch(`${baseUrl}/api/contract-checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          files: allFiles,
          user_name: userName ?? 'Система',
          signed_date: signedDate || null,
          effective_date: effectiveDate || null,
          custom_date_label: customDate1Label || null,
          custom_date_value: customDate1Value || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        await loadItems()
        onStatusChange?.('на_исполнении')
      } else {
        alert('Ошибка: ' + data.error)
      }
    } catch {
      alert('Ошибка соединения')
    } finally {
      setGenerating(false)
    }
  }

  const openEdit = (item: ChecklistItem) => {
    setEditingItem(item)
    setEditTitle(item.title)
    setEditDescription(item.description ?? '')
    setEditCategory(item.category)
    setEditDueDate(item.due_date ?? '')
    setEditResponsible(item.responsible ?? '')
  }

  const saveEdit = async () => {
    if (!editingItem) return
    if (!editTitle.trim()) { alert('Введите название пункта'); return }
    setEditLoading(true)
    const res = await fetch(`${baseUrl}/api/contract-checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'edit_item',
        item_id: editingItem.id,
        contract_id: contractId,
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        category: editCategory,
        due_date: editDueDate || null,
        responsible: editResponsible || null,
        user_name: userName ?? 'Система',
      }),
    })
    const data = await res.json()
    if (data.success) {
      setItems(prev => prev.map(i => i.id === editingItem.id
        ? { ...i, title: editTitle.trim(), description: editDescription.trim() || null,
            category: editCategory, due_date: editDueDate || null, responsible: editResponsible || null }
        : i
      ))
      setEditingItem(null)
    } else {
      alert('Ошибка: ' + data.error)
    }
    setEditLoading(false)
  }

  const toggleItem = async (item: ChecklistItem) => {
    if (!canManage) return
    const newDone = !item.is_done
    setItems(prev => prev.map(i =>
      i.id === item.id
        ? { ...i, is_done: newDone, done_by_name: newDone ? (userName ?? null) : null }
        : i
    ))
    await fetch(`${baseUrl}/api/contract-checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toggle',
        item_id: item.id,
        contract_id: contractId,
        is_done: newDone,
        title: item.title,
        user_name: userName ?? 'Система',
        bitrix_user_id: userId ?? null,
      }),
    })
  }

  const deleteItem = async (item: ChecklistItem) => {
    if (!confirm(`Удалить пункт «${item.title}»?`)) return
    setItems(prev => prev.filter(i => i.id !== item.id))
    await fetch(`${baseUrl}/api/contract-checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_item',
        item_id: item.id,
        contract_id: contractId,
        title: item.title,
        user_name: userName ?? 'Система',
      }),
    })
  }

  const addItem = async () => {
    if (!newTitle.trim()) { alert('Введите название пункта'); return }
    setAddLoading(true)
    const res = await fetch(`${baseUrl}/api/contract-checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_item',
        contract_id: contractId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        category: newCategory,
        due_date: newDueDate || null,
        responsible: newResponsible || null,
        user_name: userName ?? 'Система',
      }),
    })
    const data = await res.json()
    if (data.success) {
      await loadItems()
      setShowAddItem(false)
      setNewTitle(''); setNewDescription(''); setNewCategory('other')
      setNewDueDate(''); setNewResponsible('')
    } else {
      alert('Ошибка: ' + data.error)
    }
    setAddLoading(false)
  }

  const doneCount = items.filter(i => i.is_done).length
  const progress = items.length > 0 ? Math.round(doneCount / items.length * 100) : 0

  // Группировка по source_document
  const grouped = items.reduce((acc, item) => {
    const key = item.source_document ?? 'Основной документ'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, ChecklistItem[]>)

  return (
    <div className="p-6">

      {/* Шапка */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Контроль исполнения</h2>
          {items.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              Выполнено {doneCount} из {items.length} пунктов
            </p>
          )}
        </div>
        {canGenerate && (
          <button onClick={handleGenerateClick} disabled={generating}
            className="text-xs font-medium bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
            📋 {generating ? 'AI анализирует...' : items.length > 0 ? 'Перегенерировать' : 'Сгенерировать чек-лист'}
          </button>
        )}
      </div>

      {/* Прогресс-бар */}
      {items.length > 0 && (
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <span className="text-xs text-gray-500">Прогресс исполнения</span>
            <span className="text-xs font-medium text-emerald-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Под-вкладки */}
      {items.length > 0 && (
        <div className="flex gap-4 border-b border-gray-200 mb-4">
          <button onClick={() => setActiveSection('checklist')}
            className={`text-sm pb-2 font-medium border-b-2 transition-colors ${activeSection === 'checklist' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            Чек-лист
          </button>
          <button onClick={() => setActiveSection('history')}
            className={`text-sm pb-2 font-medium border-b-2 transition-colors ${activeSection === 'history' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            История изменений
          </button>
        </div>
      )}

      {/* Состояние загрузки */}
      {loading && (
        <p className="text-sm text-gray-400 py-8 text-center">Загрузка...</p>
      )}

      {/* Пустое состояние */}
      {!loading && items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-2xl mb-2">📋</p>
          {canGenerate
            ? <p className="text-sm text-gray-500">Нажмите «Сгенерировать чек-лист» — AI проанализирует все документы и составит план исполнения</p>
            : <p className="text-sm text-gray-400">Чек-лист будет доступен после загрузки подписанных документов</p>
          }
        </div>
      )}

      {/* Чек-лист */}
      {!loading && items.length > 0 && activeSection === 'checklist' && (
        <div>
          {Object.entries(grouped).map(([source, groupItems]) => (
            <div key={source} className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                📁 {source}
              </p>
              <div className="space-y-2">
                {groupItems.map(item => (
                  <div key={item.id}
                    className={`rounded-lg border border-gray-200 bg-white p-3 transition-opacity ${item.is_done ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      {/* Чекбокс */}
                      <button onClick={() => toggleItem(item)} disabled={!canManage}
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                          item.is_done ? 'bg-emerald-500 border-emerald-500 text-white'
                          : canManage ? 'border-gray-300 hover:border-emerald-400'
                          : 'border-gray-200 cursor-not-allowed'
                        }`}>
                        {item.is_done && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                          </svg>
                        )}
                      </button>
                      {/* Контент */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium ${item.is_done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {item.title}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${CAT_COLORS[item.category] ?? CAT_COLORS.other}`}>
                              {CAT_LABELS[item.category] ?? item.category}
                            </span>
                            {canManage && (
                              <>
                                <button onClick={() => openEdit(item)}
                                  className="text-gray-300 hover:text-blue-500 transition-colors p-0.5" title="Редактировать">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                  </svg>
                                </button>
                                <button onClick={() => deleteItem(item)}
                                  className="text-gray-300 hover:text-red-500 transition-colors p-0.5" title="Удалить">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                        <div className="flex flex-wrap gap-3 mt-1">
                          {item.due_date && (
                            <span className="text-xs text-gray-400">📅 {new Date(item.due_date).toLocaleDateString('ru-RU')}</span>
                          )}
                          {item.responsible && (
                            <span className="text-xs text-gray-400">👤 {item.responsible}</span>
                          )}
                          {item.is_done && item.done_by_name && (
                            <span className="text-xs text-emerald-600">✓ {item.done_by_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Добавить пункт */}
          {canManage && (
            <div className="mt-2">
              {!showAddItem ? (
                <button onClick={() => setShowAddItem(true)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                  + Добавить пункт вручную
                </button>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2 mt-2">
                  <p className="text-xs font-medium text-emerald-800">Новый пункт</p>
                  <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                    placeholder="Название *" maxLength={200}
                    className="w-full text-sm border border-emerald-200 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                  <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)}
                    placeholder="Описание (необязательно)" rows={2}
                    className="w-full text-sm border border-emerald-200 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none" />
                  <div className="grid grid-cols-3 gap-2">
                    <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                      className="text-xs border border-emerald-200 rounded-lg px-2 py-2 bg-white">
                      <option value="payment">💰 Оплата</option>
                      <option value="delivery">📦 Поставка</option>
                      <option value="deadline">⏰ Срок</option>
                      <option value="document">📄 Документы</option>
                      <option value="obligation">📌 Обязательство</option>
                      <option value="other">📋 Прочее</option>
                    </select>
                    <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                      className="text-xs border border-emerald-200 rounded-lg px-2 py-2 bg-white" />
                    <select value={newResponsible} onChange={e => setNewResponsible(e.target.value)}
                      className="text-xs border border-emerald-200 rounded-lg px-2 py-2 bg-white">
                      <option value="">Ответственный...</option>
                      <option value="наша сторона">Наша сторона</option>
                      <option value="контрагент">Контрагент</option>
                      <option value="обе стороны">Обе стороны</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addItem} disabled={addLoading}
                      className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                      {addLoading ? 'Сохранение...' : 'Добавить'}
                    </button>
                    <button onClick={() => setShowAddItem(false)}
                      className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* История изменений */}
      {activeSection === 'history' && (
        <HistorySection contractId={contractId} />
      )}

      {/* Модальное окно редактирования пункта */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Редактировать пункт</h3>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Название *</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  maxLength={200}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Описание</label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)}
                  rows={3} placeholder="Необязательно"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Категория</label>
                  <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400">
                    <option value="payment">💰 Оплата</option>
                    <option value="delivery">📦 Поставка</option>
                    <option value="deadline">⏰ Срок</option>
                    <option value="document">📄 Документы</option>
                    <option value="obligation">📌 Обязательство</option>
                    <option value="other">📋 Прочее</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Срок исполнения</label>
                  <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ответственный</label>
                <select value={editResponsible} onChange={e => setEditResponsible(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400">
                  <option value="">Не указан</option>
                  <option value="наша сторона">Наша сторона</option>
                  <option value="контрагент">Контрагент</option>
                  <option value="обе стороны">Обе стороны</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={saveEdit} disabled={editLoading}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {editLoading ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button onClick={() => setEditingItem(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно дат */}
      {showDatesModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Ключевые даты</h3>
            <p className="text-xs text-gray-500 mb-4">
              AI использует эти даты для расчёта относительных сроков из документов
              (например: «в течение 5 дней после подписания»).
              Если дата неизвестна — оставьте поле пустым.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Дата подписания договора</label>
                <input type="date" value={signedDate} onChange={e => setSignedDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Дата вступления в силу</label>
                <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Дополнительная дата (необязательно)</label>
                <div className="flex gap-2">
                  <input value={customDate1Label} onChange={e => setCustomDate1Label(e.target.value)}
                    placeholder="Название (напр. Дата поставки)"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                  <input type="date" value={customDate1Value} onChange={e => setCustomDate1Value(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleGenerate}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-emerald-700">
                Сгенерировать чек-лист
              </button>
              <button onClick={() => setShowDatesModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// Компонент истории изменений
function HistorySection({ contractId }: { contractId: string }) {
  const [logs, setLogs] = useState<Array<{id: string, action: string, details: string, user_name: string, created_at: string}>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${baseUrl}/api/contract-checklist?contract_id=${contractId}&history=true`)
      const data = await res.json()
      setLogs(data.logs ?? [])
      setLoading(false)
    }
    load()
  }, [contractId])

  if (loading) return <p className="text-sm text-gray-400 py-4 text-center">Загрузка...</p>
  if (logs.length === 0) return <p className="text-sm text-gray-400 py-4 text-center">История пуста</p>

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div key={log.id} className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800">{log.action}</p>
            {log.details && <p className="text-xs text-gray-500 mt-0.5">{log.details}</p>}
            <p className="text-xs text-gray-400 mt-0.5">
              {log.user_name} · {new Date(log.created_at).toLocaleString('ru-RU')}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}