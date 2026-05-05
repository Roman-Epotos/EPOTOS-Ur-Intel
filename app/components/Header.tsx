'use client'

import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'
import Link from 'next/link'

export default function Header() {
  const { user, loading } = useBitrixAuth()

  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Эпотос-ЮрИнтел</h1>
        <p className="text-sm text-gray-500 mt-1">Система управления юридическими документами</p>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/contracts/new"
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          + Новый документ
        </Link>

        {/* Профиль пользователя */}
        {!loading && user && [30, 1148].includes(parseInt(user.id)) && (
          <Link href="/admin"
            className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            Настройки
          </Link>
        )}
        {!loading && (
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-9 h-9 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center text-white text-sm font-medium">
                    {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 leading-tight">{user.name}</p>
                  <p className="text-xs text-gray-500 leading-tight">{user.email}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium">
                  ?
                </div>
                <div>
                  <p className="text-sm text-gray-500">Гость</p>
                  <p className="text-xs text-gray-400">Войдите через Битрикс24</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}