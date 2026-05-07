'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useBitrixAuth } from '@/app/hooks/useBitrixAuth'

declare global {
  interface Window {
    DocsAPI: {
      DocEditor: new (elementId: string, config: object) => void
    }
  }
}

function EditorContent() {
  const searchParams = useSearchParams()
  const version_id = searchParams.get('version_id')
  const mode = searchParams.get('mode') ?? 'edit'
  const user_id = searchParams.get('user_id') ?? ''
  const user_name = searchParams.get('user_name') ?? 'Пользователь'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const baseUrl = 'https://epotos-ur-intel.vercel.app'
  const onlyofficeUrl = 'https://office.epotos-port.ru'

  useEffect(() => {
    console.log('Editor init:', { version_id, user_name })
    if (!version_id) return

    const initEditor = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/onlyoffice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version_id,
            user_name,
            user_id,
            mode,
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          setError(data.error)
          return
        }

        const script = document.createElement('script')
        script.src = `${onlyofficeUrl}/web-apps/apps/api/documents/api.js`
        script.onload = () => {
          setLoading(false)
          new window.DocsAPI.DocEditor('onlyoffice-editor', {
            ...data.config,
            token: data.token,
            height: '100%',
            width: '100%',
          })
        }
        script.onerror = () => {
          setError('Не удалось загрузить редактор OnlyOffice')
          setLoading(false)
        }
        document.head.appendChild(script)
      } catch {
        setError('Ошибка подключения к редактору')
        setLoading(false)
      }
    }

    initEditor()
  }, [version_id])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-medium">Ошибка</p>
          <p className="text-gray-500 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {loading && (
        <div className="flex items-center justify-center h-screen">
          <p className="text-gray-500 text-sm">Загрузка редактора...</p>
        </div>
      )}
      <div id="onlyoffice-editor" className="flex-1 w-full h-screen" />
    </div>
  )
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Загрузка...</p>
      </div>
    }>
      <EditorContent />
    </Suspense>
  )
}