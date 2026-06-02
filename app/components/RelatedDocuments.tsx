'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const baseUrl = 'https://epotos-ur-intel.vercel.app'

interface RelatedContract {
  id: string
  number: string
  title: string
  type: string
  status: string
  created_at: string
  counterparty: string
}

interface Props {
  contractId: string
  contractNumber: string
  contractStatus: string
  parentContractId: string | null
  parentContractExternal: string | null
  isChild: boolean
  currentUserId: number
  currentUserRole: string
  currentUserCompanies: string[]
}

const statusColor: Record<string, string> = {
  черновик: 'bg-gray-100 text-gray-600',
  на_согласовании: 'bg-yellow-100 text-yellow-800',
  согласован: 'bg-blue-100 text-blue-800',
  подписан: 'bg-green-100 text-green-800',
  на_исполнении: 'bg-purple-100 text-purple-800',
  отклонён: 'bg-red-100 text-red-700',
}

const statusLabel: Record<string, string> = {
  черновик: 'Черновик',
  на_согласовании: 'На согласовании',
  согласован: 'Согласован',
  подписан: 'Подписан',
  на_исполнении: 'На исполнении',
  отклонён: 'Отклонён',
}

const CAN_LINK_ROLES = ['admin', 'developer', 'gc_manager', 'legal_gc', 'legal']

