import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import * as jwt from 'jsonwebtoken'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL ?? 'https://office.epotos-port.ru'
const JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET ?? 'epotos_office_secret_2026'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { version_id, attachment_id, user_name, user_id, mode } = body

    if (!version_id && !attachment_id) {
      return NextResponse.json({ error: 'version_id или attachment_id обязателен' }, { status: 400 })
    }

    let fileName: string
    let fileExt: string | undefined
    let recordId: string
    let fileApiUrl: string

    if (version_id) {
      const { data: version } = await supabase
        .from('versions')
        .select('*, contracts(id, title, number)')
        .eq('id', version_id)
        .single()

      if (!version) {
        return NextResponse.json({ error: 'Версия не найдена' }, { status: 404 })
      }

      fileName = version.file_name
      fileExt = fileName.split('.').pop()?.toLowerCase()
      recordId = version_id
      fileApiUrl = `https://epotos-ur-intel.vercel.app/api/onlyoffice/file?version_id=${version_id}`
    } else {
      const { data: attachment } = await supabase
        .from('document_attachments')
        .select('*')
        .eq('id', attachment_id)
        .single()

      if (!attachment) {
        return NextResponse.json({ error: 'Вложение не найдено' }, { status: 404 })
      }

      fileName = attachment.file_name
      fileExt = fileName.split('.').pop()?.toLowerCase()
      recordId = attachment_id
      fileApiUrl = `https://epotos-ur-intel.vercel.app/api/onlyoffice/file?attachment_id=${attachment_id}`
    }

    // Определяем тип документа для OnlyOffice
    const docType = fileExt === 'xlsx' || fileExt === 'xls' ? 'cell' :
                    fileExt === 'docx' || fileExt === 'doc' ? 'word' : 'word'

    const documentKey = `${recordId}_${Date.now()}`

    // Конфигурация OnlyOffice
    const config = {
      document: {
        fileType: fileExt,
        key: documentKey,
        title: fileName,
        url: fileApiUrl,
        permissions: {
          edit: mode !== 'view',
          download: true,
          print: true,
          review: true,
        },
      },
      documentType: docType,
      editorConfig: {
        mode: mode === 'view' ? 'view' : 'edit',
        lang: 'ru',
        user: {
          id: String(user_id ?? 'guest'),
          name: user_name ?? 'Пользователь',
        },
        customization: {
          autosave: true,
          forcesave: true,
          compactHeader: true,
          toolbarNoTabs: false,
          hideRightMenu: false,
        },
        callbackUrl: version_id
          ? `https://epotos-ur-intel.vercel.app/api/onlyoffice/callback?version_id=${version_id}`
          : `https://epotos-ur-intel.vercel.app/api/onlyoffice/callback?attachment_id=${attachment_id}`,
      },
    }

    // Подписываем JWT
    const token = jwt.sign(config, JWT_SECRET, { algorithm: 'HS256' })

    console.log('OnlyOffice config:', JSON.stringify(config))
    console.log('JWT token:', token)

    return NextResponse.json({
      config,
      token,
      onlyofficeUrl: ONLYOFFICE_URL,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}