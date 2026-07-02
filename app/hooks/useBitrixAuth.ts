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
        // 1. Проверяем параметры в URL (от Битрикс24)
        const params = new URLSearchParams(window.location.search)
        const authId = params.get('auth_id')
        const refreshId = params.get('refresh_id')
        const domain = params.get('domain')
        const memberId = params.get('member_id')

        // Сохраняем contract_id из URL ДО авторизации
        const contractIdFromUrl = params.get('contract_id')
        console.log('[BX24 Auth] URL:', window.location.href)
        console.log('[BX24 Auth] contract_id from URL:', contractIdFromUrl)
        console.log('[BX24 Auth] all params:', window.location.search)
        if (contractIdFromUrl) {
          sessionStorage.setItem('pending_contract_id', contractIdFromUrl)
        }

        if (authId && domain && memberId) {
          const formData = new FormData()
          formData.append('AUTH_ID', authId)
          formData.append('REFRESH_ID', refreshId ?? '')
          formData.append('DOMAIN', domain)
          formData.append('member_id', memberId)

          const response = await fetch('/api/bitrix/callback', { method: 'POST', body: formData })
          const data = await response.json()

          if (data.success) {
            setUser(data.user)
            sessionStorage.setItem('bitrix_user', JSON.stringify({
              ...data.user,
              auth_id: authId,
              member_id: memberId,
            }))
            const contractId = params.get('contract_id')
              ?? sessionStorage.getItem('pending_contract_id')
            sessionStorage.removeItem('pending_contract_id')
            if (contractId) {
              window.location.replace(`/contracts/${contractId}`)
            } else {
              window.history.replaceState({}, '', '/')
            }
          }
          setLoading(false)
          return
        }

        // 2. Проверяем sessionStorage
        const stored = sessionStorage.getItem('bitrix_user')
        if (stored) {
          const storedUser = JSON.parse(stored)
          if (storedUser.auth_id && storedUser.member_id) {
            const verifyRes = await fetch('/api/bitrix/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                auth_id: storedUser.auth_id,
                member_id: storedUser.member_id,
                user_id: storedUser.id,
              }),
            })
            const verifyData = await verifyRes.json()
            if (verifyData.valid) {
              setUser(storedUser)
              // Если в URL есть contract_id — редиректим на карточку
              const contractId = params.get('contract_id')
              if (contractId && !window.location.pathname.startsWith('/contracts/')) {
                window.location.replace(`/contracts/${contractId}`)
                return
              }
            } else {
              sessionStorage.removeItem('bitrix_user')
              window.location.reload()
            }
          } else {
            // Нет auth_id — мобильный Б24, разрешаем
            setUser(storedUser)
            // Если в URL есть contract_id — редиректим на карточку
            const contractId = params.get('contract_id')
            if (contractId && !window.location.pathname.startsWith('/contracts/')) {
              window.location.replace(`/contracts/${contractId}`)
              return
            }
          }
        } else {
          // Нет ни URL параметров ни sessionStorage — редиректим в Б24
          if (window.self === window.top) {
            // Открыт не в iframe — прямая ссылка без авторизации
            window.location.replace('https://gkepotos.bitrix24.ru/marketplace/app/252/')
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