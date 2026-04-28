import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

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

export default async function HomePage() {
  const supabase = await createClient()

  const { data: contracts } = await supabase
    .from('contracts')
    .select('*')
    .order('created_at', { ascending: false })

  const all = contracts ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Эпотос-ЮрИнтел</h1>
            <p className="text-sm text-gray-500 mt-1">Система управления договорами</p>
          </div>
          <Link href="/contracts/new"
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
            + Новый договор
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Всего договоров', value: all.length },
            { label: 'На согласовании', value: all.filter(c => c.status === 'на_согласовании').length },
            { label: 'Подписаны', value: all.filter(c => c.status === 'подписан').length },
            { label: 'Черновики', value: all.filter(c => c.status === 'черновик').length },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-4 border border-gray-200">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">Все договоры</h2>
            <span className="text-xs text-gray-400">{all.length} записей</span>
          </div>

          {all.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-gray-400 text-sm">Договоров пока нет</p>
              <Link href="/contracts/new"
                className="mt-3 inline-block text-sm text-gray-900 underline">
                Создать первый договор
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">Номер</th>
                  <th className="px-6 py-3 font-medium">Название</th>
                  <th className="px-6 py-3 font-medium">Контрагент</th>
                  <th className="px-6 py-3 font-medium">Сумма</th>
                  <th className="px-6 py-3 font-medium">Срок</th>
                  <th className="px-6 py-3 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {all.map((contract) => (
                  <tr key={contract.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <Link href={`/contracts/${contract.id}`} className="hover:underline">{contract.number}</Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{contract.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{contract.counterparty}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {contract.amount ? Number(contract.amount).toLocaleString('ru-RU') + ' ₽' : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{contract.end_date ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[contract.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {statusLabel[contract.status] ?? contract.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}