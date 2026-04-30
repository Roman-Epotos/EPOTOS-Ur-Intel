'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'
import { createClient } from '@supabase/supabase-js'

interface Contract {
  id: string
  number: string
  title: string
  counterparty: string
  status: string
  amount: number | null
}

interface ApprovalItem {
  id: string
  role: string
  status: string
  stage: string
  session_id: string
  approval_sessions: {
    id: string
    contract_id: string
    deadline: string
    initiated_by_name: string
    contracts: Contract
  }
}

interface SessionItem {
  id: string
  deadline: string
  status: string
  created_at: string
  contracts: Contract
}

interface MyDocsData {
  required_approvals: ApprovalItem[]
  optional_approvals: ApprovalItem[]
  my_drafts: Contract[]
  my_initiated: SessionItem[]
}

const STAGE_LABELS: Record<string, string> = {
  legal: 'Юридический',
  finance: 'Финансовый',
  accounting: 'Бухгалтерия',
  director: 'Директор',
  custom: 'Доп.',
}

export default function MyDocuments() {
  const { user, loading: authLoading } = useBitrixAuth()
  const [data, setData] = useState<MyDocsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('approvals')

  useEffect(() => {
    if (!user?.id) return

    const load = async () => {
      try {
        const res = await fetch(
          `https://epotos-ur-intel.vercel.app/api/my-documents?bitrix_user_id=${user.id}`
        )
        const json = await res.json()
        setData(json)
      } catch {
        console.error('Ошибка загрузки моих документов')
      } finally {
        setLoading(false)
      }
    }

    load()

    // Realtime подписка
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )

    const channel = supabase
      .channel('my-docs-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'approval_participants',
      }, () => load())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contracts',
      }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  if (authLoading || loading) return null

  if (!user) return null

  const totalActions = (data?.required_approvals.length ?? 0) +
    (data?.optional_approvals.length ?? 0)

  const hasAnything = totalActions > 0 ||
    (data?.my_drafts.length ?? 0) > 0 ||
    (data?.my_initiated.length ?? 0) > 0

  if (!hasAnything) return null

  const tabs = [
    {
      id: 'approvals',
      label: 'Требуют действия',
      count: totalActions,
      show: totalActions > 0
    },
    {
      id: 'initiated',
      label: 'Я инициатор',
      count: data?.my_initiated.length ?? 0,
      show: (data?.my_initiated.length ?? 0) > 0
    },
    {
      id: 'drafts',
      label: 'Мои черновики',
      count: data?.my_drafts.length ?? 0,
      show: (data?.my_drafts.length ?? 0) > 0
    },
  ].filter(t => t.show)

  return (
    <div className="bg-white rounded-xl border border-gray-200 mb-6">
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">
            Мои документы
            {totalActions > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {totalActions}
              </span>
            )}
          </h2>
        </div>

        {/* Вкладки */}
        <div className="flex gap-2 mt-3">
          {tabs.map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${activeTab === tab.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}>
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.id
                  ? 'bg-white text-gray-900'
                  : 'bg-gray-400 text-white'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">

        {/* Требуют действия */}
        {activeTab === 'approvals' && (
          <div className="space-y-2">
            {data?.required_approvals.map(item => (
              <Link
                key={item.id}
                href={`/contracts/${item.approval_sessions.contracts.id}/approval-portal`}
                className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-medium">
                      Согласовать
                    </span>
                    <span className="text-xs text-gray-500">
                      {STAGE_LABELS[item.stage] ?? item.stage}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-1 truncate">
                    {item.approval_sessions.contracts.number} — {item.approval_sessions.contracts.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.approval_sessions.contracts.counterparty} · до {new Date(item.approval_sessions.deadline).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <span className="text-gray-400 text-sm ml-2">→</span>
              </Link>
            ))}

            {data?.optional_approvals.map(item => (
              <Link
                key={item.id}
                href={`/contracts/${item.approval_sessions.contracts.id}/approval-portal`}
                className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-medium">
                      Ознакомиться
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-1 truncate">
                    {item.approval_sessions.contracts.number} — {item.approval_sessions.contracts.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.approval_sessions.contracts.counterparty} · до {new Date(item.approval_sessions.deadline).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <span className="text-gray-400 text-sm ml-2">→</span>
              </Link>
            ))}

            {totalActions === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                Нет документов требующих действий
              </p>
            )}
          </div>
        )}

        {/* Я инициатор */}
        {activeTab === 'initiated' && (
          <div className="space-y-2">
            {data?.my_initiated.map(item => (
              <Link
                key={item.id}
                href={`/contracts/${item.contracts.id}/approval-portal`}
                className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-100 rounded-lg hover:bg-yellow-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full font-medium">
                      На согласовании
                    </span>
                    <span className="text-xs text-gray-500">
                      до {new Date(item.deadline).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-1 truncate">
                    {item.contracts.number} — {item.contracts.title}
                  </p>
                  <p className="text-xs text-gray-500">{item.contracts.counterparty}</p>
                </div>
                <span className="text-gray-400 text-sm ml-2">→</span>
              </Link>
            ))}
          </div>
        )}

        {/* Мои черновики */}
        {activeTab === 'drafts' && (
          <div className="space-y-2">
            {data?.my_drafts.map(contract => (
              <Link
                key={contract.id}
                href={`/contracts/${contract.id}`}
                className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {contract.number} — {contract.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {contract.counterparty}
                    {contract.amount && ` · ${Number(contract.amount).toLocaleString('ru-RU')} ₽`}
                  </p>
                </div>
                <span className="text-gray-400 text-sm ml-2">→</span>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}