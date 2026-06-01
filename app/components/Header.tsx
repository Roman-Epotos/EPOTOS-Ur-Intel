'use client'

import { useState, useEffect } from 'react'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'
import Link from 'next/link'

export default function Header() {
  const { user, loading } = useBitrixAuth()
  const [helpUnread, setHelpUnread] = useState(0)

  useEffect(() => {
    if (!user) return
    const baseUrl = 'https://epotos-ur-intel.vercel.app'
    const isAdmin = [30, 1148].includes(parseInt(user.id))
    const url = isAdmin
      ? `${baseUrl}/api/support-requests?bitrix_user_id=${user.id}`
      : `${baseUrl}/api/support-requests?bitrix_user_id=${user.id}&my_requests=true`
    fetch(url)
      .then(r => r.json())
      .then(d => {
        const reqs = d.requests ?? []
        const unread = reqs.filter((r: { id: string; status: string; support_messages?: { created_at: string }[] }) => {
          if (r.status === 'resolved') return false
          const lastSeen = localStorage.getItem(`support_seen_${r.id}`)
          if (!lastSeen) return true
          const msgs = r.support_messages ?? []
          if (msgs.length === 0) return false
          const lastMsgAt = msgs[msgs.length - 1].created_at
          return new Date(lastMsgAt) > new Date(lastSeen)
        }).length
        setHelpUnread(unread)
      })
      .catch(() => {})
  }, [user])

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
        <Link
          href="/dashboard"
          className="text-sm text-gray-600 border border-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          🖥️ Рабочий стол
        </Link>
        <Link
          href="/counterparties"
          className="text-sm text-gray-600 border border-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          🏢 Контрагенты
        </Link>

        {/* Профиль пользователя */}
        
        <Link href="/help"
          className="relative text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
          ❓ Помощь
          {helpUnread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
              {helpUnread}
            </span>
          )}
        </Link>
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