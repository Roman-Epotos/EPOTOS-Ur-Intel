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
  const [needManualAuth, setNeedManualAuth] = useState(false)

  useEffect(() => {
    let postMessageTimer: ReturnType<typeof setTimeout> | null = null

    const verifyAndSetUser = async (authId: string, refreshId: string, domain: string, memberId: string) => {
      const formData = new FormData()
      formData.append('AUTH_ID', authId)
      formData.append('REFRESH_ID', refreshId)
      formData.append('DOMAIN', domain)
      formData.append('member_id', memberId)

      const response = await fetch('/api/bitrix/callback', { method: 'POST', body: formData })
      const data = await response.json()

      if (data.success) {
        const userToStore = { ...data.user, auth_id: authId, member_id: memberId }
        setUser(data.user)
        sessionStorage.setItem('bitrix_user', JSON.stringify(userToStore))
        return true
      }
      return false
    }

    const authenticate = async () => {
      try {
        // 1. Проверяем параметры в URL (десктоп Б24)
        const params = new URLSearchParams(window.location.search)
        const authId = params.get('auth_id')
        const refreshId = params.get('refresh_id')
        const domain = params.get('domain')
        const memberId = params.get('member_id')

        if (authId && domain && memberId) {
          const ok = await verifyAndSetUser(authId, refreshId ?? '', domain, memberId)
          if (ok) {
            const contractId = params.get('contract_id')
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
              setLoading(false)
              return
            } else {
              sessionStorage.removeItem('bitrix_user')
            }
          } else if (storedUser.auth_id === undefined && storedUser.id) {
            // Старая запись без auth_id — удаляем, требуем переавторизацию
            sessionStorage.removeItem('bitrix_user')
          }
        }

        // 3. Ждём postMessage от мобильного Б24 (3 секунды)
        postMessageTimer = setTimeout(() => {
          // postMessage не пришёл — требуем ручной вход
          setNeedManualAuth(true)
          setLoading(false)
        }, 3000)

        const handleMessage = async (event: MessageEvent) => {
          // Принимаем только от доверенных источников
          if (!event.origin.includes('bitrix24.ru') && !event.origin.includes('b24')) return

          const msg = event.data
          if (!msg || typeof msg !== 'object') return

          // Мобильный Б24 передаёт AUTH_ID, REFRESH_ID, DOMAIN, member_id
          const mAuthId = msg.AUTH_ID ?? msg.auth_id
          const mRefreshId = msg.REFRESH_ID ?? msg.refresh_id ?? ''
          const mDomain = msg.DOMAIN ?? msg.domain
          const mMemberId = msg.member_id ?? msg.MEMBER_ID

          if (mAuthId && mDomain && mMemberId) {
            if (postMessageTimer) clearTimeout(postMessageTimer)
            const ok = await verifyAndSetUser(mAuthId, mRefreshId, mDomain, mMemberId)
            if (!ok) {
              setNeedManualAuth(true)
            }
            setLoading(false)
            window.removeEventListener('message', handleMessage)
          }
        }

        window.addEventListener('message', handleMessage)

      } catch (err) {
        console.error('Bitrix auth error:', err)
        setLoading(false)
      }
    }

    authenticate()

    return () => {
      if (postMessageTimer) clearTimeout(postMessageTimer)
    }
  }, [])

  

  const logout = () => {
    sessionStorage.removeItem('bitrix_user')
    setUser(null)
    setNeedManualAuth(false)
    if (window.BX24?.setTitle) window.BX24.setTitle(0)
  }

  return { user, loading, logout, needManualAuth }
}