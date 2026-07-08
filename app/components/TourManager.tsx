'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { driver, Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { TOURS } from '@/app/lib/tours'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

const STORAGE_KEY = 'epotos_active_tour'

interface ActiveTourState {
  tourId: string
  stepIndex: number
}

// advanceOnRouteChange: true — для шагов, где переход на следующий шаг
// происходит НЕ по клику на подсвеченный элемент (например — отправка
// формы, после которой открывается страница с заранее неизвестным ID).
// Как только пользователь уходит со route этого шага — считаем шаг
// пройденным и сразу переключаемся на следующий.

export function startTour(tourId: string) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tourId, stepIndex: 0 }))
  window.dispatchEvent(new Event('epotos-tour-updated'))
}

function getState(): ActiveTourState | null {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

function saveState(state: ActiveTourState | null) {
  if (state) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  else sessionStorage.removeItem(STORAGE_KEY)
}

// route вида '/contracts/*' означает "любая страница, начинающаяся с /contracts/"
function matchesRoute(stepRoute: string, currentPath: string): boolean {
  if (stepRoute === currentPath) return true
  if (stepRoute.endsWith('/*')) return currentPath.startsWith(stepRoute.slice(0, -2))
  return false
}

function waitForElement(selector: string, timeout = 4000): Promise<Element | null> {
  return new Promise(resolve => {
    const found = document.querySelector(selector)
    if (found) { resolve(found); return }
    const start = Date.now()
    const interval = setInterval(() => {
      const el = document.querySelector(selector)
      if (el || Date.now() - start > timeout) {
        clearInterval(interval)
        resolve(el)
      }
    }, 100)
  })
}



export default function TourManager() {
  const router = useRouter()
  const pathname = usePathname()
  const { loading: authLoading } = useBitrixAuth()
  const driverRef = useRef<Driver | null>(null)
  const isNavigatingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let cleanupClick: (() => void) | null = null

    const runStep = async () => {
      const state = getState()
      if (!state) return

      const tour = TOURS.find(t => t.id === state.tourId)
      if (!tour) { saveState(null); return }

      let stepIndex = state.stepIndex
      let step = tour.steps[stepIndex]
      if (!step) { saveState(null); return }

      // Шаг завершается сменой страницы на заранее неизвестный URL
      // (например, отправка формы) — если мы уже ушли с его route,
      // считаем шаг пройденным и сразу берём следующий
      if (step.advanceOnRouteChange && !matchesRoute(step.route, pathname)) {
        const next = tour.steps[stepIndex + 1]
        if (!next) { saveState(null); return }
        stepIndex += 1
        step = next
        saveState({ tourId: state.tourId, stepIndex })
      }

      // Этот шаг относится к другой странице — ждём, пока туда перейдут
      if (!matchesRoute(step.route, pathname)) return

      // Пока не разрешилась проверка авторизации/роли — не ищем элемент
      // вообще: именно от неё зависит, появится ли доп. кнопка в шапке
      // (например, «Настройки» у админа), а значит и итоговая вёрстка
      if (authLoading) return

      const el = await waitForElement(step.selector)
      if (cancelled || !el) return

      const isLast = stepIndex === tour.steps.length - 1

      // Клик по САМОМУ подсвеченному элементу продвигает тур дальше —
      // элемент при этом выполняет и свою обычную работу (переход по
      // ссылке, переключение вкладки, отправка формы)
      const handleElementClick = () => {
        isNavigatingRef.current = true
        if (isLast) {
          saveState(null)
        } else {
          saveState({ tourId: state.tourId, stepIndex: stepIndex + 1 })
        }
        driverRef.current?.destroy()
        window.dispatchEvent(new Event('epotos-tour-updated'))
        isNavigatingRef.current = false
      }
      el.addEventListener('click', handleElementClick, { once: true })

      // Страница могла ещё не закончить асинхронную подгрузку контента
      // (виджеты «Мои документы»/статистика) в момент запуска подсветки —
      // из-за этого вёрстка сдвигается уже ПОСЛЕ того, как driver.js
      // вычислил позицию. Следим за изменением размеров и пересчитываем.
      const resizeObserver = new ResizeObserver(() => {
        driverRef.current?.refresh()
      })
      resizeObserver.observe(document.body)

      cleanupClick = () => {
        el.removeEventListener('click', handleElementClick)
        resizeObserver.disconnect()
      }

      driverRef.current?.destroy()
      driverRef.current = driver({
        onDestroyStarted: () => {
          if (!isNavigatingRef.current) {
            saveState(null)
            driverRef.current?.destroy()
          }
        },
        onCloseClick: () => {
          saveState(null)
          driverRef.current?.destroy()
        },
        steps: [{
          element: step.selector,
          popover: {
            title: step.title,
            description: step.description,
            side: step.popoverSide ?? 'bottom',
            showButtons: ['close'],
          },
        }],
      })
      driverRef.current.drive()
    }

    runStep()

    const handler = () => runStep()
    window.addEventListener('epotos-tour-updated', handler)

    return () => {
      cancelled = true
      cleanupClick?.()
      window.removeEventListener('epotos-tour-updated', handler)
    }
  }, [pathname, authLoading])

  return null
}