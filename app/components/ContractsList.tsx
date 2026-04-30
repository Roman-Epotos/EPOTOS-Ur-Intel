'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

interface Contract {
  id: string
  number: string
  title: string
  counterparty: string
  status: string
  amount: number | null
  end_date: string | null
  author_bitrix_id: number | null
}

interface UserRole {
  role: 'admin' | 'director' | 'legal' | 'user'
  companies: string[]
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

export default function ContractsList() {
  const { user, loading: authLoading } = useBitrixAuth()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [counterpartyFilter, setCounterpartyFilter] = useState('')

  const baseUrl = 'https://epotos-ur-intel.vercel.app'

  useEffect(() => {
    if (!user?.id) return

    const load = async () => {
      try {
        // Получаем роль пользователя
        const roleRes = await fetch(`${baseUrl}/api/user-role?bitrix_user_id=${user.id}`)
        const roleData = await roleRes.json()
        setUserRole(roleData)

        // Получаем договоры в зависимости от роли
        const params = new URLSearchParams()
        params.append('bitrix_user_id', user.id)
        params.append('role', roleData.role)
        if (roleData.companies.length > 0) {
          params.append('companies', roleData.companies.join(','))
        }

        const contractsRes = await fetch(`${baseUrl}/api/contracts-list?${params}`)
        const contractsData = await contractsRes.json()
        setContracts(contractsData.contracts ?? [])
      } catch {
        console.error('Ошибка загрузки')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id])

  if (authLoading || loading) return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 text-sm text-gray-400">Загрузка...</div>
    </div>
  )

  if (!user) return null

  // Фильтрация
  const filtered = contracts.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false
    if (companyFilter !== 'all' && !c.number.startsWith(companyFilter + '-')) return false
    if (counterpartyFilter && !c.counterparty.toLowerCase().includes(counterpartyFilter.toLowerCase())) return false
    if (search && !c.number.toLowerCase().includes(search.toLowerCase()) &&
        !c.title.toLowerCase().includes(search.toLowerCase()) &&
        !c.counterparty.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const roleLabels: Record<string, string> = {
    admin: 'Все договоры (Администратор)',
    director: 'Договоры компании',
    legal: 'Договоры на юридическом сопровождении',
    user: 'Мои договоры',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-700">
            {roleLabels[userRole?.role ?? 'user']}
          </h2>
          <span className="text-xs text-gray-400">{filtered.length} записей</span>
        </div>

        <div className="flex gap-2 flex-wrap mt-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по номеру, названию..."
            className="flex-1 min-w-40 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          >
            <option value="all">Все статусы</option>
            <option value="черновик">Черновики</option>
            <option value="на_согласовании">На согласовании</option>
            <option value="подписан">Подписанные</option>
            <option value="архив">Архив</option>
          </select>
          <select
            value={companyFilter}
            onChange={e => setCompanyFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          >
            <option value="all">Все компании</option>
            <option value="ТХ">ООО Техно</option>
            <option value="НПП">НПП ЭПОТОС</option>
            <option value="СПТ">ООО СПТ</option>
            <option value="ОС">ООО ОС</option>
            <option value="Э-К">ООО Эпотос-К</option>
          </select>
          <input
            value={counterpartyFilter}
            onChange={e => setCounterpartyFilter(e.target.value)}
            placeholder="Контрагент..."
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 min-w-32"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-gray-400 text-sm">Договоров не найдено</p>
          {userRole?.role === 'user' && (
            <Link href="/contracts/new"
              className="mt-3 inline-block text-sm text-gray-900 underline">
              Создать первый договор
            </Link>
          )}
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
            {filtered.map(contract => (
              <tr key={contract.id}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  <Link href={`/contracts/${contract.id}`} className="hover:underline">
                    {contract.number}
                  </Link>
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
  )
}