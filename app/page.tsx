import Link from 'next/link'
import Header from '@/app/components/Header'
import MyDocuments from '@/app/components/MyDocuments'
import ContractsList from '@/app/components/ContractsList'
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

        <Header />

        <MyDocuments />

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

        <ContractsList />

      </div>
    </div>
  )
}