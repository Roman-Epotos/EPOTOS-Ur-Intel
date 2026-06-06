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

// Объявляем тип для BX24 SDK
declare global {
  interface Window {
    BX24?: {
      setTitle: (count: number) => void
      init: (callback: () => void) => void
    }
  }
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
            sessionStorage.setItem('bitrix_user', JSON.stringify(data.user))

            

            // Если есть contract_id — редиректим на документ, иначе на главную
            const contractId = params.get('contract_id')
            if (contractId) {
              window.location.replace(`/contracts/${contractId}`)
            } else {
              window.history.replaceState({}, '', '/')
            }
          }
        } else {
          // Проверяем sessionStorage
          const stored = sessionStorage.getItem('bitrix_user')
          if (stored) {
            const storedUser = JSON.parse(stored)
            setUser(storedUser)
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
    if (window.BX24?.setTitle) window.BX24.setTitle(0)
  }

  return { user, loading, logout }
}