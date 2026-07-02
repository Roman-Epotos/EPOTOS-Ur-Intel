'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function RedirectContent() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const contractId = searchParams.get('contract_id')
    if (contractId) {
      localStorage.setItem('redirect_contract_id', contractId)
    }
    // Перенаправляем в Б24 для открытия приложения
    window.location.replace('https://gkepotos.bitrix24.ru/marketplace/app/252/')
  }, [])

  return <div className="flex items-center justify-center h-screen text-gray-500">Перенаправление...</div>
}

export default function RedirectPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Загрузка...</div>}>
      <RedirectContent />
    </Suspense>
  )
}