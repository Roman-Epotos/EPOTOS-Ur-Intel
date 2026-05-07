'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

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
    document.title = 'Эпотос-ЮрИнтел — Редактор'

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
          setLoading(false)
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
            type: 'desktop',
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
      <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100vh'}}>
        <div style={{textAlign:'center'}}>
          <p style={{color:'red', fontWeight:500}}>Ошибка</p>
          <p style={{color:'gray', fontSize:14, marginTop:4}}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{position:'fixed', top:0, left:0, width:'100vw', height:'100vh', overflow:'hidden'}}>
      {loading && (
        <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100vh'}}>
          <p style={{color:'gray', fontSize:14}}>Загрузка редактора...</p>
        </div>
      )}
      <div id="onlyoffice-editor" style={{width:'100%', height:'100%'}} />
    </div>
  )
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100vh'}}>
        <p style={{color:'gray', fontSize:14}}>Загрузка...</p>
      </div>
    }>
      <EditorContent />
    </Suspense>
  )
}