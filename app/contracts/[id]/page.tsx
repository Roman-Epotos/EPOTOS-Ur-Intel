import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import DeleteContractButton from '@/app/components/DeleteContractButton'

const statusLabel: Record<string, string> = {
  'черновик': 'Черновик',
  'на_согласовании': 'На согласовании',
  'подписан': 'Подписан',
  'отклонён': 'Отклонён',
  'архив': 'Архив',
}

const statusColor: Record<string, string> = {
  'черновик': 'bg-gray-100 text-gray-700',
  'на_согласовании': 'bg-yellow-100 text-yellow-800',
  'подписан': 'bg-green-100 text-green-800',
  'отклонён': 'bg-red-100 text-red-700',
  'архив': 'bg-gray-200 text-gray-500',
}

export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single()

  if (!contract) notFound()

  const { data: logs } = await supabase
    .from('contract_logs')
    .select('*')
    .eq('contract_id', id)
    .order('created_at', { ascending: false })

  const allLogs = logs ?? []

  const { data: versions } = await supabase
    .from('versions')
    .select('*')
    .eq('contract_id', id)
    .order('version_number', { ascending: false })

  const allVersions = versions ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            Назад
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">{contract.number}</h1>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ml-2 ${statusColor[contract.status] ?? 'bg-gray-100 text-gray-700'}`}>
            {statusLabel[contract.status] ?? contract.status}
          </span>
          <div className="ml-auto">
            <DeleteContractButton contractId={id} contractNumber={contract.number} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">

          <div className="col-span-2 space-y-6">

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">Реквизиты договора</h2>
              <div className="space-y-3">
                {[
                  { label: 'Название', value: contract.title },
                  { label: 'Контрагент', value: contract.counterparty },
                  { label: 'Тип', value: contract.type },
                  { label: 'Сумма', value: contract.amount ? Number(contract.amount).toLocaleString('ru-RU') + ' ₽' : '—' },
                  { label: 'Дата начала', value: contract.start_date ?? '—' },
                  { label: 'Дата окончания', value: contract.end_date ?? '—' },
                ].map((item) => (
                  <div key={item.label} className="flex gap-4">
                    <span className="text-sm text-gray-500 w-32 flex-shrink-0">{item.label}</span>
                    <span className="text-sm text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-700">Версии документа</h2>
                <div className="flex gap-2">
                  <Link
                    href={`/contracts/${id}/upload`}
                    className="text-xs bg-gray-900 text-white px-3 py-1 rounded-lg"
                  >
                    + Загрузить версию
                  </Link>
                  {contract.status === 'черновик' && (
                    <Link
                      href={`/contracts/${id}/approve`}
                      className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700"
                    >
                      Отправить на согласование
                    </Link>
                  )}
                  <Link
                    href={`/contracts/${id}/approval-portal`}
                    className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg hover:bg-purple-700"
                  >
                    Портал
                  </Link>
                </div>
              </div>

              {allVersions.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Версий пока нет — загрузите первый документ
                </div>
              ) : (
                <div className="space-y-3">
                  {allVersions.map((version) => (
                    <div key={version.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
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
                      <a href={version.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-900 border border-gray-200 px-3 py-1 rounded-lg">
                        Скачать
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          <div className="col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">История действий</h2>

              {allLogs.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">
                  История пуста
                </div>
              ) : (
                <div className="space-y-4">
                  {allLogs.map((log) => (
                    <div key={log.id} className="border-l-2 border-gray-200 pl-3">
                      <p className="text-xs font-medium text-gray-900">{log.action}</p>
                      {log.details && (
                        <p className="text-xs text-gray-500 mt-0.5">{log.details}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {log.user_name} · {new Date(log.created_at).toLocaleString('ru-RU')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}