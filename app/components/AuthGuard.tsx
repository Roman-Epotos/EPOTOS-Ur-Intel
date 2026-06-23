'use client'

import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, needManualAuth } = useBitrixAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Авторизация...</p>
        </div>
      </div>
    )
  }

  if (needManualAuth && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">ЮрИнтел-Эпотос</h1>
          <p className="text-sm text-gray-500 mb-6">
            Для доступа к системе необходимо открыть приложение через Битрикс24.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6">
            <p className="text-xs font-medium text-gray-700">Как войти:</p>
            <p className="text-xs text-gray-500">1. Откройте Битрикс24</p>
            <p className="text-xs text-gray-500">2. Перейдите в раздел «ЮрИнтел-Эпотос»</p>
            <p className="text-xs text-gray-500">3. Система авторизует вас автоматически</p>
          </div>
          
            <button
            onClick={() => window.open('https://gkepotos.bitrix24.ru/marketplace/app/248/', '_blank')}
            className="block w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
            Открыть в Битрикс24
          </button>
          <p className="text-xs text-gray-400 mt-4">
            Если проблема повторяется — обратитесь к администратору
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}