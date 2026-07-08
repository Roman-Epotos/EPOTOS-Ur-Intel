'use client'

import { useState, useEffect } from 'react'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import Tooltip from '@/app/components/Tooltip'

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function Header() {
  const { user, loading } = useBitrixAuth()
  const [helpUnread, setHelpUnread] = useState(0)

  const checkUnread = async (userId: string) => {
    const baseUrl = 'https://epotos-ur-intel.vercel.app'
    const isAdminUser = [30, 1148].includes(parseInt(userId))
    const url = isAdminUser
      ? `${baseUrl}/api/support-requests?bitrix_user_id=${userId}`
      : `${baseUrl}/api/support-requests?bitrix_user_id=${userId}&my_requests=true`
    const r = await fetch(url)
    const d = await r.json()
    const reqs = d.requests ?? []
    const unread = reqs.filter((req: { id: string; status: string; support_messages?: { created_at: string }[] }) => {
      if (req.status === 'resolved') return false
      const lastSeen = localStorage.getItem(`support_seen_${req.id}`)
      if (!lastSeen) return true
      const msgs = req.support_messages ?? []
      if (msgs.length === 0) return false
      const lastMsgAt = msgs[msgs.length - 1].created_at
      return new Date(lastMsgAt) > new Date(lastSeen)
    }).length
    setHelpUnread(unread)
  }

  useEffect(() => {
    if (!user) return
    checkUnread(user.id)

    // Realtime — обновляем счётчик при новом сообщении от другого пользователя
    const channel = supabaseClient
      .channel('header_support_unread')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
      }, (payload) => {
        const msg = payload.new as { author_bitrix_id: number }
        // Показываем только если сообщение от другого пользователя
        if (msg.author_bitrix_id !== parseInt(user.id)) {
          checkUnread(user.id)
        }
      })
      .subscribe()

    return () => { supabaseClient.removeChannel(channel) }
  }, [user])

  return (
    <div className="flex items-center justify-between mb-4 md:mb-8">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg md:text-2xl font-semibold text-gray-900 truncate">ЮрИнтел-Эпотос</h1>
        <p className="hidden md:block text-sm text-gray-500 mt-1">Система управления юридическими документами</p>
      </div>

      <div className="flex items-center gap-1.5 md:gap-4 ml-2 flex-shrink-0">
        <Tooltip text="Создать новый документ — договор, доп. соглашение и т.д. Начните с выбора компании и контрагента" position="bottom">
          <Link
            href="/contracts/new"
            data-tour="new-doc-btn"
            className="bg-gray-900 text-white px-2 py-2 md:px-4 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-700 transition-colors whitespace-nowrap"
          >
            <span className="hidden md:inline">+ Новый документ</span>
            <span className="md:hidden">+ Новый</span>
          </Link>
        </Tooltip>
        <Tooltip text="Дашборды: список всех договоров компании, статусы, юридический и финансовый обзор" position="bottom">
          <Link
            href="/dashboard"
            className="text-xs md:text-sm text-gray-600 border border-gray-200 px-2 py-2 md:px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            <span className="hidden md:inline">🖥️ Рабочий стол</span>
            <span className="md:hidden">🖥️</span>
          </Link>
        </Tooltip>
        <Tooltip text="Реестр контрагентов — российские и иностранные компании, физлица, с проверкой надёжности" position="bottom">
          <Link
            href="/counterparties"
            className="text-xs md:text-sm text-gray-600 border border-gray-200 px-2 py-2 md:px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            <span className="hidden md:inline">🏢 Контрагенты</span>
            <span className="md:hidden">🏢</span>
          </Link>
        </Tooltip>

        {/* Профиль пользователя */}
        <Tooltip text="Инструкция по работе с системой, частые вопросы и чат с ЭПОТОС-Ассистентом" position="bottom">
          <Link href="/help"
            className="relative text-xs text-gray-500 border border-gray-200 px-2 py-2 md:px-3 md:py-1.5 rounded-lg hover:bg-gray-50">
            ❓
            <span className="hidden md:inline"> Помощь</span>
            {helpUnread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
              {helpUnread}
            </span>
          )}
        </Link>
        </Tooltip>
        {!loading && user && [30, 1148].includes(parseInt(user.id)) && (
          <Link href="/admin"
            className="hidden md:block text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            Настройки
          </Link>
        )}
        {!loading && (
          <div className="flex items-center gap-1 md:gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs md:text-sm font-medium">
                    {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="hidden md:block text-right">
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