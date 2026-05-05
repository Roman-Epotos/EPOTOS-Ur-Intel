'use client'

import { useState, useEffect } from 'react'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

interface Stats {
  total: number
  on_approval: number
  signed: number
  drafts: number
  pending_my_action: number
}

export default function PersonalStats() {
  const { user, loading: authLoading } = useBitrixAuth()
  const [stats, setStats] = useState<Stats | null>(null)

  const baseUrl = 'https://epotos-ur-intel.vercel.app'

  useEffect(() => {
    if (!user?.id) return

    const load = async () => {
      try {
        const [contractsRes, myDocsRes] = await Promise.all([
          fetch(`${baseUrl}/api/contracts-list?bitrix_user_id=${user.id}&role=user`),
          fetch(`${baseUrl}/api/my-documents?bitrix_user_id=${user.id}`),
        ])

        const contractsData = await contractsRes.json()
        const myDocsData = await myDocsRes.json()

        const contracts = contractsData.contracts ?? []
        const pendingActions = (myDocsData.required_approvals?.length ?? 0) +
          (myDocsData.optional_approvals?.length ?? 0)

        setStats({
          total: contracts.length,
          on_approval: contracts.filter((c: { status: string }) => c.status === 'на_согласовании').length,
          signed: contracts.filter((c: { status: string }) => c.status === 'подписан').length,
          drafts: contracts.filter((c: { status: string }) => c.status === 'черновик').length,
          pending_my_action: pendingActions,
        })
      } catch {
        console.error('Ошибка загрузки статистики')
      }
    }

    load()
  }, [user?.id])

  if (authLoading || !stats) return (
    <div className="grid grid-cols-4 gap-4 mb-8">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white rounded-xl p-4 border border-gray-200 animate-pulse">
          <div className="h-3 bg-gray-200 rounded w-2/3 mb-3"></div>
          <div className="h-7 bg-gray-200 rounded w-1/3"></div>
        </div>
      ))}
    </div>
  )

  const items = [
    { label: 'Всего документов', value: stats.total, color: 'text-gray-900' },
    { label: 'На согласовании', value: stats.on_approval, color: 'text-yellow-600' },
    { label: 'Подписаны', value: stats.signed, color: 'text-green-600' },
    { label: 'Черновики', value: stats.drafts, color: 'text-gray-500' },
  ]

  return (
    <div className="grid grid-cols-4 gap-4 mb-8">
      {items.map(stat => (
        <div key={stat.label} className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">{stat.label}</p>
          <p className={`text-2xl font-semibold mt-1 ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  )
}