'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

const RELOAD_GUARD_KEY = 'bitrix_reload_attempted_at'
const RELOAD_COOLDOWN_MS = 15000

function shouldAllowReload(): boolean {
  const last = sessionStorage.getItem(RELOAD_GUARD_KEY)
  if (last && Date.now() - parseInt(last) < RELOAD_COOLDOWN_MS) {
    return false
  }
  sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  return true
}

export function useBitrixAuth() {
  const router = useRouter()
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
            const freshUser = JSON.stringify({
              ...data.user,
              auth_id: authId,
              member_id: memberId,
            })
            sessionStorage.setItem('bitrix_user', freshUser)
            localStorage.setItem('bitrix_user', freshUser)
            let contractId = params.get('contract_id')
              ?? sessionStorage.getItem('pending_contract_id')
            sessionStorage.removeItem('pending_contract_id')

            // Сценарий B: contract_id обрезан Битриксом, sessionStorage
            // партиционирован. Спрашиваем мост: cookie-id долетит сам,
            // member_id даём как резерв/доп.проверку.
            if (!contractId) {
              try {
                const dlRes = await fetch(
                  `/api/deep-link?member_id=${encodeURIComponent(memberId)}`,
                  { method: 'GET', credentials: 'include' }
                )
                const dlData = await dlRes.json()
                if (dlData.contract_id) contractId = dlData.contract_id
              } catch (e) {
                console.error('[BX24 Auth] deep-link GET failed', e)
              }
            }

            if (contractId) {
              router.replace(`/contracts/${contractId}`)
            }
            // Сброс URL на главную убран: при нескольких параллельных
            // копиях хука (нет единого провайдера) одна копия может найти
            // contract_id и успешно перейти на карточку, а другая, придя
            // чуть позже с пустыми руками, перетирала бы её адрес обратно
            // на "/". Цена — в адресной строке иногда останутся служебные
            // auth_id/refresh_id при обычном заходе на главную; это не
            // ломает работу, просто не самый чистый URL.
          }
          setLoading(false)
          return
        }

        // 2. Проверяем sessionStorage
        const stored = sessionStorage.getItem('bitrix_user') ?? localStorage.getItem('bitrix_user')
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
                router.replace(`/contracts/${contractId}`)
                return
              }
            } else if (storedUser.refresh_id) {
              // Токен протух — пробуем тихо обновить через refresh_id, без сброса страницы
              try {
                const refreshRes = await fetch('/api/bitrix/refresh', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refresh_id: storedUser.refresh_id }),
                })
                const refreshData = await refreshRes.json()
                if (refreshData.success) {
                  const updatedUser = {
                    ...storedUser,
                    auth_id: refreshData.auth_id,
                    refresh_id: refreshData.refresh_id,
                  }
                  sessionStorage.setItem('bitrix_user', JSON.stringify(updatedUser))
                  localStorage.setItem('bitrix_user', JSON.stringify(updatedUser))
                  setUser(updatedUser)
                } else {
                  sessionStorage.removeItem('bitrix_user'); localStorage.removeItem('bitrix_user')
                  if (shouldAllowReload()) window.location.reload()
                }
              } catch {
                sessionStorage.removeItem('bitrix_user'); localStorage.removeItem('bitrix_user')
                if (shouldAllowReload()) window.location.reload()
              }
            } else {
              sessionStorage.removeItem('bitrix_user'); localStorage.removeItem('bitrix_user')
              if (shouldAllowReload()) window.location.reload()
            }
          } else {
            // Нет auth_id — мобильный Б24, разрешаем
            setUser(storedUser)
            // Если в URL есть contract_id — редиректим на карточку
            const contractId = params.get('contract_id')
            if (contractId && !window.location.pathname.startsWith('/contracts/')) {
              router.replace(`/contracts/${contractId}`)
              return
            }
          }
        } else {
          // Нет ни URL параметров ни sessionStorage — редиректим в Б24
          if (window.self === window.top) {
            // Открыт не в iframe — прямая ссылка без авторизации.
            // Если это карточка конкретного документа — берём id из адреса
            // и передаём дальше, чтобы после входа через Битрикс вернуться
            // на тот же документ, а не потерять контекст.
            const pathMatch = window.location.pathname.match(/^\/contracts\/([^/]+)/)
            const returnContractId = pathMatch ? pathMatch[1] : null
            if (returnContractId) {
              // Оставляем как было — не мешает, вдруг та же вкладка вернётся.
              sessionStorage.setItem('pending_contract_id', returnContractId)

              // Мост через Supabase: id генерим здесь, ДО ухода в Битрикс.
              const deepLinkId = crypto.randomUUID()
              const knownMember =
                (JSON.parse(sessionStorage.getItem('bitrix_user') ?? 'null')?.member_id) ??
                (JSON.parse(localStorage.getItem('bitrix_user') ?? 'null')?.member_id) ??
                ''

              try {
                await fetch('/api/deep-link', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: deepLinkId, member_id: knownMember, contract_id: returnContractId }),
                })
              } catch (e) {
                console.error('[BX24 Auth] deep-link POST failed', e)
              }
            }
            window.location.replace(
              returnContractId
                ? `https://gkepotos.bitrix24.ru/marketplace/app/252/?contract_id=${returnContractId}`
                : 'https://gkepotos.bitrix24.ru/marketplace/app/252/'
            )
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
    sessionStorage.removeItem('bitrix_user'); localStorage.removeItem('bitrix_user')
    setUser(null)
    if (window.BX24?.setTitle) window.BX24.setTitle(0)
  }

  return { user, loading, logout }
}