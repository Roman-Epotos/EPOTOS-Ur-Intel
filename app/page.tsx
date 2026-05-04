import Link from 'next/link'
import Header from '@/app/components/Header'
import MyDocuments from '@/app/components/MyDocuments'
import ContractsList from '@/app/components/ContractsList'
import PersonalStats from '@/app/components/PersonalStats'
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

        <PersonalStats />

        <ContractsList />

      </div>
    </div>
  )
}