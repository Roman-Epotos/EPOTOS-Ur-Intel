'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/app/components/Header'
import MyDocuments from '@/app/components/MyDocuments'
import ContractsList from '@/app/components/ContractsList'
import PersonalStats from '@/app/components/PersonalStats'

export default function HomePage() {
  const router = useRouter()

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
        <MyDocuments key={typeof window !== 'undefined' ? window.location.pathname : 'home'} />
        <PersonalStats />
      </div>
      <div className="max-w-6xl mx-auto w-full px-4 flex-1 min-h-[400px] pb-4">
        <ContractsList />
      </div>
    </div>
  )
}