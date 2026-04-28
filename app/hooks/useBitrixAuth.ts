'use client'

import { useState, useEffect } from 'react'

export interface BitrixUser {
  id: string
  name: string
  email: string
  avatar: string | null
  auth_id: string
  refresh_id: string
  domain: string
  member_id: string
}

export function useBitrixAuth() {
  const [user, setUser] = useState<BitrixUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const authenticate = async () => {
      try {
        // Проверяем параметры в URL (от Битрикс24)
        const params = new URLSearchParams(window.location.search)
        const authId = params.get('auth_id')
        const refreshId = params.get('refresh_id')
        const domain = params.get('domain')
        const memberId = params.get('member_id')

        if (authId && domain && memberId) {
          // Отправляем данные на сервер для верификации
          const formData = new FormData()
          formData.append('AUTH_ID', authId)
          formData.append('REFRESH_ID', refreshId ?? '')
          formData.append('DOMAIN', domain)
          formData.append('member_id', memberId)

          const response = await fetch('/api/bitrix/callback', {
            method: 'POST',
            body: formData,
          })

          const data = await response.json()

          if (data.success) {
            setUser(data.user)
            // Сохраняем в sessionStorage
            sessionStorage.setItem('bitrix_user', JSON.stringify(data.user))
            // Убираем параметры из URL
            window.history.replaceState({}, '', '/')
          }
        } else {
          // Проверяем sessionStorage
          const stored = sessionStorage.getItem('bitrix_user')
          if (stored) {
            setUser(JSON.parse(stored))
          }
        }
      } catch (err) {
        console.error('Bitrix auth error:', err)
      } finally {
        setLoading(false)
      }
    }

    authenticate()
  }, [])

  const logout = () => {
    sessionStorage.removeItem('bitrix_user')
    setUser(null)
  }

  return { user, loading, logout }
}