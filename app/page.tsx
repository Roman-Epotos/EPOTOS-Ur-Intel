'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/app/components/Header'
import MyDocuments, { MyDocsData } from '@/app/components/MyDocuments'
import ContractsList from '@/app/components/ContractsList'
import PersonalStats from '@/app/components/PersonalStats'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

const baseUrl = 'https://epotos-ur-intel.vercel.app'

export default function HomePage() {
  const router = useRouter()
  const { user } = useBitrixAuth()
  const [myDocsData, setMyDocsData] = useState<MyDocsData | null>(null)
  const [myDocsLoading, setMyDocsLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const hasMyDocsContent = !!myDocsData && (
    (myDocsData.required_approvals?.length ?? 0) > 0 ||
    (myDocsData.optional_approvals?.length ?? 0) > 0 ||
    (myDocsData.my_drafts?.length ?? 0) > 0 ||
    (myDocsData.my_initiated?.length ?? 0) > 0 ||
    (myDocsData.my_edo?.length ?? 0) > 0
  )

  const loadMyDocs = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch(
        `${baseUrl}/api/my-documents?bitrix_user_id=${user.id}&_t=${Date.now()}`,
        { cache: 'no-store' }
      )
      const json = await res.json()
      setMyDocsData(json)
    } catch {
      console.error('Ошибка загрузки моих документов')
    } finally {
      setMyDocsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadMyDocs()
  }, [loadMyDocs])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const contractId = params.get('contract_id')
    if (contractId) {
      router.replace(`/contracts/${contractId}`)
    }
  }, [])

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full px-4 pt-6 flex-shrink-0">
        <Header />
        {!hasMyDocsContent && (
          <button onClick={() => setIsCollapsed(c => !c)}
            className="md:hidden w-full flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-2.5 mb-3 text-sm text-gray-500">
            <span>Рабочий стол</span>
            <span>{isCollapsed ? '▼ Показать' : '▲ Свернуть'}</span>
          </button>
        )}
        <MyDocuments
          key={typeof window !== 'undefined' ? window.location.pathname : 'home'}
          data={myDocsData}
          loading={myDocsLoading}
          onReload={loadMyDocs}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(c => !c)}
        />
        <PersonalStats myDocsData={myDocsData} isCollapsed={isCollapsed} />
      </div>
      <div className="max-w-6xl mx-auto w-full px-4 flex-1 min-h-[400px] pb-4">
        <ContractsList />
      </div>
    </div>
  )
}