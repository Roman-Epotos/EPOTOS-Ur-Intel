'use client'

import { useState } from 'react'
import Link from 'next/link'
import ApproveButton from '@/app/components/ApproveButton'
import DelegateApproveCheckbox from '@/app/components/DelegateApproveCheckbox'
import DeleteContractButton from '@/app/components/DeleteContractButton'
import AIAnalysis from '@/app/components/AIAnalysis'

interface Version {
  id: string
  version_number: number
  file_name: string
  file_url: string
  comment: string | null
  created_at: string
}

interface Log {
  id: string
  action: string
  details: string | null
  user_name: string
  created_at: string
}

interface Contract {
  id: string
  number: string
  title: string
  counterparty: string
  type: string | null
  status: string
  amount: number | null
  start_date: string | null
  end_date: string | null
  author_bitrix_id: number | null
  allow_others_to_approve: boolean | null
}

interface Props {
  contract: Contract
  versions: Version[]
  logs: Log[]
}

const statusLabel: Record<string, string> = {
  черновик: 'Черновик',
  на_согласовании: 'На согласовании',
  подписан: 'Подписан',
  отклонён: 'Отклонён',
  архив: 'Архив',
}

const statusColor: Record<string, string> = {
  черновик: 'bg-gray-100 text-gray-700',
  на_согласовании: 'bg-yellow-100 text-yellow-800',
  подписан: 'bg-green-100 text-green-800',
  отклонён: 'bg-red-100 text-red-700',
  архив: 'bg-gray-200 text-gray-500',
}

const TABS = [
  { id: 'details', label: 'Реквизиты', icon: '📋' },
  { id: 'documents', label: 'Документы', icon: '📁' },
  { id: 'ai', label: 'EpotosGPT', icon: '🤖' },
  { id: 'chat', label: 'Чат', icon: '💬' },
]

export default function ContractTabs({ contract, versions, logs }: Props) {
  const [activeTab, setActiveTab] = useState('details')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Шапка */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Назад</Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-semibold text-gray-900">{contract.number}</h1>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[contract.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {statusLabel[contract.status] ?? contract.status}
            </span>
          </div>
          <DeleteContractButton contractId={contract.id} contractNumber={contract.number} />
        </div>

        {/* Вкладки */}
        <div className="flex gap-0 mb-0">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 px-5 py-3 text-sm font-medium
                rounded-t-xl border border-b-0 transition-all
                ${activeTab === tab.id
                  ? 'bg-white border-gray-200 text-gray-900 z-10 relative shadow-sm'
                  : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }
                ${index > 0 ? '-ml-px' : ''}
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.id === 'chat' && contract.status === 'на_согласовании' && (
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              )}
            </button>
          ))}
        </div>

        {/* Контент вкладок */}
        <div className="bg-white rounded-b-xl rounded-tr-xl border border-gray-200 shadow-sm">

          {/* Реквизиты */}
          {activeTab === 'details' && (
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Реквизиты договора</h2>
                  <div className="space-y-3">
                    {[
                      { label: 'Название', value: contract.title },
                      { label: 'Контрагент', value: contract.counterparty },
                      { label: 'Тип', value: contract.type },
                      { label: 'Сумма', value: contract.amount ? Number(contract.amount).toLocaleString('ru-RU') + ' ₽' : '—' },
                      { label: 'Дата начала', value: contract.start_date ?? '—' },
                      { label: 'Дата окончания', value: contract.end_date ?? '—' },
                    ].map(item => (
                      <div key={item.label} className="flex gap-4">
                        <span className="text-sm text-gray-500 w-36 flex-shrink-0">{item.label}</span>
                        <span className="text-sm text-gray-900">{item.value ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* История действий */}
                <div>
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">История действий</h2>
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {logs.length === 0 ? (
                      <p className="text-sm text-gray-400">История пуста</p>
                    ) : (
                      logs.map(log => (
                        <div key={log.id} className="border-l-2 border-gray-200 pl-3">
                          <p className="text-xs font-medium text-gray-900">{log.action}</p>
                          {log.details && <p className="text-xs text-gray-500 mt-0.5">{log.details}</p>}
                          <p className="text-xs text-gray-400 mt-1">
                            {log.user_name} · {new Date(log.created_at).toLocaleString('ru-RU')}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Документы */}
          {activeTab === 'documents' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Версии документа</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/contracts/${contract.id}/upload`}
                    className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700">
                    + Загрузить версию
                  </Link>
                  <ApproveButton
                    contractId={contract.id}
                    contractStatus={contract.status}
                    authorBitrixId={contract.author_bitrix_id ?? null}
                    allowOthers={contract.allow_others_to_approve ?? false}
                  />
                  <Link href={`/contracts/${contract.id}/approval-portal`}
                    className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700">
                    Портал
                  </Link>
                </div>
              </div>

              <DelegateApproveCheckbox
                contractId={contract.id}
                contractNumber={contract.number}
                authorBitrixId={contract.author_bitrix_id ?? null}
                allowOthers={contract.allow_others_to_approve ?? false}
              />

              <div className="mt-4">
                {versions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    Версий пока нет — загрузите первый документ
                  </div>
                ) : (
                  <div className="space-y-3">
                    {versions.map(version => (
                      <div key={version.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-semibold text-gray-900 bg-gray-200 px-2 py-1 rounded">
                            v{version.version_number}
                          </span>
                          <div>
                            <p className="text-sm text-gray-900">{version.file_name}</p>
                            {version.comment && (
                              <p className="text-xs text-gray-500 mt-0.5">{version.comment}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(version.created_at).toLocaleString('ru-RU')}
                            </p>
                          </div>
                        </div>
                        <a href={version.file_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-gray-700 border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50">
                          Скачать
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* EpotosGPT */}
          {activeTab === 'ai' && (
            <div className="p-6">
              <AIAnalysis
                contractId={contract.id}
                versions={versions.map(v => ({
                  id: v.id,
                  file_url: v.file_url,
                  file_name: v.file_name,
                  version_number: v.version_number,
                }))}
              />
            </div>
          )}

          {/* Чат согласования */}
          {activeTab === 'chat' && (
            <div className="p-6">
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">
                  {contract.status === 'на_согласовании'
                    ? <Link href={`/contracts/${contract.id}/approval-portal`}
                        className="text-blue-600 hover:underline">
                        Открыть портал согласования →
                      </Link>
                    : 'Чат доступен после запуска согласования'
                  }
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}