export default function RelatedDocuments({
  contractId, contractNumber, contractStatus,
  parentContractId, parentContractExternal, isChild,
  currentUserId, currentUserRole, currentUserCompanies,
}: Props) {
  const [children, setChildren] = useState<RelatedContract[]>([])
  const [parent, setParent] = useState<RelatedContract | null>(null)
  const [loading, setLoading] = useState(true)

  // Привязка
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkSource, setLinkSource] = useState<'system' | 'external'>('system')
  const [linkSearch, setLinkSearch] = useState('')
  const [linkSearchLoading, setLinkSearchLoading] = useState(false)
  const [linkSuggestions, setLinkSuggestions] = useState<RelatedContract[]>([])
  const [selectedParent, setSelectedParent] = useState<RelatedContract | null>(null)
  const [externalNumber, setExternalNumber] = useState('')
  const [linking, setLinking] = useState(false)
  const [linkSuccess, setLinkSuccess] = useState('')
  const [linkError, setLinkError] = useState('')

  const canLink = CAN_LINK_ROLES.includes(currentUserRole)

  useEffect(() => {
    loadRelated()
  }, [contractId])

  const loadRelated = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${baseUrl}/api/related-contracts?contract_id=${contractId}`)
      const data = await res.json()
      setChildren(data.children ?? [])
      setParent(data.parent ?? null)
    } finally {
      setLoading(false)
    }
  }

  const searchParents = async (q: string) => {
    if (q.length < 2) { setLinkSuggestions([]); return }
    setLinkSearchLoading(true)
    try {
      const res = await fetch(`${baseUrl}/api/contracts-list?bitrix_user_id=${currentUserId}&parent_only=true&search=${encodeURIComponent(q)}`)
      const data = await res.json()
      setLinkSuggestions((data.contracts ?? []).filter((c: RelatedContract) => c.id !== contractId))
    } finally {
      setLinkSearchLoading(false)
    }
  }

  const handleLink = async () => {
    setLinking(true)
    setLinkError('')
    setLinkSuccess('')
    const res = await fetch(`${baseUrl}/api/related-contracts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract_id: contractId,
        parent_contract_id: linkSource === 'system' ? selectedParent?.id : null,
        parent_contract_external: linkSource === 'external' ? externalNumber : null,
        is_child: true,
        user_id: currentUserId,
      }),
    })
    const data = await res.json()
    if (data.success) {
      setLinkSuccess('Документ успешно привязан!')
      setShowLinkModal(false)
      loadRelated()
    } else {
      setLinkError(data.error ?? 'Ошибка привязки')
    }
    setLinking(false)
  }

  const handleUnlink = async () => {
    if (!confirm('Отвязать этот документ от родительского?')) return
    const res = await fetch(`${baseUrl}/api/related-contracts`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract_id: contractId, user_id: currentUserId }),
    })
    const data = await res.json()
    if (data.success) loadRelated()
  }

  if (loading) return (
    <div className="p-6">
      <p className="text-sm text-gray-400">Загрузка...</p>
    </div>
  )

  return (
    <div className="p-6 space-y-6">

      {linkSuccess && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{linkSuccess}</div>}

      {/* Родительский документ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">📄 Основной документ</h2>
          {canLink && (
            <button onClick={() => setShowLinkModal(true)}
              className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
              {isChild ? '🔄 Перепривязать' : '🔗 Привязать к документу'}
            </button>
          )}
        </div>

        {parent ? (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-3">
            <div>
              <Link href={`/contracts/${parent.id}`}
                className="text-sm font-medium text-blue-600 hover:underline">
                {parent.number}
              </Link>
              <p className="text-sm text-gray-700 mt-0.5">{parent.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{parent.counterparty}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[parent.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {statusLabel[parent.status] ?? parent.status}
              </span>
              {canLink && (
                <button onClick={handleUnlink}
                  className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">
                  Отвязать
                </button>
              )}
            </div>
          </div>
        ) : parentContractExternal ? (
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
            <p className="text-sm text-gray-700">📎 Дополнительный документ к договору <strong>{parentContractExternal}</strong></p>
            <p className="text-xs text-gray-500 mt-1">Основной договор создан вне системы ЮрИнтел</p>
            {canLink && (
              <button onClick={handleUnlink}
                className="text-xs text-red-500 mt-2 hover:underline">
                Отвязать
              </button>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-sm text-gray-400">Этот документ не привязан к основному</p>
            {canLink && (
              <button onClick={() => setShowLinkModal(true)}
                className="text-xs text-blue-600 mt-2 hover:underline">
                Привязать →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Дочерние документы */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          🔗 Дочерние документы
          {children.length > 0 && (
            <span className="ml-2 bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">{children.length}</span>
          )}
        </h2>

        {children.length === 0 ? (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-sm text-gray-400">Дочерних документов пока нет</p>
            <p className="text-xs text-gray-400 mt-1">Спецификации, доп.соглашения и другие документы, привязанные к этому, появятся здесь</p>
          </div>
        ) : (
          <div className="space-y-2">
            {children.map(c => (
              <div key={c.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-3">
                <div>
                  <Link href={`/contracts/${c.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline">
                    {c.number}
                  </Link>
                  <p className="text-sm text-gray-700 mt-0.5">{c.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.type} · {new Date(c.created_at).toLocaleDateString('ru-RU')}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${statusColor[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {statusLabel[c.status] ?? c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно привязки */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Привязать к основному документу</h3>

            {linkError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{linkError}</div>}

            <div className="flex gap-2">
              <button onClick={() => setLinkSource('system')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${linkSource === 'system' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                🔍 Найти в системе
              </button>
              <button onClick={() => setLinkSource('external')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${linkSource === 'external' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                ✏️ Документ вне системы
              </button>
            </div>

            {linkSource === 'system' && (
              <div className="relative">
                <input
                  type="text"
                  value={linkSearch}
                  onChange={e => { setLinkSearch(e.target.value); searchParents(e.target.value) }}
                  placeholder="Поиск по номеру, названию или контрагенту..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                {linkSearchLoading && <p className="text-xs text-gray-400 mt-1">Поиск...</p>}
                {linkSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {linkSuggestions.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedParent(c); setLinkSuggestions([]); setLinkSearch(`${c.number} — ${c.title}`) }}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                        <p className="text-sm font-medium text-gray-900">{c.number}</p>
                        <p className="text-xs text-gray-500">{c.title} · {c.counterparty}</p>
                      </button>
                    ))}
                  </div>
                )}
                {selectedParent && (
                  <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <span className="text-green-600 text-sm">✓</span>
                    <p className="text-sm text-gray-900 font-medium">{selectedParent.number}</p>
                    <button type="button" onClick={() => { setSelectedParent(null); setLinkSearch('') }}
                      className="ml-auto text-xs text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                )}
              </div>
            )}

            {linkSource === 'external' && (
              <input
                type="text"
                value={externalNumber}
                onChange={e => setExternalNumber(e.target.value)}
                placeholder="Введите номер основного договора..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={handleLink} disabled={linking || (linkSource === 'system' && !selectedParent) || (linkSource === 'external' && !externalNumber.trim())}
                className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                {linking ? 'Привязываем...' : '🔗 Привязать'}
              </button>
              <button onClick={() => { setShowLinkModal(false); setLinkError('') }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}